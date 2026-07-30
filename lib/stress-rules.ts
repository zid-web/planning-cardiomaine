/**
 * Règles Stress + externe D (echo PSS stress).
 *
 * - Jamais de vacation Stress le mercredi après-midi ni le vendredi après-midi
 *   (cases grisées / non assignables).
 * - D : tous les jeudis — Stress matin ;
 *   - 1er jeudi du mois : Stress matin + Stress après-midi ;
 *   - autres jeudis : Stress matin + EE1 et EE2 après-midi.
 */

import {
  dateStrForWeekDay,
  isDoctorAbsentForFixed,
} from "@/lib/fixed-assignments"
import type { DoctorVacation, ScheduleData } from "@/lib/types"

export const STRESS_MATIN_ROW = "Matin - Stress"
export const STRESS_APM_ROW = "Apm - Stress"
export const STRESS_CLOSED_APM_DAYS = ["MERCREDI", "VENDREDI"] as const

/** Cases Stress fermées (jamais de vacation). */
export function isStressSlotClosed(rowKey: string, day: string): boolean {
  return rowKey === STRESS_APM_ROW && (STRESS_CLOSED_APM_DAYS as readonly string[]).includes(day)
}

/**
 * Premier jeudi du mois calendaire (date ISO YYYY-MM-DD, jour local UTC
 * aligné `dateStrForWeekDay`).
 */
export function isFirstThursdayOfMonth(isoDate: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!m) return false
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const date = new Date(Date.UTC(y, mo - 1, d))
  if (date.getUTCDay() !== 4) return false // jeudi
  return d <= 7
}

function setDoctors(
  schedule: ScheduleData,
  rowKey: string,
  day: string,
  doctors: string[],
): ScheduleData {
  if (!schedule[rowKey]?.[day]) return schedule
  const cell = schedule[rowKey][day]
  return {
    ...schedule,
    [rowKey]: {
      ...schedule[rowKey],
      [day]: {
        ...cell,
        value: [...doctors],
        type: doctors.length > 0 ? "doctor" : "empty",
        status: (cell.status || "validated") as "validated" | "pending",
      },
    },
  }
}

function removeDoctor(
  schedule: ScheduleData,
  rowKey: string,
  day: string,
  doctor: string,
): ScheduleData {
  const vals = schedule[rowKey]?.[day]?.value || []
  if (!vals.includes(doctor)) return schedule
  return setDoctors(
    schedule,
    rowKey,
    day,
    vals.filter((d) => d !== doctor),
  )
}

function assignExclusiveIfAvailable(
  schedule: ScheduleData,
  rowKey: string,
  day: string,
  doctor: string,
  weekKey: string,
  vacations: DoctorVacation[],
  opts?: { vacationsReady?: boolean },
): ScheduleData {
  if (!schedule[rowKey]?.[day]) return schedule
  const dateStr = dateStrForWeekDay(weekKey, day)
  if (!dateStr) return schedule
  if (isDoctorAbsentForFixed(schedule, doctor, day, dateStr, vacations)) {
    return removeDoctor(schedule, rowKey, day, doctor)
  }
  const current = schedule[rowKey][day].value || []
  if (opts?.vacationsReady === false) {
    const onlyFixedOrEmpty =
      current.length === 0 || current.every((d) => d === doctor)
    if (!onlyFixedOrEmpty) return schedule
  }
  return setDoctors(schedule, rowKey, day, [doctor])
}

/** Vide les cases Stress fermées (Mer/Ven Apm). */
export function applyStressClosedClear(schedule: ScheduleData): ScheduleData {
  let next = schedule
  for (const day of STRESS_CLOSED_APM_DAYS) {
    if (!next[STRESS_APM_ROW]?.[day]) continue
    const vals = next[STRESS_APM_ROW][day].value || []
    if (vals.length === 0) continue
    next = setDoctors(next, STRESS_APM_ROW, day, [])
  }
  return next
}

/**
 * Injecte D le jeudi (Stress / EE selon 1er jeudi du mois).
 * Soft sur congés : contrainte sautée si D absente.
 */
export function applyDThursdayAssignments(
  schedule: ScheduleData,
  weekKey: string,
  vacations: DoctorVacation[] = [],
  opts?: { vacationsReady?: boolean },
): ScheduleData {
  if (!weekKey || !schedule) return schedule
  const thuDate = dateStrForWeekDay(weekKey, "JEUDI")
  if (!thuDate) return schedule

  const firstThu = isFirstThursdayOfMonth(thuDate)
  let next = schedule

  // Tous les jeudis : Stress matin = D
  next = assignExclusiveIfAvailable(
    next,
    STRESS_MATIN_ROW,
    "JEUDI",
    "D",
    weekKey,
    vacations,
    opts,
  )

  if (firstThu) {
    next = assignExclusiveIfAvailable(
      next,
      STRESS_APM_ROW,
      "JEUDI",
      "D",
      weekKey,
      vacations,
      opts,
    )
    next = removeDoctor(next, "Apm - EE1", "JEUDI", "D")
    next = removeDoctor(next, "Apm - EE2", "JEUDI", "D")
  } else {
    next = removeDoctor(next, STRESS_APM_ROW, "JEUDI", "D")
    next = assignExclusiveIfAvailable(
      next,
      "Apm - EE1",
      "JEUDI",
      "D",
      weekKey,
      vacations,
      opts,
    )
    next = assignExclusiveIfAvailable(
      next,
      "Apm - EE2",
      "JEUDI",
      "D",
      weekKey,
      vacations,
      opts,
    )
  }

  return next
}

/** Point d’entrée structurel : clear Mer/Ven Apm Stress + D jeudi. */
export function applyStressAndDRules(
  schedule: ScheduleData,
  weekKey: string,
  vacations: DoctorVacation[] = [],
  opts?: { vacationsReady?: boolean },
): ScheduleData {
  let next = applyStressClosedClear(schedule)
  next = applyDThursdayAssignments(next, weekKey, vacations, opts)
  return next
}
