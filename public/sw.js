/* Increment this version when changing public offline assets. No customer, order or auth data is cached. */
const CACHE_VERSION = "catering-desk-public-v1";
const BASE = new URL(self.registration.scope);
const CACHE_NAME = CACHE_VERSION + ":" + BASE.pathname;
const OFFLINE = new URL("offline.html", BASE).href;
const PUBLIC_FILES = ["offline.html", "pwa/icon-192.png", "pwa/icon-512.png", "pwa/maskable-512.png", "pwa/apple-touch-icon.png"]
  .map(file => new URL(file, BASE).href);

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const url of PUBLIC_FILES) {
      // Reject sign-in redirects from private hosting instead of caching a login response.
      const response = await fetch(url, { cache: "no-store", redirect: "error", credentials: "same-origin" });
      if (!response.ok || response.redirected) throw new Error("Public offline asset unavailable");
      const type = response.headers.get("content-type") || "";
      if (url === OFFLINE) {
        if (!type.includes("text/html") || !(await response.clone().text()).includes('name="catering-offline"')) throw new Error("Unexpected offline page");
      } else if (!type.includes("image/png")) throw new Error("Unexpected app icon");
      await cache.put(url, response);
    }
  })());
  // Let updates activate when existing tabs close; never reload an unsaved order form.
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith("catering-desk-public-") && name.endsWith(":" + BASE.pathname) && name !== CACHE_NAME) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname)) return;
  const relativePath = url.pathname.slice(BASE.pathname.length);
  // Do not intercept APIs, auth callbacks, framework payloads, or private workspace requests.
  if (/^(api|auth|_next|_vinext)(\/|$)/.test(relativePath) || url.search || request.headers.has("RSC")) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => (await caches.match(OFFLINE)) || Response.error()));
  } else if (PUBLIC_FILES.includes(url.href)) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
  }
});
