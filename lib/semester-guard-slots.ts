/**
 * Utilities for computing semester guard slots (WE + public holidays)
 * and for mapping weeks to semester boundaries.
 */

import { isWomComboWeekend } from "@/lib/weekend-wom-rules"

// French public holidays (fixed each year + Easter-based)
export function getFrenchPublicHolidays(year: number): string[] {
  const holidays: string[] = []

  // Fixed holidays
  holidays.push(`${year}-01-01`) // Nouvel An
  holidays.push(`${year}-05-01`) // Fête du Travail
  holidays.push(`${year}-05-08`) // Victoire 1945
  holidays.push(`${year}-07-14`) // Fête Nationale
  holidays.push(`${year}-08-15`) // Assomption
  holidays.push(`${year}-11-01`) // Toussaint
  holidays.push(`${year}-11-11`) // Armistice
  holidays.push(`${year}-12-25`) // Noël

  // Easter-based (algorithm for Western Easter)
  const easterDate = computeEaster(year)
  const lundi = new Date(easterDate)
  lundi.setDate(lundi.getDate() + 1)
  const ascension = new Date(easterDate)
  ascension.setDate(ascension.getDate() + 39)
  const pentecote = new Date(easterDate)
  pentecote.setDate(pentecote.getDate() + 49)
  const lundiPentecote = new Date(easterDate)
  lundiPentecote.setDate(lundiPentecote.getDate() + 50)

  holidays.push(toDateStr(lundi))       // Lundi de Pâques
  holidays.push(toDateStr(ascension))   // Ascension
  holidays.push(toDateStr(pentecote))   // Pentecôte (not always, but included)
  holidays.push(toDateStr(lundiPentecote)) // Lundi de Pentecôte

  return [...new Set(holidays)].sort()
}

function computeEaster(year: number): Date {
  // Anonymous Gregorian algorithm
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0]
}

export type SemesterGuardSlot = {
  date: string         // YYYY-MM-DD
  dayType: "samedi" | "dimanche" | "ferie"
  weekday: string      // 'Samedi' | 'Dimanche' | display name
  weekKey: string      // ISO week key e.g. "2026-W03"
  isWomCombo: boolean  // Is this a WOM combo weekend?
  isHolidayWeekday: boolean // Is it a public holiday falling on a weekday (Mon-Fri)?
  label: string        // human-readable date
}

const MONTH_LABELS_FR = [
  "jan.", "fév.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
]

const DAY_LABELS_FR = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."]

export function formatDateFr(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00")
  const day = d.getDate()
  const monthLabel = MONTH_LABELS_FR[d.getMonth()]
  const dayLabel = DAY_LABELS_FR[d.getDay()]
  return `${dayLabel} ${day} ${monthLabel}`
}

/**
 * Returns all guard slots (Samedi, Dimanche, Fériés)
 * for the given semester and year.
 *
 * S1: January → August (excluding Jan 1 if semester === 1, only exclude if that's the rule)
 * S2: September → December (including Jan 1 of year+1)
 */
export function getSemesterGuardSlots(
  semester: 1 | 2,
  year: number,
): SemesterGuardSlot[] {
  const slots: SemesterGuardSlot[] = []

  // Semester date boundaries
  const startDate = semester === 1
    ? new Date(year, 0, 2)    // Jan 2 (exclude Jan 1 = Nouvel An)
    : new Date(year, 8, 1)    // Sep 1

  const endDate = semester === 1
    ? new Date(year, 7, 31)   // Aug 31
    : new Date(year + 1, 0, 1) // Jan 1 of next year (included)

  // Collect public holidays for the year (and year+1 for S2)
  const holidays = new Set(getFrenchPublicHolidays(year))
  if (semester === 2) {
    getFrenchPublicHolidays(year + 1).forEach(h => holidays.add(h))
  }

  const cur = new Date(startDate)
  while (cur <= endDate) {
    const dateStr = toDateStr(cur)
    const dayOfWeek = cur.getDay() // 0=Sun, 6=Sat
    const isSat = dayOfWeek === 6
    const isSun = dayOfWeek === 0
    const isFerie = holidays.has(dateStr)

    if (isSat || isSun || isFerie) {
      const weekKey = getWeekKeyFromDate(cur)
      const isWomCombo = isWomComboWeekend(weekKey)

      let dayType: "samedi" | "dimanche" | "ferie"
      let weekday: string

      if (isFerie && !isSat && !isSun) {
        dayType = "ferie"
        weekday = DAY_LABELS_FR[dayOfWeek]
      } else if (isSat) {
        dayType = "samedi"
        weekday = "Samedi"
      } else {
        dayType = "dimanche"
        weekday = "Dimanche"
      }

      slots.push({
        date: dateStr,
        dayType,
        weekday,
        weekKey,
        isWomCombo,
        isHolidayWeekday: isFerie && !isSat && !isSun,
        label: formatDateFr(dateStr) + (isFerie ? " 🎉" : ""),
      })
    }

    cur.setDate(cur.getDate() + 1)
  }

  return slots
}

/** Returns ISO week key (YYYY-Www) for a Date object */
export function getWeekKeyFromDate(date: Date): string {
  // ISO week: week starts on Monday
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  const weekNum = 1 + Math.round(
    ((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7,
  )
  const isoYear = d.getFullYear()
  return `${isoYear}-W${String(weekNum).padStart(2, "0")}`
}

/** Monday ISO date string for a given week key */
export function mondayOfWeekKey(weekKey: string): string {
  const [yearStr, weekStr] = weekKey.split("-W")
  const year = parseInt(yearStr)
  const week = parseInt(weekStr)

  const jan4 = new Date(year, 0, 4)
  const startOfWeek1 = new Date(jan4)
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7))

  const monday = new Date(startOfWeek1)
  monday.setDate(startOfWeek1.getDate() + (week - 1) * 7)

  return toDateStr(monday)
}

/** Return month label in French */
export function monthLabelFr(month: number): string {
  return MONTH_LABELS_FR[month - 1] || String(month)
}

/** Group slots by month for display */
export function groupSlotsByMonth(
  slots: SemesterGuardSlot[],
): Map<string, SemesterGuardSlot[]> {
  const map = new Map<string, SemesterGuardSlot[]>()
  for (const slot of slots) {
    const d = new Date(slot.date + "T12:00:00")
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(slot)
  }
  return map
}

export function monthLabelFromKey(key: string): string {
  const [year, month] = key.split("-")
  return `${MONTH_LABELS_FR[parseInt(month) - 1]} ${year}`
}
