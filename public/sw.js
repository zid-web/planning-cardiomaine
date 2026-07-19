// public/sw.js
const CACHE_NAME = 'cardio-planning-v2';
const STATIC_ASSETS = [
  '/protected/planning',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.ico',
];

// Installation : mise en cache des assets statiques
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

// Activation : nettoyage des anciens caches
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

// Interception des requêtes
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Ignorer les requêtes non-GET
  if (request.method !== 'GET') {
    return event.respondWith(fetch(request));
  }

  // Ignorer les URLs non-HTTP
  if (!request.url.startsWith('http')) {
    return event.respondWith(fetch(request));
  }

  // Ignorer les appels API et Next.js internes
  if (request.url.includes('/api/') || request.url.includes('/_next/') || request.url.includes('/auth/')) {
    return event.respondWith(fetch(request));
  }

  // Gestion du cache avec fallback offline
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        // Tenter le fetch réseau
        return fetch(request)
          .then((response) => {
            // Ne mettre en cache que les réponses valides
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            const responseClone = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                try {
                  cache.put(request, responseClone);
                } catch (err) {
                  console.warn('[v0] Cache put failed:', request.url, err);
                }
              })
              .catch((err) => console.warn('[v0] Cache open failed:', err));
            return response;
          })
          .catch((err) => {
            console.warn('[v0] Network fetch failed, returning offline fallback:', request.url, err);
            // Retourner une réponse fallback (page d'accueil offline)
            return caches.match('/protected/planning')
              .then((offlineResponse) => {
                if (offlineResponse) {
                  return offlineResponse;
                }
                // Fallback ultime : une réponse d'erreur
                return new Response('Application hors ligne', {
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: { 'Content-Type': 'text/plain' }
                });
              });
          });
      })
      .catch((err) => {
        console.error('[v0] Service Worker critical error:', err);
        // Retourner une réponse d'erreur
        return new Response('Erreur réseau', {
          status: 500,
          statusText: 'Internal Server Error',
          headers: { 'Content-Type': 'text/plain' }
        });
      })
  );
});
