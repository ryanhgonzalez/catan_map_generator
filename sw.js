// sw.js – Offline support: precache the app shell, then serve from cache
// while refreshing it in the background (stale-while-revalidate), so new
// deploys show up on the next visit without bumping the version.

const CACHE_NAME = "catan-board-generator-v1";

const PRECACHE_URLS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/stylesheet.css",
  "js/catan.js",
  "js/ui.js",
  "images/clay.png",
  "images/desert.png",
  "images/grain.png",
  "images/ore.png",
  "images/wood.png",
  "images/wool.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
  "icons/favicon-32.png",
  "icons/favicon-16.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  // Drop caches from older versions
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  // Shared boards are index.html with a ?board=... query, so match
  // navigations without the query string.
  const isNavigation = request.mode === "navigate";

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request, { ignoreSearch: isNavigation });

      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            cache.put(isNavigation ? "index.html" : request, response.clone());
          }
          return response;
        })
        .catch(async () =>
          cached ||
          (isNavigation && await cache.match("index.html")) ||
          Response.error()
        );

      if (cached) {
        event.waitUntil(network);
        return cached;
      }
      return network;
    })
  );
});
