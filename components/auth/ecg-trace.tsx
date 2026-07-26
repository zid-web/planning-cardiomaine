"use client"

import { cn } from "@/lib/utils"

type EcgTraceProps = {
  className?: string
  /** Trait plus marqué (panneau branding) ou discret (séparateur mobile). */
  variant?: "hero" | "separator"
}

/**
 * Tracé ECG signature — une seule animation d’apparition au chargement.
 * Statique si `prefers-reduced-motion: reduce` (voir `app/globals.css`).
 */
export function EcgTrace({ className, variant = "hero" }: EcgTraceProps) {
  const strokeWidth = variant === "hero" ? 1.75 : 1.25
  // Forme ECG stylisée (baseline → onde P → QRS → T → retour)
  const d =
    "M0 40 H18 C20 40 21 38 22 36 C23 34 24 40 26 40 H38 " +
    "C39 40 40 28 41 22 L44 8 L48 62 L51 34 L53 40 H68 " +
    "C70 40 72 32 74 30 C78 26 82 38 84 40 H120 " +
    "C122 40 123 38 124 36 C125 34 126 40 128 40 H160"

  return (
    <svg
      viewBox="0 0 160 70"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("ecg-trace overflow-visible", className)}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={d}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        className="ecg-trace-path"
      />
    </svg>
  )
}
