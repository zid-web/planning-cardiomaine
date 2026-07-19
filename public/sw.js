// public/sw.js
const CACHE_NAME = 'cardio-planning-v1784499101179';
const STATIC_ASSETS = [
  '/protected/planning',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  console.log('[v0] Service Worker installing with cache:', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[v0] Static cache opened');
        return cache.addAll(STATIC_ASSETS).catch((err) => {
          console.warn('[v0] Some assets failed to cache:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('[v0] Service Worker activating, cleaning old caches');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[v0] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Ignorer les requêtes non-GET, les extensions, et les APIs
  if (request.method !== 'GET') {
    return;
  }

  // Ignorer les requêtes vers des URLs non HTTP/HTTPS
  if (!request.url.startsWith('http')) {
    return;
  }

  // Ignorer les requêtes vers les API et les assets Next.js internes
  if (request.url.includes('/api/') || request.url.includes('/_next/') || request.url.includes('/auth/')) {
    return event.respondWith(fetch(request));
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Si la ressource est en cache, la retourner
      if (cachedResponse) {
        return cachedResponse;
      }

      // Sinon, fetch depuis le réseau
      return fetch(request)
        .then((response) => {
          // Ne mettre en cache que les réponses valides (200) et de type approprié
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            try {
              cache.put(request, responseClone);
            } catch (err) {
              console.warn('[v0] Failed to cache:', request.url, err);
            }
          });
          return response;
        })
        .catch((err) => {
          console.warn('[v0] Fetch failed, returning offline fallback:', request.url, err);
          // Optionnel : retourner une page offline personnalisée
          // return caches.match('/offline.html');
        });
    })
  );
});
