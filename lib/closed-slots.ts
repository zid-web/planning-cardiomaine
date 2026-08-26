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

/** La case est-elle fermée (grisée / non assignable) ? */
export function isSlotClosed(rowKey: string, day: string): boolean {
  if (isStressSlotClosed(rowKey, day)) return true
  return (CLOSED_SLOTS[rowKey] || []).includes(day)
}

/** Motif de refus affiché quand la case est fermée. */
export function closedSlotReason(rowKey: string, day: string): string | null {
  if (isStressSlotClosed(rowKey, day)) {
    return "Pas de vacation Stress le mercredi ni le vendredi après-midi."
  }
  if ((CLOSED_SLOTS[rowKey] || []).includes(day)) {
    if (rowKey === EE1_MATIN_ROW) {
      return "EE1 n’ouvre le matin que le jeudi — utilisez EE2."
    }
    return `Vacation « ${rowKey} » fermée le ${day.toLowerCase()}.`
  }
  return null
}

/** Vide les cases fermées de la table `CLOSED_SLOTS` (idempotent). */
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
