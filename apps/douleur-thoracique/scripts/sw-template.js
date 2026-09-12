/* eslint-disable no-restricted-globals */
/**
 * Service worker de « Douleur Thoracique au Cabinet ».
 *
 * Ce fichier est un gabarit : `scripts/build-sw.mjs` y injecte, après
 * `next build`, la version du cache et la liste exacte des fichiers produits
 * dans `out/`. Ne pas l'enregistrer tel quel — il n'est servi que depuis
 * `out/sw.js`.
 *
 * Stratégies :
 *   · navigations            → réseau d'abord (3 s), repli sur le cache
 *   · /_next/static/*        → cache d'abord (noms hachés, contenu immuable)
 *   · autres ressources GET  → cache servi immédiatement, rafraîchi en fond
 */

const CACHE_VERSION = "__CACHE_VERSION__"
const CACHE_NAME = `douleur-thoracique-${CACHE_VERSION}`
const PRECACHE_URLS = __PRECACHE_MANIFEST__
const NAVIGATION_FALLBACK = "/"
const NETWORK_TIMEOUT_MS = 3000

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      // `addAll` échoue en bloc si une seule requête échoue : on tolère les
      // ressources manquantes pour ne jamais laisser l'installation en erreur.
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            const response = await fetch(url, { cache: "reload" })
            if (response.ok) await cache.put(url, response)
          } catch {
            /* ressource ignorée */
          }
        }),
      )
    })(),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys.filter((key) => key.startsWith("douleur-thoracique-") && key !== CACHE_NAME).map((key) => caches.delete(key)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting()
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request))
    return
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request))
    return
  }

  event.respondWith(staleWhileRevalidate(request))
})

/**
 * Réseau d'abord, avec une fenêtre courte : au cabinet, une connexion qui
 * traîne ne doit pas retarder l'ouverture de l'outil. Hors ligne, on sert la
 * page demandée si elle est en cache, sinon la racine du parcours.
 */
async function handleNavigation(request) {
  const cache = await caches.open(CACHE_NAME)

  try {
    const response = await withTimeout(fetch(request), NETWORK_TIMEOUT_MS)
    if (response && response.ok) {
      cache.put(request, response.clone())
      return response
    }
    if (response) return response
  } catch {
    /* bascule sur le cache */
  }

  const cached = (await cache.match(request, { ignoreSearch: true })) || (await cache.match(NAVIGATION_FALLBACK))
  if (cached) return cached

  return new Response(
    "<!doctype html><meta charset=utf-8><title>Hors ligne</title>" +
      "<p style=\"font:16px system-ui;padding:2rem\">Application indisponible hors ligne : ouvrez-la une fois avec une connexion pour l'installer.</p>",
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
  )
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.match(request)
  if (cached) return cached

  const response = await fetch(request)
  if (response.ok) cache.put(request, response.clone())
  return response
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.match(request)

  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone())
      return response
    })
    .catch(() => null)

  if (cached) return cached

  const response = await network
  return response || Response.error()
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}
