const CACHE_VERSION = "kabumon-cache-v5";
const SCOPE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const scopedPath = (path) => {
  if (path === "/") return `${SCOPE_PATH}/` || "/";
  return `${SCOPE_PATH}${path}`;
};
const APP_SHELL = [
  scopedPath("/"),
  scopedPath("/offline.html"),
  scopedPath("/manifest.webmanifest"),
  scopedPath("/icons/kabumon-icon-192.png"),
  scopedPath("/icons/kabumon-icon-512.png"),
  scopedPath("/icons/kabumon-apple-touch.png"),
  scopedPath("/ui/ideal-nav-frame.png"),
  scopedPath("/ui/ideal-nav-active-frame.png"),
  scopedPath("/ui/ideal-market-icon.png"),
  scopedPath("/ui/nav-home.png"),
  scopedPath("/ui/nav-gacha.png"),
  scopedPath("/ui/nav-train.png"),
  scopedPath("/ui/nav-event.png"),
  scopedPath("/ui/nav-team.png"),
  scopedPath("/ui/nav-dex.png"),
  scopedPath("/ui/nav-market.png"),
  scopedPath("/ui/header-coin.png"),
  scopedPath("/ui/header-gem.png"),
  scopedPath("/ui/header-avatar.png")
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const request = event.request;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(scopedPath("/"), copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(scopedPath("/")) || caches.match(scopedPath("/offline.html"))))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type === "opaque") return response;
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request));
    })
  );
});
