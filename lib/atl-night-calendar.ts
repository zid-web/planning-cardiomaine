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
  /** Planning de la semaine de la date (pour ATL Midi / Garde / nuits voisines / week-end). */
  schedule?: ScheduleData
  vacations?: DoctorVacation[]
  /** Nuits ATL déjà assurées par médecin (équité). */
  counts?: Record<string, number>
  /** Nuits déjà décidées hors planning (ex. brouillon du calendrier), par date : prioritaires sur le planning. */
  nights?: ReadonlyMap<string, string>
}

const WEEKDAY_NIGHTS = ["LUNDI", "MARDI", "MERCREDI", "JEUDI"] as const

function isWomDoctor(d: string | null | undefined): d is string {
  return Boolean(d) && (ATL_NIGHT_WOM as readonly string[]).includes(d as string)
}

function addDays(date: string, delta: number): string {
  const [y, m, d] = date.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + delta))
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`
}

/** Médecin de la nuit ATL d'une date : brouillon du calendrier d'abord, sinon planning (même semaine). */
function nightOf(date: string, ctx: AtlNightProposalContext, weekKey: string): string | null {
  const fromDraft = ctx.nights?.get(date)
  if (fromDraft) return fromDraft
  if (isoWeekKeyOfDate(date) !== weekKey) return null
  return listed(ctx.schedule, ATL_NIGHT_ROW, dayNameOfDate(date)).find((d) => d !== "FV") ?? null
}

/** Premier médecin M/W/O de garde (Matin, Midi ou Nuit) ce jour-là. */
function womOnGarde(schedule: ScheduleData | undefined, day: string): string | null {
  for (const row of ["Garde Matin", "Garde Midi", "Garde Nuit"]) {
    const d = listed(schedule, row, day).find(isWomDoctor)
    if (d) return d
  }
  return null
}

export type WeekendCombo = { atlSat: string; atlSun: string }

/**
 * Week-end combo déduit des gardes (semaine W/O/M) : dès que M, W ou O est de garde
 * le samedi et/ou le dimanche, l'astreinte du week-end se croise avec la garde :
 * - le médecin de garde **samedi** fait l'astreinte **dimanche** ;
 * - le médecin de garde **dimanche** fait l'astreinte **vendredi nuit + samedi** ;
 * - si un seul des deux jours a un M/W/O de garde, l'autre astreinte va à un autre
 *   M/W/O disponible (le moins chargé).
 * Null hors semaine W/O/M ou si aucun M/W/O n'est de garde le week-end.
 */
export function weekendComboFromGardes(
  schedule: ScheduleData | undefined,
  weekKey: string,
  vacations: DoctorVacation[] = [],
  counts: Record<string, number> = {},
): WeekendCombo | null {
  if (!schedule || isChAstreinteWeek(weekKey)) return null
  const gSat = womOnGarde(schedule, "SAMEDI")
  const gSun = womOnGarde(schedule, "DIMANCHE")
  if (!gSat && !gSun) return null
  const sat = dateStrForWeekDay(weekKey, "SAMEDI") ?? ""
  const sun = dateStrForWeekDay(weekKey, "DIMANCHE") ?? ""
  const pick = (exclude: string | null, dates: string[]): string | null =>
    [...ATL_NIGHT_WOM]
      .filter((d) => d !== exclude && dates.every((dt) => !dt || !isDoctorOnVacationForFixed(d, dt, vacations)))
      .sort((a, b) => (counts[a] ?? 0) - (counts[b] ?? 0))[0] ?? null
  const atlSun = gSat ?? pick(gSun, [sun])
  const atlSat = gSun ?? pick(gSat, [sat])
  if (!atlSat || !atlSun) return null
  return { atlSat, atlSun }
}

/**
 * Médecin proposé pour l'astreinte ATL de nuit d'une date, ou null si personne n'est
 * disponible. Ne tient pas compte d'une entrée déjà présente pour cette date.
 */
export function proposeAtlNightDoctor(date: string, ctx: AtlNightProposalContext = {}): string | null {
  if (expectedAtlNightGroup(date) === "CH") return "CH"
  const day = dayNameOfDate(date)
  const weekKey = isoWeekKeyOfDate(date)
  const sched = ctx.schedule
  const vacations = ctx.vacations ?? []
  const counts = ctx.counts ?? {}
  const gardeNuit = new Set(listed(sched, "Garde Nuit", day))
  const available = (d: string) => !isDoctorOnVacationForFixed(d, date, vacations) && !gardeNuit.has(d)

  // Week-end (vendredi, samedi, dimanche) : combo dès qu'un M/W/O est de garde, sinon mono.
  if (day === "VENDREDI" || day === "SAMEDI" || day === "DIMANCHE") {
    const combo = weekendComboFromGardes(sched, weekKey, vacations, counts)
    if (combo) {
      const doc = day === "DIMANCHE" ? combo.atlSun : combo.atlSat
      if (available(doc)) return doc
    } else {
      // Mono : le même médecin du vendredi soir au dimanche
      const fri = dateStrForWeekDay(weekKey, "VENDREDI")
      const satD = dateStrForWeekDay(weekKey, "SAMEDI")
      for (const other of [fri, satD]) {
        if (!other || other === date) continue
        const n = nightOf(other, ctx, weekKey)
        if (isWomDoctor(n) && available(n)) return n
      }
    }
  }

  let candidates = (ATL_NIGHT_WOM as readonly string[]).filter(available)

  // Lun → jeu : jamais le même M/W/O deux nuits consécutives (veille ou lendemain).
  if ((WEEKDAY_NIGHTS as readonly string[]).includes(day)) {
    const idx = (WEEKDAY_NIGHTS as readonly string[]).indexOf(day)
    const neighbours = new Set<string>()
    if (idx > 0) {
      const n = nightOf(addDays(date, -1), ctx, weekKey)
      if (isWomDoctor(n)) neighbours.add(n)
    }
    if (idx < WEEKDAY_NIGHTS.length - 1) {
      const n = nightOf(addDays(date, 1), ctx, weekKey)
      if (isWomDoctor(n)) neighbours.add(n)
    }
    candidates = candidates.filter((d) => !neighbours.has(d))
  }

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
  return [...candidates].sort((a, b) => (counts[a] ?? 0) - (counts[b] ?? 0))[0]
}

/**
 * Applique le combo du week-end au planning (semaine W/O/M) dès qu'un M/W/O est de garde
 * samedi et/ou dimanche : astreintes ATL Matin/Midi/Nuit du samedi + nuit du vendredi au
 * médecin `atlSat`, astreintes du dimanche au médecin `atlSun`. Les cases saisies ou vidées
 * par un admin ne sont jamais réécrites ; les autres passent en proposition.
 */
export function applyWeekendComboFromGardes(
  schedule: ScheduleData,
  weekKey: string,
  vacations: DoctorVacation[] = [],
): ScheduleData {
  const combo = weekendComboFromGardes(schedule, weekKey, vacations)
  if (!combo) return schedule
  const targets: Array<[string, string, string]> = [
    [ATL_NIGHT_ROW, "VENDREDI", combo.atlSat],
    ...["Astreintes ATL Matin", "Astreintes ATL Midi", ATL_NIGHT_ROW].flatMap(
      (row) => [[row, "SAMEDI", combo.atlSat], [row, "DIMANCHE", combo.atlSun]] as Array<[string, string, string]>,
    ),
  ]
  let next = schedule
  for (const [row, day, doc] of targets) {
    const cell = next[row]?.[day]
    if (!next[row] || !cell) continue
    const cur = (cell.value ?? []) as string[]
    if (cell.manuallyCleared || (cell.manualAssignment && cur.length > 0)) continue
    const date = dateStrForWeekDay(weekKey, day)
    if (date && isDoctorOnVacationForFixed(doc, date, vacations)) continue
    if (cur.length === 1 && cur[0] === doc) continue
    const keep = cur.filter((d) => !isWomDoctor(d) && d !== "CH" && d !== "FV")
    next = {
      ...next,
      [row]: { ...next[row], [day]: { ...cell, value: [doc, ...keep], type: "doctor", status: "pending" } },
    }
  }
  return next
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
    // Une proposition automatique ne remplace jamais une nuit déjà validée dans le planning.
    if (!entry.manual && curValue.length > 0 && cell?.status === "validated") continue
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
  const nights = new Map(list.map((e) => [e.date, e.user]))
  const last = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate()
  for (let d = 1; d <= last; d++) {
    const date = `${year}-${String(month0 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    if (taken.has(date)) continue
    const ctx = contextFor(date)
    const user = proposeAtlNightDoctor(date, { ...ctx, counts, nights })
    if (!user) continue
    counts[user] = (counts[user] ?? 0) + 1
    nights.set(date, user)
    added.push({ date, user })
  }
  return normalizeAtlNightCalendar([...list, ...added])
}
