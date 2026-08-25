"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

/**
 * Capture l'événement natif d'installation PWA (beforeinstallprompt) dès le
 * tout premier chargement de l'app, peu importe la page visitée en premier
 * (confirmé utilisateur 25/08/2026) - avant, la capture ne démarrait qu'au
 * montage de la page de connexion, ce qui retardait un peu la disponibilité
 * du vrai bouton natif. Partagé via un contexte pour que n'importe quelle
 * page (pas seulement /auth/login) puisse proposer l'installation.
 */

type PWAInstallContextValue = {
  /** true dès que le navigateur a confirmé que l'app est installable */
  canInstall: boolean
  /** true sur iOS/iPadOS (où l'installation passe par "Partager > Sur l'écran d'accueil", pas de prompt natif) */
  isIOS: boolean
  /** Déclenche la vraie fenêtre native d'installation si disponible. Retourne false si aucun prompt natif n'est encore prêt (afficher un guide manuel dans ce cas). */
  promptInstall: () => Promise<boolean>
}

const PWAInstallContext = createContext<PWAInstallContextValue>({
  canInstall: false,
  isIOS: false,
  promptInstall: async () => false,
})

export function usePWAInstall() {
  return useContext(PWAInstallContext)
}

export function PWAInstallProvider({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase()
    setIsIOS(/iphone|ipad|ipod/.test(userAgent))

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener("beforeinstallprompt", handler)

    const onInstalled = () => setDeferredPrompt(null)
    window.addEventListener("appinstalled", onInstalled)

    return () => {
      window.removeEventListener("beforeinstallprompt", handler)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  const promptInstall = async () => {
    if (!deferredPrompt) return false
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === "accepted") {
      setDeferredPrompt(null)
    }
    return true
  }

  return (
    <PWAInstallContext.Provider
      value={{ canInstall: Boolean(deferredPrompt), isIOS, promptInstall }}
    >
      {children}
    </PWAInstallContext.Provider>
  )
}
