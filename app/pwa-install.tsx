"use client";
import { useEffect, useRef, useState } from "react";
import { Download, Smartphone } from "lucide-react";
import { installInstructions, observePwaInstall, type InstallState } from "../lib/pwa-install";

export default function PwaInstall() {
  const [state, setState] = useState<InstallState | null>(null);
  const [instructions, setInstructions] = useState("");
  const banner = useRef<HTMLElement>(null);
  const installer = useRef<ReturnType<typeof observePwaInstall> | null>(null);

  useEffect(() => {
    const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!manifest) return;
    const base = new URL("./", manifest.href);
    installer.current = observePwaInstall(window, navigator, manifest.href, setState);
    setInstructions(installInstructions(navigator));
    if ("serviceWorker" in navigator && window.isSecureContext) {
      // Only the public offline page and icons are cached. Workspace/auth requests stay online.
      void navigator.serviceWorker.register(new URL("sw.js", base), { scope: base.pathname, updateViaCache: "none" }).catch(() => {
        // Installation can still be offered by browsers without service worker support.
      });
    }
    return () => { installer.current?.dispose(); installer.current = null; };
  }, []);

  const visible = Boolean(state && !state.installed);
  useEffect(() => {
    if (!visible || !banner.current) return;
    const element = banner.current;
    const measure = () => document.documentElement.style.setProperty("--pwa-install-height", `${element.getBoundingClientRect().height}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => { observer.disconnect(); document.documentElement.style.removeProperty("--pwa-install-height"); };
  }, [visible]);

  if (!visible || !state) return null;
  return <aside className="pwa-install" ref={banner} aria-label="Install Catering Desk">
    <span className="pwa-install-icon" aria-hidden="true"><Smartphone size={23} /></span>
    <div className="pwa-install-copy">
      <h2>Keep Catering Desk one tap away</h2>
      <p>{state.canPrompt ? "Install the app on this device for quick access to your catering workspace." : instructions}</p>
      {state.message && <p className="pwa-install-status" role="status">{state.message}</p>}
    </div>
    {state.canPrompt && <button className="button primary pwa-install-button" type="button" disabled={state.prompting} onClick={() => void installer.current?.install()}>
      <Download size={17} />{state.prompting ? "Installing…" : "Install app"}
    </button>}
  </aside>;
}
