import { readFile,writeFile,mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import ts from 'typescript';

const root=fileURLToPath(new URL('../',import.meta.url));
const runtime=path.join(root,'.sites-runtime');
await mkdir(runtime,{recursive:true});
const validator=ts.transpileModule(await readFile(path.join(root,'lib/supabase-config.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const validatorPath=path.join(runtime,'pages-config-validator.mjs');
await writeFile(validatorPath,validator);
const {publicSupabaseConfig}=await import(pathToFileURL(validatorPath));
let config=publicSupabaseConfig(process.env);
if(!config){
  const input=await readConfig();
  config=publicSupabaseConfig({SUPABASE_URL:input.url,SUPABASE_PUBLISHABLE_KEY:input.publishableKey});
}
if(!config)throw new Error('A valid Supabase URL and public publishable/anon key are required. Privileged keys are rejected.');
const output=path.join(runtime,'github-pages');
await build({
  configFile:false,root:path.join(root,'web'),base:'./',publicDir:false,
  plugins:[react()],
  resolve:{alias:{'@':root}},
  define:{__CATERING_SUPABASE_CONFIG__:JSON.stringify(config)},
  build:{outDir:output,emptyOutDir:true,assetsDir:'pages-assets',sourcemap:false}
});
await writeFile(path.join(output,'.nojekyll'),'');
console.log(JSON.stringify({result:'PASS',output,projectHost:new URL(config.url).hostname,publicConfigOnly:true}));

async function readConfig(){
  process.stderr.write('Ready for public Supabase configuration JSON on stdin (input is hidden).\n');
  const terminal=process.stdin.isTTY;
  if(terminal)process.stdin.setRawMode(true);
  process.stdin.setEncoding('utf8');
  try{
    const input=await new Promise((resolve,reject)=>{
      let text='';
      const data=chunk=>{text+=chunk;if(text.length>20000){cleanup();reject(new Error('Configuration is too large.'));}else if(text.includes('\n')){cleanup();resolve(text.trim());}};
      const end=()=>{cleanup();resolve(text.trim());};
      const cleanup=()=>{process.stdin.removeListener('data',data);process.stdin.removeListener('end',end);process.stdin.pause();};
      process.stdin.on('data',data);process.stdin.once('end',end);
    });
    return JSON.parse(input);
  } finally {if(terminal)process.stdin.setRawMode(false);}
}
