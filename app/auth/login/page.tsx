"use client"

import { createClient } from "@/lib/supabase/client"
import { EcgTrace } from "@/components/auth/ecg-trace"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Smartphone, Share, X } from "lucide-react"

// Composant PWA isolé pour éviter le BAILOUT_TO_CLIENT_SIDE_RENDERING global
function InstallPWAButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showInstallBtn, setShowInstallBtn] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [showInstallGuide, setShowInstallGuide] = useState(false)

  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase()
    const ios = /iphone|ipad|ipod/.test(userAgent)
    setIsIOS(ios)

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowInstallBtn(true)
    }
    window.addEventListener("beforeinstallprompt", handler)

    if (ios && !(window.navigator as any).standalone) {
      setShowInstallBtn(true)
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler)
    }
  }, [])

  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      deferredPrompt.userChoice.then(({ outcome }: { outcome: string }) => {
        if (outcome === "accepted") {
          setDeferredPrompt(null)
          setShowInstallBtn(false)
        }
      })
    } else {
      setShowInstallGuide(true)
    }
  }

  if (!showInstallBtn) return null

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        className="absolute right-4 top-4 z-50 flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-bold text-[#1B3A5C] shadow-sm backdrop-blur-md transition-all hover:bg-slate-50 hover:shadow-md"
      >
        <Smartphone className="size-3.5 text-slate-500" />
        <span>Installer l&apos;application</span>
      </button>

      {showInstallGuide && isIOS && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">
                Installer l&apos;application
              </h3>
              <button
                type="button"
                onClick={() => setShowInstallGuide(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="size-4" />
              </button>
            </div>
            <ol className="space-y-3 text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#0F2A47] text-[10px] font-bold text-white">1</span>
                <span>Appuyez sur l&apos;icône Partager <Share className="inline size-4 text-blue-500" /> en bas de Safari</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#0F2A47] text-[10px] font-bold text-white">2</span>
                <span>Faites défiler et appuyez sur « Sur l&apos;écran d&apos;accueil »</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#0F2A47] text-[10px] font-bold text-white">3</span>
                <span>Appuyez sur « Ajouter »</span>
              </li>
            </ol>
            <button
              type="button"
              onClick={() => setShowInstallGuide(false)}
              className="mt-5 w-full rounded-lg bg-[#0F2A47] py-2.5 text-sm font-medium text-white"
            >
              Compris
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default function Page() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      if (!email || !password) {
        throw new Error("L'email et le mot de passe sont requis")
      }

      let supabase
      try {
        supabase = createClient()
        if (!supabase) {
          throw new Error("Le client Supabase n'est pas disponible")
        }
      } catch (clientError) {
        console.error("[auth/login] Failed to create Supabase client:", clientError)
        throw new Error(
          "Le service d'authentification n'est pas correctement configuré. Veuillez contacter le support.",
        )
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error("[auth/login] Auth error:", error.message, error.status)
        if (error.status === 400) {
          throw new Error("Email ou mot de passe incorrect. Veuillez réessayer.")
        } else if (error.status === 422) {
          throw new Error("Email introuvable. Vérifiez votre email ou créez un compte.")
        } else if (error.status === 401) {
          throw new Error("Identifiants invalides. Vérifiez votre email et votre mot de passe.")
        } else {
          throw new Error(error.message || "Échec de l'authentification. Veuillez réessayer.")
        }
      }

      if (!data.user) {
        console.error("[auth/login] No user data in response")
        throw new Error("Échec de la connexion : aucune donnée utilisateur retournée")
      }

      router.push("/protected/planning")
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Une erreur inattendue est survenue"
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="layout-main flex h-full min-h-0 w-full overflow-y-auto bg-[#FAFBFC] text-slate-900">
      <div className="flex min-h-full w-full flex-col lg:flex-row">
        {/* Panneau gauche — identité Cardiomaine */}
        <aside className="relative flex w-full flex-col justify-between overflow-hidden bg-[#0F2A47] px-6 py-8 text-white sm:px-10 lg:w-[48%] lg:min-h-svh lg:px-12 lg:py-14">
          <div className="pointer-events-none absolute inset-0 opacity-[0.12]" aria-hidden="true">
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-4 lg:px-8">
              <EcgTrace className="ecg-trace overflow-visible h-24 w-full text-[#B23A48] sm:h-32 lg:h-40" />
            </div>
          </div>

          <div className="relative z-10">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-300">
              Planning médical
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Cardiomaine
            </h1>
          </div>

          <div className="relative z-10 mt-6 text-[#B23A48] lg:hidden">
            <EcgTrace className="ecg-trace overflow-visible h-10 w-full max-w-xs" strokeWidth={1.25} />
          </div>

          <p className="relative z-10 mt-8 hidden text-xs text-slate-400 lg:block">
            Accès réservé à l&apos;équipe
          </p>
        </aside>

        {/* Panneau droit — formulaire de connexion */}
        <main className="flex w-full flex-1 items-center justify-center px-6 py-10 sm:px-10 lg:w-[52%] lg:px-16 lg:py-14">
          <div className="w-full max-w-[400px]">
            <div className="mb-8">
              <h2 className="text-2xl font-semibold tracking-tight text-[#0F2A47]">
                Connexion
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Entrez votre email et votre mot de passe pour accéder au planning.
              </p>
            </div>

            {error && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="flex flex-col gap-5">
              <div className="grid gap-2">
                <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:border-[#1B3A5C] focus-visible:ring-[#1B3A5C]/30"
                />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                    Mot de passe
                  </Label>
                  <Link
                    href="/auth/forgot-password"
                    className="text-sm text-[#1B3A5C] underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B23A48]/50"
                  >
                    Mot de passe oublié ?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 border-slate-300 bg-white text-slate-900 focus-visible:border-[#1B3A5C] focus-visible:ring-[#1B3A5C]/30"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="h-11 w-full bg-[#B23A48] text-white hover:bg-[#9C2B3E] focus-visible:ring-[#B23A48]/40 disabled:opacity-60"
              >
                {isLoading ? "Connexion en cours…" : "Se connecter"}
              </Button>

              <p className="text-center text-sm text-slate-600">
                Pas encore de compte ?{" "}
                <Link
                  href="/auth/sign-up"
                  className="font-medium text-[#1B3A5C] underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B23A48]/50"
                >
                  S&apos;inscrire
                </Link>
              </p>
            </form>
          </div>
        </main>
      </div>

      {/* Bouton PWA conditionnel — isolé dans son propre composant client */}
      <InstallPWAButton />
    </div>
  )
}
