"use client";
import { useEffect, useRef, useState } from "react";
import { Download, Smartphone } from "lucide-react";
import { observePwaInstall, type InstallState } from "../lib/pwa-install";

export default function PwaInstall({ installPageUrl }: { installPageUrl?: string } = {}) {
  const [state, setState] = useState<InstallState | null>(null);
  const banner = useRef<HTMLElement>(null);
  const installer = useRef<ReturnType<typeof observePwaInstall> | null>(null);

  useEffect(() => {
    // Private previews are behind a separate access gate. Their button must open
    // the real app instead of waiting for a prompt that cannot install that preview.
    if (installPageUrl) {
      const mode = window.matchMedia("(display-mode: standalone)");
      const update = () => setState({
        installed: mode.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
        canPrompt: false, prompting: false, message: "",
      });
      update();
      mode.addEventListener("change", update);
      return () => mode.removeEventListener("change", update);
    }
    const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!manifest) return;
    const base = new URL("./", manifest.href);
    installer.current = observePwaInstall(window, navigator, manifest.href, setState);
    if ("serviceWorker" in navigator && window.isSecureContext) {
      // Only the public offline page and icons are cached. Workspace/auth requests stay online.
      void navigator.serviceWorker.register(new URL("sw.js", base), { scope: base.pathname, updateViaCache: "none" }).catch(() => {
        // Installation can still be offered by browsers without service worker support.
      });
    }
    return () => { installer.current?.dispose(); installer.current = null; };
  }, [installPageUrl]);

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
      <h2>Install Catering Desk</h2>
      <p>{installPageUrl ? "Open our mobile app link to install Catering Desk. Use your usual account to access the same workspace." : "Add the app to your Home Screen for quick access to your catering workspace."}</p>
      {state.message && <p className="pwa-install-status" role="status">{state.message}</p>}
    </div>
    {installPageUrl ? <a className="button primary pwa-install-button" href={installPageUrl} target="_blank" rel="noopener noreferrer" aria-label="Install app — opens the mobile app link">
      <Download size={17} />Install app
    </a> : <button className="button primary pwa-install-button" type="button" disabled={state.prompting} onClick={() => void installer.current?.install()}>
      <Download size={17} />{state.prompting ? "Installing…" : "Install app"}
    </button>}
  </aside>;
}
