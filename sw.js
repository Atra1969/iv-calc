// IV Dosing Calculator — Service Worker
// Strategy: cache-first for the app shell so it works fully offline (essential for flight/EMS use).
// Bump CACHE_VERSION on any deploy to force clients to fetch the new shell.

const CACHE_VERSION = "iv-calc-v6-2026-05-24g";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./meds.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192-maskable.png",
  "./icons/icon-512-maskable.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      // addAll fails atomically; use individual adds to tolerate any missing optional file
      Promise.all(APP_SHELL.map((url) =>
        cache.add(new Request(url, { cache: "reload" })).catch(() => null)
      ))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // HTML navigations: network-first so deploys propagate fast; fall back to cached shell offline.
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then((r) => r || caches.match("./index.html")))
    );
    return;
  }

  // Everything else: cache-first, then network, then store.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
    })
  );
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (data === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  // Settings > App update > Current build display reads this.
  if (data && data.type === "GET_VERSION") {
    const port = event.ports && event.ports[0];
    const payload = { type: "VERSION", version: CACHE_VERSION };
    if (port) port.postMessage(payload);
    else if (event.source && event.source.postMessage) event.source.postMessage(payload);
    return;
  }
  // Force-refresh: wipe every cache this SW owns so the next fetch goes to network.
  if (data && data.type === "WIPE_CACHES") {
    event.waitUntil(
      caches.keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .then(() => {
          const port = event.ports && event.ports[0];
          const reply = { type: "WIPE_CACHES_DONE" };
          if (port) port.postMessage(reply);
          else if (event.source && event.source.postMessage) event.source.postMessage(reply);
        })
    );
    return;
  }
});
