"use client"

import { useCallback, useEffect, useState } from "react"
import { Download, X, Share, Plus, MoreVertical } from "lucide-react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

const DISMISS_KEY = "dt-install-dismissed"

type Platform = "ios" | "android-chrome" | "desktop"

function detectPlatform(): Platform {
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua) && !("MSStream" in window)) return "ios"
  if (/Android/.test(ua)) return "android-chrome"
  return "desktop"
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
    document.referrer.startsWith("android-app://")
  )
}

/**
 * Bandeau d'installation de la PWA.
 *
 * Chrome / Edge / Android exposent `beforeinstallprompt` : un simple bouton
 * suffit. Safari iOS ne l'expose pas, on affiche alors la marche à suivre
 * « Partager → Sur l'écran d'accueil ». Le refus est mémorisé pour la journée.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [showHowTo, setShowHowTo] = useState(false)
  const [platform, setPlatform] = useState<Platform>("desktop")

  useEffect(() => {
    if (isStandalone()) return

    setPlatform(detectPlatform())

    let dismissedToday = false
    try {
      dismissedToday = localStorage.getItem(DISMISS_KEY) === new Date().toDateString()
    } catch {
      // Stockage indisponible (navigation privée) : on propose l'installation.
    }
    if (dismissedToday) return

    const onBeforeInstall = (event: Event) => {
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
      setVisible(true)
    }
    const onInstalled = () => {
      setDeferred(null)
      setVisible(false)
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall)
    window.addEventListener("appinstalled", onInstalled)

    // Sur iOS l'événement n'arrive jamais : on affiche le bandeau après un
    // court délai pour ne pas masquer le premier écran du wizard.
    const timer = window.setTimeout(() => setVisible(true), 1200)

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall)
      window.removeEventListener("appinstalled", onInstalled)
      window.clearTimeout(timer)
    }
  }, [])

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, new Date().toDateString())
    } catch {
      // Rien à mémoriser si le stockage est refusé.
    }
    setVisible(false)
    setShowHowTo(false)
  }, [])

  const install = useCallback(async () => {
    if (!deferred) {
      setShowHowTo(true)
      return
    }
    try {
      await deferred.prompt()
      const { outcome } = await deferred.userChoice
      if (outcome === "accepted") setVisible(false)
    } catch {
      setShowHowTo(true)
    } finally {
      setDeferred(null)
    }
  }, [deferred])

  if (!visible) return null

  return (
    <>
      <div>
        <div className="flex items-center gap-2 rounded-full border border-[#e2e8f0] bg-white p-1.5 pr-2 shadow-lg">
          <button
            type="button"
            onClick={install}
            className="flex items-center gap-1.5 rounded-full bg-[#1e293b] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#0f172a]"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Installer l&apos;application
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-full p-1 transition-colors hover:bg-[#f1f5f9]"
            aria-label="Masquer la proposition d'installation"
          >
            <X className="h-4 w-4 text-[#94a3b8]" aria-hidden="true" />
          </button>
        </div>
      </div>

      {showHowTo && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 print:hidden"
          onClick={() => setShowHowTo(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#1e293b]">Installer sur cet appareil</h2>
              <button
                type="button"
                onClick={() => setShowHowTo(false)}
                className="rounded-full p-1.5 hover:bg-[#f1f5f9]"
                aria-label="Fermer"
              >
                <X className="h-4 w-4 text-[#64748b]" aria-hidden="true" />
              </button>
            </div>

            {platform === "ios" ? (
              <ol className="space-y-2">
                <HowToStep index={1}>
                  Dans Safari, appuyez sur <Share className="inline h-4 w-4 align-text-bottom" /> Partager
                </HowToStep>
                <HowToStep index={2}>
                  Choisissez <Plus className="inline h-4 w-4 align-text-bottom" /> « Sur l&apos;écran d&apos;accueil »
                </HowToStep>
                <HowToStep index={3}>Confirmez avec « Ajouter »</HowToStep>
              </ol>
            ) : (
              <ol className="space-y-2">
                <HowToStep index={1}>
                  Ouvrez le menu <MoreVertical className="inline h-4 w-4 align-text-bottom" /> du navigateur
                </HowToStep>
                <HowToStep index={2}>
                  Choisissez « Installer l&apos;application » ou « Ajouter à l&apos;écran d&apos;accueil »
                </HowToStep>
                <HowToStep index={3}>Confirmez avec « Installer »</HowToStep>
              </ol>
            )}

            <p className="mt-4 text-[11px] leading-relaxed text-[#64748b]">
              Une fois installée, l&apos;application s&apos;ouvre en plein écran et fonctionne sans connexion.
            </p>
          </div>
        </div>
      )}
    </>
  )
}

function HowToStep({ index, children }: { index: number; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-lg bg-[#f8fafc] p-3">
      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#1e293b] text-xs font-bold text-white">
        {index}
      </span>
      <span className="text-xs text-[#334155]">{children}</span>
    </li>
  )
}

export default InstallPrompt
