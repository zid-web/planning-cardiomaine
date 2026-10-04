/**
 * Calendrier « Choix de Gardes » : les samedis, dimanches et jours fériés se
 * remplissent directement avec des initiales de médecins (lignes `Garde Matin`
 * et `Garde Nuit` du planning), comme le calendrier NCT. Aucune demande ni
 * validation : fonctions pures, testées dans guard-calendar.test.ts.
 */

import { buildMonthGrid } from "@/lib/nct-calendar"
import { publicHolidayName } from "@/lib/french-calendar"

export const GUARD_ROWS = ["Garde Matin", "Garde Nuit"] as const
export type GuardRow = (typeof GUARD_ROWS)[number]

export type GuardDayKind = "samedi" | "dimanche" | "ferie"

/** Type de jour de garde (`YYYY-MM-DD`), ou null pour un jour ordinaire. Le férié prime sur le week-end. */
export function guardDayKind(date: string): GuardDayKind | null {
  if (publicHolidayName(date)) return "ferie"
  const [y, m, d] = date.split("-").map(Number)
  if (!y || !m || !d) return null
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  if (dow === 6) return "samedi"
  if (dow === 0) return "dimanche"
  return null
}

/** Jours de garde d'un mois (uniquement ceux du mois, pas les jours de bord de grille). */
export function guardDatesInMonth(year: number, month0: number): string[] {
  return buildMonthGrid(year, month0)
    .flat()
    .filter((c) => c.inMonth && guardDayKind(c.date) !== null)
    .map((c) => c.date)
}

/** Ajoute le médecin s'il est absent, le retire s'il est présent (ordre conservé). */
export function toggleGuardDoctor(values: readonly string[], doctor: string): string[] {
  return values.includes(doctor) ? values.filter((v) => v !== doctor) : [...values, doctor]
}

export type GuardFill = {
  /** Jours de garde du mois. */
  total: number
  /** Jours où Matin **et** Nuit sont renseignés. */
  complete: number
  /** Jours où une seule des deux gardes est renseignée. */
  partial: number
}

export function guardFill(
  dates: readonly string[],
  valuesOf: (date: string, row: GuardRow) => readonly string[],
): GuardFill {
  let complete = 0
  let partial = 0
  for (const date of dates) {
    const filled = GUARD_ROWS.filter((row) => valuesOf(date, row).length > 0).length
    if (filled === GUARD_ROWS.length) complete++
    else if (filled > 0) partial++
  }
  return { total: dates.length, complete, partial }
}
