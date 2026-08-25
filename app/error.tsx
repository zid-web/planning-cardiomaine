"use client"

import { useEffect } from "react"
import { captureException } from "@/lib/sentry"

/**
 * Error boundary de segment (App Router).
 *
 * Couvre toutes les routes sous `app/`, mais PAS le layout racine lui-même —
 * c'est le rôle de `app/global-error.tsx`.
 *
 * Sans ce fichier, la moindre erreur de rendu démontait l'arbre React entier
 * et laissait un écran blanc, sans message ni moyen de repartir. Cas concret
 * relevé lors du travail PWA : `schedule-app.tsx` charge quatre composants en
 * `lazy()` ; leurs chunks sont bien enveloppés dans `<Suspense>`, mais
 * Suspense ne gère que l'attente, pas les erreurs — un import rejeté
 * traversait donc tout l'arbre sans être intercepté.
 *
 * `reset()` retente le rendu du segment sans rechargement complet : suffisant
 * pour une erreur transitoire (requête échouée), inutile si le bundle lui-même
 * est en cause — d'où le second bouton.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    captureException(error, {
      boundary: "app/error",
      digest: error.digest,
      url: typeof window !== "undefined" ? window.location.href : undefined,
    })
  }, [error])

  return (
    <div className="flex h-full w-full items-center justify-center overflow-y-auto bg-[#FAFBFC] p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg sm:p-8">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[#FDECEF]">
          {/* Icône inline : une dépendance de plus serait un point de panne
              supplémentaire dans l'écran qui gère justement les pannes. */}
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#B23A48"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>

        <h1 className="text-lg font-bold text-[#0F2A47]">Une erreur est survenue</h1>
        <p className="mt-2 text-sm text-slate-600">
          Cette partie de l&apos;application n&apos;a pas pu s&apos;afficher. Aucune donnée du planning
          n&apos;a été modifiée.
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="flex-1 rounded-lg bg-[#0F2A47] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1B3A5C]"
          >
            Réessayer
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50"
          >
            Recharger la page
          </button>
        </div>

        <a
          href="/protected/planning"
          className="mt-3 block text-center text-sm font-medium text-[#1B3A5C] hover:underline"
        >
          Retour au planning
        </a>

        {(error.digest || error.message) && (
          <details className="mt-6 border-t border-slate-200 pt-4">
            <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700">
              Détails techniques
            </summary>
            {error.digest && (
              <p className="mt-2 text-xs text-slate-500">
                Référence à communiquer au support :{" "}
                <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-slate-700">
                  {error.digest}
                </code>
              </p>
            )}
            {error.message && (
              <p className="mt-2 break-words font-mono text-xs text-slate-500">{error.message}</p>
            )}
          </details>
        )}
      </div>
    </div>
  )
}
