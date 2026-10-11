/**
 * Stress : un même médecin n'occupe une case Stress qu'**une fois par semaine** (roulement
 * entre les médecins concernés) — tant qu'il y a assez de médecins disponibles (hors congés
 * et absences). Si personne d'autre n'est disponible, la répétition est tolérée.
 */
import { DAYS, NURSES } from "@/lib/constants"
import { dateStrForWeekDay } from "@/lib/fixed-assignments"
import { DOC022_CLINICAL_ELIGIBILITY } from "@/lib/group-clinical-rules"
import { isListedDoctor } from "@/lib/doctor-code"
import { canAssignDoctorToSlot } from "@/lib/slot-blocking"
import type { DoctorVacation, ScheduleData } from "@/lib/types"

export const STRESS_ROWS = ["Matin - Stress", "Apm - Stress"] as const
const WEEKDAYS = DAYS.filter((d) => d !== "SAMEDI" && d !== "DIMANCHE")

export function isStressRow(rowKey: string): boolean {
  return (STRESS_ROWS as readonly string[]).includes(rowKey)
}

/** Médecin « comptant » pour le roulement : listé, ni infirmière ni structurel. */
function isStressDoctor(d: string): boolean {
  return isListedDoctor(d) && !(NURSES as readonly string[]).includes(d) && d !== "CH" && d !== "FV" && d !== "I"
}

/** Cases Stress de la semaine, dans l'ordre chronologique. */
export function stressCellsInOrder(schedule: ScheduleData): Array<{ row: string; day: string }> {
  const cells: Array<{ row: string; day: string }> = []
  for (const day of WEEKDAYS) for (const row of STRESS_ROWS) if (schedule[row]?.[day]) cells.push({ row, day })
  return cells
}

/** Médecins déjà au Stress cette semaine (toutes cases, tous statuts), hors case `except`. */
export function doctorsOnStress(schedule: ScheduleData, except?: { row: string; day: string }): Set<string> {
  const used = new Set<string>()
  for (const { row, day } of stressCellsInOrder(schedule)) {
    if (except && except.row === row && except.day === day) continue
    for (const d of schedule[row]?.[day]?.value || []) if (isStressDoctor(d)) used.add(d)
  }
  return used
}

/**
 * Candidats Stress non encore utilisés cette semaine, éligibles et réellement disponibles pour
 * cette case (mêmes règles que l'affectation manuelle). `excludeDoctor` : médecin remplacé.
 */
export function unusedStressCandidates(
  schedule: ScheduleData,
  weekKey: string,
  row: string,
  day: string,
  vacations: DoctorVacation[],
  excludeDoctor?: string,
  order?: readonly string[],
): string[] {
  const dateStr = dateStrForWeekDay(weekKey, day)
  if (!dateStr) return []
  const used = doctorsOnStress(schedule, { row, day })
  const pool = [...(order ?? DOC022_CLINICAL_ELIGIBILITY.stress)]
  // Schéma de la case sans le médecin remplacé : sa présence ne doit pas bloquer les autres règles.
  const cell = schedule[row]?.[day]
  const tmp: ScheduleData =
    excludeDoctor && cell
      ? { ...schedule, [row]: { ...schedule[row], [day]: { ...cell, value: cell.value.filter((v) => v !== excludeDoctor) } } }
      : schedule
  return pool.filter(
    (d) =>
      d !== excludeDoctor &&
      d !== "D" && // D : Stress fixe du jeudi (règle fixe), jamais proposé en roulement
      !used.has(d) &&
      canAssignDoctorToSlot(d, dateStr, row, day, tmp, vacations).allowed,
  )
}

/**
 * Avertissement (non bloquant) à la saisie manuelle : le médecin a déjà un Stress cette semaine
 * alors qu'un autre médecin éligible et disponible n'en a pas encore.
 */
export function stressRepeatWarning(
  schedule: ScheduleData,
  weekKey: string,
  row: string,
  day: string,
  doctor: string,
  vacations: DoctorVacation[],
): string | null {
  if (!isStressRow(row) || !isStressDoctor(doctor)) return null
  if (!doctorsOnStress(schedule, { row, day }).has(doctor)) return null
  const alternatives = unusedStressCandidates(schedule, weekKey, row, day, vacations, doctor)
  if (alternatives.length === 0) return null // pas assez de médecins disponibles : répétition normale
  return `${doctor} est déjà au Stress cette semaine (roulement). Disponibles : ${alternatives.slice(0, 5).join(", ")}.`
}
