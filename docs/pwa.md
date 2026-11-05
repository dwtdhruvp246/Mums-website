# Catering Desk PWA

Install the business app from **https://dwtdhruvp246.github.io/Mums-website/**. The `chatgpt.site` address is a private preview with an additional ChatGPT access gate. Its Install app action opens the public app link in a new tab, preserving any unsaved form in the preview. It does not wait for a native install prompt or register a worker on the protected preview.

Use the GitHub Pages address on phones. Installation files must be accessible to the browser independently of the private preview's access gate. The public app still requires the user's normal Supabase sign-in to access their workspace; no session, account information or workspace data is passed through the install link.

## Installation

- **Chrome / Edge:** choose **Install app** in the persistent strip, then confirm in the browser's installation dialog.
- **Android:** open the site in a regular Chrome tab and tap **Install app**. The app does not direct users to the three-dot menu. Chrome may first require a page interaction and some viewing time before releasing its installation prompt; the button stays visible and reports preparation or readiness. If the first tap releases the prompt while user activation is still valid, the same tap opens confirmation. Otherwise tap the button when it reports readiness.
- **iPhone / iPad:** open the link in Safari, tap **Share → Add to Home Screen → Add**. Keep **Open as Web App** enabled if Safari shows it. Open Catering Desk using the new Home Screen icon.
- **Safari on Mac:** **File → Add to Dock → Add**.

The app's installation strip always contains an **Install app** button, with no close button, Later action, or stored dismissal preference. Cancelling the browser's own installation dialog leaves the strip and button visible. A browser controls its native dialog and can always allow cancellation. A browser that exposes a direct `navigator.install()` API can open confirmation without waiting for a deferred offer; this is feature detected and optional.

Unsupported browsers show relevant guidance only after the user taps the button. iOS still requires Safari's Share / Add to Home Screen flow; a website cannot install itself silently or bypass the browser's confirmation and installation restrictions.

The strip hides after the browser confirms installation and whenever Catering Desk runs in standalone mode, including iOS's standalone flag. Supported browsers can also detect this app as an installed related application when visiting in a normal tab. Browsers without that capability, especially iOS, cannot reliably disclose an existing installation to a separate tab; use the installed Home Screen app to hide the strip. Nothing is permanently marked installed in local storage, so a subsequent uninstall can show the reminder again.

Installation does not create another account or workspace. Sign in using the administrator-created Supabase account. Browser and installed-app storage/session sharing depends on the platform; a first sign-in may be needed in the installed app. There is no added inactivity sign-out timer.

## Connectivity and updates

Workspace reads and saves require internet access. The worker caches only the branded connection-help page and PNG app icons. It does not cache sign-in responses, Supabase traffic, workspace records, app HTML, framework payloads, configuration, or mutations. Offline launch shows connection guidance instead of outdated orders.

Worker updates wait until existing app windows/tabs close. They do not force-refresh an open order form. Normal online reloads fetch current app assets from the network. Increment `CACHE_VERSION` in `public/sw.js` when changing cached offline assets.

## Hosting and checks

The installable app's manifest uses relative scope and launch paths. Its explicit `/` identity preserves the original `./` identity (the browser resolves `id` relative to the start URL's origin, unlike icon/scope URLs). The Pages build keeps its launch, scope and assets under `/Mums-website/`. `scripts/build-pages.mjs` sets the matching absolute related-app identity for GitHub Pages and copies all PWA assets into its output. Publish the entire build output. The protected native preview deliberately omits installable-app metadata and links to the Pages app instead.

`pnpm verify:pwa` exercises installation acceptance/dismissal, early prompt capture, standalone and related-app detection, platform instructions, scope resolution, icon dimensions, cache isolation and offline navigation using synthetic browser/network fixtures. It performs no live account or database writes.

Browser references: [installation prompts](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Trigger_install_prompt), [installed related apps](https://developer.chrome.com/docs/capabilities/get-installed-related-apps), and [offline fallback](https://web.dev/articles/offline-fallback-page).
