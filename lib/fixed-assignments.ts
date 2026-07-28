import { parseISO, isAfter, isBefore } from "date-fns"
import { DAYS } from "@/lib/constants"
import { DOC022_FIXED_CLINICAL_SLOTS } from "@/lib/group-clinical-rules"
import type { DoctorVacation, ScheduleData } from "@/lib/types"

/** Rotation Visite : uniquement U, A, B — une semaine chacun. */
export const VISITE_ROTATION = ["U", "A", "B"] as const

/**
 * Contraintes fixes métier (vacations cliniques / hors site / FV / DAAS).
 * Appliquées à la création de semaine et lors de « Générer ».
 */
export function mondayOfIsoWeekKey(weekKey: string): Date | null {
  const [yearStr, weekStr] = weekKey.split("-W")
  const year = Number.parseInt(yearStr, 10)
  const weekNum = Number.parseInt(weekStr, 10)
  if (!Number.isFinite(year) || !Number.isFinite(weekNum)) return null
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dayJan4 = jan4.getUTCDay() || 7
  const monday1 = new Date(jan4.getTime() - (dayJan4 - 1) * 86400000)
  return new Date(monday1.getTime() + (weekNum - 1) * 7 * 86400000)
}

export function dateStrForWeekDay(weekKey: string, dayName: string): string | null {
  const monday = mondayOfIsoWeekKey(weekKey)
  if (!monday) return null
  const idx = DAYS.indexOf(dayName)
  if (idx < 0) return null
  const d = new Date(monday)
  d.setUTCDate(monday.getUTCDate() + idx)
  return d.toISOString().split("T")[0]
}

/** Vacances pour règles fixes — CH exempt ; FV / S / A / P / U / DAAS respectent les congés. */
export function isDoctorOnVacationForFixed(
  doctorId: string,
  dateStr: string,
  vacations: DoctorVacation[],
): boolean {
  if (!doctorId || doctorId === "CH") return false
  if (!vacations?.length) return false
  const targetDate = parseISO(dateStr)
  return vacations.some((vacation) => {
    if (vacation.doctor_id !== doctorId) return false
    const startDate = parseISO(vacation.start_date)
    const endDate = parseISO(vacation.end_date)
    return !isBefore(targetDate, startDate) && !isAfter(targetDate, endDate)
  })
}

/** Absent = doctor_vacations **ou** déjà sur la ligne Congés (signal planning). */
export function isDoctorAbsentForFixed(
  schedule: ScheduleData,
  doctorId: string,
  day: string,
  dateStr: string,
  vacations: DoctorVacation[],
): boolean {
  if (!doctorId || doctorId === "CH") return false
  if (isDoctorOnVacationForFixed(doctorId, dateStr, vacations)) return true
  const conges = schedule["Congés"]?.[day]?.value || []
  if (conges.includes(doctorId)) return true
  const legacy = schedule["Vacances"]?.[day]?.value || []
  return legacy.includes(doctorId)
}

function setDoctors(
  schedule: ScheduleData,
  rowKey: string,
  day: string,
  doctors: string[],
): void {
  if (!schedule[rowKey]?.[day]) return
  const cell = schedule[rowKey][day]
  schedule[rowKey][day] = {
    ...cell,
    value: [...doctors],
    type: doctors.length > 0 ? "doctor" : "empty",
    status: cell.status || "validated",
  }
}

/**
 * Assignation fixe uniquement si le médecin est présent (pas en congés).
 * Sinon : la contrainte saute — on retire l’initiale fixe et la case reste libre
 * (les éventuels remplaçants manuels, ex. P sur Rythmo mercredi, sont conservés).
 */
function assignIfAvailable(
  schedule: ScheduleData,
  rowKey: string,
  day: string,
  doctor: string,
  weekKey: string,
  vacations: DoctorVacation[],
  opts?: { vacationsReady?: boolean },
): void {
  const dateStr = dateStrForWeekDay(weekKey, day)
  if (!dateStr) return
  if (isDoctorAbsentForFixed(schedule, doctor, day, dateStr, vacations)) {
    const current = schedule[rowKey]?.[day]?.value || []
    if (current.includes(doctor)) {
      setDoctors(
        schedule,
        rowKey,
        day,
        current.filter((d) => d !== doctor),
      )
    }
    // Case libre : ne rien réinjecter
    return
  }
  const current = schedule[rowKey]?.[day]?.value || []
  // Congés pas encore chargés : ne pas écraser une couverture manuelle (ex. P)
  if (opts?.vacationsReady === false) {
    const onlyFixedOrEmpty =
      current.length === 0 || current.every((d) => d === doctor)
    if (!onlyFixedOrEmpty) return
  }
  setDoctors(schedule, rowKey, day, [doctor])
}

/**
 * Applique les assignations fixes (écrase les cellules concernées).
 * - IRM : uniquement S — Lundi (matin) + Vendredi (après-midi), hors vacances
 * - FV : Garde Nuit chaque Lundi ; Coro chaque Jeudi après-midi ; hors vacances
 * - DAAS : uniquement Apm - EE2 chaque Lundi, hors vacances
 * - Rythmo : P mardi (matin+apm), U mercredi apm, A lundi+jeudi apm —
 *   **uniquement si le médecin n’est pas en congés** (sinon contrainte sautée, case libre)
 * - Visite : uniquement U/A/B en rotation hebdomadaire, hors vacances
 * - DOC022 : ETT Poret lun matin, écho enfants S mer apm, EE2 V lun matin /
 *   O ven matin, Scinti T lun+mer / R mar
 */
