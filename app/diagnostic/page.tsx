"use client"

/**
 * Page de diagnostic de connexion — publique et sans donnée sensible.
 *
 * Contexte (consigne utilisateur 07/09/2026) : le problème d'authentification
 * ne se manifeste que sur les iPhone d'autres membres de l'équipe, que
 * l'administrateur ne peut pas inspecter lui-même. Cette page permet à la
 * personne bloquée de relever l'état réel de son appareil et de l'envoyer.
 *
 * Deux contraintes dictent la conception :
 *
 * 1. **Publique.** La panne à diagnostiquer est précisément « je n'arrive pas
 *    à me connecter » : une page protégée renverrait l'utilisateur vers la
 *    connexion, donc vers le mur qu'on cherche à comprendre. `/diagnostic`
 *    est donc déclarée dans `publicRoutes` de `proxy.ts`.
 * 2. **Aucun secret affiché.** Ni jeton d'accès, ni jeton de rafraîchissement,
 *    ni email, ni clé. Uniquement des états, des durées et des noms de
 *    cookies — sans leur valeur. Le rapport peut donc circuler par message
 *    sans rien exposer.
 */

import { useCallback, useEffect, useState } from "react"

import { createClient } from "@/lib/supabase/client"

type Row = { label: string; value: string; warn?: boolean }

const SUPABASE_COOKIE = /^sb-.*-auth-token(\.\d+)?$/

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return "—"
  const sign = seconds < 0 ? "expiré depuis " : ""
  const s = Math.abs(Math.round(seconds))
  if (s < 60) return `${sign}${s} s`
  if (s < 3600) return `${sign}${Math.round(s / 60)} min`
  return `${sign}${(s / 3600).toFixed(1)} h`
}

/** Mode d'affichage : app installée ou onglet de navigateur. */
function displayMode(): string {
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    window.matchMedia?.("(display-mode: fullscreen)").matches === true ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  return standalone ? "App installée (standalone)" : "Onglet de navigateur"
}

