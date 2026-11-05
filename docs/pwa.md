# Catering Desk PWA

Install the business app from **https://dwtdhruvp246.github.io/Mums-website/**. The private Sites preview is a separate origin with a separate installation and an additional ChatGPT access gate.

## Installation

- **Chrome / Edge:** choose **Install app** in the persistent strip when offered. Otherwise use the address-bar installation icon or browser menu installation command.
- **Android:** browser menu → **Install app** or **Add to Home screen** → **Install**. Chrome is recommended for the full installed experience.
- **iPhone / iPad:** open the link in Safari, tap **Share → Add to Home Screen → Add**. Keep **Open as Web App** enabled if Safari shows it. Open Catering Desk using the new Home Screen icon.
- **Safari on Mac:** **File → Add to Dock → Add**.

The app's installation strip contains no close button, Later action, or stored dismissal preference. Cancelling the browser's own installation dialog leaves the strip visible with manual steps. A browser controls its native dialog and can always allow cancellation.

The strip hides after the browser confirms installation and whenever Catering Desk runs in standalone mode, including iOS's standalone flag. Supported browsers can also detect this app as an installed related application when visiting in a normal tab. Browsers without that capability, especially iOS, cannot reliably disclose an existing installation to a separate tab; use the installed Home Screen app to hide the strip. Nothing is permanently marked installed in local storage, so a subsequent uninstall can show the reminder again.

Installation does not create another account or workspace. Sign in using the administrator-created Supabase account. Browser and installed-app storage/session sharing depends on the platform; a first sign-in may be needed in the installed app. There is no added inactivity sign-out timer.

## Connectivity and updates

Workspace reads and saves require internet access. The worker caches only the branded connection-help page and PNG app icons. It does not cache sign-in responses, Supabase traffic, workspace records, app HTML, framework payloads, configuration, or mutations. Offline launch shows connection guidance instead of outdated orders.

Worker updates wait until existing app windows/tabs close. They do not force-refresh an open order form. Normal online reloads fetch current app assets from the network. Increment `CACHE_VERSION` in `public/sw.js` when changing cached offline assets.

## Hosting and checks

The manifest uses relative scope, identity and launch paths. The native deployment serves it at `/manifest.webmanifest`; the Pages build keeps everything under `/Mums-website/`. `scripts/build-pages.mjs` sets the matching absolute related-app identity for GitHub Pages and copies all PWA assets into its output. Publish the entire build output.

`pnpm verify:pwa` exercises installation acceptance/dismissal, early prompt capture, standalone and related-app detection, platform instructions, scope resolution, icon dimensions, cache isolation and offline navigation using synthetic browser/network fixtures. It performs no live account or database writes.

Browser references: [installation prompts](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Trigger_install_prompt), [installed related apps](https://developer.chrome.com/docs/capabilities/get-installed-related-apps), and [offline fallback](https://web.dev/articles/offline-fallback-page).
