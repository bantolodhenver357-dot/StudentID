
const CACHE = "school-id-maker-v3";

const FILES = [
  "./",
  "./index.html",
  "./LOGOVMC.png",
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

// Install the updated app shell.
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);

    await Promise.all(
      FILES.map(async file => {
        try {
          const url = new URL(file, self.registration.scope).href;
          const response = await fetch(url, { cache: "no-store" });

          if (response.ok) {
            await cache.put(url, response);
          }
        } catch (error) {
          console.warn("Could not cache:", file, error);
        }
      })
    );

    // Activate the new worker immediately.
    await self.skipWaiting();
  })());
});

// Activate the new version and remove only old School ID Maker caches.
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();

    await Promise.all(
      keys
        .filter(key =>
          key.startsWith("school-id-maker-") &&
          key !== CACHE
        )
        .map(key => caches.delete(key))
    );

    await self.clients.claim();
  })());
});

// Always try the network first. Use cached files when offline.
self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Do not intercept external resources such as Supabase or Google Fonts.
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);

    try {
      const response = await fetch(request, {
        cache: "no-store"
      });

      if (response.ok) {
        await cache.put(request, response.clone());
      }

      return response;

    } catch (error) {
      // Use the saved version when the device is offline.
      const cached = await cache.match(request);

      if (cached) return cached;

      // Allow the app shell to open offline.
      if (request.mode === "navigate") {
        const appShell = new URL(
          "./index.html",
          self.registration.scope
        ).href;

        const fallback = await cache.match(appShell);

        if (fallback) return fallback;
      }

      return new Response("You are currently offline.", {
        status: 503,
        headers: {
          "Content-Type": "text/plain"
        }
      });
    }
  })());
});
