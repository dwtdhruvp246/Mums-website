import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

export type AuthState={phase:"loading"|"signed-out"|"signed-in"|"restore-error";session:Session|null;message:string};
export const initialAuthState:AuthState={phase:"loading",session:null,message:""};

/** A network failure is a retryable restore state, never a request to sign out. */
export function restoredAuth(session:Session|null,error:unknown):AuthState{
  if(error)return {phase:"restore-error",session:null,message:"We couldn’t restore your sign-in. Check your connection and try again."};
  return session?{phase:"signed-in",session,message:""}:{phase:"signed-out",session:null,message:""};
}
export function changedAuth(previous:AuthState,event:AuthChangeEvent,session:Session|null):AuthState{
  if(event==="SIGNED_OUT")return {phase:"signed-out",session:null,message:previous.session?"Your session has ended. Please sign in again.":""};
  if(session)return {phase:"signed-in",session,message:""};
  // Restoration owns the initial null state; transient events must not erase an account.
  return previous;
}
