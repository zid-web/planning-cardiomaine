"use client"
import { useEffect, useState } from "react"
import { Download, Share, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function InstallButton() {
  const [promptEvent, setPromptEvent] = useState<any>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [showIOSInstructions, setShowIOSInstructions] = useState(false)

  useEffect(() => {
    // Check if user is on iOS
    const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    setIsIOS(isIosDevice)

    // Listen for beforeinstallprompt event (Android/Chrome)
    const handler = (e: any) => {
      e.preventDefault()
      setPromptEvent(e)
    }
    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  const installApp = () => {
    if (isIOS) {
      setShowIOSInstructions(true)
    } else if (promptEvent) {
      promptEvent.prompt()
      promptEvent.userChoice.then(() => setPromptEvent(null))
    }
  }

  if (!promptEvent && !isIOS) return null

  return (
    <>
      <Button onClick={installApp} className="gap-2 shadow-lg" variant="default">
        <Download className="h-4 w-4" />
        Installer l'application
      </Button>

      {showIOSInstructions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
          <Card className="w-full max-w-md relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2"
              onClick={() => setShowIOSInstructions(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share className="h-6 w-6" />
                Installation sur iPhone
              </CardTitle>
              <CardDescription>Suivez ces étapes pour ajouter l'app à votre écran d'accueil</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="list-decimal list-inside space-y-3 text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  Appuyez sur le bouton <span className="font-bold text-slate-900">Partager</span>{" "}
                  <Share className="h-4 w-4" />
                </li>
                <li className="flex items-center gap-2">
                  Faites défiler vers le bas et choisissez{" "}
                  <span className="font-bold text-slate-900">"Sur l'écran d'accueil"</span>
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
