"use client"

import { useEffect } from "react"
import { captureException } from "@/lib/sentry"

/**
 * Error boundary de dernier recours (App Router).
 *
 * Ne se déclenche que si le layout racine lui-même échoue — cas que
 * `app/error.tsx` ne peut pas couvrir, puisqu'il est rendu à l'intérieur de ce
 * layout. Il doit donc fournir ses propres `<html>` et `<body>`.
 *
 * Styles en inline volontairement : `globals.css` est importé par le layout
 * racine, celui-là même qui vient d'échouer. Les classes Tailwind ne sont donc
 * pas garanties ici, et un écran de panne qui s'affiche sans style est
 * infiniment préférable à un écran de panne qui ne s'affiche pas.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    captureException(error, {
      boundary: "app/global-error",
      digest: error.digest,
      url: typeof window !== "undefined" ? window.location.href : undefined,
    })
  }, [error])

  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          backgroundColor: "#FAFBFC",
          color: "#0f172a",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "26rem",
            borderRadius: "1rem",
            backgroundColor: "#fff",
            padding: "1.75rem",
            boxShadow: "0 10px 40px rgba(15,42,71,0.12)",
          }}
        >
          <h1 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700, color: "#0F2A47" }}>
            L&apos;application n&apos;a pas pu démarrer
          </h1>
          <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#475569" }}>
            Une erreur est survenue au chargement. Aucune donnée du planning n&apos;a été modifiée.
          </p>

          <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={reset}
              style={{
                width: "100%",
                borderRadius: "0.5rem",
                border: "none",
                backgroundColor: "#0F2A47",
                padding: "0.7rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Réessayer
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                width: "100%",
                borderRadius: "0.5rem",
                border: "1px solid #cbd5e1",
                backgroundColor: "#fff",
                padding: "0.7rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "#0f172a",
                cursor: "pointer",
              }}
            >
              Recharger la page
            </button>
          </div>

          {error.digest && (
            <p style={{ marginTop: "1.25rem", fontSize: "0.75rem", color: "#64748b" }}>
              Référence à communiquer au support :{" "}
              <code style={{ fontFamily: "ui-monospace, monospace", color: "#334155" }}>
                {error.digest}
              </code>
            </p>
          )}
        </div>
      </body>
    </html>
  )
}
