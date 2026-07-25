self.addEventListener("install", (event) => {
})

self.addEventListener("activate", (event) => {
})

self.addEventListener("fetch", (event) => {
  // Simple pass-through fetch
  event.respondWith(fetch(event.request))
})
