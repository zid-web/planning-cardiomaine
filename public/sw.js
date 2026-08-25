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
  // Correctif complet (confirmé utilisateur 25/08/2026) :
  // - "event.respondWith(fetch(event.request))" pour TOUTES les requêtes
  //   plantait sur les requêtes de NAVIGATION ("Failed to fetch"), car le
  //   mode "navigate" ne peut pas être réutilisé directement dans fetch().
  // - Mais un gestionnaire "fetch" VIDE (sans respondWith) est ignoré par
  //   Chrome pour l'évaluation d'installabilité PWA ("no-op fetch handler"),
  //   empêchant l'icône d'installation d'apparaître.
  // Solution : répondre réellement, mais seulement pour les requêtes NON-
  // navigation (où event.request est réutilisable sans risque). Les
  // navigations passent nativement, sans interception.
  if (event.request.mode === "navigate") {
    return
  }
  event.respondWith(fetch(event.request))
})
