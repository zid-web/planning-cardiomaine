/**
 * Ligne « Matin - Visite » — la visite est une vacation **hebdomadaire** :
 * un même médecin (U / A / B en rotation) l'assure du lundi au vendredi.
 *
 * Conséquence pour la saisie manuelle (consigne utilisateur 26/08/2026) :
 * changer les initiales sur **une** case doit reporter le changement sur
 * **toute la semaine**, sans quoi il faut refaire cinq fois la même correction.
 *
 * Deux garde-fous au report :
 * - un jour où le médecin a une contrainte le matin (congés, ½ journée off
 *   matin…) est laissé **vide** plutôt que de recevoir une affectation
 *   impossible ;
 * - une case explicitement vidée par l'admin (`manuallyCleared`) n'est jamais
 *   re-remplie, comme partout ailleurs dans le planning.
 *
 * La visite ne bloque pas le créneau (`NON_BLOCKING_ROWS`) et ne concerne que
 * le matin : le médecin de visite reste assignable l'après-midi, et même sur
 * une autre tâche du matin.
 */

import { dateStrForWeekDay } from "@/lib/fixed-assignments"
import { canAssignDoctorToSlot } from "@/lib/slot-blocking"
import type { CellData, DoctorVacation, ScheduleData } from "@/lib/types"

export const VISITE_ROW = "Matin - Visite"

const VISITE_WEEKDAYS = ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI"] as const

export function isVisiteRow(rowKey: string): boolean {
  return rowKey === VISITE_ROW
}

/**
 * Reporte le contenu de la case Visite de `sourceDay` sur les autres jours
 * ouvrés de la semaine. Ne modifie pas l'objet reçu.
 *
 * Chaque jour ne reçoit que les médecins réellement assignables ce matin-là ;
 * si aucun ne l'est, la case est laissée vide.
 */
export function spreadVisiteAcrossWeek(
  schedule: ScheduleData,
  weekKey: string,
  sourceDay: string,
  vacations: DoctorVacation[] = [],
): ScheduleData {
  const sourceCell = schedule[VISITE_ROW]?.[sourceDay]
  if (!sourceCell) return schedule

  const doctors = sourceCell.value || []
  let next = schedule

  for (const day of VISITE_WEEKDAYS) {
    if (day === sourceDay) continue
    const cell = next[VISITE_ROW]?.[day]
    if (!cell) continue
    if (cell.manuallyCleared) continue

    const dateStr = dateStrForWeekDay(weekKey, day)
    const allowed = doctors.filter((doc) => {
      if (!dateStr) return true
      return canAssignDoctorToSlot(doc, dateStr, VISITE_ROW, day, next, vacations).allowed
    })

    // Rien à changer : évite de réécrire (et de re-marquer) une case identique.
    if (
      allowed.length === (cell.value || []).length &&
      allowed.every((d, i) => (cell.value || [])[i] === d)
    ) {
      continue
    }

    const nextCell: CellData = {
      ...cell,
      value: allowed,
      type: allowed.length > 0 ? "doctor" : "empty",
      status: sourceCell.status,
      remplacant: sourceCell.remplacant,
    }
    next = {
      ...next,
      [VISITE_ROW]: { ...next[VISITE_ROW], [day]: nextCell },
    }
  }

  return next
}
