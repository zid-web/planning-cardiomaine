/**
 * Calendrier des Astreintes ATL Nuit (même principe que le calendrier NCT).
 *
 * Une entrée par date : le médecin d'astreinte ATL de nuit, saisi à la main (`manual`)
 * ou proposé automatiquement (appli / solveur). Le calendrier et la ligne
 * « Astreintes ATL Nuit » du planning se mettent à jour l'un l'autre :
 * - une entrée du calendrier est posée dans la case du planning (validée si manuelle,
 *   proposition sinon) ;
 * - une case modifiée à la main dans le planning devient une entrée manuelle.
 *
 * Règles de proposition (consigne 13/10/2026) :
 * - roulement habituel CH / W-O-M (`lib/astreinte-cycle.ts`) : nuits CH → CH ;
 * - nuits W/O/M : le médecin d'astreinte ATL Midi fait la nuit dans la mesure du possible ;
 * - FV ne fait jamais d'astreinte ATL Nuit ;
 * - jamais le médecin de garde de nuit le même soir (ex. jeudi avec FV présent :
 *   W ou M si O est de garde cette nuit-là, sinon M, W ou O) ;
 * - à défaut, le moins chargé en nuits ATL (équité).
 */

import { DAYS } from "@/lib/constants"
import { chNightWeekdaysForWeek, isChAstreinteWeek } from "@/lib/astreinte-cycle"
import { dateStrForWeekDay, isDoctorOnVacationForFixed } from "@/lib/fixed-assignments"
import type { DoctorVacation, ScheduleData } from "@/lib/types"

export type AtlNightEntry = { date: string; user: string; manual?: boolean }

export const ATL_NIGHT_CALENDAR_SETTING_KEY = "atl_night_calendar"
export const ATL_NIGHT_ROW = "Astreintes ATL Nuit"
/** Médecins pouvant assurer l'astreinte ATL de nuit (FV jamais). */
export const ATL_NIGHT_DOCTORS = ["M", "W", "O", "CH"] as const
export const ATL_NIGHT_WOM = ["M", "W", "O"] as const
export const ATL_NIGHT_NEVER = ["FV"] as const

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function isRealIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false
  const [y, m, d] = value.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

/** Dates valides, médecin autorisé, une entrée par date (la dernière l'emporte), tri chronologique. */
export function normalizeAtlNightCalendar(raw: unknown): AtlNightEntry[] {
  if (!Array.isArray(raw)) return []
  const byDate = new Map<string, AtlNightEntry>()
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const date = String((item as AtlNightEntry).date ?? "").trim()
    const user = String((item as AtlNightEntry).user ?? "").trim().toUpperCase()
    if (!isRealIsoDate(date) || !user || user.length > 4) continue
    if ((ATL_NIGHT_NEVER as readonly string[]).includes(user)) continue
    byDate.set(date, { date, user, ...((item as AtlNightEntry).manual ? { manual: true } : {}) })
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export function parseAtlNightCalendarSetting(value: string | null | undefined): AtlNightEntry[] | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? normalizeAtlNightCalendar(parsed) : null
  } catch {
    return null
  }
}

export function serializeAtlNightCalendar(list: AtlNightEntry[]): string {
  return JSON.stringify(normalizeAtlNightCalendar(list))
}

let current: AtlNightEntry[] = []

export function getAtlNightCalendar(): readonly AtlNightEntry[] {
  return current
}

export function setAtlNightCalendar(list: readonly AtlNightEntry[] | null | undefined): void {
  current = normalizeAtlNightCalendar(list ?? [])
}

/** Ajoute / remplace / supprime (`user` null) l'entrée d'une date. */
export function withAtlNightEntry(
  list: readonly AtlNightEntry[],
  date: string,
  user: string | null,
  manual = true,
): AtlNightEntry[] {
  const rest = list.filter((e) => e.date !== date)
  return normalizeAtlNightCalendar(user ? [...rest, { date, user, manual }] : rest)
}

