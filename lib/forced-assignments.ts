/**
 * Affectations **forcées** par un admin (consigne 19/11/2026) : dans le sélecteur, un médecin
 * grisé par une règle reste affectable par l'admin — le motif devient un simple avertissement —
 * sauf s'il est en congé. Le médecin forcé est noté dans `CellData.forced` pour que les règles
 * automatiques (strips de créneau, ½ journée off, couplages…) ne le retirent pas ensuite.
 *
 * Il reste retiré : en congé, un jour férié (activités fermées sauf ATL / gardes), ou quand
 * l'admin le retire lui-même de la case (il disparaît alors aussi de `forced`).
 */

import { DAYS } from "@/lib/constants"
import { dateStrForWeekDay, isDoctorOnVacationForFixed } from "@/lib/fixed-assignments"
import { holidayNameForWeekDay, isHolidayClosedSlot } from "@/lib/holiday-closed"
import type { DoctorVacation, ScheduleData } from "@/lib/types"

/** Le médecin est-il en congé ce jour (table des congés ou ligne Congés) ? Seul cas non forçable. */
export function isOnLeave(
  schedule: ScheduleData | undefined,
  doctor: string,
  day: string,
  dateStr: string | null | undefined,
  vacations: DoctorVacation[],
): boolean {
  if (((schedule?.["Congés"]?.[day]?.value ?? []) as string[]).includes(doctor)) return true
  return Boolean(dateStr && isDoctorOnVacationForFixed(doctor, dateStr, vacations))
}

/**
 * Remet dans chaque case les médecins forcés que la chaîne de règles a retirés (`before` = planning
 * reçu, `after` = planning après les règles). Nettoie `forced` des médecins que l'admin a retirés.
 */
export function restoreForcedAssignments(
  before: ScheduleData,
  after: ScheduleData,
  weekKey: string,
  vacations: DoctorVacation[] = [],
): ScheduleData {
  let next = after
  for (const [row, days] of Object.entries(before)) {
    for (const day of DAYS) {
      const src = days?.[day]
      const forced = (src?.forced ?? []).filter((d) => ((src?.value ?? []) as string[]).includes(d))
      if (!src?.forced?.length && !forced.length) continue
      const dateStr = dateStrForWeekDay(weekKey, day)
      const holidayClosed = isHolidayClosedSlot(row, holidayNameForWeekDay(weekKey, day))
      const keep = forced.filter((d) => !holidayClosed && !isOnLeave(next, d, day, dateStr, vacations))
      const cell = next[row]?.[day]
      if (!cell) continue
      const value = ((cell.value ?? []) as string[]).slice()
      for (const d of keep) if (!value.includes(d)) value.push(d)
      const sameForced = JSON.stringify(cell.forced ?? []) === JSON.stringify(keep)
      if (sameForced && value.length === (cell.value ?? []).length) continue
      next = {
        ...next,
        [row]: {
          ...next[row],
          [day]: { ...cell, value, type: value.length ? "doctor" : cell.type, forced: keep.length ? keep : undefined },
        },
      }
    }
  }
  return next
}
