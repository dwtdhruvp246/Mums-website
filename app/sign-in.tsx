"use client";
import { useState, type FormEvent } from "react";
import { ArrowRight, ClipboardList, CookingPot, Eye, EyeOff, Leaf, LoaderCircle, LockKeyhole, Mail, ShieldCheck } from "lucide-react";

export default function SignIn({ready,busy,message,onSignIn}:{ready:boolean;busy:boolean;message:string;onSignIn:(email:string,password:string)=>Promise<void>}){
  const [showPassword,setShowPassword]=useState(false);
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!ready||busy)return;await onSignIn(email.trim(),password);}
  return <main className="login-shell">
    <section className="login-story" aria-label="Catering Desk">
      <a href="/" className="login-brand"><span className="brand-mark"><CookingPot size={25}/></span><strong>Catering<span>Desk</span></strong></a>
      <div className="login-story-content"><span className="login-eyebrow">A LITTLE ORDER FOR YOUR KITCHEN</span><h1>Good food.<br/> Smooth days.</h1><p>Your orders, customers and kitchen preparation, together in one place.</p><div className="login-illustration" aria-hidden="true"><div className="login-illustration-orbit"/><div className="login-pot"><CookingPot size={88} strokeWidth={1.15}/><Leaf size={25} strokeWidth={1.6}/></div><div className="login-order-note"><span><ClipboardList size={19}/></span><div><strong>Every order, accounted for.</strong><small>From the first enquiry to collection.</small></div></div></div></div>
      <p className="login-story-footer">Made for the way your kitchen works.</p>
    </section>
    <section className="login-form-side">
      <div className="login-form-card"><span className="login-lock"><LockKeyhole size={22}/></span><p className="login-form-eyebrow">YOUR CATERING WORKSPACE</p><h2>Welcome back.</h2><p className="login-intro">Sign in with the details provided by your administrator.</p>
        {!ready&&<div className="login-setup-notice" role="status"><span className="demo-dot"/><div><strong>Sign-in preview</strong><p>Access is being set up. Your administrator will let you know when you can sign in.</p></div></div>}
        <form onSubmit={submit}>
          {message&&<div className="form-error login-error" role="alert">{message}</div>}
          <label className="login-field"><span>Email address</span><div><Mail size={17}/><input type="email" name="email" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="you@example.com" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/></div></label>
          <label className="login-field"><span>Password</span><div><LockKeyhole size={17}/><input type={showPassword?"text":"password"} name="password" autoComplete="current-password" placeholder="Enter your password" required value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/><button type="button" className="icon-button" aria-label={showPassword?"Hide password":"Show password"} aria-pressed={showPassword} onClick={()=>setShowPassword(!showPassword)} disabled={busy}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>
          <button className="button primary login-submit" type="submit" disabled={!ready||busy}>{busy?<><LoaderCircle size={18} className="spin"/> Signing in…</>:<>Sign in <ArrowRight size={18}/></>}</button>
        </form>
        <div className="login-access-note"><ShieldCheck size={18}/><p>Accounts are managed by your administrator. Contact them if you need access or help signing in.</p></div>
      </div>
      <footer className="login-footer">Catering Desk <span>•</span> Your kitchen, organised.</footer>
    </section>
  </main>;
}
