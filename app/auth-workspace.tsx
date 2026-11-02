"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CookingPot, LoaderCircle, RefreshCw } from "lucide-react";
import { browserSupabase } from "../lib/supabase-client";
import { type PublicSupabaseConfig } from "../lib/supabase-config";
import { changedAuth, initialAuthState, restoredAuth } from "../lib/auth-state";
import { supabaseWorkspaceRepository } from "../lib/workspace-repository";
import CateringApp from "./catering-app";
import SignIn from "./sign-in";

export default function AuthWorkspace(){
  const [client,setClient]=useState<SupabaseClient|null>(null);
  const [configPhase,setConfigPhase]=useState<"loading"|"ready"|"unconfigured"|"error">("loading");
  const [auth,setAuth]=useState(initialAuthState);
  const [restoreAttempt,setRestoreAttempt]=useState(0);
  const [configAttempt,setConfigAttempt]=useState(0);
  const [busy,setBusy]=useState(false);
  const busyRef=useRef(false);
  const [message,setMessage]=useState("");
  const [signOutError,setSignOutError]=useState("");

  useEffect(()=>{
    let active=true;const controller=new AbortController();
    setConfigPhase("loading");
    void fetch("/api/auth/config",{cache:"no-store",credentials:"same-origin",signal:controller.signal}).then(async response=>{
      if(!response.ok)throw new Error("Configuration unavailable");
      const body=await response.json() as {config:PublicSupabaseConfig|null};
      if(!active)return;
      if(!body.config){setConfigPhase("unconfigured");return;}
      setClient(browserSupabase(body.config));setConfigPhase("ready");
    }).catch(()=>{if(active)setConfigPhase("error");});
    return()=>{active=false;controller.abort();};
  },[configAttempt]);

  useEffect(()=>{
    if(!client)return;
    let active=true,version=0;setAuth(initialAuthState);
    // Keep this callback synchronous: token refresh must not wait on database work.
    const {data}=client.auth.onAuthStateChange((event,session)=>{
      if(!active)return;
      if(event!=="INITIAL_SESSION")version++;
      setAuth(previous=>changedAuth(previous,event,session));
    });
    const initialVersion=version;
    void client.auth.getSession().then(({data,error})=>{if(active&&version===initialVersion)setAuth(restoredAuth(data.session,error));}).catch(error=>{if(active&&version===initialVersion)setAuth(restoredAuth(null,error));});
    return()=>{active=false;data.subscription.unsubscribe();};
  },[client,restoreAttempt]);

  const userId=auth.session?.user.id;
  const repository=useMemo(()=>client&&userId?supabaseWorkspaceRepository(client,userId):undefined,[client,userId]);
  const signIn=useCallback(async(email:string,password:string)=>{
    if(!client||busyRef.current)return;
    busyRef.current=true;setBusy(true);setMessage("");
    try{
      const {data,error}=await client.auth.signInWithPassword({email,password});
      if(error){
        if(error.status===429)setMessage("Too many sign-in attempts. Please wait a little and try again.");
        else if(error.name==="AuthRetryableFetchError"||!navigator.onLine)setMessage("We couldn’t connect. Check your internet connection and try again.");
        else setMessage("We couldn’t sign you in. Check your email and password, or contact your administrator.");
      }else if(data.session)setAuth({phase:"signed-in",session:data.session,message:""});
      else setMessage("This account is not ready to sign in. Contact your administrator.");
    }catch{setMessage("We couldn’t connect. Check your internet connection and try again.");}
    finally{busyRef.current=false;setBusy(false);}
  },[client]);

  const signOut=useCallback(async()=>{
    if(!client||busyRef.current)return;
    busyRef.current=true;setBusy(true);setSignOutError("");
    try{const {error}=await client.auth.signOut({scope:"local"});if(error)throw error;setMessage("");setAuth({phase:"signed-out",session:null,message:""});}
    catch{setSignOutError("We couldn’t finish signing out. Check your connection and try again.");}
    finally{busyRef.current=false;setBusy(false);}
  },[client]);

  if(configPhase==="loading"||(configPhase==="ready"&&auth.phase==="loading"))return <SessionScreen loading/>;
  if(configPhase==="error")return <SessionScreen message="We couldn’t open the sign-in page. Check your connection and try again." retry={()=>setConfigAttempt(n=>n+1)}/>;
  if(auth.phase==="restore-error")return <SessionScreen message={auth.message} retry={()=>setRestoreAttempt(n=>n+1)}/>;
  if(configPhase==="ready"&&auth.phase==="signed-in"&&auth.session&&repository)return <><CateringApp key={auth.session.user.id} preview={false} repository={repository} accountEmail={auth.session.user.email??""} onSignOut={signOut} signingOut={busy}/>{signOutError&&<div className="auth-action-error" role="alert"><span>{signOutError}</span><button className="text-button" onClick={()=>void signOut()}>Try again</button></div>}</>;
  return <SignIn ready={configPhase==="ready"} busy={busy} message={message||auth.message} onSignIn={signIn}/>;
}

function SessionScreen({loading=false,message,retry}:{loading?:boolean;message?:string;retry?:()=>void}){
  return <main className="session-screen"><span className="brand-mark"><CookingPot size={27}/></span><h1>Catering Desk</h1>{loading?<><LoaderCircle size={22} className="spin"/><p role="status">Opening your workspace…</p></>:<><p role="alert">{message}</p><button className="button primary" onClick={retry}><RefreshCw size={16}/> Try again</button></>}</main>;
}
