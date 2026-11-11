
const CACHE = "school-id-maker-v2";

const FILES = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/supabase.js",
  "./js/auth.js",
  "./js/database.js",
  "./js/editor.js",
  "./js/app.js",
  "./js/export.js",
  "./js/cloud-sync.js",
  "./manifest.json"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(FILES))
  );

  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE)
          .map(key => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        if (response.ok) {
          const copy = response.clone();

          caches.open(CACHE).then(cache =>
            cache.put(event.request, copy)
          );
        }

        return response;
      }).catch(() => caches.match("./index.html"));
    })
  );
});
