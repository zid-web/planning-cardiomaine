import { DOCTORS, NURSES } from "@/lib/constants"
import type { CellData } from "@/lib/types"

/**
 * Codes affichés **sans** le titre « Dr. » : les infirmières (Val, Véro, Laura)
 * et **CH** (Centre Hospitalier — une structure externe, pas une personne).
 * Tous figurent dans `DOCTORS` pour les besoins du planning.
 */
const CODES_WITHOUT_DOCTOR_TITLE: readonly string[] = [...NURSES, "CH"]

/**
 * Libellé d'affichage d'un intervenant : « Dr. X » pour les médecins, **nom
 * seul** pour les infirmières et pour CH.
 */
export function formatPersonLabel(code: string | null | undefined): string {
  const trimmed = (code || "").trim()
  if (!trimmed) return "—"
  if (CODES_WITHOUT_DOCTOR_TITLE.includes(trimmed)) return trimmed
  return `Dr. ${trimmed}`
}

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

/**
 * Entrées à afficher dans une case : initiales listées + remplaçant (champ dédié
 * ou libellé libre déjà présent dans `value`).
 */
export function getCellDisplayAssignees(cell: CellData | undefined | null): string[] {
  if (!cell) return []
  const values = Array.isArray(cell.value) ? cell.value.filter(Boolean) : []
  const fromField = cell.remplacant?.trim()
  if (fromField && !values.includes(fromField)) {
    return [...values, fromField]
  }
  return values
}
