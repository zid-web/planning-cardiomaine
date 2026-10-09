/**
 * Règle absolue : un jour férié, **toutes les activités sont fermées**
 * (aucune affectation) sauf les Astreintes ATL et les Gardes.
 *
 * Source unique pour l'affichage (case grisée), la validation d'assignation,
 * le moteur de contraintes (vidage) et le PDF. Les jours fériés viennent de
 * `getFrenchPublicHolidays`, comme l'en-tête de la grille globale.
 */

import { DAYS } from "@/lib/constants"
import { dateStrForWeekDay } from "@/lib/fixed-assignments"
import { getFrenchPublicHolidays } from "@/lib/schedule-utils"
import type { ScheduleData } from "@/lib/types"

/** Lignes qui restent ouvertes un jour férié. */
export function isRowAllowedOnHoliday(rowKey: string): boolean {
  return rowKey.includes("Astreintes ATL") || rowKey.includes("Garde")
}

/** Nom du jour férié pour une date ISO (YYYY-MM-DD), sinon null. */
export function holidayNameForIsoDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const [y, m, d] = iso.split("-")
  if (!y || !m || !d) return null
  return getFrenchPublicHolidays(Number(y))[`${d}/${m}/${y}`] ?? null
}

const weekDayHolidayCache = new Map<string, string | null>()

export function holidayNameForWeekDay(weekKey: string, day: string): string | null {
  const key = `${weekKey}|${day}`
  const hit = weekDayHolidayCache.get(key)
  if (hit !== undefined) return hit
  const name = holidayNameForIsoDate(dateStrForWeekDay(weekKey, day))
  weekDayHolidayCache.set(key, name)
  return name
}

/** La case est-elle fermée parce que c'est un jour férié ? */
export function isHolidayClosedSlot(rowKey: string, holidayName: string | null | undefined): boolean {
  return Boolean(holidayName) && rowKey !== "Notes du jour" && !isRowAllowedOnHoliday(rowKey)
}

export function holidayClosedReason(holidayName: string): string {
  return `Jour férié (${holidayName}) : toutes les activités sont fermées, sauf Astreintes ATL et Gardes.`
}

/**
 * Vide toutes les cases fermées d'un jour férié (idempotent, y compris les
 * saisies manuelles : la règle est absolue). N'altère jamais ATL / Gardes / Notes.
 */
export function applyHolidayClosedClear(schedule: ScheduleData, weekKey: string): ScheduleData {
  let next = schedule
  for (const day of DAYS) {
    const holiday = holidayNameForWeekDay(weekKey, day)
    if (!holiday) continue
    for (const rowKey of Object.keys(next)) {
      if (!isHolidayClosedSlot(rowKey, holiday)) continue
      const cell = next[rowKey]?.[day]
      if (!cell || ((cell.value || []).length === 0 && !cell.remplacant)) continue
      next = {
        ...next,
        [rowKey]: {
          ...next[rowKey],
          [day]: {
            ...cell,
            value: [],
            type: "empty",
            status: "validated",
            remplacant: undefined,
            request: undefined,
            manualAssignment: undefined,
          },
        },
      }
    }
  }
  return next
}
