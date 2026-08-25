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
  // Correctif définitif (confirmé utilisateur 25/08/2026) : réutiliser
  // event.request dans fetch() plantait ("Failed to fetch") pour PLUSIEURS
  // types de requêtes (pas seulement la navigation - aussi probablement les
  // requêtes cross-origin/CORS comme Supabase, Analytics, etc., où le
  // request original a un "mode" incompatible avec un nouvel appel fetch()).
  // Solution la plus sûre : n'intercepter QUE quelques fichiers statiques
  // précis et sans risque (nos propres icônes), en reconstruisant une
  // requête neuve et simple - jamais event.request lui-même. Tout le reste
  // (navigations, API, Supabase, etc.) passe intégralement sans y toucher,
  // pour ne jamais interférer avec le fonctionnement normal du site.
  const url = new URL(event.request.url)
  const isOwnStaticIcon =
    event.request.method === "GET" &&
    url.origin === self.location.origin &&
    /^\/(icon-192x192|icon-512x512|apple-icon)\.png$/.test(url.pathname)

  if (isOwnStaticIcon) {
    event.respondWith(fetch(url.pathname))
  }
})
