import { DAYS } from "@/lib/constants"
import { isListedDoctor } from "@/lib/doctor-code"
import type { ScheduleData } from "@/lib/types"

export type HalfDaySlot = "matin" | "am"

export const HALF_DAY_OFF_MATIN_ROW = "1/2 journée off Matin"
export const HALF_DAY_OFF_APM_ROW = "1/2 journée off Après-midi"

/**
 * Demi-journées libres habituelles (règle fixe métier).
 * Aligné sur le seed de `generateWeekSchedule`.
 */
export const HABITUAL_HALF_DAYS_OFF: Record<string, Partial<Record<HalfDaySlot, string[]>>> = {
  LUNDI: { matin: ["R", "K"], am: ["R", "K", "Z"] },
  MARDI: { matin: ["H", "S"], am: ["H", "S"] },
  MERCREDI: { am: ["B", "W", "M", "G"] },
  JEUDI: { am: ["P", "U"] },
  VENDREDI: { matin: ["K"], am: ["O", "K", "A"] },
}

export function halfDayOffRowForSlot(slot: HalfDaySlot): string {
  return slot === "matin" ? HALF_DAY_OFF_MATIN_ROW : HALF_DAY_OFF_APM_ROW
}

/** True si le médecin a déjà une 1/2 journée off habituelle l’après-midi ce jour-là. */
export function hasHabitualAfternoonOff(doctorId: string, dayName: string): boolean {
  const list = HABITUAL_HALF_DAYS_OFF[dayName]?.am || []
  return list.includes(doctorId)
}

export function hasHabitualMorningOff(doctorId: string, dayName: string): boolean {
  const list = HABITUAL_HALF_DAYS_OFF[dayName]?.matin || []
  return list.includes(doctorId)
}

/**
 * Après garde de nuit : 1/2 off **après-midi** le lendemain,
 * sauf si ce créneau est déjà l’off habituel → alors **matin**.
 * Pas d’off généré si la garde est un samedi.
 */
export function targetOffSlotAfterNightGuard(
  doctorId: string,
  nextDayName: string,
): HalfDaySlot {
  if (hasHabitualAfternoonOff(doctorId, nextDayName)) return "matin"
  return "am"
}

/**
 * Remplit les lignes 1/2 journée off avec les règles habituelles.
 */
export function applyHabitualHalfDaysOff(schedule: ScheduleData): ScheduleData {
  let next = schedule
  for (const [dayName, slots] of Object.entries(HABITUAL_HALF_DAYS_OFF)) {
    for (const slot of ["matin", "am"] as HalfDaySlot[]) {
      const doctors = slots[slot]
      if (!doctors?.length) continue
      const rowKey = halfDayOffRowForSlot(slot)
      if (!next[rowKey]?.[dayName]) continue
      const cell = next[rowKey][dayName]
      const merged = [...(cell.value || [])]
      let changed = false
      for (const doc of doctors) {
        if (!merged.includes(doc)) {
          merged.push(doc)
          changed = true
        }
      }
      // Seed attendu = liste habituelle (ordre stable)
      const expected = [...doctors]
      const same =
        cell.value?.length === expected.length &&
        expected.every((d, i) => cell.value?.[i] === d)
      if (!changed && same) continue
      if (next === schedule) next = { ...schedule }
      if (next[rowKey] === schedule[rowKey]) next[rowKey] = { ...schedule[rowKey] }
      next[rowKey][dayName] = {
        ...cell,
        value: expected,
        type: "doctor",
      }
    }
  }
  return next
}

function addDoctorToHalfDayCell(
  schedule: ScheduleData,
  rowKey: string,
  dayName: string,
  doctorId: string,
): ScheduleData {
  if (!schedule[rowKey]?.[dayName]) return schedule
  const cell = schedule[rowKey][dayName]
  const value = cell.value || []
  if (value.includes(doctorId)) return schedule
  return {
    ...schedule,
    [rowKey]: {
      ...schedule[rowKey],
      [dayName]: {
        ...cell,
        value: [...value, doctorId],
        type: "doctor",
      },
    },
  }
}

