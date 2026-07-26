import { DOCTORS } from "@/lib/constants"

/** Initiale / code présent dans la liste officielle des médecins. */
export function isListedDoctor(code: string): boolean {
  return DOCTORS.includes(code)
}

/**
 * Normalise un nom de remplaçant saisi en texte libre.
 * Retourne null si invalide (vide, trop long, ou collision avec une initiale listée).
 */
export function normalizeRemplacantLabel(raw: string): string | null {
  const trimmed = (raw || "").trim().replace(/\s+/g, " ")
  if (!trimmed) return null
  if (trimmed.length > 40) return null
  // Éviter d’écraser une vraie initiale (ex. saisir "A" → utiliser le bouton A)
  if (isListedDoctor(trimmed)) return null
  return trimmed
}
