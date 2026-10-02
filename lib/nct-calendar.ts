/**
 * Calendrier NCT (date → médecin) — modifiable par l'admin.
 *
 * Le calendrier par défaut (2025-12 + 2026) est codé ici ; l'admin peut ajouter,
 * supprimer ou réaffecter des dates (modale « NCT » ou modification directe de la
 * case `Hors site - NCT`). Le calendrier personnalisé est stocké en base
 * (`settings.nct_calendar`) et injecté via `setNctCalendar` — tous les
 * consommateurs (contraintes structurelles, seed de semaine, propositions de
 * garde de nuit, règle « pas de garde la veille d'un NCT ») lisent `getNctCalendar()`.
 */

export type NctEntry = { date: string; user: string }

export const NCT_CALENDAR_SETTING_KEY = "nct_calendar"

/** Médecins pouvant assurer le NCT (alternance W/M). */
export const NCT_DOCTORS = ["W", "M"] as const

export const NCT_DEFAULT_2025_DEC: NctEntry[] = [
  { date: "2025-12-04", user: "M" },
  { date: "2025-12-11", user: "W" },
  { date: "2025-12-18", user: "M" },
]

export const NCT_DEFAULT_2026: NctEntry[] = [
  { date: "2026-01-15", user: "W" }, // Starting with W for 2026
  { date: "2026-01-29", user: "M" },
  { date: "2026-02-05", user: "W" },
  { date: "2026-02-19", user: "M" },
  { date: "2026-02-26", user: "W" },
  { date: "2026-03-12", user: "M" },
  { date: "2026-03-26", user: "W" },
  { date: "2026-04-09", user: "M" },
  { date: "2026-04-30", user: "W" },
  { date: "2026-05-07", user: "M" },
  { date: "2026-05-21", user: "W" },
  { date: "2026-05-28", user: "M" },
  { date: "2026-06-11", user: "W" },
  { date: "2026-06-18", user: "M" },
  { date: "2026-06-25", user: "W" },
  { date: "2026-07-09", user: "M" },
  // Aligné guard-api/solver.py NCT_FIXED_SCHEDULE
  { date: "2026-07-23", user: "M" },
  { date: "2026-09-10", user: "W" }, // Corrigé (demande utilisateur, S37 = W)
  { date: "2026-09-17", user: "W" },
  { date: "2026-09-24", user: "M" },
  { date: "2026-10-01", user: "W" },
  { date: "2026-10-15", user: "M" },
  { date: "2026-10-29", user: "W" },
  { date: "2026-11-05", user: "M" },
  { date: "2026-11-19", user: "W" },
  { date: "2026-11-26", user: "M" },
  { date: "2026-12-03", user: "W" },
  { date: "2026-12-17", user: "M" },
]

export const DEFAULT_NCT_CALENDAR: readonly NctEntry[] = [
  ...NCT_DEFAULT_2025_DEC,
  ...NCT_DEFAULT_2026,
]

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function isRealIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false
  const [y, m, d] = value.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

/**
 * Nettoie une liste brute : dates valides uniquement, médecin non vide
 * (majuscules), une seule entrée par date (la dernière l'emporte), tri chronologique.
 */
export function normalizeNctCalendar(raw: unknown): NctEntry[] {
  if (!Array.isArray(raw)) return []
  const byDate = new Map<string, string>()
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const date = String((item as NctEntry).date ?? "").trim()
    const user = String((item as NctEntry).user ?? "").trim().toUpperCase()
    if (!isRealIsoDate(date) || !user || user.length > 4) continue
    byDate.set(date, user)
  }
  return [...byDate.entries()]
    .map(([date, user]) => ({ date, user }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function parseNctCalendarSetting(value: string | null | undefined): NctEntry[] | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? normalizeNctCalendar(parsed) : null
  } catch {
    return null
  }
}

export function serializeNctCalendar(list: NctEntry[]): string {
  return JSON.stringify(normalizeNctCalendar(list))
}

