/**
 * Impact d'un congé validé sur le planning : liste les affectations d'un médecin
 * que le réarrangement des contraintes a retirées (avant → après), pour les
 * signaler à l'admin — qui doit alors proposer un remplaçant (« Générer » ou
 * saisie manuelle). Fonctions pures, testées dans vacation-impact.test.ts.
 */

import { DAYS } from "@/lib/constants"
import type { ScheduleData } from "@/lib/types"

/** Lignes qui ne sont pas des affectations de travail : absences, ½ journées off, notes. */
export const NON_ASSIGNMENT_ROWS: ReadonlySet<string> = new Set([
  "Congés",
  "Vacances",
  "1/2 journée off Matin",
  "1/2 journée off Après-midi",
  "Notes du jour",
])

export type RemovedAssignment = {
  weekKey: string
  row: string
  day: string
}

export function listRemovedAssignments(
  before: ScheduleData | undefined,
  after: ScheduleData | undefined,
  doctor: string,
  weekKey: string,
): RemovedAssignment[] {
  if (!before || !after) return []
  const removed: RemovedAssignment[] = []
  for (const row of Object.keys(before)) {
    if (NON_ASSIGNMENT_ROWS.has(row)) continue
    for (const day of DAYS) {
      const had = (before[row]?.[day]?.value ?? []).includes(doctor)
      const has = (after[row]?.[day]?.value ?? []).includes(doctor)
      if (had && !has) removed.push({ weekKey, row, day })
    }
  }
  return removed
}

/** Semaine ISO dont le lundi–dimanche (`YYYY-MM-DD`) recoupe la période `[start, end]`. */
export function weekOverlapsRange(monday: string, sunday: string, start: string, end: string): boolean {
  return monday <= end && sunday >= start
}
