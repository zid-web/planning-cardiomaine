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
  // Correctif (confirmé utilisateur 24/08/2026) : "event.respondWith(fetch(event.request))"
  // plantait systématiquement pour les requêtes de NAVIGATION (chargement
  // de page) avec "TypeError: Failed to fetch" - le mode "navigate" d'une
  // requête ne peut pas être réutilisé directement dans fetch(), ce qui
  // rendait le site entier inaccessible une fois le service worker actif.
  // Chrome exige seulement qu'un gestionnaire "fetch" EXISTE pour
  // l'installabilité - il n'a pas besoin d'intercepter quoi que ce soit.
  // Ne rien faire ici = toutes les requêtes passent normalement au réseau,
  // exactement comme sans service worker.
})