let current: NctEntry[] = normalizeNctCalendar(DEFAULT_NCT_CALENDAR)

export function getNctCalendar(): readonly NctEntry[] {
  return current
}

export function setNctCalendar(list: readonly NctEntry[] | null | undefined): void {
  current = list ? normalizeNctCalendar(list) : normalizeNctCalendar(DEFAULT_NCT_CALENDAR)
}

/** Médecin NCT d'une date (`YYYY-MM-DD`), ou null si pas de NCT ce jour-là. */
export function nctDoctorForDate(date: string): string | null {
  return current.find((e) => e.date === date)?.user ?? null
}

export type NctCalendarDiff = {
  added: NctEntry[]
  removed: NctEntry[]
  /** Même date, médecin différent (valeur finale). */
  changed: NctEntry[]
}

export function diffNctCalendars(prev: readonly NctEntry[], next: readonly NctEntry[]): NctCalendarDiff {
  const prevMap = new Map(prev.map((e) => [e.date, e.user]))
  const nextMap = new Map(next.map((e) => [e.date, e.user]))
  const added: NctEntry[] = []
  const removed: NctEntry[] = []
  const changed: NctEntry[] = []
  for (const [date, user] of nextMap) {
    if (!prevMap.has(date)) added.push({ date, user })
    else if (prevMap.get(date) !== user) changed.push({ date, user })
  }
  for (const [date, user] of prevMap) {
    if (!nextMap.has(date)) removed.push({ date, user })
  }
  return { added, removed, changed }
}

/** Calendrier après modification d'une seule date (user vide/null = suppression). */
export function withNctEntry(
  list: readonly NctEntry[],
  date: string,
  user: string | null,
): NctEntry[] {
  const rest = list.filter((e) => e.date !== date)
  return normalizeNctCalendar(user ? [...rest, { date, user }] : rest)
}

export type MonthGridCell = { date: string; day: number; inMonth: boolean }

function isoOf(y: number, m0: number, d: number): string {
  return new Date(Date.UTC(y, m0, d)).toISOString().split("T")[0]
}

/**
 * Grille d'un mois (semaines du lundi au dimanche, 5 ou 6 lignes) pour
 * l'affichage calendrier. `month0` : 0 = janvier.
 */
export function buildMonthGrid(year: number, month0: number): MonthGridCell[][] {
  const first = new Date(Date.UTC(year, month0, 1))
  const offset = (first.getUTCDay() + 6) % 7 // lundi = 0
  const daysInMonth = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate()
  const total = Math.ceil((offset + daysInMonth) / 7) * 7
  const weeks: MonthGridCell[][] = []
  for (let i = 0; i < total; i += 7) {
    const row: MonthGridCell[] = []
    for (let j = 0; j < 7; j++) {
      const dayNum = i + j - offset + 1
      const dt = new Date(Date.UTC(year, month0, dayNum))
      row.push({
        date: isoOf(year, month0, dayNum),
        day: dt.getUTCDate(),
        inMonth: dayNum >= 1 && dayNum <= daysInMonth,
      })
    }
    weeks.push(row)
  }
  return weeks
}

/** Mois précédent / suivant avec passage d'une année à l'autre. */
export function shiftMonth(year: number, month0: number, delta: number): { year: number; month0: number } {
  const idx = year * 12 + month0 + delta
  return { year: Math.floor(idx / 12), month0: ((idx % 12) + 12) % 12 }
}

/**
 * Clic sur un jour : pas de NCT → premier médecin (W) → M → suppression.
 * Un médecin hors W/M (saisi dans la grille) repasse à W.
 */
export function cycleNctUser(current: string | null): string | null {
  if (!current) return NCT_DOCTORS[0]
  const idx = (NCT_DOCTORS as readonly string[]).indexOf(current)
  if (idx === -1) return NCT_DOCTORS[0]
  return idx + 1 < NCT_DOCTORS.length ? NCT_DOCTORS[idx + 1] : null
}
