"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"

/**
 * Surveille l'arrivée d'une nouvelle version de l'application et évite
 * l'écran blanc après un déploiement.
 *
 * Deux problèmes distincts, deux traitements :
 *
 * 1. Un onglet PWA resté ouvert continue de tourner sur l'ancien code.
 *    `schedule-app.tsx` charge plusieurs composants en `lazy()` (modale
 *    Congés, génération des gardes, import d'historique) : leur chunk n'est
 *    demandé qu'au moment du clic. Si un déploiement est passé entre-temps,
 *    le fichier n'existe plus et l'import échoue. Sans error boundary, React
 *    démonte l'arbre entier — écran blanc. On recharge alors une seule fois,
 *    ce qui suffit puisque le nouveau HTML référence les nouveaux chunks.
 *
 * 2. Détection proactive : on compare la version qui a rendu la page à celle
 *    servie par `/api/version`, et on propose de recharger. La comparaison ne
 *    passe pas par le service worker : `sw.js` est statique, un déploiement
 *    qui ne le modifie pas ne déclenche aucune mise à jour côté navigateur.
 *    Le worker en attente reste néanmoins un signal complémentaire.
 *
 * Le rechargement n'est jamais imposé dans le cas 2 : une modale d'affectation
 * peut contenir une saisie non enregistrée, c'est à l'utilisateur de choisir
 * son moment.
 */

const VERSION_ENDPOINT = "/api/version"
const POLL_INTERVAL_MS = 15 * 60 * 1000
const CHUNK_RELOAD_KEY = "pwa:chunk-reload-at"
const CHUNK_RELOAD_COOLDOWN_MS = 60 * 1000

function isChunkLoadError(value: unknown): boolean {
  if (!value) return false
  const err = value as { name?: string; message?: string }
  const name = typeof err.name === "string" ? err.name : ""
  const message = typeof err.message === "string" ? err.message : String(value)
  return (
    name === "ChunkLoadError" ||
    /Loading chunk [^\s]+ failed/i.test(message) ||
    /Loading CSS chunk/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message)
  )
}

export default function AppUpdateWatcher({ buildId }: { buildId: string }) {
  // Refs : ces valeurs ne doivent jamais provoquer de rendu.
  const promptShownRef = useRef(false)
  const reloadingRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    const reloadNow = () => {
      if (reloadingRef.current) return
      reloadingRef.current = true
      window.location.reload()
    }

    // ── 1. Filet anti-écran blanc sur chunk manquant ────────────────────────
    const handleChunkFailure = (value: unknown) => {
      if (!isChunkLoadError(value)) return

      // Garde-fou anti-boucle : si l'échec persiste après un rechargement, le
      // problème n'est pas la version — on n'insiste pas et on le dit.
      let last = 0
      try {
        last = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY)) || 0
      } catch {
        // sessionStorage indisponible (mode privé strict) : on tente quand même.
      }

      if (last && Date.now() - last < CHUNK_RELOAD_COOLDOWN_MS) {
        toast.error("Une ressource de l'application n'a pas pu être chargée.", {
          description: "Vérifiez votre connexion, puis rechargez la page.",
          duration: Infinity,
          action: { label: "Recharger", onClick: reloadNow },
        })
        return
      }

      try {
        window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()))
      } catch {
        // idem
      }
      reloadNow()
    }

    const onError = (e: ErrorEvent) => handleChunkFailure(e.error ?? e.message)
    const onRejection = (e: PromiseRejectionEvent) => handleChunkFailure(e.reason)

    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onRejection)

    // ── 2. Détection d'une nouvelle version ─────────────────────────────────
    const applyUpdate = async () => {
      // Si un service worker attend, on le laisse prendre la main avant de
      // recharger, sinon la page rechargée resterait pilotée par l'ancien.
      try {
        const reg = await navigator.serviceWorker?.getRegistration()
        if (reg?.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" })
          // `controllerchange` peut ne jamais arriver : on ne bloque pas dessus.
          window.setTimeout(reloadNow, 1500)
          return
        }
      } catch {
        // Service worker indisponible : le rechargement seul suffit.
      }
      reloadNow()
    }

    const promptUpdate = () => {
      if (promptShownRef.current || reloadingRef.current) return
      promptShownRef.current = true
      toast("Nouvelle version disponible", {
        description: "Rechargez pour appliquer la mise à jour.",
        duration: Infinity,
        action: { label: "Recharger", onClick: () => void applyUpdate() },
      })
    }

    const checkVersion = async () => {
      if (cancelled || document.visibilityState !== "visible") return
      try {
        const res = await fetch(VERSION_ENDPOINT, { cache: "no-store" })
        if (!res.ok) return
        const data = (await res.json()) as { buildId?: string }
        if (!cancelled && data.buildId && data.buildId !== buildId) promptUpdate()
      } catch {
        // Hors ligne ou endpoint injoignable : sans conséquence, on retentera.
      }
    }

    const interval = window.setInterval(() => void checkVersion(), POLL_INTERVAL_MS)

    const onVisibility = () => {
      if (document.visibilityState !== "visible") return
      void checkVersion()
      // Une vérification du service worker n'a lieu qu'à la navigation : on la
      // déclenche explicitement au retour sur l'onglet.
      void navigator.serviceWorker?.getRegistration().then((reg) => reg?.update().catch(() => {}))
    }

    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("online", onVisibility)

    // ── 3. Service worker en attente = signal complémentaire ────────────────
    let onControllerChange: (() => void) | null = null

    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      onControllerChange = () => reloadNow()
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange)

      navigator.serviceWorker
        .getRegistration()
        .then((reg) => {
          if (!reg || cancelled) return

          // Un worker déjà en attente au montage : mise à jour installée avant
          // que ce composant n'existe.
          if (reg.waiting && navigator.serviceWorker.controller) promptUpdate()

          reg.addEventListener("updatefound", () => {
            const installing = reg.installing
            if (!installing) return
            installing.addEventListener("statechange", () => {
              // `controller` absent = toute première installation, pas une
              // mise à jour : rien à signaler à l'utilisateur.
              if (installing.state === "installed" && navigator.serviceWorker.controller) {
                promptUpdate()
              }
            })
          })
        })
        .catch(() => {
          // Enregistrement indisponible : la détection par /api/version reste.
        })
    }

    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onRejection)
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("online", onVisibility)
      if (onControllerChange) {
        navigator.serviceWorker?.removeEventListener("controllerchange", onControllerChange)
      }
    }
  }, [buildId])

  return null
}
