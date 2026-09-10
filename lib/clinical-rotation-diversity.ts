/**
 * Règles de diversité et de priorité pour les propositions du générateur
 * (demande utilisateur) :
 *
 *  1. Stress : le même médecin ne doit jamais être reproposé deux jours
 *     consécutifs, sauf si aucun autre médecin éligible n'est disponible.
 *  2. Rééducation (Lundi/Mercredi/Vendredi — seuls jours ouverts, voir
 *     lib/closed-slots.ts) : jamais le même médecin sur les 3 créneaux de
 *     la semaine, sauf exception (indisponibilité de tous les autres
 *     médecins éligibles).
 *  3. Cs PSS : les coronarographistes (M, O, W) non affectés en Coro ce
 *     jour-là et pas hors site, ainsi que les rythmologues (P, A) non
 *     affectés en Rythmo/ETT, ainsi que les échographistes (H, Z, G) non
 *     affectés en Stress/ETT/Rééducation, sont proposés en priorité sur les
 *     cases Cs PSS encore vides. U, B et S en sont exclus (exclusivement
 *     Cs Tessée).
 *
 * Le solveur externe (backend séparé, hors de ce dépôt) ne connaît pas ces
 * règles fines — cette passe locale s'exécute donc APRÈS ses propositions
 * pour les corriger avant affichage. Elle ne touche JAMAIS une case déjà
 * validée / remplie manuellement (uniquement les cases encore "pending" ou
 * vides), cohérent avec la règle « le générateur ne doit jamais écraser une
 * saisie existante ».
 */
import { DAYS } from "@/lib/constants"
import { dateStrForWeekDay } from "@/lib/fixed-assignments"
import { canAssignDoctorToSlot } from "@/lib/slot-blocking"
import { DOC022_CLINICAL_ELIGIBILITY } from "@/lib/group-clinical-rules"
import type { ScheduleData, DoctorVacation } from "@/lib/types"

const WEEKDAYS = ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI"] as const
const REEDUC_ROW = "Apm - RÉEDUCATION"
const REEDUC_DAYS = ["LUNDI", "MERCREDI", "VENDREDI"] as const
const STRESS_ROWS = ["Matin - Stress", "Apm - Stress"] as const

function cellDoctor(schedule: ScheduleData, row: string, day: string): string | null {
  const v = schedule[row]?.[day]?.value
  return Array.isArray(v) && v.length > 0 ? v[0] : null
}

function isPending(schedule: ScheduleData, row: string, day: string): boolean {
  return schedule[row]?.[day]?.status === "pending"
}

function setDoctor(
  schedule: ScheduleData,
  row: string,
  day: string,
  doctor: string,
  status: "validated" | "pending",
): ScheduleData {
  const existingRow = schedule[row] || {}
  const existingCell = existingRow[day]
  return {
    ...schedule,
    [row]: {
      ...existingRow,
      [day]: {
        ...(existingCell || {}),
        value: [doctor],
        type: "doctor",
        status,
      },
    },
  }
}

/** Premier candidat éligible + réellement disponible ce jour-là pour cette case (hors exclus). */
function pickReplacement(
  schedule: ScheduleData,
  weekKey: string,
  row: string,
  day: string,
  pool: readonly string[],
  exclude: readonly string[],
  vacations: DoctorVacation[],
): string | null {
  const dateStr = dateStrForWeekDay(weekKey, day)
  if (!dateStr) return null
  for (const candidate of pool) {
    if (exclude.includes(candidate)) continue
    const r = canAssignDoctorToSlot(candidate, dateStr, row, day, schedule, vacations)
    if (r.allowed) return candidate
  }
  return null
}

