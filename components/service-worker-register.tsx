"use client"

import { useEffect } from "react"

/**
 * Enregistre le service worker pour l'installabilité PWA (icône
 * d'installation dans le navigateur, ajout à l'écran d'accueil
 * iOS/Android, installation bureau) - confirmé utilisateur 24/08/2026.
 * Un service worker minimal suffit pour que Chrome/Edge/Android proposent
 * l'installation ; pas de mise en cache offline agressive pour ne pas
 * risquer d'afficher un planning périmé.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("[pwa] Échec de l'enregistrement du service worker:", err)
    })
  }, [])

  return null
}
