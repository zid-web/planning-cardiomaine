"use client"
import { useEffect, useState } from "react"
import { Download, Share, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function InstallButton() {
  const [promptEvent, setPromptEvent] = useState<any>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [showIOSInstructions, setShowIOSInstructions] = useState(false)

  useEffect(() => {
    // Détecter iOS
    const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    setIsIOS(isIosDevice)

    // Détecter si l'app est déjà installée (mode standalone) pour masquer l'icône
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true
    setIsStandalone(standalone)

    // Écouter l'événement beforeinstallprompt (Android/Chrome)
    const handler = (e: any) => {
      e.preventDefault()
      setPromptEvent(e)
    }
    window.addEventListener("beforeinstallprompt", handler)

    // Masquer l'icône une fois l'installation effectuée
    const installedHandler = () => setPromptEvent(null)
    window.addEventListener("appinstalled", installedHandler)

    return () => {
      window.removeEventListener("beforeinstallprompt", handler)
      window.removeEventListener("appinstalled", installedHandler)
    }
  }, [])

  const installApp = () => {
    if (isIOS) {
      setShowIOSInstructions(true)
    } else if (promptEvent) {
      promptEvent.prompt()
      promptEvent.userChoice.then(() => setPromptEvent(null))
    }
  }

  // Ne rien afficher si déjà installée, ou si aucune méthode d'installation n'est disponible
  if (isStandalone) return null
  if (!promptEvent && !isIOS) return null

  return (
    <>
      <Button
        onClick={installApp}
        variant="ghost"
        size="icon"
        title="Installer l'application"
        aria-label="Installer l'application sur l'écran d'accueil"
        className="text-gray-500 hover:text-blue-600"
      >
        <Download className="h-5 w-5" />
      </Button>

      {showIOSInstructions && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
          <Card className="w-full max-w-md relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2"
              onClick={() => setShowIOSInstructions(false)}
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </Button>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share className="h-6 w-6" />
                Installation sur iPhone
              </CardTitle>
              <CardDescription>Suivez ces étapes pour ajouter l&apos;app à votre écran d&apos;accueil</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="list-decimal list-inside space-y-3 text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  Appuyez sur le bouton <span className="font-bold text-slate-900">Partager</span>{" "}
                  <Share className="h-4 w-4" />
                </li>
                <li className="flex items-center gap-2">
                  Faites défiler vers le bas et choisissez{" "}
                  <span className="font-bold text-slate-900">&quot;Sur l&apos;écran d&apos;accueil&quot;</span>
                </li>
                <li className="flex items-center gap-2">
                  Appuyez sur <span className="font-bold text-slate-900">Ajouter</span> en haut à droite
                </li>
              </ol>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
