const CACHE_NAME = 'cardio-planning-v' + Date.now()
const STATIC_CACHE = 'cardio-static-v' + Date.now()

self.addEventListener('install', (event) => {
  console.log('[v0] Service Worker installing with cache:', CACHE_NAME)
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[v0] Static cache opened')
      return cache
    })
  )
  self.skipWaiting() // Activate immediately without waiting for clients to close
})

self.addEventListener('activate', (event) => {
  console.log('[v0] Service Worker activating, cleaning old caches')
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== CACHE_NAME) {
            console.log('[v0] Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type: 'SKIP_WAITING' })
    })
  })
})

self.addEventListener('fetch', (event) => {
  // For HTML pages, always fetch from network first
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then((response) => {
        // Don't cache HTML in service worker
        return response
      }).catch(() => {
        // Return cached version if offline
        return caches.match(event.request)
      })
    )
    return
  }

  // For API calls, always fetch from network
  if (event.request.url.includes('/api/')) {
    event.respondWith(fetch(event.request))
    return
  }

  // For assets (JS, CSS, images), fetch from network with fallback to cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (!response || response.status !== 200) {
          return response
        }
        const responseClone = response.clone()
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone)
        })
        return response
      })
      .catch(() => {
        return caches.match(event.request)
      })
  )
})
