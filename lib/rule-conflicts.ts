/**
 * Incohérences affichées sur le planning : une affectation (saisie manuelle, validée ou
 * proposée) qui ne passerait plus la validation de l'affectation manuelle — deux nuits de
 * garde consécutives, garde de nuit la veille d'une Coro / ATL / Rythmo, créneau déjà pris,
 * case fermée, jour férié… — est signalée en rouge, avec son motif en infobulle. Les conflits
 * de congés restent gérés par `detectConflict`.
 */
import { DAYS, NURSES } from "@/lib/constants"
import { dateStrForWeekDay } from "@/lib/fixed-assignments"
import { isListedDoctor } from "@/lib/doctor-code"
import { canAssignDoctorToSlot, type AssignmentContext } from "@/lib/slot-blocking"
import type { DoctorVacation, ScheduleData } from "@/lib/types"

const SKIP_ROWS = new Set(["Congés", "Vacances", "Congrès", "Notes du jour", "1/2 journée off Matin", "1/2 journée off Après-midi"])

export function ruleConflictKey(row: string, day: string, doctor: string): string {
  return `${row}||${day}||${doctor}`
}

export function computeRuleConflicts(
  schedule: ScheduleData,
  weekKey: string,
  vacations: DoctorVacation[],
  ctx?: AssignmentContext,
): Map<string, string> {
  const conflicts = new Map<string, string>()
  for (const [row, days] of Object.entries(schedule)) {
    if (!days || SKIP_ROWS.has(row)) continue
    for (const day of DAYS) {
      const cell = days[day]
      const values = cell?.value
      if (!cell || !Array.isArray(values) || values.length === 0) continue
      // Week-end : l'ATL suit la garde par construction (couplage M/O/W) — pas une incohérence.
      if (row.startsWith("Astreintes ATL") && (day === "SAMEDI" || day === "DIMANCHE")) continue
      const dateStr = dateStrForWeekDay(weekKey, day)
      if (!dateStr) continue
      for (const doc of new Set(values)) {
        if (!isListedDoctor(doc) || doc === "CH" || (NURSES as readonly string[]).includes(doc)) continue
        // On teste le médecin « comme si on l'ajoutait » : sans sa propre présence dans la case.
        const without: ScheduleData = {
          ...schedule,
          [row]: { ...days, [day]: { ...cell, value: values.filter((v) => v !== doc) } },
        }
        const res = canAssignDoctorToSlot(doc, dateStr, row, day, without, vacations, ctx)
        if (!res.allowed) conflicts.set(ruleConflictKey(row, day, doc), res.reason || "Règle d'affectation non respectée")
      }
    }
  }
  return conflicts
}
