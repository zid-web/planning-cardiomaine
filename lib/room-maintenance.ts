/**
 * Suspensions de la salle de coronarographie (Coro) envoyées au solveur via
 * `room_maintenance` — même principe que `activity_maintenance` (NCT/PSSL/
 * LFB/CDL), mais dédié à Coro et avec un sous-ensemble de créneaux (matin
 * et/ou après-midi, jamais nuit).
 *
 * Bug corrigé le 31/07/2026 : les consignes données via la page vocale
 * (ex. "coro indisponible l'après-midi de S31 à S34 inclus") n'étaient
 * appliquées QUE lors de la régénération immédiate déclenchée par la
 * commande vocale elle-même - jamais mémorisées pour les générations
 * normales ultérieures des semaines suivantes (S32, S33, S34). Ce fichier
 * fournit le même mécanisme de calendrier figé qu'`activity-maintenance.ts`,
 * à réviser/étendre à chaque nouvelle consigne vocale confirmée portant sur
 * plusieurs semaines.
 */

import { isoWeekInclusiveRangeToDates } from "@/lib/activity-maintenance"

export type RoomMaintenanceSlot = "matin" | "am"

export type RoomMaintenancePeriod = {
  start_date: string // YYYY-MM-DD
  end_date: string // YYYY-MM-DD
  slots: RoomMaintenanceSlot[]
  reason?: string
}

/**
 * Calendrier métier 2026 (confirmé 28-29/07/2026) :
 * - Coro après-midi indisponible S31 → S34 inclus.
 */
export function buildDefaultRoomMaintenance2026(): RoomMaintenancePeriod[] {
  const coroAm = isoWeekInclusiveRangeToDates(2026, 31, 34)
  const out: RoomMaintenancePeriod[] = []
  if (coroAm) {
    out.push({
      ...coroAm,
      slots: ["am"],
      reason: "Salle de coro indisponible l'après-midi S31-S34 2026",
    })
  }
  return out
}

/** Payload complet pour `/generate-week` (toutes périodes connues). */
export function buildRoomMaintenancePayload(
  periods: RoomMaintenancePeriod[] = buildDefaultRoomMaintenance2026(),
): RoomMaintenancePeriod[] {
  return periods.map((p) => ({
    start_date: p.start_date,
    end_date: p.end_date,
    slots: [...p.slots],
    ...(p.reason ? { reason: p.reason } : {}),
  }))
}

function parseIsoDay(iso: string): number {
  return iso < "0000-01-01" ? NaN : Date.parse(`${iso}T00:00:00.000Z`)
}

/**
 * True si `isoDate` (YYYY-MM-DD) + `slot` ("matin"|"am") tombe dans une
 * suspension de la salle de coro. Utilisé par la validation manuelle de
 * case (`canAssignDoctorToSlot`) pour bloquer une saisie manuelle sur Coro
 * pendant la maintenance - bug corrigé le 31/07/2026 : la génération
 * automatique respectait déjà cette suspension, mais la saisie manuelle
 * directe dans une case l'ignorait complètement.
 */
export function isRoomUnderMaintenanceOnDate(
  isoDate: string,
  slot: RoomMaintenanceSlot,
  periods: RoomMaintenancePeriod[] = buildDefaultRoomMaintenance2026(),
): boolean {
  if (!isoDate || !slot) return false
  const t = parseIsoDay(isoDate)
  if (!Number.isFinite(t)) return false
  for (const p of periods) {
    if (!p.slots.includes(slot)) continue
    const a = parseIsoDay(p.start_date)
    const b = parseIsoDay(p.end_date)
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue
    if (t >= a && t <= b) return true
  }
  return false
}
