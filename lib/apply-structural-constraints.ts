import { DAYS } from "@/lib/constants"
import {
  applyFixedClinicalAssignments,
  clearFixedAssigneesOnVacation,
  dateStrForWeekDay,
  mondayOfIsoWeekKey,
} from "@/lib/fixed-assignments"
import {
  applyHabitualHalfDaysOff,
  applyNightGuardRecoveryOffs,
} from "@/lib/half-day-off"
import { NCT_DATES_2025_DEC, NCT_DATES_2026 } from "@/lib/guard-scheduler"
import type { DoctorVacation, ScheduleData } from "@/lib/types"
import { normalizeLeaveSchedule } from "@/lib/vacation-congés-mapper"

/**
 * Lignes / règles structurelles — toujours injectées dans le planning
 * (sans passer par « Générer »).
 */
export const STRUCTURAL_CONSTRAINT_NOTES = [
  "IRM = S (Lundi + Vendredi)",
  "FV = Garde Nuit Lundi + Coro Jeudi apm",
  "DAAS = Apm EE2 Lundi",
  "Rythmo = P mardi, U mercredi apm, A lundi/jeudi apm",
  "Visite = rotation U → A → B",
  "½ journée off habituelles",
  "½ journée off récupération après Garde Nuit",
  "Congés depuis doctor_vacations + retrait absents",
  "NCT calendrier (W/M)",
  "LFB Jeudi rotation B/Z/A",
] as const

function setValidatedDoctors(
  schedule: ScheduleData,
  rowKey: string,
  day: string,
  doctors: string[],
): ScheduleData {
  if (!schedule[rowKey]?.[day]) return schedule
  const cell = schedule[rowKey][day]
  const unique = [...new Set(doctors.filter(Boolean))]
  const same =
    (cell.value || []).length === unique.length &&
    unique.every((d, i) => cell.value?.[i] === d) &&
    cell.status === "validated"
  if (same) return schedule
  return {
    ...schedule,
    [rowKey]: {
      ...schedule[rowKey],
      [day]: {
        ...cell,
        value: unique,
        type: unique.length ? "doctor" : "empty",
        status: "validated",
      },
    },
  }
}

/** NCT calendrier pour la semaine courante. */
export function applyNctCalendarConstraints(
  schedule: ScheduleData,
  weekKey: string,
): ScheduleData {
  if (!schedule["Hors site - NCT"]) return schedule
  const monday = mondayOfIsoWeekKey(weekKey)
  if (!monday) return schedule

  const yearNum = Number.parseInt(weekKey.split("-")[0] || "0", 10)
  const nctList =
    yearNum === 2025
      ? NCT_DATES_2025_DEC
      : yearNum >= 2026
        ? NCT_DATES_2026
        : []

  const dayToDate: Record<string, string> = {}
  for (const day of DAYS) {
    const iso = dateStrForWeekDay(weekKey, day)
    if (iso) dayToDate[day] = iso
  }

  let next = schedule
  for (const nct of nctList) {
    const dayName = Object.keys(dayToDate).find((d) => dayToDate[d] === nct.date)
    if (!dayName) continue
    next = setValidatedDoctors(next, "Hors site - NCT", dayName, [nct.user])
  }
  return next
}

/** LFB Jeudi : rotation B → Z → A. */
export function applyLfbThursdayRotation(
  schedule: ScheduleData,
  weekKey: string,
): ScheduleData {
  if (!schedule["Hors site - LFB"]) return schedule
  const weekNum = Number.parseInt(weekKey.split("-W")[1] || "1", 10)
  const lfbUser = (["B", "Z", "A"] as const)[((weekNum % 3) + 3) % 3]
  let next = schedule
  for (const day of DAYS) {
    next = setValidatedDoctors(next, "Hors site - LFB", day, day === "JEUDI" ? [lfbUser] : [])
  }
  return next
}

export type ApplyStructuralConstraintsOptions = {
  previousSundayGuardDoctor?: string | null
  /** Si false, ne touche pas aux ½-off habituelles (défaut true). */
  applyHabitualHalfDays?: boolean
  /** Si false, ne dérive pas la récupération garde nuit (défaut true). */
  applyNightRecovery?: boolean
}

/**
 * Injecte toutes les contraintes structurelles métier dans un planning semaine.
 * Idempotent. Les cellules structurelles sont en statut **validated**.
 *
 * Ne remplit PAS les propositions équité (gardes/astreintes/Coro libres) —
 * cela reste le rôle de « Générer » (pending).
 */
export function applyStructuralConstraints(
  schedule: ScheduleData,
  weekKey: string,
  vacations: DoctorVacation[] = [],
  opts: ApplyStructuralConstraintsOptions = {},
): ScheduleData {
  if (!schedule || !weekKey) return schedule

  // Clone profond : applyFixedClinicalAssignments mute les cellules en place
  let next: ScheduleData = structuredClone(schedule)

  // 1) Assignations cliniques fixes (IRM / FV / DAAS / Rythmo / Visite)
  next = applyFixedClinicalAssignments(next, weekKey, vacations)

  // 2) NCT calendrier + LFB
  next = applyNctCalendarConstraints(next, weekKey)
  next = applyLfbThursdayRotation(next, weekKey)

  // 3) Demi-journées libres habituelles
  if (opts.applyHabitualHalfDays !== false) {
    next = applyHabitualHalfDaysOff(next)
  }

  // 4) Récupération ½ off après Garde Nuit (y compris dimanche précédent → lundi)
  if (opts.applyNightRecovery !== false) {
    next = applyNightGuardRecoveryOffs(next, {
      previousSundayGuardDoctor: opts.previousSundayGuardDoctor,
    })
  }

  // 5) Congés + retrait des absents des autres lignes
  next = normalizeLeaveSchedule(next, vacations, weekKey)

  // 6) Sécurité : retirer initiales fixes si congés (idempotent avec 1)
  if (vacations.length > 0) {
    next = clearFixedAssigneesOnVacation(next, weekKey, vacations)
  }

  return next
}

/**
 * Compare deux plannings semaine (valeurs + status) pour savoir s’il faut persister.
 */
export function schedulesDiffer(a: ScheduleData | undefined, b: ScheduleData | undefined): boolean {
  if (a === b) return false
  if (!a || !b) return true
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const rowKey of keys) {
    for (const day of DAYS) {
      const ca = a[rowKey]?.[day]
      const cb = b[rowKey]?.[day]
      const va = (ca?.value || []).join("|")
      const vb = (cb?.value || []).join("|")
      if (va !== vb) return true
      if ((ca?.status || "validated") !== (cb?.status || "validated")) return true
    }
  }
  return false
}
