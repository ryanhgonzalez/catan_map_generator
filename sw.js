// sw.js – Offline support. The page, styles and scripts are fetched from
// the network first so a deploy always arrives as a matching set; the
// cached copies are only used offline. Tile images and icons rarely change,
// so they come from the cache and refresh in the background.

// Bump to drop caches from older versions. v1 could keep serving a stale
// page forever (navigations were stored under a different key than "./").
const CACHE_NAME = "catan-board-generator-v2";

// The page is cached under this one key, whatever URL it was opened with
// (folder, index.html, or a ?board= share link)
const PAGE_KEY = "index.html";

const PRECACHE_URLS = [
  PAGE_KEY,
  "manifest.webmanifest",
  "css/stylesheet.css",
  "js/catan.js",
  "js/ui.js",
  "js/install.js",
  "js/vendor/qrcode.js",
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
      // "reload" skips the HTTP cache so the precache is the deployed version
      .then((cache) => cache.addAll(
        PRECACHE_URLS.map((url) => new Request(url, { cache: "reload" }))
      ))
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
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, PAGE_KEY));
  } else if (/\.(png|ico)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event, request));
  } else {
    event.respondWith(networkFirst(request, request));
  }
});

async function networkFirst(request, cacheKey) {
  const cache = await caches.open(CACHE_NAME);
  try {
    // "no-cache" revalidates with the server instead of trusting the
    // browser's HTTP cache, which could hand back a mix of versions
    const response = await fetch(request, { cache: "no-cache" });
    if (response.ok) {
      cache.put(cacheKey, response.clone());
    }
    return response;
  } catch (err) {
    return (await cache.match(cacheKey)) || Response.error();
  }
}

async function staleWhileRevalidate(event, request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached || Response.error());

  if (cached) {
    event.waitUntil(network);
    return cached;
  }
  return network;
}
