import { DAYS } from "@/lib/constants"
import { isListedDoctor } from "@/lib/doctor-code"
import { mondayOfIsoWeekKey } from "@/lib/fixed-assignments"
import type { ScheduleData } from "@/lib/types"

export type HalfDaySlot = "matin" | "am"

export const HALF_DAY_OFF_MATIN_ROW = "1/2 journée off Matin"
export const HALF_DAY_OFF_APM_ROW = "1/2 journée off Après-midi"

/**
 * Demi-journées libres habituelles (règle fixe métier).
 * Source unique aussi pour `applyHabitualHalfDaysOff` / récupération garde nuit.
 *
 * **H / S (mardi)** : ½ off **après-midi uniquement** — pas le matin
 * (le matin n’apparaît que via récupération après Garde Nuit la veille).
 */
export const HABITUAL_HALF_DAYS_OFF: Record<string, Partial<Record<HalfDaySlot, string[]>>> = {
  LUNDI: { matin: ["R", "K"], am: ["R", "K", "Z"] },
  MARDI: { am: ["H", "S"] }, // pas de ½ off matin habituel pour H/S
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

/** ISO week key for a UTC Monday date. */
function isoWeekKeyFromUtcMonday(monday: Date): string {
  const thursday = new Date(monday)
  thursday.setUTCDate(monday.getUTCDate() + 3)
  const year = thursday.getUTCFullYear()
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dayJan4 = jan4.getUTCDay() || 7
  const monday1 = new Date(jan4.getTime() - (dayJan4 - 1) * 86400000)
  const week = Math.round((monday.getTime() - monday1.getTime()) / 86400000 / 7) + 1
  return `${year}-W${String(week).padStart(2, "0")}`
}

/** Semaine ISO précédente (`2026-W30` → `2026-W29`). */
export function previousIsoWeekKey(weekKey: string): string | null {
  const monday = mondayOfIsoWeekKey(weekKey)
  if (!monday) return null
  const prev = new Date(monday)
  prev.setUTCDate(prev.getUTCDate() - 7)
  return isoWeekKeyFromUtcMonday(prev)
}

/** Semaine ISO suivante (`2026-W30` → `2026-W31`). */
export function nextIsoWeekKey(weekKey: string): string | null {
  const monday = mondayOfIsoWeekKey(weekKey)
  if (!monday) return null
  const next = new Date(monday)
  next.setUTCDate(next.getUTCDate() + 7)
  return isoWeekKeyFromUtcMonday(next)
}

/**
 * Médecin de garde/astreinte nuit le dimanche (hors CH).
 * Priorité : Garde Nuit, puis Astreintes ATL Nuit.
 */
export function extractSundayNightGuardDoctor(
  schedule: ScheduleData | undefined | null,
): string | null {
  if (!schedule) return null
  for (const rowKey of ["Garde Nuit", "Astreintes ATL Nuit"] as const) {
    const doctors = schedule[rowKey]?.DIMANCHE?.value || []
    const real = doctors.find((d) => Boolean(d) && d !== "CH" && isListedDoctor(d))
    if (real) return real
  }
  return null
}

/** Médecins listés (hors CH) réellement sur Garde Nuit ce jour. */
export function nightGuardDoctorsOnDay(schedule: ScheduleData, nightDay: string): string[] {
  const vals = schedule["Garde Nuit"]?.[nightDay]?.value || []
  return vals.filter((d) => Boolean(d) && d !== "CH" && isListedDoctor(d))
}

/**
 * Remplit les lignes 1/2 journée off avec les règles habituelles.
 * Pour chaque jour : aligne matin **et** apm sur `HABITUAL_HALF_DAYS_OFF`
 * (slot absent → case vide), afin de retirer définitivement d’anciennes
 * initiales erronées (ex. H/S mardi matin).
 */
export function applyHabitualHalfDaysOff(schedule: ScheduleData): ScheduleData {
  let next = schedule
  for (const dayName of DAYS) {
    for (const slot of ["matin", "am"] as HalfDaySlot[]) {
      const doctors = HABITUAL_HALF_DAYS_OFF[dayName]?.[slot] || []
      const rowKey = halfDayOffRowForSlot(slot)
      if (!next[rowKey]?.[dayName]) continue
      const cell = next[rowKey][dayName]
      const expected = [...doctors]
      const same =
        (cell.value || []).length === expected.length &&
        expected.every((d, i) => cell.value?.[i] === d)
      if (same) continue
      if (next === schedule) next = { ...schedule }
      if (next[rowKey] === schedule[rowKey]) next[rowKey] = { ...schedule[rowKey] }
      next[rowKey][dayName] = {
        ...cell,
        value: expected,
        type: expected.length > 0 ? "doctor" : "empty",
      }
    }
  }
  return next
}

function setHalfDayCell(
  schedule: ScheduleData,
  rowKey: string,
  dayName: string,
  doctors: string[],
): ScheduleData {
  if (!schedule[rowKey]?.[dayName]) return schedule
  const cell = schedule[rowKey][dayName]
  const unique = [...new Set(doctors.filter(Boolean))]
  const prev = cell.value || []
  const same =
    prev.length === unique.length && unique.every((d, i) => prev[i] === d)
  if (same) return schedule
  return {
    ...schedule,
    [rowKey]: {
      ...schedule[rowKey],
      [dayName]: {
        ...cell,
        value: unique,
        type: unique.length > 0 ? "doctor" : "empty",
      },
    },
  }
}

/**
 * Reconstruit les cases ½ off matin + après-midi d’un jour :
 * - conserve uniquement les offs **habituels**
 * - ajoute uniquement le(s) médecin(s) de récupération (garde de nuit la veille)
 * Nettoyage systématique : plus d’anciens médecins de récupération orphelins.
 */
export function rebuildHalfDayOffsForDay(
  schedule: ScheduleData,
  dayName: string,
  recoveryDoctors: string[],
): ScheduleData {
  const habitualMatin = HABITUAL_HALF_DAYS_OFF[dayName]?.matin || []
  const habitualAm = HABITUAL_HALF_DAYS_OFF[dayName]?.am || []

  const matin: string[] = [...habitualMatin]
  const am: string[] = [...habitualAm]

  for (const doc of recoveryDoctors) {
    if (!doc || doc === "CH" || !isListedDoctor(doc)) continue
    const slot = targetOffSlotAfterNightGuard(doc, dayName)
    if (slot === "matin") {
      if (!matin.includes(doc)) matin.push(doc)
    } else if (!am.includes(doc)) {
      am.push(doc)
    }
  }

  let next = setHalfDayCell(schedule, HALF_DAY_OFF_MATIN_ROW, dayName, matin)
  next = setHalfDayCell(next, HALF_DAY_OFF_APM_ROW, dayName, am)
  return next
}

/**
 * Jour suivant d’une nuit de garde (null si samedi / dimanche / inconnu).
 */
export function nextDayAfterNightGuard(nightDayName: string): string | null {
  if (nightDayName === "SAMEDI" || nightDayName === "DIMANCHE") return null
  const idx = DAYS.indexOf(nightDayName)
  if (idx < 0 || idx >= DAYS.length - 1) return null
  return DAYS[idx + 1]
}

/**
 * Après modification de Garde Nuit un jour J : reconstruit les ½ off du lendemain
 * (matin + apm) pour ne garder que les habituels + le médecin réellement de garde.
 */
export function syncRecoveryOffsAfterNightGuardChange(
  schedule: ScheduleData,
  nightDayName: string,
): ScheduleData {
  const nextDay = nextDayAfterNightGuard(nightDayName)
  if (!nextDay) return schedule
  const recovery = nightGuardDoctorsOnDay(schedule, nightDayName)
  return rebuildHalfDayOffsForDay(schedule, nextDay, recovery)
}

/**
 * Place la ½ off de récupération le **lundi** après une garde de nuit dimanche
 * (semaine précédente). Reconstruit matin + apm lundi (habituels + récupération).
 */
export function placeMondayRecoveryFromSundayNight(
  schedule: ScheduleData,
  sundayDoc: string | string[] | null | undefined,
): ScheduleData {
  const list = Array.isArray(sundayDoc) ? sundayDoc : sundayDoc ? [sundayDoc] : []
  const recovery = list.filter((d) => Boolean(d) && d !== "CH" && isListedDoctor(d))
  return rebuildHalfDayOffsForDay(schedule, "LUNDI", recovery)
}

/**
 * Place (ou corrige) la 1/2 journée off de récupération après garde de nuit.
 * Préférer `syncRecoveryOffsAfterNightGuardChange` (nettoie toute la case lendemain).
 * - DIMANCHE / SAMEDI : no-op in-week
 */
export function placeNightGuardRecoveryOff(
  schedule: ScheduleData,
  nightDayName: string,
  _doctorId?: string,
): ScheduleData {
  return syncRecoveryOffsAfterNightGuardChange(schedule, nightDayName)
}

/**
 * Parcourt la ligne Garde Nuit et reconstruit les ½ off du lendemain
 * (nettoyage systématique : uniquement habituels + médecin(s) réellement de garde).
 * `previousSundayGuardDoctor` : garde dimanche semaine précédente → ½ off lundi.
 */
export function applyNightGuardRecoveryOffs(
  schedule: ScheduleData,
  opts?: { previousSundayGuardDoctor?: string | null },
): ScheduleData {
  let next = schedule

  for (const dayName of DAYS) {
    if (dayName === "SAMEDI" || dayName === "DIMANCHE") continue
    next = syncRecoveryOffsAfterNightGuardChange(next, dayName)
  }

  // Lundi : récupération dimanche précédent (remplace / nettoie au-delà des nuits in-week)
  next = placeMondayRecoveryFromSundayNight(next, opts?.previousSundayGuardDoctor)

  return next
}
