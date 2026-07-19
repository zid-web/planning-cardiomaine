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
  const { request } = event
  const url = new URL(request.url)

  // Skip non-HTTP/HTTPS and chrome-extension requests
  if (!url.protocol.startsWith('http')) {
    return
  }

  // Skip POST, PUT, DELETE requests (only cache GET/HEAD)
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    event.respondWith(fetch(request))
    return
  }

  // For HTML pages (navigate mode), always fetch from network first
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((response) => {
        return response
      }).catch(() => {
        return caches.match(request)
      })
    )
    return
  }

  // For API calls, always fetch from network
  if (url.pathname.includes('/api/')) {
    event.respondWith(fetch(request))
    return
  }

  // For assets (JS, CSS, images), fetch from network with fallback to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Don't cache if response is not ok or status not 200
        if (!response || response.status !== 200 || response.type === 'error') {
          return response
        }
        
        // Only cache valid cacheable content types
        const contentType = response.headers.get('content-type') || ''
        const isCacheable = 
          contentType.includes('application/javascript') ||
          contentType.includes('text/css') ||
          contentType.includes('image/') ||
          contentType.includes('font/')
        
        if (isCacheable) {
          const responseClone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone).catch((err) => {
              console.log('[v0] Cache put failed:', err.message)
            })
          })
        }
        return response
      })
      .catch(() => {
        return caches.match(request)
      })
  )
})
