/**
 * Jours fériés français (calculés, y compris les fêtes mobiles liées à Pâques)
 * et vacances scolaires **zone B** (académies de Nantes, Rennes, Lille, Nice,
 * Aix-Marseille, Strasbourg, etc.).
 *
 * Affichage uniquement (calendrier NCT) — aucune règle de planning n'en dépend.
 */

export type SchoolHoliday = {
  name: string
  /** Premier jour de vacances (samedi après la dernière classe), `YYYY-MM-DD`. */
  start: string
  /** Dernier jour de vacances inclus (veille de la reprise), `YYYY-MM-DD`. */
  end: string
}

/**
 * Vacances scolaires zone B — calendrier officiel du ministère de l'Éducation
 * nationale. Les dates `end` sont la veille du jour de reprise des cours.
 * 2027-2028 : seules Toussaint et Noël (communes à toutes les zones) sont
 * renseignées ; compléter hiver / printemps 2028 une fois confirmés.
 */
export const SCHOOL_HOLIDAYS_ZONE_B: readonly SchoolHoliday[] = [
  // 2025-2026
  { name: "Toussaint", start: "2025-10-18", end: "2025-11-02" },
  { name: "Noël", start: "2025-12-20", end: "2026-01-04" },
  { name: "Hiver", start: "2026-02-14", end: "2026-03-01" },
  { name: "Printemps", start: "2026-04-11", end: "2026-04-26" },
  { name: "Été", start: "2026-07-04", end: "2026-08-31" },
  // 2026-2027
  { name: "Toussaint", start: "2026-10-17", end: "2026-11-01" },
  { name: "Noël", start: "2026-12-19", end: "2027-01-03" },
  { name: "Hiver", start: "2027-02-20", end: "2027-03-07" },
  { name: "Printemps", start: "2027-04-17", end: "2027-05-02" },
  { name: "Été", start: "2027-07-03", end: "2027-08-31" },
  // 2027-2028 (partiel)
  { name: "Toussaint", start: "2027-10-23", end: "2027-11-07" },
  { name: "Noël", start: "2027-12-18", end: "2028-01-02" },
]

/** Dimanche de Pâques (algorithme de Meeus/Jones/Butcher), en UTC. */
export function easterSunday(year: number): Date {
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
  const month = Math.floor((h + l - 7 * m + 114) / 31) // 3 = mars, 4 = avril
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(year, month - 1, day))
}

function iso(d: Date): string {
  return d.toISOString().split("T")[0]
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000)
}

const holidayCache = new Map<number, Map<string, string>>()

/** Jours fériés d'une année : date ISO → nom. */
export function publicHolidays(year: number): Map<string, string> {
  const cached = holidayCache.get(year)
  if (cached) return cached
  const pad = (n: number) => String(n).padStart(2, "0")
  const fixed = (m: number, d: number) => `${year}-${pad(m)}-${pad(d)}`
  const easter = easterSunday(year)
  const map = new Map<string, string>([
    [fixed(1, 1), "Jour de l'an"],
    [iso(addDays(easter, 1)), "Lundi de Pâques"],
    [fixed(5, 1), "Fête du travail"],
    [fixed(5, 8), "Victoire 1945"],
    [iso(addDays(easter, 39)), "Ascension"],
    [iso(addDays(easter, 50)), "Lundi de Pentecôte"],
    [fixed(7, 14), "Fête nationale"],
    [fixed(8, 15), "Assomption"],
    [fixed(11, 1), "Toussaint"],
    [fixed(11, 11), "Armistice 1918"],
    [fixed(12, 25), "Noël"],
  ])
  holidayCache.set(year, map)
  return map
}

/** Nom du jour férié (`YYYY-MM-DD`), ou null. */
export function publicHolidayName(date: string): string | null {
  const year = Number.parseInt(date.slice(0, 4), 10)
  if (!Number.isFinite(year)) return null
  return publicHolidays(year).get(date) ?? null
}

/** Vacances scolaires zone B couvrant la date, ou null. */
export function schoolHolidayZoneB(date: string): SchoolHoliday | null {
  return SCHOOL_HOLIDAYS_ZONE_B.find((h) => date >= h.start && date <= h.end) ?? null
}
