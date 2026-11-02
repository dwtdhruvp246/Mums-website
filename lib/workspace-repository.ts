import type { SupabaseClient } from "@supabase/supabase-js";
import type { Workspace } from "./domain";
import { parseWorkspace } from "./workspace-validation";

export type VersionedWorkspace={workspace:Workspace;revision:number};
export type WorkspaceRepository={load:()=>Promise<VersionedWorkspace>;save:(workspace:Workspace,revision:number)=>Promise<VersionedWorkspace>};
const TABLE="catering_workspaces";
const COLUMNS="data,revision";

function readRow(row:{data:unknown;revision:unknown}):VersionedWorkspace{
  if(!Number.isSafeInteger(row.revision)||Number(row.revision)<0)throw new Error("This workspace could not be read. Contact your administrator.");
  return {workspace:parseWorkspace(row.data),revision:Number(row.revision)};
}
function queryError(error:{code?:string}){
  if(error.code==="42P01"||error.code==="PGRST205")return new Error("Workspace setup is not complete. Contact your administrator.");
  return new Error("Your workspace could not be saved or loaded. Check your connection and try again.");
}
export function supabaseWorkspaceRepository(client:SupabaseClient,userId:string):WorkspaceRepository{
  async function read(){
    const {data,error}=await client.from(TABLE).select(COLUMNS).eq("user_id",userId).maybeSingle();
    if(error)throw queryError(error);
    return data?readRow(data):null;
  }
  return {
    async load(){
      const existing=await read();if(existing)return existing;
      // The server supplies an empty workspace; no browser demo data is imported.
      const {data,error}=await client.from(TABLE).insert({user_id:userId}).select(COLUMNS).single();
      if(error){if(error.code==="23505"){const concurrent=await read();if(concurrent)return concurrent;}throw queryError(error);}
      return readRow(data);
    },
    async save(workspace,revision){
      const validated=parseWorkspace(workspace);
      const {data,error}=await client.from(TABLE).update({data:validated}).eq("user_id",userId).eq("revision",revision).select(COLUMNS).maybeSingle();
      if(error)throw queryError(error);
      if(!data)throw new Error("This workspace changed on another device. Close this form and refresh before saving again. Your latest changes have not been saved.");
      return readRow(data);
    }
  };
}