/** Cycle d'un clic dans le calendrier : vide → M → W → O → CH → vide. */
export function cycleAtlNightUser(current: string | null): string | null {
  const order = ATL_NIGHT_DOCTORS as readonly string[]
  if (!current) return order[0]
  const i = order.indexOf(current)
  return i < 0 || i === order.length - 1 ? null : order[i + 1]
}

/** Clé ISO de semaine (`YYYY-Www`) d'une date `YYYY-MM-DD`. */
export function isoWeekKeyOfDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const dow = dt.getUTCDay() || 7
  dt.setUTCDate(dt.getUTCDate() + 4 - dow)
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((dt.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${dt.getUTCFullYear()}-W${String(week).padStart(2, "0")}`
}

/** Nom du jour (`LUNDI`…`DIMANCHE`) d'une date `YYYY-MM-DD`. */
export function dayNameOfDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return DAYS[(dow + 6) % 7]
}

/** Groupe attendu par le roulement habituel pour la nuit de cette date. */
export function expectedAtlNightGroup(date: string): "CH" | "WOM" {
  const wk = isoWeekKeyOfDate(date)
  const day = dayNameOfDate(date)
  if (day === "SAMEDI" || day === "DIMANCHE") return isChAstreinteWeek(wk) ? "CH" : "WOM"
  return chNightWeekdaysForWeek(wk).has(day) ? "CH" : "WOM"
}

function listed(schedule: ScheduleData | undefined, row: string, day: string): string[] {
  return ((schedule?.[row]?.[day]?.value ?? []) as string[]).filter(Boolean)
}

export type AtlNightProposalContext = {
  /** Planning de la semaine de la date (pour ATL Midi / Garde Nuit / week-end). */
  schedule?: ScheduleData
  vacations?: DoctorVacation[]
  /** Nuits ATL déjà assurées par médecin (équité). */
  counts?: Record<string, number>
}

/**
 * Médecin proposé pour l'astreinte ATL de nuit d'une date, ou null si personne n'est
 * disponible. Ne tient pas compte d'une entrée déjà présente dans le calendrier.
 */
export function proposeAtlNightDoctor(date: string, ctx: AtlNightProposalContext = {}): string | null {
  if (expectedAtlNightGroup(date) === "CH") return "CH"
  const day = dayNameOfDate(date)
  const sched = ctx.schedule
  const vacations = ctx.vacations ?? []
  const gardeNuit = new Set(listed(sched, "Garde Nuit", day))

  let candidates = (ATL_NIGHT_WOM as readonly string[]).filter(
    (d) => !isDoctorOnVacationForFixed(d, date, vacations) && !gardeNuit.has(d),
  )

  // Lun / Mar : le médecin de l'ATL de nuit du vendredi ou du week-end est exclu
  // (règle d'équité M/O/W, si une alternative existe).
  if (day === "LUNDI" || day === "MARDI") {
    const weekendDocs = new Set([
      ...listed(sched, ATL_NIGHT_ROW, "VENDREDI"),
      ...listed(sched, ATL_NIGHT_ROW, "SAMEDI"),
      ...listed(sched, ATL_NIGHT_ROW, "DIMANCHE"),
    ])
    const filtered = candidates.filter((d) => !weekendDocs.has(d))
    if (filtered.length) candidates = filtered
  }
  if (!candidates.length) return null

  // Le médecin d'astreinte ATL Midi fait la nuit dans la mesure du possible (FV exclu).
  const midi = listed(sched, "Astreintes ATL Midi", day).find((d) => candidates.includes(d))
  if (midi) return midi

  // Sinon : le moins chargé en nuits ATL, ordre M, W, O à égalité.
  const counts = ctx.counts ?? {}
  return [...candidates].sort((a, b) => (counts[a] ?? 0) - (counts[b] ?? 0))[0]
}

/** Nuits ATL par médecin dans une liste d'entrées (équité). */
export function countAtlNights(list: readonly AtlNightEntry[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const e of list) counts[e.user] = (counts[e.user] ?? 0) + 1
  return counts
}

/** Dates (`YYYY-MM-DD`) d'une semaine ISO, du lundi au dimanche. */
export function datesOfWeek(weekKey: string): Array<{ day: string; date: string }> {
  return DAYS.map((day) => ({ day, date: dateStrForWeekDay(weekKey, day) ?? "" })).filter((x) => x.date)
}

/**
 * Pose les entrées du calendrier dans la ligne « Astreintes ATL Nuit » d'une semaine.
 * Entrée manuelle → case validée et protégée (`manualAssignment`, le roulement CH ne la
 * réécrit pas). Entrée automatique → proposition, sauf si la case a été saisie ou vidée
 * par un admin.
 */
export function applyAtlNightCalendarToWeek(
  schedule: ScheduleData,
  weekKey: string,
  list: readonly AtlNightEntry[] = current,
): ScheduleData {
  if (!schedule[ATL_NIGHT_ROW] || list.length === 0) return schedule
  const byDate = new Map(list.map((e) => [e.date, e]))
  let next = schedule
  for (const { day, date } of datesOfWeek(weekKey)) {
    const entry = byDate.get(date)
    if (!entry) continue
    const cell = next[ATL_NIGHT_ROW]?.[day]
    const curValue = (cell?.value ?? []) as string[]
    const adminOwned = Boolean(cell?.manuallyCleared) || (Boolean(cell?.manualAssignment) && curValue.length > 0)
    if (!entry.manual && adminOwned) continue
    if (curValue.length === 1 && curValue[0] === entry.user && (!entry.manual || cell?.status === "validated")) continue
    next = {
      ...next,
      [ATL_NIGHT_ROW]: {
        ...next[ATL_NIGHT_ROW],
        [day]: {
          ...(cell ?? {}),
          value: [entry.user],
          type: "doctor",
          status: entry.manual ? "validated" : "pending",
          manuallyCleared: false,
          ...(entry.manual ? { manualAssignment: true } : {}),
        },
      },
    }
  }
  return next
}

/**
 * Remplit les nuits ATL vides (Lun–Dim) d'une semaine selon les règles de proposition,
 * en propositions (`pending`). Ne touche jamais une case remplie ou vidée par un admin.
 */
export function fillEmptyAtlNights(
  schedule: ScheduleData,
  weekKey: string,
  vacations: DoctorVacation[] = [],
  counts: Record<string, number> = {},
): ScheduleData {
  if (!schedule[ATL_NIGHT_ROW]) return schedule
  let next = schedule
  const localCounts = { ...counts }
  for (const { day, date } of datesOfWeek(weekKey)) {
    const cell = next[ATL_NIGHT_ROW]?.[day]
    if (cell?.manuallyCleared) continue
    if (((cell?.value ?? []) as string[]).length > 0) continue
    const doc = proposeAtlNightDoctor(date, { schedule: next, vacations, counts: localCounts })
    if (!doc) continue
    localCounts[doc] = (localCounts[doc] ?? 0) + 1
    next = {
      ...next,
      [ATL_NIGHT_ROW]: {
        ...next[ATL_NIGHT_ROW],
        [day]: { ...(cell ?? {}), value: [doc], type: "doctor", status: "pending" },
      },
    }
  }
  return next
}

/** Entrées automatiques pour les dates d'un mois sans entrée (remplissage « Auto »). */
export function autoFillAtlNightMonth(
  list: readonly AtlNightEntry[],
  year: number,
  month0: number,
  contextFor: (date: string) => AtlNightProposalContext,
): AtlNightEntry[] {
  const taken = new Set(list.map((e) => e.date))
  const counts = countAtlNights(list)
  const added: AtlNightEntry[] = []
  const last = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate()
  for (let d = 1; d <= last; d++) {
    const date = `${year}-${String(month0 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    if (taken.has(date)) continue
    const ctx = contextFor(date)
    const user = proposeAtlNightDoctor(date, { ...ctx, counts })
    if (!user) continue
    counts[user] = (counts[user] ?? 0) + 1
    added.push({ date, user })
  }
  return normalizeAtlNightCalendar([...list, ...added])
}
