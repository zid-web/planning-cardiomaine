// Service worker minimal pour l'installabilité PWA (confirmé utilisateur
// 24/08/2026) - volontairement SANS mise en cache du planning ou des
// données : dans une app de planning médical, servir une version périmée
// depuis le cache serait dangereux/trompeur. Existe uniquement pour
// satisfaire les critères d'installation des navigateurs.

self.addEventListener("install", (event) => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("fetch", (event) => {
  // Simple pass-through fetch - pas de cache, toujours les données fraîches.
  event.respondWith(fetch(event.request))
})
