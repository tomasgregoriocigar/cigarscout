/* TrustedCigar service worker — build 2026-11-13.7
   Owner rule (Tomás, Nov 8, 2026): the home-screen shortcut must always
   be up to date — an installed shortcut that serves a stale build is a
   product defect. So the app shell is NETWORK-FIRST here: while online,
   every open fetches the current page (bypassing the HTTP cache); the
   cache is only the offline fallback. The cache name carries the build
   id — any deploy that changes this file bumps the name, and activation
   deletes every older cache, evicting stale shells from installed
   phones. Cross-origin and non-GET requests are left to the browser
   untouched (analytics beacon, vision reader, OCR CDN). */
var CACHE = "tc-2026-11-13-7";
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
      var hadOld = keys.some(function (key) { return key !== CACHE; });
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE) return caches.delete(key);
      })).then(function () { return hadOld; });
    }).then(function (hadOld) {
      return self.clients.claim().then(function () {
        if (!hadOld || !self.clients.matchAll) return;
        return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
          return Promise.all(list.map(function (client) {
            try {
              var u = new URL(client.url);
              if (u.origin === self.location.origin && (u.pathname === "/app/" || u.pathname === "/scanner/") && client.navigate) {
                return client.navigate(client.url);
              }
            } catch (e) { /* leave that window alone */ }
          }));
        });
      });
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

/* Found-it alerts (build 2026-11-13.7). Apple's rule: every push MUST
   show a notification, or WebKit revokes the subscription — so the push
   handler always shows one (generic text if the payload is unreadable)
   and sets the icon badge alongside it. */
self.addEventListener("push", function (event) {
  var data = { title: "TrustedCigar", body: "Good news. Open the app to see what we found.", url: "/app/", badge: 1 };
  try {
    var j = event.data ? event.data.json() : null;
    if (j) {
      if (j.title) data.title = String(j.title);
      if (j.body) data.body = String(j.body);
      if (j.url) data.url = String(j.url);
      if (typeof j.badge === "number") data.badge = j.badge;
    }
  } catch (e) { /* keep the generic notification */ }
  var tasks = [
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      data: { url: data.url }
    })
  ];
  if (self.navigator && self.navigator.setAppBadge) {
    tasks.push(data.badge > 0 ? self.navigator.setAppBadge() : self.navigator.clearAppBadge());
  }
  event.waitUntil(Promise.all(tasks));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || "/app/";
  var tasks = [];
  if (self.navigator && self.navigator.clearAppBadge) tasks.push(self.navigator.clearAppBadge());
  tasks.push(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].url.indexOf(url) !== -1 && "focus" in list[i]) return list[i].focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  }));
  event.waitUntil(Promise.all(tasks));
});
