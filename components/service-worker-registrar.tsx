"use client"
import { useEffect } from "react"

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      // Enregistre le service worker : requis pour rendre l'app installable (PWA) sur Android/Chrome.
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("[v0] Échec de l'enregistrement du service worker:", err)
      })
    }
  }, [])

  return null
}
