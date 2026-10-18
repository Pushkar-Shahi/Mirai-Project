// Mirai PWA Service Worker v1.0.0
const CACHE_NAME = 'mirai-pwa-v1.0.2';
const CORE_ASSETS = [
  './',
  './shared/styles/app.css',
  './shared/theme-init.js',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS).catch((err) => {
        console.warn('Mirai SW pre-cache partial notice:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Never cache mutation requests (POST, PUT, DELETE, PATCH)
  if (req.method !== 'GET') {
    return;
  }

  // Network-only for live API, auth endpoints, and cloud API domains
  if (
    url.pathname.startsWith('/api') ||
    url.hostname.includes('onrender.com') ||
    url.pathname.includes('/auth/') ||
    url.searchParams.has('nocache')
  ) {
    return;
  }

  // HTML page navigation: Network First with cache fallback for offline usage
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          const fallback = (await caches.match('./login/')) || (await caches.match('./'));
          return fallback || new Response(
            '<!doctype html><html><head><meta charset="utf-8"><title>Offline - Mirai</title><style>body{background:#060814;color:#00d2ff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:20px;}</style></head><body><div><h1>Mirai Offline</h1><p>You are currently offline. Please reconnect to access real-time data.</p></div></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        })
    );
    return;
  }

  // Static Assets (CSS, JS, SVG, PNG, fonts): Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200 && networkRes.type === 'basic') {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        })
        .catch(() => null);

      return cached || fetchPromise;
    })
  );
});
