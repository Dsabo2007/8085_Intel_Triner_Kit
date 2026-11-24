/**
 * M85 Kit — offline cache (PWA).
 *
 * Keeps the simulator usable with no connection (GitHub Pages visitors,
 * installed iPhone/iPad home-screen app):
 *  - first visit caches the shell (HTML, hashed JS/CSS, icon, manifest),
 *  - navigations are network-first with a cached fallback,
 *  - static assets are cache-first (they are content-hashed and immutable).
 *
 * The app itself never phones home: the 8085 core is embedded in the JS
 * bundle as WASM, so once the shell is cached everything runs offline.
 */
const CACHE = 'm85-kit-v3';

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.png',
  './favicon.ico',
  './assets/aistudio/8085_default_register_values_8196be1b.md',
  './assets/aistudio/photo_2026-11-02_18-22-11_f8235d6d.jpg',
  './assets/index-CWjXQKHA.js',
  './assets/index-X1jBUc69.css',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // App shell: try the network first (so deploys show up immediately),
  // fall back to the cache when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('./index.html'))
        )
    );
    return;
  }

  // Static assets: cache first — they carry content hashes in the name.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
