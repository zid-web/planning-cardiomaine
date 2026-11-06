/**
 * Interdits envoyés au solveur, calculés avec la validation même de l'appli
 * (`canAssignDoctorToSlot`, celle de la saisie manuelle).
 *
 * Plutôt que de recopier chaque règle en Python (et de les voir diverger), l'appli
 * évalue pour chaque case que le solveur peut remplir et chaque médecin si l'affectation
 * serait acceptée. Toute règle ajoutée un jour à la validation de l'appli est donc
 * transmise automatiquement : congés, ½ journées off, éligibilités, jours fériés, cases
 * fermées, NCT, binômes EE, pool du vendredi, interne, créneau déjà pris par une saisie…
 *
 * Le contexte est le planning **sans les propositions en attente** : seules les cases
 * validées (saisies, contraintes structurelles) contraignent. Les règles qui dépendent des
 * propres choix du solveur (nuits consécutives, Stress une fois par semaine…) restent des
 * règles explicites de `app_rules`.
 */

import { DAYS, NURSES } from "@/lib/constants"
import { DOCTORS } from "@/lib/constants"
import { dateStrForWeekDay } from "@/lib/fixed-assignments"
import { GENERATOR_PROPOSAL_ROW_KEYS } from "@/lib/guard-api-mapping"
import { canAssignDoctorToSlot, type AssignmentContext } from "@/lib/slot-blocking"
import type { DoctorVacation, ScheduleData } from "@/lib/types"

/** Lignes que le solveur peut remplir. */
export const SOLVER_FILLED_ROWS: readonly string[] = [
  ...GENERATOR_PROPOSAL_ROW_KEYS,
  "Matin - Rythmo",
  "Apm - Rythmo",
  "Hors site - NCT",
]

/** Médecins que le solveur peut placer (ni infirmières, ni interne, ni remplaçants). */
const SOLVER_DOCTORS = DOCTORS.filter((d) => d !== "I" && !(NURSES as readonly string[]).includes(d))

export type ForbiddenAssignments = {
  /** ligne → jour → médecins interdits (envoyé au solveur). */
  forbidden: Record<string, Record<string, string[]>>
  /** "ligne|jour|médecin" → motif (gardé côté appli pour expliquer un écart du solveur). */
  reasons: Record<string, string>
  count: number
}

/** Planning sans les propositions en attente : seules les cases validées contraignent. */
export function validatedOnly(schedule: ScheduleData): ScheduleData {
  const out: ScheduleData = {}
  for (const [row, days] of Object.entries(schedule)) {
    out[row] = {}
    for (const [day, cell] of Object.entries(days || {})) {
      out[row][day] = cell?.status === "pending" ? { ...cell, value: [], type: "empty", status: "validated" } : cell
    }
  }
  return out
}

export function buildForbiddenAssignments(
  weekKey: string,
  schedule: ScheduleData,
  vacations: DoctorVacation[] = [],
  ctx?: AssignmentContext,
): ForbiddenAssignments {
  const base = validatedOnly(schedule)
  const forbidden: Record<string, Record<string, string[]>> = {}
  const reasons: Record<string, string> = {}
  let count = 0
  for (const row of SOLVER_FILLED_ROWS) {
    if (!base[row]) continue
    for (const day of DAYS) {
      const date = dateStrForWeekDay(weekKey, day)
      if (!date) continue
      const present = new Set((base[row]?.[day]?.value ?? []) as string[])
      for (const doc of SOLVER_DOCTORS) {
        if (present.has(doc)) continue // déjà saisi dans la case : c'est `fixed_assignments`
        const res = canAssignDoctorToSlot(doc, date, row, day, base, vacations, ctx)
        if (res.allowed) continue
        ;((forbidden[row] ??= {})[day] ??= []).push(doc)
        reasons[`${row}|${day}|${doc}`] = res.reason ?? "interdit par les règles de l'appli"
        count++
      }
    }
  }
  return { forbidden, reasons, count }
}
