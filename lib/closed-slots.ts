/**
 * Cases de vacation **fermées** (grisées, jamais assignables) — indépendantes
 * des congés et des blocages de créneau.
 *
 * Point d’entrée unique `isSlotClosed(row, day)`, utilisé par :
 * - `canAssignDoctorToSlot` (refus d’assignation + message),
 * - `isCellBlocked` côté UI (case grisée),
 * - `applyClosedSlotsClear` (vidage structurel des cases fermées).
 *
 * Y sont regroupées les fermetures Stress (mercredi / vendredi après-midi,
 * historique) et EE1 matin (consigne utilisateur 26/08/2026 : EE1 n’ouvre le
 * matin que le **jeudi**).
 *
 * S’y ajoutent les fermetures **structurelles** (`STRUCTURAL_CLOSED_SLOTS`) :
 * les jours où la vacation n’existe tout simplement pas (rééducation mardi et
 * jeudi, LFB/PSSL/NCT hors jeudi, CDL hors mardi, Scinti jeudi et vendredi,
 * IRM hors lundi/vendredi, Rythmo lundi et jeudi matin). Elles n’étaient
 * jusqu’ici déclarées que dans l’affichage (`isCellBlocked`) : le moteur les
 * ignorait, si bien qu’un résultat de solveur ou un import pouvait poser un
 * médecin sur une case grisée. La case restait vide à l’écran, mais son
 * occupant invisible bloquait ce médecin partout ailleurs sur le créneau.
 *
 * Ces fermetures sont **non destructives** : elles refusent les nouvelles
 * assignations, mais ne vident pas les cases déjà enregistrées
 * (`applyClosedSlotsClear` ne parcourt que `CLOSED_SLOTS`).
 */

import { DAYS } from "@/lib/constants"
import { isStressSlotClosed } from "@/lib/stress-rules"
import type { ScheduleData } from "@/lib/types"

export const EE1_MATIN_ROW = "Matin - EE1"

/**
 * EE1 matin fermée lundi, mardi, mercredi et vendredi — seul le **jeudi**
 * matin reste ouvert (consigne utilisateur 26/08/2026).
 */
export const EE1_MATIN_CLOSED_DAYS = ["LUNDI", "MARDI", "MERCREDI", "VENDREDI"] as const

/** Table déclarative des fermetures : ligne → jours fermés. */
export const CLOSED_SLOTS: Record<string, readonly string[]> = {
  [EE1_MATIN_ROW]: EE1_MATIN_CLOSED_DAYS,
}

/**
 * Jours où la vacation **n’a pas lieu**, par clé de ligne exacte.
 * Miroir de ce que l’affichage grisait déjà — désormais source unique.
 */
export const STRUCTURAL_CLOSED_SLOTS: Record<string, readonly string[]> = {
  "Apm - RÉEDUCATION": ["MARDI", "JEUDI"],
  "Matin - Rythmo": ["LUNDI", "JEUDI"],
  "Hors site - LFB": ["LUNDI", "MARDI", "MERCREDI", "VENDREDI"],
  "Hors site - PSSL": ["LUNDI", "MARDI", "MERCREDI", "VENDREDI"],
  "Hors site - NCT": ["LUNDI", "MARDI", "MERCREDI", "VENDREDI"],
  "Hors site - CDL": ["LUNDI", "MERCREDI", "JEUDI", "VENDREDI"],
  "Hors site - Scinti": ["JEUDI", "VENDREDI"],
  "Hors site - IRM": ["MARDI", "MERCREDI", "JEUDI"],
}

/** Motif affiché pour une fermeture structurelle. */
const STRUCTURAL_CLOSED_REASONS: Record<string, string> = {
  "Apm - RÉEDUCATION": "Pas de rééducation le mardi ni le jeudi.",
  "Matin - Rythmo": "Rythmo non disponible le lundi matin et le jeudi matin.",
  "Hors site - LFB": "LFB n’a lieu que le jeudi.",
  "Hors site - PSSL": "PSSL n’a lieu que le jeudi.",
  "Hors site - NCT": "NCT n’a lieu que le jeudi.",
  "Hors site - CDL": "CDL n’a lieu que le mardi.",
  "Hors site - Scinti": "Scintigraphie du lundi au mercredi uniquement.",
  "Hors site - IRM": "IRM le lundi et le vendredi uniquement.",
}

/** La vacation est-elle structurellement absente ce jour-là ? */
export function isStructurallyClosed(rowKey: string, day: string): boolean {
  return (STRUCTURAL_CLOSED_SLOTS[rowKey] || []).includes(day)
}

/** La case est-elle fermée (grisée / non assignable) ? */
export function isSlotClosed(rowKey: string, day: string): boolean {
  if (isStressSlotClosed(rowKey, day)) return true
  if (isStructurallyClosed(rowKey, day)) return true
  return (CLOSED_SLOTS[rowKey] || []).includes(day)
}

/** Motif de refus affiché quand la case est fermée. */
export function closedSlotReason(rowKey: string, day: string): string | null {
  if (isStressSlotClosed(rowKey, day)) {
    return "Pas de vacation Stress le mercredi ni le vendredi après-midi."
  }
  if (isStructurallyClosed(rowKey, day)) {
    return STRUCTURAL_CLOSED_REASONS[rowKey] || `Vacation « ${rowKey} » fermée le ${day.toLowerCase()}.`
  }
  if ((CLOSED_SLOTS[rowKey] || []).includes(day)) {
    if (rowKey === EE1_MATIN_ROW) {
      return "EE1 n’ouvre le matin que le jeudi — utilisez EE2."
    }
    return `Vacation « ${rowKey} » fermée le ${day.toLowerCase()}.`
  }
  return null
}

/**
 * Vide les cases fermées de la table `CLOSED_SLOTS` (idempotent).
 * Volontairement limitée à `CLOSED_SLOTS` : les fermetures structurelles
 * refusent les nouvelles assignations sans effacer l’existant.
 */
export function applyClosedSlotsClear(schedule: ScheduleData): ScheduleData {
  let next = schedule
  for (const [rowKey, closedDays] of Object.entries(CLOSED_SLOTS)) {
    if (!next[rowKey]) continue
    for (const day of DAYS) {
      if (!closedDays.includes(day)) continue
      const cell = next[rowKey][day]
      if (!cell || (cell.value || []).length === 0) continue
      next = {
        ...next,
        [rowKey]: {
          ...next[rowKey],
          [day]: { ...cell, value: [], type: "empty" },
        },
      }
    }
  }
  return next
}
