/* TrustedCigar service worker — build 2026-11-08.3
   Owner rule (Tomás, Nov 8, 2026): the home-screen shortcut must always
   be up to date — an installed shortcut that serves a stale build is a
   product defect. So the app shell is NETWORK-FIRST here: while online,
   every open fetches the current page (bypassing the HTTP cache); the
   cache is only the offline fallback. The cache name carries the build
   id — any deploy that changes this file bumps the name, and activation
   deletes every older cache, evicting stale shells from installed
   phones. Cross-origin and non-GET requests are left to the browser
   untouched (analytics beacon, vision reader, OCR CDN). */
var CACHE = "tc-2026-11-08-3";
var SHELL = [
  "/",
  "/app/",
  "/scanner/",
  "/manifest.json",
  "/styles.css",
  "/apple-touch-icon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(SHELL);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE) return caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

function networkFirst(event, noStore) {
  var req = event.request;
  var fetchReq = req;
  if (noStore) {
    try { fetchReq = new Request(req, { cache: "no-store" }); } catch (e) { fetchReq = req; }
  }
  event.respondWith(
    fetch(fetchReq).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req);
    })
  );
}

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  /* App shell and page navigations: network-first, always current
     while online; cache is the offline fallback only. */
  if (SHELL.indexOf(url.pathname) !== -1 || req.mode === "navigate") {
    networkFirst(event, true);
    return;
  }

  /* All other pages and assets: network-first, cache as fallback. */
  networkFirst(event, false);
});