function removeDoctorFromHalfDayCell(
  schedule: ScheduleData,
  rowKey: string,
  dayName: string,
  doctorId: string,
): ScheduleData {
  if (!schedule[rowKey]?.[dayName]) return schedule
  const cell = schedule[rowKey][dayName]
  const value = cell.value || []
  if (!value.includes(doctorId)) return schedule
  const filtered = value.filter((d) => d !== doctorId)
  return {
    ...schedule,
    [rowKey]: {
      ...schedule[rowKey],
      [dayName]: {
        ...cell,
        value: filtered,
        type: filtered.length > 0 ? "doctor" : "empty",
      },
    },
  }
}

/**
 * Place (ou corrige) la 1/2 journée off de récupération après garde de nuit.
 * - tous les jours sauf SAMEDI
 * - défaut : après-midi du lendemain
 * - si off habituel apm ce jour-là → matin du lendemain
 */
export function placeNightGuardRecoveryOff(
  schedule: ScheduleData,
  nightDayName: string,
  doctorId: string,
): ScheduleData {
  if (!doctorId || doctorId === "CH" || !isListedDoctor(doctorId)) return schedule
  if (nightDayName === "SAMEDI") return schedule

  const dayIndex = DAYS.indexOf(nightDayName)
  if (dayIndex < 0 || dayIndex >= DAYS.length - 1) return schedule

  const nextDay = DAYS[dayIndex + 1]
  const targetSlot = targetOffSlotAfterNightGuard(doctorId, nextDay)
  const targetRow = halfDayOffRowForSlot(targetSlot)
  const otherSlot: HalfDaySlot = targetSlot === "am" ? "matin" : "am"
  const otherRow = halfDayOffRowForSlot(otherSlot)

  let next = addDoctorToHalfDayCell(schedule, targetRow, nextDay, doctorId)

  // Nettoie un mauvais créneau de récupération (sans toucher à l’off habituel)
  const otherIsHabitual =
    otherSlot === "am"
      ? hasHabitualAfternoonOff(doctorId, nextDay)
      : hasHabitualMorningOff(doctorId, nextDay)
  if (!otherIsHabitual) {
    next = removeDoctorFromHalfDayCell(next, otherRow, nextDay, doctorId)
  }

  return next
}

/**
 * Parcourt la ligne Garde Nuit de la semaine et applique les récupérations.
 * `previousSundayGuardDoctor` : garde dimanche semaine précédente → off lundi.
 */
export function applyNightGuardRecoveryOffs(
  schedule: ScheduleData,
  opts?: { previousSundayGuardDoctor?: string | null },
): ScheduleData {
  let next = schedule

  const nightRow = schedule["Garde Nuit"]
  if (nightRow) {
    for (const dayName of DAYS) {
      if (dayName === "SAMEDI") continue
      const doctors = nightRow[dayName]?.value || []
      for (const doctorId of doctors) {
        next = placeNightGuardRecoveryOff(next, dayName, doctorId)
      }
    }
  }

  const sundayDoc = opts?.previousSundayGuardDoctor
  if (sundayDoc && sundayDoc !== "CH" && isListedDoctor(sundayDoc)) {
    // Dimanche précédent ≈ même règle que nuit « virtuelle » avant LUNDI
    // → place via nightDay = DIMANCHE ne marche pas (pas de lendemain in-week).
    // On place directement sur LUNDI.
    const targetSlot = targetOffSlotAfterNightGuard(sundayDoc, "LUNDI")
    const targetRow = halfDayOffRowForSlot(targetSlot)
    const otherSlot: HalfDaySlot = targetSlot === "am" ? "matin" : "am"
    const otherRow = halfDayOffRowForSlot(otherSlot)
    next = addDoctorToHalfDayCell(next, targetRow, "LUNDI", sundayDoc)
    const otherIsHabitual =
      otherSlot === "am"
        ? hasHabitualAfternoonOff(sundayDoc, "LUNDI")
        : hasHabitualMorningOff(sundayDoc, "LUNDI")
    if (!otherIsHabitual) {
      next = removeDoctorFromHalfDayCell(next, otherRow, "LUNDI", sundayDoc)
    }
  }

  return next
}
