import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { PublicSupabaseConfig } from "./supabase-config";

let singleton:SupabaseClient|undefined;
let singletonConfig="";

export function browserSupabase(config:PublicSupabaseConfig){
  if(typeof window==="undefined")throw new Error("The sign-in client runs in the browser only.");
  const signature=config.url+"|"+config.publishableKey;
  if(!singleton||singletonConfig!==signature){
    singleton=createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:"catering-desk-auth-"+new URL(config.url).hostname}});
    singletonConfig=signature;
  }
  return singleton;
}
