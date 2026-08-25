"use client"

import { createClient } from "@/lib/supabase/client"
import { EcgTrace } from "@/components/auth/ecg-trace"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Smartphone, Share, X } from "lucide-react"
import { usePWAInstall } from "@/components/pwa-install-provider"

export default function Page() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  // Contexte partagé (confirmé utilisateur 25/08/2026) : la capture de
  // l'événement d'installation démarre désormais dès app/layout.tsx (tout
  // premier chargement de l'app), pas seulement au montage de cette page -
  // le vrai bouton natif a donc plus de temps pour devenir disponible.
  const { canInstall, isIOS, promptInstall } = usePWAInstall()
  const [showInstallGuide, setShowInstallGuide] = useState(false)
  const showInstallBtn = canInstall || (isIOS && typeof window !== "undefined" && !(window.navigator as any).standalone)

  const handleInstallClick = async () => {
    const triggered = await promptInstall()
    if (!triggered) {
      setShowInstallGuide(true)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      if (!email || !password) {
        throw new Error("Email and password are required")
      }

      let supabase
      try {
        supabase = createClient()
        if (!supabase) {
          throw new Error("Supabase client is not available")
        }
      } catch (clientError) {
        console.error("[auth/login] Failed to create Supabase client:", clientError)
        throw new Error(
          "Authentication service is not properly configured. Please contact support.",
        )
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error("[auth/login] Auth error:", error.message, error.status)
        if (error.status === 400) {
          throw new Error("Invalid email or password. Please try again.")
        } else if (error.status === 422) {
          throw new Error("Email not found. Please check your email or sign up.")
        } else if (error.status === 401) {
          throw new Error("Invalid credentials. Please check your email and password.")
        } else {
          throw new Error(error.message || "Authentication failed. Please try again.")
        }
      }

      if (!data.user) {
        console.error("[auth/login] No user data in response")
        throw new Error("Login failed: No user data returned")
      }

      router.push("/protected/planning")
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "An error occurred"
      console.error("[auth/login] Login failed:", errorMessage)
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="layout-main flex h-full min-h-0 w-full overflow-y-auto bg-[#FAFBFC] text-slate-900">
      <div className="flex min-h-full w-full flex-col lg:flex-row">
        {/* Panneau branding */}
        <aside className="relative flex w-full flex-col justify-between overflow-hidden bg-[#0F2A47] px-6 py-8 text-white sm:px-10 lg:w-[48%] lg:min-h-svh lg:px-12 lg:py-14">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.12]"
            aria-hidden="true"
          >
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-4 lg:px-8">
              <EcgTrace className="h-24 w-full text-[#B23A48] sm:h-32 lg:h-40" variant="hero" />
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

          {/* Séparateur ECG mobile */}
          <div className="relative z-10 mt-6 text-[#B23A48] lg:hidden">
            <EcgTrace className="h-10 w-full max-w-xs" variant="separator" />
          </div>

          <p className="relative z-10 mt-8 hidden text-xs text-slate-400 lg:block">
            Accès réservé à l&apos;équipe
          </p>
        </aside>

        {/* Panneau formulaire */}
        <main className="flex w-full flex-1 items-center justify-center px-6 py-10 sm:px-10 lg:w-[52%] lg:px-16 lg:py-14">
          <div className="w-full max-w-[400px]">
            <div className="mb-8">
              <h2 className="text-2xl font-semibold tracking-tight text-[#0F2A47]">Connexion</h2>
              <p className="mt-2 text-sm text-slate-500">
                Entrez votre email et votre mot de passe pour accéder au planning.
              </p>
            </div>

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
                    Password
                  </Label>
                  <Link
                    href="/auth/forgot-password"
                    className="text-sm text-[#1B3A5C] underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B23A48]/50"
                  >
                    Forgot your password?
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

              {error && (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="h-11 w-full bg-[#B23A48] text-white hover:bg-[#9C2B3E] focus-visible:ring-[#B23A48]/40 disabled:opacity-60"
                disabled={isLoading}
              >
                {isLoading ? "Logging in..." : "Login"}
              </Button>

              <p className="text-center text-sm text-slate-600">
                Don&apos;t have an account?{" "}
                <Link
                  href="/auth/sign-up"
                  className="font-medium text-[#1B3A5C] underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B23A48]/50"
                >
                  Sign up
                </Link>
              </p>
            </form>
          </div>
        </main>
      </div>

      <button
        type="button"
        onClick={handleInstallClick}
        className="absolute right-4 top-4 z-50 flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-bold text-[#1B3A5C] shadow-sm backdrop-blur-md transition-all hover:bg-slate-50 hover:shadow-md"
      >
        <Smartphone className="size-3.5 text-slate-500" />
        <span>Installer l&apos;application</span>
      </button>

      {showInstallGuide && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 flex flex-col gap-4 text-slate-800">
            <button
              onClick={() => setShowInstallGuide(false)}
              className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            >
              <X className="size-5" />
            </button>

            <div className="flex flex-col items-center text-center gap-2 mt-2">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-[#0F2A47] text-white shadow-md">
                <Smartphone className="size-6" />
              </div>
              <h3 className="text-lg font-bold tracking-tight text-slate-900 mt-2">Installer l&apos;application</h3>
              <p className="text-xs text-slate-500">Cardiomaine Planning</p>
            </div>

            <div className="space-y-3.5 text-sm text-slate-600">
              {isIOS ? (
                <div className="text-xs leading-relaxed text-slate-700 space-y-1 bg-amber-50/50 border border-amber-100/50 rounded-xl p-3.5">
                  <p className="font-bold">Sur iPhone & iPad (Safari) :</p>
                  <p className="flex items-center gap-1 flex-wrap">
                    1. Appuyez sur le bouton de partage <Share className="size-3.5 text-blue-600 inline" /> en bas de Safari.
                  </p>
                  <p>
                    2. Sélectionnez <span className="font-bold">&ldquo;Sur l&apos;écran d&apos;accueil&rdquo;</span> (icône <span className="font-extrabold border rounded px-1">+</span>).
                  </p>
                  <p>
                    3. Confirmez pour installer l&apos;application.
                  </p>
                </div>
              ) : (
                <div className="text-xs leading-relaxed text-slate-700 space-y-1 bg-blue-50/50 border border-blue-100/50 rounded-xl p-3.5">
                  <p className="font-bold">Instructions :</p>
                  <p>1. Appuyez sur le menu du navigateur (icône menu en haut à droite).</p>
                  <p>2. Choisissez <span className="font-bold">&ldquo;Installer l&apos;application&rdquo;</span> ou <span className="font-bold">&ldquo;Ajouter à l&apos;écran d&apos;accueil&rdquo;</span>.</p>
                </div>
              )}
            </div>

            <Button
              onClick={() => setShowInstallGuide(false)}
              className="w-full bg-[#0F2A47] text-white hover:bg-[#1B3A5C] font-bold"
            >
              Fermer
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
