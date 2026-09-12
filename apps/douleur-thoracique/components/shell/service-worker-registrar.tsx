"use client"

import { useEffect } from "react"

/**
 * Enregistre le service worker qui rend l'application utilisable hors ligne.
 *
 * Le service worker n'est déposé dans `out/` que par `scripts/build-sw.mjs`,
 * exécuté après `next build`. En développement il n'existe pas : on se contente
 * alors de désinscrire toute instance héritée d'une session précédente, sans
 * quoi un ancien cache masquerait les modifications en cours.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return

    const isDev = process.env.NODE_ENV !== "production"

    const run = async () => {
      try {
        if (isDev) {
          const registrations = await navigator.serviceWorker.getRegistrations()
          await Promise.all(registrations.map((r) => r.unregister()))
          return
        }

        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" })

        // Une nouvelle version prête à prendre la main : on l'active
        // immédiatement puis on recharge une seule fois la page afin que le
        // clinicien ne reste pas sur une version périmée de l'algorithme.
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing
          if (!installing) return
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              installing.postMessage({ type: "SKIP_WAITING" })
            }
          })
        })

        let refreshing = false
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (refreshing) return
          refreshing = true
          window.location.reload()
        })
      } catch {
        // L'absence de service worker dégrade l'app en simple site web :
        // aucun message d'erreur à afficher au clinicien.
      }
    }

    if (document.readyState === "complete") void run()
    else {
      const onLoad = () => void run()
      window.addEventListener("load", onLoad, { once: true })
      return () => window.removeEventListener("load", onLoad)
    }
  }, [])

  return null
}

export default ServiceWorkerRegistrar
