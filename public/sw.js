// Cache-first service worker for Atlas Academy image assets. Servant art rarely changes between
// visits, and the grid can pull 100+ images — without this, every reload re-downloads all of it
// from the CDN. Only images from static.atlasacademy.io are intercepted; everything else
// (the app shell, the API's JSON responses) passes straight through to the network untouched.

const CACHE_NAME = "fgo-image-cache-v1";
const CACHEABLE_HOSTS = ["static.atlasacademy.io"];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("fgo-image-cache-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (!CACHEABLE_HOSTS.includes(url.hostname)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;

      try {
        const response = await fetch(request);
        // Most of these are <img>/background-image loads with no explicit `crossorigin`, so the
        // browser fetches them in no-cors mode — the response here is "opaque" (status always 0,
        // ok always false, body unreadable) even on success. Opaque responses are still
        // perfectly cacheable and replayable, so don't gate caching on response.ok.
        cache.put(request, response.clone());
        return response;
      } catch {
        // Offline/network failure and nothing cached — let the browser report it normally.
        return Response.error();
      }
    })(),
  );
});
