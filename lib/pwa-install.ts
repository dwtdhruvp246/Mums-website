export type InstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type RelatedApp = { platform?: string; id?: string; url?: string };
export type InstallNavigator = Pick<Navigator, "userAgent" | "platform" | "maxTouchPoints"> & {
  standalone?: boolean;
  install?: () => Promise<unknown>;
  userActivation?: { readonly isActive: boolean };
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
  let disposed = false, checking = 0, prompting = false, requested = false, message = "";
  const hasDirectInstall = () => typeof nav.install === "function";
  const inApp = () => standalone.matches || minimal.matches || nav.standalone === true;
  const publish = () => {
    if (!disposed) onChange({ installed: inApp() || confirmed || relatedInstalled, canPrompt: Boolean(prompt) || hasDirectInstall(), prompting, message });
  };
  async function checkInstalled() {
    publish();
    if (!nav.getInstalledRelatedApps || inApp() || confirmed) return;
    const version = ++checking;
    try {
      const apps = await nav.getInstalledRelatedApps();
      if (disposed || version !== checking) return;
      // The original manifest's relative id resolved against the start URL's origin.
      // Keep that existing identity so installed copies are recognised, not duplicated.
      const appId = new URL("/", manifestUrl).href;
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
    message = requested ? "Ready to install. Tap Install app to continue." : "";
    publish();
    // A first tap can also satisfy Chrome's engagement check. Continue that same
    // explicit request only while the browser still reports a real user activation.
    if (requested && nav.userActivation?.isActive) void install();
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
  async function install() {
      if (prompting || disposed || inApp() || confirmed || relatedInstalled) return;
      if (!prompt && !hasDirectInstall()) {
        requested = true;
        message = installInstructions(nav);
        publish();
        void checkInstalled();
        return;
      }
      requested = false;
      const invitation = prompt;
      prompting = true;
      message = "";
      publish();
      try {
        // Progressive enhancement: some browsers expose a direct install API.
        // Call it from this click without awaiting any preparation first.
        if (!invitation && nav.install) {
          await nav.install();
          installed();
          return;
        }
        // Keep the banner until installation is confirmed, not merely accepted in a dialog.
        await invitation!.prompt();
        const choice = await invitation!.userChoice;
        message = choice.outcome === "dismissed"
          ? "Installation was not completed. Tap Install app to try again when your browser is ready."
          : "Confirm the installation in your browser to finish adding Catering Desk.";
      } catch (error) {
        message = error instanceof Error && error.name === "AbortError"
          ? "Installation was not completed. Tap Install app to try again."
          : "Your browser could not open installation yet. Keep this page open in a regular Chrome or Edge tab, then try Install app again.";
      } finally {
        if (prompt === invitation) {
          prompt = undefined;
          delete target.__cateringInstallPrompt;
        }
        prompting = false;
        publish();
        void checkInstalled();
      }
  }
  return {
    install,
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
  if (/Android/i.test(ua) && (!/Chrome|Chromium|Edg|SamsungBrowser|OPR/i.test(ua) || /FBAN|FBAV|Instagram|;\s*wv\)/i.test(ua))) return "Open this page in Google Chrome on your phone, then tap Install app here. Installation is not available in some in-app browsers.";
  if (/Macintosh|Mac OS X/i.test(ua) && /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR/i.test(ua)) return "In Safari, choose File → Add to Dock → Add. Then open Catering Desk from your Dock.";
  if (/Firefox/i.test(ua)) return "Open this page in Chrome or Edge, then tap Install app here.";
  return "Your browser is preparing installation. Keep this page open in a regular Chrome or Edge tab. When it is ready, tap Install app to confirm.";
}