/** 1. Stress : pas le même médecin 2 jours consécutifs (cases pending uniquement). */
function diversifyStress(schedule: ScheduleData, weekKey: string, vacations: DoctorVacation[]): ScheduleData {
  let next = schedule
  const pool = DOC022_CLINICAL_ELIGIBILITY.stress as readonly string[]

  for (let i = 1; i < WEEKDAYS.length; i++) {
    const prevDay = WEEKDAYS[i - 1]
    const day = WEEKDAYS[i]
    const prevDoctors = new Set(
      STRESS_ROWS.map((r) => cellDoctor(next, r, prevDay)).filter((d): d is string => Boolean(d)),
    )
    if (prevDoctors.size === 0) continue

    for (const row of STRESS_ROWS) {
      const doctor = cellDoctor(next, row, day)
      if (!doctor || !prevDoctors.has(doctor)) continue
      if (!isPending(next, row, day)) continue // jamais toucher une case validée manuellement
      const replacement = pickReplacement(
        next,
        weekKey,
        row,
        day,
        pool,
        [...prevDoctors],
        vacations,
      )
      if (replacement) {
        next = setDoctor(next, row, day, replacement, "pending")
      }
      // Sinon : aucune alternative disponible → on laisse la répétition
      // (exception explicitement prévue par la consigne utilisateur).
    }
  }
  return next
}

/** 2. Rééducation : jamais le même médecin sur les 3 créneaux Lun/Mer/Ven (cases pending uniquement). */
function diversifyReeduc(schedule: ScheduleData, weekKey: string, vacations: DoctorVacation[]): ScheduleData {
  let next = schedule
  const pool = DOC022_CLINICAL_ELIGIBILITY.reeduc as readonly string[]
  const used: string[] = []

  for (const day of REEDUC_DAYS) {
    const doctor = cellDoctor(next, REEDUC_ROW, day)
    if (!doctor) continue
    if (!used.includes(doctor)) {
      used.push(doctor)
      continue
    }
    // Répétition détectée
    if (!isPending(next, REEDUC_ROW, day)) continue // jamais toucher une case validée manuellement
    const replacement = pickReplacement(next, weekKey, REEDUC_ROW, day, pool, used, vacations)
    if (replacement) {
      next = setDoctor(next, REEDUC_ROW, day, replacement, "pending")
      used.push(replacement)
    }
    // Sinon : aucune alternative dispo → répétition tolérée (exception).
  }
  return next
}

/**
 * 3. Cs PSS : remplissage prioritaire des cases encore VIDES (jamais une
 * case déjà remplie, pending ou validée) avec le premier médecin libre
 * trouvé dans l'ordre coro (M, O, W) → rythmo (P, A) → écho (H, Z, G).
 * U, B, S ne sont jamais candidats (exclusivement Cs Tessée).
 */
function fillCsPssFallback(schedule: ScheduleData, weekKey: string, vacations: DoctorVacation[]): ScheduleData {
  let next = schedule
  const coroGroup = ["M", "O", "W"] as const
  const rythmoGroup = ["P", "A"] as const
  const echoGroup = ["H", "Z", "G"] as const
  const priorityPool = [...coroGroup, ...rythmoGroup, ...echoGroup]
  const excluded = ["U", "B", "S"]

  for (const row of ["Matin - Cs PSS", "Apm - Cs PSS"] as const) {
    if (!next[row]) continue
    for (const day of WEEKDAYS) {
      const cell = next[row][day]
      const hasValue = Array.isArray(cell?.value) && cell.value.length > 0
      if (hasValue) continue // ne jamais toucher une case déjà remplie
      const replacement = pickReplacement(next, weekKey, row, day, priorityPool, excluded, vacations)
      if (replacement) {
        next = setDoctor(next, row, day, replacement, "pending")
      }
    }
  }
  return next
}

/** Point d'entrée unique, à appeler juste après les propositions du solveur. */
export function applyClinicalRotationRules(
  schedule: ScheduleData,
  weekKey: string,
  vacations: DoctorVacation[],
): ScheduleData {
  let next = schedule
  next = diversifyStress(next, weekKey, vacations)
  next = diversifyReeduc(next, weekKey, vacations)
  next = fillCsPssFallback(next, weekKey, vacations)
  return next
}