/**
 * Empêche une étape muette de figer tout le relevé.
 *
 * `navigator.serviceWorker.getRegistration()` peut ne jamais se résoudre
 * pendant l'installation d'un worker, et un appel réseau peut rester en
 * suspens sur une connexion mobile dégradée. Sans garde-fou, `setRows` ne
 * serait jamais appelé et la page resterait sur « Relevé en cours… » —
 * précisément le défaut que ce diagnostic sert à débusquer ailleurs.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ])
}

function storageAvailable(kind: "localStorage" | "sessionStorage"): boolean {
  try {
    const store = window[kind]
    store.setItem("__diag", "1")
    store.removeItem("__diag")
    return true
  } catch {
    return false
  }
}

export default function DiagnosticPage() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [connected, setConnected] = useState<boolean | null>(null)
  const [copied, setCopied] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshResult, setRefreshResult] = useState<Row | null>(null)

  /** Relevé complet. Séparé de `collect` pour qu'un jet n'efface pas le reste. */
  const gather = async (): Promise<Row[]> => {
    const out: Row[] = []

    out.push({ label: "Mode d'affichage", value: displayMode() })
    out.push({ label: "Appareil / navigateur", value: navigator.userAgent })

    // ── Cookies ────────────────────────────────────────────────────────────
    out.push({
      label: "Cookies autorisés",
      value: navigator.cookieEnabled ? "oui" : "non",
      warn: !navigator.cookieEnabled,
    })
    const cookieNames = document.cookie
      .split(";")
      .map((c) => c.split("=")[0]?.trim())
      .filter(Boolean) as string[]
    const authCookies = cookieNames.filter((n) => SUPABASE_COOKIE.test(n))
    // L'absence de cookies est normale hors session : le caractère anormal ne
    // se décide qu'après avoir lu la session, plus bas.
    const cookieRow: Row = {
      label: "Cookies de session présents",
      value: authCookies.length > 0 ? `${authCookies.length} (${authCookies.join(", ")})` : "aucun",
    }
    out.push(cookieRow)

    out.push({ label: "localStorage", value: storageAvailable("localStorage") ? "accessible" : "bloqué" })
    out.push({
      label: "sessionStorage",
      value: storageAvailable("sessionStorage") ? "accessible" : "bloqué",
    })

    // ── Session Supabase ───────────────────────────────────────────────────
    // Être déconnecté n'est PAS une anomalie : c'est l'état normal avant
    // connexion. Le signaler en rouge noierait le vrai signal sous une alarme
    // attendue. Les lignes qui n'ont pas de sens sans session sont donc
    // marquées « non applicable » plutôt que « échec ».
    let hasSession = false
    try {
      const supabase = createClient()
      const { data, error } = await withTimeout(
        supabase.auth.getSession(),
        10_000,
        { data: { session: null }, error: null } as Awaited<
          ReturnType<typeof supabase.auth.getSession>
        >,
      )
      if (error) {
        out.push({ label: "Session", value: `erreur — ${error.message}`, warn: true })
      } else if (!data.session) {
        out.push({ label: "Session", value: "aucune — vous n'êtes pas connecté" })
      } else {
        hasSession = true
        const expiresAt = data.session.expires_at ? data.session.expires_at * 1000 : null
        out.push({ label: "Session", value: "présente" })
        if (expiresAt) {
          out.push({
            label: "Jeton valide encore",
            value: formatDuration((expiresAt - Date.now()) / 1000),
            warn: expiresAt < Date.now(),
          })
        }
        out.push({
          label: "Jeton de rafraîchissement",
          value: data.session.refresh_token ? "présent" : "absent",
          warn: !data.session.refresh_token,
        })
      }

      if (!hasSession) {
        out.push({ label: "Vérification serveur du compte", value: "non applicable (déconnecté)" })
      } else {
        const { error: userError } = await withTimeout(
          supabase.auth.getUser(),
          10_000,
          { error: { message: "délai dépassé" } } as unknown as Awaited<
            ReturnType<typeof supabase.auth.getUser>
          >,
        )
        out.push({
          label: "Vérification serveur du compte",
          value: userError ? `échec — ${userError.message}` : "réussie",
          warn: Boolean(userError),
        })
      }
    } catch (err) {
      out.push({
        label: "Service d'authentification",
        value: `injoignable — ${err instanceof Error ? err.message : "erreur inconnue"}`,
        warn: true,
      })
    }
    setConnected(hasSession)
    // Une session vivante sans cookie pour la porter est le symptôme central
    // recherché sur iPhone : c'est là, et seulement là, qu'il faut alerter.
    if (hasSession && authCookies.length === 0) cookieRow.warn = true

    // ── Horloge de l'appareil ──────────────────────────────────────────────
    // Un décalage d'horloge de plus de quelques minutes fait rejeter les
    // jetons JWT comme « pas encore valides » ou « expirés », ce qui produit
    // exactement une impossibilité de se connecter, sans autre symptôme.
    try {
      const res = await withTimeout(
        fetch("/api/version", { cache: "no-store" }),
        10_000,
        null as unknown as Response,
      )
      const serverDate = res?.headers.get("date")
      if (serverDate) {
        const skew = (Date.now() - new Date(serverDate).getTime()) / 1000
        out.push({
          label: "Décalage horloge appareil/serveur",
          value: formatDuration(skew).replace("expiré depuis ", "-"),
          warn: Math.abs(skew) > 120,
        })
      }
    } catch {
      out.push({ label: "Décalage horloge appareil/serveur", value: "non mesurable", warn: true })
    }

    // ── Service worker ─────────────────────────────────────────────────────
    if ("serviceWorker" in navigator) {
      const reg = await withTimeout(navigator.serviceWorker.getRegistration(), 5_000, undefined)
      out.push({
        label: "Service worker",
        value: reg ? (reg.active ? "actif" : "enregistré, non actif") : "non enregistré",
      })
    } else {
      out.push({ label: "Service worker", value: "non pris en charge" })
    }

    out.push({ label: "Relevé effectué le", value: new Date().toLocaleString("fr-FR") })
    return out
  }

  const collect = useCallback(async () => {
    let out: Row[] = []
    try {
      out = await gather()
    } catch (err) {
      // Un relevé partiel reste exploitable ; un écran vide, non.
      out.push({
        label: "Relevé interrompu",
        value: err instanceof Error ? err.message : "erreur inconnue",
        warn: true,
      })
    }
    setRows(out)
  }, [])

  useEffect(() => {
    void collect()
  }, [collect])

  /** Vérifie que le rafraîchissement du jeton fonctionne réellement. */
  const testRefresh = async () => {
    setRefreshing(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.refreshSession()
      setRefreshResult(
        error
          ? { label: "Test de rafraîchissement", value: `échec — ${error.message}`, warn: true }
          : {
              label: "Test de rafraîchissement",
              value: data.session ? "réussi" : "aucune session à rafraîchir",
              warn: !data.session,
            },
      )
    } catch (err) {
      setRefreshResult({
        label: "Test de rafraîchissement",
        value: `échec — ${err instanceof Error ? err.message : "erreur inconnue"}`,
        warn: true,
      })
    } finally {
      setRefreshing(false)
    }
  }

  const allRows = [...(rows || []), ...(refreshResult ? [refreshResult] : [])]
  const report = allRows.map((r) => `${r.label} : ${r.value}`).join("\n")

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(report)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Presse-papiers refusé : le texte reste sélectionnable ci-dessous.
      setCopied(false)
    }
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        backgroundColor: "#FAFBFC",
        color: "#0f172a",
        padding: "1.5rem 1rem 3rem",
      }}
    >
      <div style={{ maxWidth: "34rem", margin: "0 auto" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600, color: "#0F2A47", margin: 0 }}>
          Diagnostic de connexion
        </h1>
        <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#64748b" }}>
          Cette page relève l&apos;état de votre appareil pour comprendre un problème de connexion.
          Elle n&apos;affiche aucun mot de passe, aucun identifiant et aucun jeton : le rapport peut
          être transmis sans risque.
        </p>

        {/* Sans session, la moitié des lignes n'a rien à dire : on l'annonce
            plutôt que de laisser croire à un relevé complet. */}
        {connected === false && (
          <div
            style={{
              marginTop: "1rem",
              borderRadius: "0.5rem",
              border: "1px solid #fcd34d",
              backgroundColor: "#fffbeb",
              padding: "0.75rem 0.875rem",
              fontSize: "0.8125rem",
              color: "#78350f",
            }}
          >
            Vous n&apos;êtes pas connecté : ce relevé est incomplet. Pour le rendre utile,{" "}
            <a href="/auth/login" style={{ color: "#78350f", fontWeight: 600 }}>
              essayez de vous connecter
            </a>
            , puis revenez sur cette page — que la connexion ait réussi ou échoué.
          </div>
        )}

        {!rows && (
          <p style={{ marginTop: "2rem", fontSize: "0.875rem", color: "#64748b" }}>
            Relevé en cours…
          </p>
        )}

        {rows && (
          <>
            <div
              style={{
                marginTop: "1.5rem",
                border: "1px solid #e2e8f0",
                borderRadius: "0.5rem",
                backgroundColor: "#fff",
                overflow: "hidden",
              }}
            >
              {allRows.map((row, i) => (
                <div
                  key={row.label}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.125rem",
                    padding: "0.625rem 0.875rem",
                    borderTop: i === 0 ? "none" : "1px solid #f1f5f9",
                    backgroundColor: row.warn ? "#fef2f2" : "#fff",
                  }}
                >
                  <span style={{ fontSize: "0.6875rem", color: "#94a3b8" }}>{row.label}</span>
                  <span
                    style={{
                      fontSize: "0.8125rem",
                      fontWeight: 500,
                      color: row.warn ? "#b91c1c" : "#0f172a",
                      wordBreak: "break-word",
                    }}
                  >
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "1rem" }}>
              <button
                type="button"
                onClick={copyReport}
                style={{
                  flex: "1 1 10rem",
                  borderRadius: "0.375rem",
                  border: "none",
                  backgroundColor: "#B23A48",
                  color: "#fff",
                  padding: "0.75rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {copied ? "Copié ✓" : "Copier le rapport"}
              </button>
              <button
                type="button"
                onClick={testRefresh}
                disabled={refreshing}
                style={{
                  flex: "1 1 10rem",
                  borderRadius: "0.375rem",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#fff",
                  color: "#0F2A47",
                  padding: "0.75rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  cursor: refreshing ? "progress" : "pointer",
                }}
              >
                {refreshing ? "Test en cours…" : "Tester le rafraîchissement"}
              </button>
            </div>

            <p style={{ marginTop: "1rem", fontSize: "0.75rem", color: "#64748b" }}>
              Si le bouton « Copier » ne fonctionne pas, sélectionnez le texte ci-dessous et
              envoyez-le.
            </p>
            <textarea
              readOnly
              value={report}
              rows={8}
              style={{
                marginTop: "0.375rem",
                width: "100%",
                borderRadius: "0.375rem",
                border: "1px solid #e2e8f0",
                padding: "0.625rem",
                fontSize: "0.75rem",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                color: "#334155",
                backgroundColor: "#fff",
              }}
            />
          </>
        )}

        <p style={{ marginTop: "1.5rem", fontSize: "0.8125rem" }}>
          <a href="/auth/login" style={{ color: "#1B3A5C" }}>
            ← Retour à la connexion
          </a>
        </p>
      </div>
    </main>
  )
}