export function applyFixedClinicalAssignments(
  schedule: ScheduleData,
  weekKey: string,
  vacations: DoctorVacation[] = [],
  opts?: { vacationsReady?: boolean },
): ScheduleData {
  const weekNum = Number.parseInt(weekKey.split("-W")[1] || "1", 10)
  const assignOpts = { vacationsReady: opts?.vacationsReady }

  // --- IRM : seul S, Lundi + Vendredi (ligne jour = créneau ouvert) ---
  if (schedule["Hors site - IRM"]) {
    for (const day of DAYS) {
      setDoctors(schedule, "Hors site - IRM", day, [])
    }
    assignIfAvailable(schedule, "Hors site - IRM", "LUNDI", "S", weekKey, vacations, assignOpts)
    assignIfAvailable(schedule, "Hors site - IRM", "VENDREDI", "S", weekKey, vacations, assignOpts)
  }

  // --- Rythmo (saute si le médecin est en congés ce jour-là → case libre) ---
  // P : Mardi matin + apm
  assignIfAvailable(schedule, "Matin - Rythmo", "MARDI", "P", weekKey, vacations, assignOpts)
  assignIfAvailable(schedule, "Apm - Rythmo", "MARDI", "P", weekKey, vacations, assignOpts)
  // U : Mercredi apm
  assignIfAvailable(schedule, "Apm - Rythmo", "MERCREDI", "U", weekKey, vacations, assignOpts)
  // A : Lundi + Jeudi après-midi
  assignIfAvailable(schedule, "Apm - Rythmo", "LUNDI", "A", weekKey, vacations, assignOpts)
  assignIfAvailable(schedule, "Apm - Rythmo", "JEUDI", "A", weekKey, vacations, assignOpts)

  // --- Visite : U → A → B par semaine ---
  if (schedule["Matin - Visite"]) {
    const visiteUser = VISITE_ROTATION[((weekNum % 3) + 3) % 3]
    for (const day of DAYS) {
      assignIfAvailable(schedule, "Matin - Visite", day, visiteUser, weekKey, vacations, assignOpts)
    }
  }

  // --- FV ---
  assignIfAvailable(schedule, "Garde Nuit", "LUNDI", "FV", weekKey, vacations, assignOpts)
  assignIfAvailable(schedule, "Apm - Coro", "JEUDI", "FV", weekKey, vacations, assignOpts)

  // --- DAAS : EE lundi après-midi uniquement ---
  assignIfAvailable(schedule, "Apm - EE2", "LUNDI", "DAAS", weekKey, vacations, assignOpts)

  // --- DOC022 : créneaux cliniques / hors site additionnels ---
  for (const slot of DOC022_FIXED_CLINICAL_SLOTS) {
    if (!schedule[slot.row]) continue
    assignIfAvailable(schedule, slot.row, slot.day, slot.doctor, weekKey, vacations, assignOpts)
  }

  return schedule
}

/**
 * Retire les initiales des règles fixes si le médecin est en vacances ce jour
 * (sans réécrire le reste du planning sauvegardé).
 */
export function clearFixedAssigneesOnVacation(
  schedule: ScheduleData,
  weekKey: string,
  vacations: DoctorVacation[],
): ScheduleData {
  if (!vacations.length) return schedule

  const checks: Array<{ row: string; day: string; doctor: string }> = [
    { row: "Hors site - IRM", day: "LUNDI", doctor: "S" },
    { row: "Hors site - IRM", day: "VENDREDI", doctor: "S" },
    { row: "Garde Nuit", day: "LUNDI", doctor: "FV" },
    { row: "Apm - Coro", day: "JEUDI", doctor: "FV" },
    { row: "Apm - EE2", day: "LUNDI", doctor: "DAAS" },
    { row: "Apm - Rythmo", day: "LUNDI", doctor: "A" },
    { row: "Apm - Rythmo", day: "JEUDI", doctor: "A" },
    { row: "Matin - Rythmo", day: "MARDI", doctor: "P" },
    { row: "Apm - Rythmo", day: "MARDI", doctor: "P" },
    { row: "Apm - Rythmo", day: "MERCREDI", doctor: "U" },
    ...DOC022_FIXED_CLINICAL_SLOTS.map((s) => ({
      row: s.row,
      day: s.day,
      doctor: s.doctor,
    })),
  ]

  for (const day of DAYS) {
    checks.push({ row: "Matin - Visite", day, doctor: "*" })
  }

  let next = schedule
  for (const { row, day, doctor } of checks) {
    const dateStr = dateStrForWeekDay(weekKey, day)
    if (!dateStr || !next[row]?.[day]) continue
    const cell = next[row][day]
    const values = cell.value || []
    if (!values.length) continue

    let filtered: string[]
    if (doctor === "*") {
      // Visite : retirer U/A/B s’ils sont en vacances
      filtered = values.filter(
        (d) =>
          !VISITE_ROTATION.includes(d as (typeof VISITE_ROTATION)[number]) ||
          !isDoctorOnVacationForFixed(d, dateStr, vacations),
      )
    } else if (values.includes(doctor) && isDoctorOnVacationForFixed(doctor, dateStr, vacations)) {
      filtered = values.filter((d) => d !== doctor)
    } else {
      continue
    }

    if (filtered.length === values.length) continue
    if (next === schedule) next = { ...schedule }
    next[row] = { ...next[row] }
    next[row][day] = {
      ...cell,
      value: filtered,
      type: filtered.length > 0 ? "doctor" : "empty",
    }
  }

  return next
}
