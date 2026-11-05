export type InstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type RelatedApp = { platform?: string; id?: string; url?: string };
export type InstallNavigator = Pick<Navigator, "userAgent" | "platform" | "maxTouchPoints"> & {
  standalone?: boolean;
  getInstalledRelatedApps?: () => Promise<RelatedApp[]>;
};
export type InstallWindow = Pick<Window, "addEventListener" | "removeEventListener" | "matchMedia"> & {
  __cateringInstallPrompt?: InstallPromptEvent;
  __cateringAppInstalled?: boolean;
};
export type InstallState = { installed: boolean; canPrompt: boolean; prompting: boolean; message: string };

// No dismissal or installed flag is persisted: a later uninstall must allow the reminder again.
export function observePwaInstall(target: InstallWindow, nav: InstallNavigator, manifestUrl: string, onChange: (state: InstallState) => void) {
  const standalone = target.matchMedia("(display-mode: standalone)");
  const minimal = target.matchMedia("(display-mode: minimal-ui)");
  let prompt = target.__cateringInstallPrompt;
  let confirmed = Boolean(target.__cateringAppInstalled), relatedInstalled = false;
  let disposed = false, checking = 0, prompting = false, message = "";
  const inApp = () => standalone.matches || minimal.matches || nav.standalone === true;
  const publish = () => {
    if (!disposed) onChange({ installed: inApp() || confirmed || relatedInstalled, canPrompt: Boolean(prompt), prompting, message });
  };
  async function checkInstalled() {
    publish();
    if (!nav.getInstalledRelatedApps || inApp() || confirmed) return;
    const version = ++checking;
    try {
      const apps = await nav.getInstalledRelatedApps();
      if (disposed || version !== checking) return;
      const appId = new URL("./", manifestUrl).href;
      relatedInstalled = apps.some(app => {
        if (app.platform !== "webapp") return false;
        try { return (app.url && new URL(app.url, manifestUrl).href === manifestUrl) || (app.id && new URL(app.id, manifestUrl).href === appId); }
        catch { return false; }
      });
      publish();
    } catch { /* Some browsers expose the API but restrict it. Keep the reminder available. */ }
  }
  const offered = (event: Event) => {
    event.preventDefault();
    prompt = event as InstallPromptEvent;
    target.__cateringInstallPrompt = prompt;
    relatedInstalled = false;
    message = "";
    publish();
  };
  const installed = () => {
    confirmed = true;
    target.__cateringAppInstalled = true;
    prompt = undefined;
    delete target.__cateringInstallPrompt;
    publish();
  };
  const recheck = () => { void checkInstalled(); };
  target.addEventListener("beforeinstallprompt", offered);
  target.addEventListener("appinstalled", installed);
  target.addEventListener("focus", recheck);
  target.addEventListener("pageshow", recheck);
  standalone.addEventListener("change", recheck);
  minimal.addEventListener("change", recheck);
  void checkInstalled();
  return {
    async install() {
      if (!prompt || prompting || disposed) return;
      const invitation = prompt;
      prompting = true;
      publish();
      try {
        // Keep the banner until installation is confirmed, not merely accepted in a dialog.
        await invitation.prompt();
        const choice = await invitation.userChoice;
        message = choice.outcome === "dismissed"
          ? "Installation was not completed. You can still install using your browser menu."
          : "Complete the installation in your browser. If needed, use the steps below.";
      } catch {
        message = "Use your browser menu to install Catering Desk with the steps below.";
      } finally {
        if (prompt === invitation) {
          prompt = undefined;
          delete target.__cateringInstallPrompt;
        }
        prompting = false;
        publish();
        void checkInstalled();
      }
    },
    dispose() {
      disposed = true;
      checking++;
      target.removeEventListener("beforeinstallprompt", offered);
      target.removeEventListener("appinstalled", installed);
      target.removeEventListener("focus", recheck);
      target.removeEventListener("pageshow", recheck);
      standalone.removeEventListener("change", recheck);
      minimal.removeEventListener("change", recheck);
    },
  };
}

export function installInstructions(nav: InstallNavigator) {
  const ua = nav.userAgent;
  const ios = /iPhone|iPad|iPod/i.test(ua) || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
  if (ios) return "In Safari, tap Share → Add to Home Screen → Add. Keep ‘Open as Web App’ on if shown. Open Catering Desk from your Home Screen after installing.";
  if (/Android/i.test(ua)) return "Open your browser menu (⋮) → Install app or Add to Home screen → Install. Use Chrome if your browser does not offer installation.";
  if (/Macintosh|Mac OS X/i.test(ua) && /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR/i.test(ua)) return "In Safari, choose File → Add to Dock → Add. Then open Catering Desk from your Dock.";
  if (/Firefox/i.test(ua)) return "Open this page in Chrome or Edge, then choose Install Catering Desk from the browser menu.";
  return "In Chrome or Edge, click the install icon in the address bar, or open the browser menu → Cast, save and share / Apps → Install Catering Desk.";
}
