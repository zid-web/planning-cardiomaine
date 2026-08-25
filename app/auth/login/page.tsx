"use client"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Smartphone, Share, X } from "lucide-react"

// ─── SVG ECG inline (évite la dépendance au composant EcgTrace) ──────────────
const ECG_PATH =
  "M0 40 H18 C20 40 21 38 22 36 C23 34 24 40 26 40 H38 C39 40 40 28 41 22 L44 8 L48 62 L51 34 L53 40 H68 C70 40 72 32 74 30 C78 26 82 38 84 40 H120 C122 40 123 38 124 36 C125 34 126 40 128 40 H160"

// ─── Bouton PWA isolé ─────────────────────────────────────────────────────────
function InstallPWAButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showInstallBtn, setShowInstallBtn] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [showInstallGuide, setShowInstallGuide] = useState(false)

  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase()
    const ios = /iphone|ipad|ipod/.test(ua)
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

    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  if (!showInstallBtn) return null

  const handleInstall = () => {
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

  return (
    <>
      <button
        type="button"
        onClick={handleInstall}
        style={{
          position: "absolute",
          top: "1rem",
          right: "1rem",
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          gap: "0.375rem",
          borderRadius: "9999px",
          border: "1px solid #e2e8f0",
          backgroundColor: "rgba(255,255,255,0.9)",
          padding: "0.375rem 0.75rem",
          fontSize: "0.75rem",
          fontWeight: 700,
          color: "#1B3A5C",
          boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          backdropFilter: "blur(8px)",
          cursor: "pointer",
        }}
      >
        <Smartphone style={{ width: "0.875rem", height: "0.875rem", color: "#64748b" }} />
        <span>Installer l&apos;application</span>
      </button>

      {showInstallGuide && isIOS && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            padding: "1rem",
            backgroundColor: "rgba(0,0,0,0.4)",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "24rem",
              borderRadius: "1rem",
              backgroundColor: "#fff",
              padding: "1.5rem",
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <h3 style={{ fontWeight: 600, color: "#1e293b" }}>Installer l&apos;application</h3>
              <button
                type="button"
                onClick={() => setShowInstallGuide(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
              >
                <X style={{ width: "1rem", height: "1rem" }} />
              </button>
            </div>
            <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.875rem", color: "#475569" }}>
              {[
                <>Appuyez sur l&apos;icône Partager <Share style={{ display: "inline", width: "1rem", height: "1rem", color: "#3b82f6" }} /> en bas de Safari</>,
                <>Faites défiler et appuyez sur « Sur l&apos;écran d&apos;accueil »</>,
                <>Appuyez sur « Ajouter »</>,
              ].map((step, i) => (
                <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                  <span
                    style={{
                      flexShrink: 0,
                      width: "1.25rem",
                      height: "1.25rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "9999px",
                      backgroundColor: "#0F2A47",
                      color: "#fff",
                      fontSize: "0.625rem",
                      fontWeight: 700,
                    }}
                  >
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={() => setShowInstallGuide(false)}
              style={{
                marginTop: "1.25rem",
                width: "100%",
                borderRadius: "0.5rem",
                backgroundColor: "#0F2A47",
                padding: "0.625rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "#fff",
                border: "none",
                cursor: "pointer",
              }}
            >
              Compris
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function LoginPage() {
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

      const supabase = createClient()
      if (!supabase) throw new Error("Service d'authentification indisponible")

      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

      if (authError) {
        if (authError.status === 400 || authError.status === 401) {
          throw new Error("Email ou mot de passe incorrect.")
        } else if (authError.status === 422) {
          throw new Error("Email introuvable. Vérifiez votre adresse ou créez un compte.")
        } else {
          throw new Error(authError.message || "Échec de l'authentification. Veuillez réessayer.")
        }
      }

      if (!data.user) throw new Error("Échec de la connexion.")

      router.push("/protected/planning")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Une erreur inattendue est survenue")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100dvh",
        width: "100%",
        backgroundColor: "#FAFBFC",
        color: "#0f172a",
        position: "relative",
        overflow: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          minHeight: "100%",
          width: "100%",
          flexDirection: "column",
        }}
        className="lg:flex-row"
      >
        {/* ── Panneau gauche — identité Cardiomaine ─────────────────────── */}
        <aside
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            overflow: "hidden",
            backgroundColor: "#0F2A47",
            padding: "2rem 1.5rem",
            color: "#fff",
            minHeight: "220px",
          }}
          className="sm:px-10 lg:w-[48%] lg:min-h-screen lg:px-12 lg:py-14"
        >
          {/* Tracé ECG en filigrane */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              opacity: 0.15,
              display: "flex",
              alignItems: "center",
            }}
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 160 70"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ width: "100%", overflow: "visible" }}
              aria-hidden="true"
            >
              <path
                d={ECG_PATH}
                stroke="#B23A48"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>

          {/* Logo */}
          <div style={{ position: "relative", zIndex: 10 }}>
            <p
              style={{
                fontSize: "0.6875rem",
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                color: "#cbd5e1",
                margin: 0,
              }}
            >
              Planning médical
            </p>
            <h1
              style={{
                marginTop: "0.75rem",
                fontSize: "clamp(1.875rem, 4vw, 3rem)",
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: "#fff",
                margin: "0.75rem 0 0",
              }}
            >
              Cardiomaine
            </h1>
          </div>

          {/* Tracé ECG mobile (petit, visible seulement < lg) */}
          <div
            style={{ position: "relative", zIndex: 10, marginTop: "1.5rem", color: "#B23A48" }}
            className="lg:hidden"
          >
            <svg
              viewBox="0 0 160 70"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ width: "100%", maxWidth: "18rem", height: "2.5rem", overflow: "visible" }}
              aria-hidden="true"
            >
              <path
                d={ECG_PATH}
                stroke="#B23A48"
                strokeWidth="1.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>

          <p
            style={{
              position: "relative",
              zIndex: 10,
              marginTop: "2rem",
              fontSize: "0.75rem",
              color: "#94a3b8",
            }}
            className="hidden lg:block"
          >
            Accès réservé à l&apos;équipe
          </p>
        </aside>

        {/* ── Panneau droit — formulaire de connexion ───────────────────── */}
        <main
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: "2.5rem 1.5rem",
          }}
          className="sm:px-10 lg:w-[52%] lg:px-16 lg:py-14"
        >
          <div style={{ width: "100%", maxWidth: "25rem" }}>
            {/* En-tête */}
            <div style={{ marginBottom: "2rem" }}>
              <h2
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 600,
                  letterSpacing: "-0.02em",
                  color: "#0F2A47",
                  margin: 0,
                }}
              >
                Connexion
              </h2>
              <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#64748b" }}>
                Entrez votre email et votre mot de passe pour accéder au planning.
              </p>
            </div>

            {/* Message d'erreur */}
            {error && (
              <div
                style={{
                  marginBottom: "1rem",
                  borderRadius: "0.375rem",
                  border: "1px solid #fecaca",
                  backgroundColor: "#fef2f2",
                  padding: "0.75rem 1rem",
                  fontSize: "0.875rem",
                  color: "#b91c1c",
                }}
              >
                {error}
              </div>
            )}

            {/* Formulaire */}
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {/* Email */}
              <div style={{ display: "grid", gap: "0.5rem" }}>
                <Label htmlFor="email" className="text-sm font-medium" style={{ color: "#334155" }}>
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
                  style={{ height: "2.75rem", borderColor: "#cbd5e1", backgroundColor: "#fff", color: "#0f172a" }}
                />
              </div>

              {/* Mot de passe */}
              <div style={{ display: "grid", gap: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                  <Label htmlFor="password" className="text-sm font-medium" style={{ color: "#334155" }}>
                    Mot de passe
                  </Label>
                  <Link
                    href="/auth/forgot-password"
                    style={{ fontSize: "0.875rem", color: "#1B3A5C", textDecoration: "none" }}
                    onMouseOver={(e) => (e.currentTarget.style.textDecoration = "underline")}
                    onMouseOut={(e) => (e.currentTarget.style.textDecoration = "none")}
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
                  style={{ height: "2.75rem", borderColor: "#cbd5e1", backgroundColor: "#fff", color: "#0f172a" }}
                />
              </div>

              {/* Bouton connexion */}
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  height: "2.75rem",
                  width: "100%",
                  borderRadius: "0.375rem",
                  backgroundColor: isLoading ? "#9C2B3E" : "#B23A48",
                  color: "#fff",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  border: "none",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  opacity: isLoading ? 0.7 : 1,
                  transition: "background-color 0.15s",
                }}
                onMouseOver={(e) => { if (!isLoading) e.currentTarget.style.backgroundColor = "#9C2B3E" }}
                onMouseOut={(e) => { if (!isLoading) e.currentTarget.style.backgroundColor = "#B23A48" }}
              >
                {isLoading ? "Connexion en cours…" : "Se connecter"}
              </button>

              <p style={{ textAlign: "center", fontSize: "0.875rem", color: "#475569" }}>
                Pas encore de compte ?{" "}
                <Link
                  href="/auth/sign-up"
                  style={{ fontWeight: 500, color: "#1B3A5C", textDecoration: "none" }}
                  onMouseOver={(e) => (e.currentTarget.style.textDecoration = "underline")}
                  onMouseOut={(e) => (e.currentTarget.style.textDecoration = "none")}
                >
                  S&apos;inscrire
                </Link>
              </p>
            </form>
          </div>
        </main>
      </div>

      {/* Bouton PWA — rendu uniquement si installable */}
      <InstallPWAButton />
    </div>
  )
}
