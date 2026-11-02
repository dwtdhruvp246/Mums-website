import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import { createClient } from '@supabase/supabase-js';

// Local fixtures only. This script never contacts Supabase or creates real users.
const target=path.resolve('.sites-runtime/auth-verification');
await mkdir(target,{recursive:true});
let checks=0;
function check(value,label){assert.ok(value,label);checks++;}
async function rejects(action,pattern){await assert.rejects(action,pattern);checks++;}
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
let db;
const clients=[];
try {
  for(const name of ['domain','demo','supabase-config','supabase-client','auth-state','workspace-validation','workspace-repository']){
    let code=ts.transpileModule(await readFile('lib/'+name+'.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
    code=code.replace(/from "(\.\/[^"]+)"/g,(_,name)=>`from "${name}.mjs"`);
    await writeFile(path.join(target,name+'.mjs'),code);
  }
  const use=async name=>import(pathToFileURL(path.join(target,name+'.mjs')));
  const {emptyWorkspace}=await use('domain'),{sampleWorkspace}=await use('demo');
  const {publicSupabaseConfig}=await use('supabase-config');
  const {parseWorkspace}=await use('workspace-validation');
  const {initialAuthState,restoredAuth,changedAuth}=await use('auth-state');
  const {supabaseWorkspaceRepository}=await use('workspace-repository');
  const url='https://fixture.supabase.co',key='sb_publishable_local_fixture';
  check(publicSupabaseConfig({})===null,'Missing configuration fails closed');
  check(publicSupabaseConfig({SUPABASE_URL:url,SUPABASE_PUBLISHABLE_KEY:key}).publishableKey===key,'Public key accepted');
  for(const invalidUrl of ['http://fixture.supabase.co','https://user:pass@fixture.supabase.co','https://fixture.supabase.co/path','https://fixture.supabase.co/?key=secret'])
    check(publicSupabaseConfig({SUPABASE_URL:invalidUrl,SUPABASE_PUBLISHABLE_KEY:key})===null,'Unsafe URL rejected');
  const jwt=payload=>Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify(payload)).toString('base64url')+'.local-fixture';
  check(publicSupabaseConfig({SUPABASE_URL:url,SUPABASE_ANON_KEY:jwt({role:'anon'})})!==null,'Legacy anon key accepted');
  for(const unsafeKey of ['sb_secret_fixture',jwt({role:'service_role'}),'not-a-key'])
    check(publicSupabaseConfig({SUPABASE_URL:url,SUPABASE_PUBLISHABLE_KEY:unsafeKey})===null,'Privileged/malformed keys never reach browser config');
  check(publicSupabaseConfig({SUPABASE_URL:url,SUPABASE_SECRET_KEY:'sb_secret_fixture'})===null,'Secret environment entry is never selected');
  check(parseWorkspace(emptyWorkspace()).orders.length===0,'Empty real workspace is valid');
  check(parseWorkspace(sampleWorkspace()).orders.length>0,'Current order/variation model round-trips');
  for(const corrupt of [null,{}, {...emptyWorkspace(),customers:[{}]},(()=>{const w=sampleWorkspace();w.orders[0].totalCents++;return w;})(),(()=>{const w=sampleWorkspace();w.customers.push(w.customers[0]);return w;})()]){
    assert.throws(()=>parseWorkspace(corrupt),/not been replaced/);checks++;
  }

  const user=id=>({id,aud:'authenticated',role:'authenticated',email:id===A?'a@example.test':'b@example.test',app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:'2026-01-01T00:00:00Z'});
  const session=(id,seconds=3600)=>({access_token:jwt({sub:id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+seconds}),refresh_token:'fixture-refresh-'+id,token_type:'bearer',expires_in:seconds,expires_at:Math.floor(Date.now()/1000)+seconds,user:user(id)});
  const signedIn=restoredAuth(session(A),null);
  check(changedAuth(signedIn,'TOKEN_REFRESHED',null)===signedIn,'Transient null refresh does not clear account');
  check(changedAuth(signedIn,'INITIAL_SESSION',null)===signedIn,'Late initial null does not clear account');
  check(restoredAuth(null,new Error('offline')).phase==='restore-error','Connection failure is recoverable, not signed out');
  check(changedAuth(initialAuthState,'SIGNED_IN',session(B)).session.user.id===B,'Account identity comes from verified session');
  check(changedAuth(signedIn,'SIGNED_OUT',null).session===null,'Explicit session end clears account');

  // Exercise actual SDK persistence, password sign-in and expired-token refresh.
  const memory=new Map(),requests=[];
  const storage={getItem:name=>memory.get(name)??null,setItem:(name,value)=>memory.set(name,value),removeItem:name=>memory.delete(name)};
  const authFetch=async(input,init={})=>{
    const endpoint=new URL(typeof input==='string'?input:input.url);requests.push(endpoint.pathname+endpoint.search);
    if(endpoint.pathname==='/auth/v1/token'&&['password','refresh_token'].includes(endpoint.searchParams.get('grant_type')))
      return new Response(JSON.stringify(session(A)),{status:200,headers:{'Content-Type':'application/json'}});
    if(endpoint.pathname==='/auth/v1/user')return new Response(JSON.stringify(user(A)),{status:200,headers:{'Content-Type':'application/json'}});
    if(endpoint.pathname==='/auth/v1/logout')return new Response('{}',{status:200});
    throw new Error('Unexpected fixture request: '+endpoint.pathname);
  };
  const client=()=>{const c=createClient(url,key,{global:{fetch:authFetch},auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storage,storageKey:'fixture-auth'}});clients.push(c);return c;};
  const first=client();
  const login=await first.auth.signInWithPassword({email:'a@example.test',password:'local-fixture-password'});
  check(!login.error&&login.data.session.user.id===A,'SDK password sign-in accepts administrator account fixture');
  check(memory.has('fixture-auth'),'Session survives in persistent storage');
  await first.auth.stopAutoRefresh();
  const reopened=client();
  const restored=await reopened.auth.getSession();
  check(!restored.error&&restored.data.session.user.id===A,'Reload restores the same account without password');
  await reopened.auth.stopAutoRefresh();
  memory.set('fixture-auth',JSON.stringify(session(A,-120)));
  const returned=client();
  const refreshed=await returned.auth.getSession();
  check(!refreshed.error&&refreshed.data.session.user.id===A,'Expired access token refreshes after inactivity');
  check(requests.some(r=>r.includes('grant_type=refresh_token')),'Recovery uses refresh token');
  check(requests.every(r=>!r.includes('signup')),'No sign-up API called');
  await returned.auth.signOut({scope:'local'});
  check(!memory.has('fixture-auth'),'Manual sign-out removes stored sign-in');

  // Exercise the real repository with actual Supabase/PostgREST request construction.
  let rows=[],restCalls=[],failRead=false,corruptRead=false;
  const restClient=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input,init={})=>{
    const endpoint=new URL(typeof input==='string'?input:input.url),method=init.method??'GET';
    const body=init.body?JSON.parse(init.body):undefined;
    restCalls.push({endpoint,method,body});
    assert.equal(endpoint.pathname,'/rest/v1/catering_workspaces');
    const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
    if(method==='GET'){
      if(failRead)return response({code:'42P01',message:'fixture'},404);
      if(corruptRead)return response([{data:{},revision:0}]);
      return response(rows.filter(r=>'eq.'+r.user_id===endpoint.searchParams.get('user_id')).map(({data,revision})=>({data,revision})));
    }
    if(method==='POST'){
      assert.deepEqual(Object.keys(body),['user_id']);
      const row={user_id:body.user_id,data:emptyWorkspace(),revision:0};rows.push(row);return response({data:row.data,revision:0},201);
    }
    if(method==='PATCH'){
      const row=rows.find(r=>'eq.'+r.user_id===endpoint.searchParams.get('user_id')&&'eq.'+r.revision===endpoint.searchParams.get('revision'));
      if(!row)return response([]);
      row.data=body.data;row.revision++;return response([{data:row.data,revision:row.revision}]);
    }
    throw new Error('Unexpected workspace request');
  }}});clients.push(restClient);
  const repoA=supabaseWorkspaceRepository(restClient,A),repoB=supabaseWorkspaceRepository(restClient,B);
  const wa=await repoA.load();check(wa.workspace.orders.length===0&&wa.revision===0,'New account starts empty');
  wa.workspace.settings.businessName='Account A kitchen';
  const saved=await repoA.save(wa.workspace,wa.revision);
  check(saved.revision===1,'Repository saves with revision');
  await rejects(()=>repoA.save(wa.workspace,0),/another device/);
  check((await repoB.load()).workspace.settings.businessName!=='Account A kitchen','Account B has separate stored workspace');
  check(restCalls.filter(c=>c.method==='GET'||c.method==='PATCH').every(c=>c.endpoint.searchParams.has('user_id')),'Every read/update filters account');
  check(restCalls.filter(c=>c.method==='PATCH').every(c=>c.endpoint.searchParams.has('revision')),'Every update guards revision');
  const before=rows.length;failRead=true;await rejects(()=>repoA.load(),/setup is not complete/);failRead=false;
  check(rows.length===before,'Failed load never creates/replaces records');
  corruptRead=true;await rejects(()=>repoA.load(),/not been replaced/);corruptRead=false;

  // Execute the shipped PostgreSQL migration and test RLS as non-owner roles.
  db=new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    insert into auth.users values('${A}'),('${B}');
    create function public.rls_auto_enable() returns event_trigger language plpgsql security definer set search_path='pg_catalog' as $$ begin return; end; $$;`);
  await db.exec(await readFile('supabase/migrations/20261102150707_private_workspaces.sql','utf8'));
  const helper=await db.query("select has_function_privilege('anon','public.rls_auto_enable()','EXECUTE') as anon, has_function_privilege('authenticated','public.rls_auto_enable()','EXECUTE') as authenticated");
  check(!helper.rows[0].anon&&!helper.rows[0].authenticated,'Automatic-RLS event helper has no public RPC access');
  const as=async id=>{await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`);};
  await as(A);
  const inserted=await db.query('insert into public.catering_workspaces(user_id) values($1) returning data,revision',[A]);
  check(inserted.rows[0].data.orders.length===0&&inserted.rows[0].revision===0,'Database supplies empty workspace');
  await rejects(()=>db.query('insert into public.catering_workspaces(user_id) values($1)',[B]),/row-level security/);
  const change=emptyWorkspace();change.settings.businessName='RLS account A';
  const update=await db.query('update public.catering_workspaces set data=$1 where user_id=$2 and revision=0 returning revision',[JSON.stringify(change),A]);
  check(update.rows[0].revision===1,'Database owns revision increment');
  check((await db.query('update public.catering_workspaces set data=$1 where user_id=$2 and revision=0 returning revision',[JSON.stringify(emptyWorkspace()),A])).rows.length===0,'Database rejects stale revision update');
  await rejects(()=>db.query('update public.catering_workspaces set revision=5'),/permission denied/);
  await rejects(()=>db.query('update public.catering_workspaces set user_id=$1',[B]),/permission denied/);
  await rejects(()=>db.query('delete from public.catering_workspaces'),/permission denied/);
  await as(B);
  check((await db.query('select * from public.catering_workspaces')).rows.length===0,'Account B cannot read A records');
  await db.query('insert into public.catering_workspaces(user_id) values($1)',[B]);
  check((await db.query('select * from public.catering_workspaces')).rows[0].data.settings.businessName!=='RLS account A','B has its own default records');
  check((await db.query('update public.catering_workspaces set data=$1 where user_id=$2 returning user_id',[JSON.stringify(emptyWorkspace()),A])).rows.length===0,'Account B cannot update A even with forged user id');
  await as(A);
  const own=await db.query('select user_id,data from public.catering_workspaces');
  check(own.rows.length===1&&own.rows[0].user_id===A&&own.rows[0].data.settings.businessName==='RLS account A','Returning to A recovers only A data');
  await as('');check((await db.query('select * from public.catering_workspaces')).rows.length===0,'Missing user identity sees no records');
  await db.exec('reset role; set role anon;');
  await rejects(()=>db.query('select * from public.catering_workspaces'),/permission denied/);
  await rejects(()=>db.query('insert into public.catering_workspaces(user_id) values($1)',[A]),/permission denied/);
  console.log(JSON.stringify({result:'PASS',checks,scope:'Actual PostgreSQL RLS migration, account isolation, revision conflicts, SDK session persistence/refresh, no signup, safe configuration and workspace recovery. Local fixtures only; hosted Supabase testing still required.'}));
} finally {
  for(const client of clients)await client.auth.stopAutoRefresh();
  if(db)await db.close();
  await rm(target,{recursive:true,force:true});
}
