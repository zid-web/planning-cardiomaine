import { createClient } from "@/lib/supabase/server"
import { isListedDoctor } from "@/lib/doctor-code"
import { mondayOfIsoWeekKey } from "@/lib/fixed-assignments"
import type { ScheduleData } from "@/lib/types"

export type EquityCounts = {
  astreinte_count: number
  garde_count: number
  nct_count: number
  weekend_count: number
}

/** Fenêtre glissante unique pour toutes les catégories d’équité (y compris CORO). */
export const EQUITY_ROLLING_MONTHS = 6

/** Lignes planning UI → buckets d’équité (doit rester aligné avec le solveur). */
export const ASTREINTE_ROWS = new Set([
  "Astreintes ATL Matin",
  "Astreintes ATL Midi",
  "Astreintes ATL Nuit",
])
export const GARDE_ROWS = new Set(["Garde Matin", "Garde Midi", "Garde Nuit"])
export const NCT_ROWS = new Set(["Hors site - NCT"])
/** Rythmo (Groupe 2 : A, U, P) — une seule ligne, matin uniquement. */
export const RYTHMO_ROWS = new Set(["Matin - Rythmo"])
/** CORO : compté à part (`getCoroEquity`) — pas de colonne `coro_count` en base. */
export const CORO_ROWS = new Set(["Matin - Coro", "Apm - Coro"])
/** Groupe 1 (échographistes) — Cs PSS + Tessée confondus. */
export const CS_ROWS = new Set([
  "Matin - Cs PSS",
  "Matin - Cs Tessée",
  "Apm - Cs PSS",
  "Apm - Cs Tessée",
])
/** ETT salle 1 + salle 2 confondues. */
export const ETT_ROWS = new Set([
  "Matin - ETT salle 1",
  "Matin - ETT salle 2",
  "Apm - ETT salle 1",
  "Apm - ETT salle 2",
])
/** Stress Matin + Apm. */
export const STRESS_ROWS = new Set(["Matin - Stress", "Apm - Stress"])
/** EE (Épreuve d'effort) Matin + Apm. */
export const EE_ROWS = new Set([
  "Matin - EE1",
  "Matin - EE2",
  "Apm - EE1",
  "Apm - EE2",
  "Matin - EE",
  "Apm - EE",
])
/** Médecins du groupe 1 (équité Cs/ETT/Stress/EE côté solveur). */
export const GROUPE1_ECHO_DOCTORS = new Set(["B", "Z", "H", "G", "S"])
export const WEEKEND_DAYS = new Set(["SAMEDI", "DIMANCHE"])

export type Groupe1EquityCounts = {
  cs: number
  ett: number
  stress: number
  ee: number
}

function emptyCounts(): EquityCounts {
  return { astreinte_count: 0, garde_count: 0, nct_count: 0, weekend_count: 0 }
}

/** Alias explicite — lundi UTC de la semaine ISO `YYYY-Www`. */
export function isoWeekKeyToMonday(weekKey: string): Date | null {
  return mondayOfIsoWeekKey(weekKey)
}

/** Début de la fenêtre glissante (aujourd’hui − N mois), recalculé à chaque appel. */
export function equityRollingWindowStart(
  now: Date = new Date(),
  months: number = EQUITY_ROLLING_MONTHS,
): Date {
  const start = new Date(now.getTime())
  start.setUTCMonth(start.getUTCMonth() - months)
  return start
}

/**
 * True si le lundi de `week_key` tombe dans la fenêtre glissante
 * `[now − months, now]` (bornes inclusives côté dates).
 */
export function isWeekKeyInEquityWindow(
  weekKey: string,
  now: Date = new Date(),
  months: number = EQUITY_ROLLING_MONTHS,
): boolean {
  if (!weekKey || weekKey === "full_schedule") return false
  const monday = isoWeekKeyToMonday(weekKey)
  if (!monday) return false
  const start = equityRollingWindowStart(now, months)
  // Inclure la semaine en cours même si son lundi est « demain » (fuseau) :
  // borne haute = fin de journée UTC de `now`.
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999),
  )
  return monday.getTime() >= start.getTime() && monday.getTime() <= end.getTime()
}

/**
 * Compteurs d’équité pour UNE semaine à partir du vrai shape CellData
 * (`value: string[]`, clé de ligne = activité).
 */
export function computeWeeklyEquity(scheduleData: ScheduleData): Record<string, EquityCounts> {
  const equity: Record<string, EquityCounts> = {}

  const bump = (doc: string, key: keyof EquityCounts) => {
    if (!doc || doc === "CH" || doc === "I") return // CH / interne hors équité individuelle
    if (!isListedDoctor(doc)) return // remplaçant texte libre : hors équité
    if (!equity[doc]) equity[doc] = emptyCounts()
    equity[doc][key]++
  }

  for (const [rowKey, dayData] of Object.entries(scheduleData || {})) {
    const isAstreinte = ASTREINTE_ROWS.has(rowKey)
    const isGarde = GARDE_ROWS.has(rowKey)
    const isNct = NCT_ROWS.has(rowKey)
    if (!isAstreinte && !isGarde && !isNct) continue

    for (const [day, cell] of Object.entries(dayData || {})) {
      const doctors = Array.isArray((cell as { value?: unknown })?.value)
        ? ((cell as { value: string[] }).value as string[])
        : []
      for (const doc of doctors) {
        if (isAstreinte) {
          bump(doc, "astreinte_count")
          if (WEEKEND_DAYS.has(day.toUpperCase())) bump(doc, "weekend_count")
        }
        if (isGarde) {
          bump(doc, "garde_count")
          if (WEEKEND_DAYS.has(day.toUpperCase())) bump(doc, "weekend_count")
        }
        if (isNct) bump(doc, "nct_count")
      }
    }
  }

  return equity
}

/**
 * Somme les compteurs sur plusieurs semaines (scan JSON de secours).
 * Par défaut, n’agrège que les semaines dans la fenêtre glissante 6 mois.
 */
export function accumulateEquityFromSchedules(
  schedules: Array<{ week_key?: string; schedule_data?: ScheduleData | null }>,
  options?: { now?: Date; months?: number; rollingWindow?: boolean },
): Record<string, EquityCounts> {
  const useWindow = options?.rollingWindow !== false
  const now = options?.now ?? new Date()
  const months = options?.months ?? EQUITY_ROLLING_MONTHS
  const total: Record<string, EquityCounts> = {}
  for (const row of schedules) {
    if (!row?.schedule_data || row.week_key === "full_schedule") continue
    if (useWindow && row.week_key && !isWeekKeyInEquityWindow(row.week_key, now, months)) {
      continue
    }
    const week = computeWeeklyEquity(row.schedule_data)
    for (const [doc, counts] of Object.entries(week)) {
      if (!total[doc]) total[doc] = emptyCounts()
      total[doc].astreinte_count += counts.astreinte_count
      total[doc].garde_count += counts.garde_count
      total[doc].nct_count += counts.nct_count
      total[doc].weekend_count += counts.weekend_count
    }
  }
  return total
}

/** Snapshot hebdo en base (idempotent). Ne fait jamais échouer la sauvegarde planning. */
export async function upsertWeeklyEquity(weekKey: string, scheduleData: ScheduleData): Promise<void> {
  if (weekKey === "full_schedule") return

  try {
    const equity = computeWeeklyEquity(scheduleData)
    const supabase = await createClient()

    const { error: deleteError } = await supabase
      .from("doctor_equity_weekly")
      .delete()
      .eq("week_key", weekKey)

    if (deleteError) {
      console.warn("[equity-tracking] Impossible de nettoyer l'ancien snapshot:", deleteError)
    }

    const rows = Object.entries(equity).map(([doctor_id, counts]) => ({
      doctor_id,
      week_key: weekKey,
      ...counts,
      updated_at: new Date().toISOString(),
    }))
    if (rows.length === 0) return

    const { error: insertError } = await supabase.from("doctor_equity_weekly").insert(rows)
    if (insertError) {
      console.warn("[equity-tracking] Impossible d'enregistrer le snapshot d'équité:", insertError)
    }
  } catch (err) {
    console.warn("[equity-tracking] Erreur inattendue lors de la mise à jour de l'équité:", err)
  }
}

/**
 * Équité sur fenêtre glissante 6 mois depuis `doctor_equity_weekly`.
 * Recalculée à chaque appel (pas de cache figé).
 * Retourne null si la table est indisponible ; {} si vide (→ repli scan JSON).
 */
export async function getCumulativeEquityFromTable(
  now: Date = new Date(),
): Promise<Record<string, EquityCounts> | null> {
  try {
    const supabase = await createClient()

    // Source de vérité : snapshots hebdo (indépendant du nommage view vs table totals)
    const { data, error } = await supabase
      .from("doctor_equity_weekly")
      .select("doctor_id, week_key, astreinte_count, garde_count, nct_count, weekend_count")

    if (error) {
      console.warn(
        "[equity-tracking] doctor_equity_weekly indisponible, repli scan JSON:",
        error.message,
      )
      return null
    }

    if (!data?.length) return {}

    const equity: Record<string, EquityCounts> = {}
    for (const row of data) {
      const weekKey = row.week_key as string
      if (!isWeekKeyInEquityWindow(weekKey, now)) continue
      const id = row.doctor_id as string
      if (!equity[id]) equity[id] = emptyCounts()
      equity[id].astreinte_count += Number(row.astreinte_count) || 0
      equity[id].garde_count += Number(row.garde_count) || 0
      equity[id].nct_count += Number(row.nct_count) || 0
      equity[id].weekend_count += Number(row.weekend_count) || 0
    }
    return equity
  } catch (err) {
    console.warn("[equity-tracking] Erreur inattendue, repli scan JSON:", err)
    return null
  }
}

/** Compte CORO (Matin/Apm) pour une semaine — hors table equity (pas de colonne DB). */
export function computeWeeklyCoro(scheduleData: ScheduleData): Record<string, number> {
  return computeWeeklyRowBucket(scheduleData, CORO_ROWS)
}

/** Type pour les comptes Coro Matin/Apm séparés par médecin M/O/W. */
export type CoroMOWSplitCounts = {
  matin: Record<string, number>
  apm: Record<string, number>
}

const CORO_WOM_SET = new Set(["M", "O", "W"])

/**
 * Compte Coro Matin et Coro Apm **séparément** pour M, O, W sur une semaine.
 * Utilisé pour la rotation équitable M/O/W intra-semaine.
 */
export function computeWeeklyCoroMOW(scheduleData: ScheduleData): CoroMOWSplitCounts {
  const matin: Record<string, number> = { M: 0, O: 0, W: 0 }
  const apm: Record<string, number> = { M: 0, O: 0, W: 0 }
  const WEEKDAYS = ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI"]
  for (const day of WEEKDAYS) {
    for (const doc of (scheduleData["Matin - Coro"]?.[day]?.value || []) as string[]) {
      if (CORO_WOM_SET.has(doc)) matin[doc] = (matin[doc] || 0) + 1
    }
    for (const doc of (scheduleData["Apm - Coro"]?.[day]?.value || []) as string[]) {
      if (CORO_WOM_SET.has(doc)) apm[doc] = (apm[doc] || 0) + 1
    }
  }
  return { matin, apm }
}

/**
 * Équité Coro Matin/Apm séparés pour M/O/W — fenêtre glissante 6 mois.
 * Scan JSON (pas de colonnes DB).
 */
export async function getCoroMOWEquity(
  now: Date = new Date(),
): Promise<CoroMOWSplitCounts> {
  const result = await accumulateFromScheduleWindow(
    now,
    computeWeeklyCoroMOW,
    (total, doc, weekVal) => {
      if (!total.matin) total.matin = { M: 0, O: 0, W: 0 }
      if (!total.apm) total.apm = { M: 0, O: 0, W: 0 }
      const wv = weekVal as CoroMOWSplitCounts
      for (const d of ["M", "O", "W"]) {
        total.matin[d] = (total.matin[d] || 0) + (wv.matin?.[d] || 0)
        total.apm[d] = (total.apm[d] || 0) + (wv.apm?.[d] || 0)
      }
    },
    "CORO-MOW-Matin/Apm",
  )
  return {
    matin: (result as unknown as CoroMOWSplitCounts).matin || { M: 0, O: 0, W: 0 },
    apm: (result as unknown as CoroMOWSplitCounts).apm || { M: 0, O: 0, W: 0 },
  }
}

/** Compteurs Cs / ETT / Stress / EE pour une semaine (vacations cliniques). */
export function computeWeeklyGroupe1Clinical(
  scheduleData: ScheduleData,
): Record<string, Groupe1EquityCounts> {
  const out: Record<string, Groupe1EquityCounts> = {}
  const bump = (doc: string, key: keyof Groupe1EquityCounts) => {
    if (!doc || doc === "CH" || doc === "I") return
    if (!isListedDoctor(doc)) return
    if (!out[doc]) out[doc] = { cs: 0, ett: 0, stress: 0, ee: 0 }
    out[doc][key]++
  }
  for (const [rowKey, dayData] of Object.entries(scheduleData || {})) {
    const kind: keyof Groupe1EquityCounts | null = CS_ROWS.has(rowKey)
      ? "cs"
      : ETT_ROWS.has(rowKey)
        ? "ett"
        : STRESS_ROWS.has(rowKey)
          ? "stress"
          : EE_ROWS.has(rowKey)
            ? "ee"
            : null
    if (!kind) continue
    for (const cell of Object.values(dayData || {})) {
      const doctors = Array.isArray((cell as { value?: unknown })?.value)
        ? ((cell as { value: string[] }).value as string[])
        : []
      for (const doc of doctors) bump(doc, kind)
    }
  }
  return out
}

function computeWeeklyRowBucket(
  scheduleData: ScheduleData,
  rows: Set<string>,
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const [rowKey, dayData] of Object.entries(scheduleData || {})) {
    if (!rows.has(rowKey)) continue
    for (const cell of Object.values(dayData || {})) {
      const doctors = Array.isArray((cell as { value?: unknown })?.value)
        ? ((cell as { value: string[] }).value as string[])
        : []
      for (const doc of doctors) {
        if (!doc || doc === "CH" || doc === "I") continue
        if (!isListedDoctor(doc)) continue
        counts[doc] = (counts[doc] || 0) + 1
      }
    }
  }
  return counts
}

/**
 * Scan générique des plannings JSON sur la fenêtre glissante 6 mois.
 * ~40 semaines chargées puis filtrées par `isWeekKeyInEquityWindow`.
 */
async function accumulateFromScheduleWindow<T>(
  now: Date,
  computeWeek: (scheduleData: ScheduleData) => Record<string, T>,
  merge: (total: Record<string, T>, doc: string, weekVal: T) => void,
  label: string,
): Promise<Record<string, T>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("schedules")
      .select("week_key, schedule_data")
      .neq("week_key", "full_schedule")
      .order("week_key", { ascending: false })
      .limit(40)

    if (error || !data?.length) {
      if (error) {
        console.warn(`[equity-tracking] Lecture schedules pour ${label}:`, error.message)
      }
      return {}
    }

    const total: Record<string, T> = {}
    for (const row of data) {
      const weekKey = row.week_key as string
      if (!isWeekKeyInEquityWindow(weekKey, now)) continue
      const week = computeWeek(row.schedule_data as ScheduleData)
      for (const [doc, val] of Object.entries(week)) {
        merge(total, doc, val as T)
      }
    }
    return total
  } catch (err) {
    console.warn(`[equity-tracking] Erreur ${label}:`, err)
    return {}
  }
}

/**
 * Équité CORO sur la même fenêtre glissante 6 mois que le reste
 * (ex-`getMonthlyCoroEquity` mensuel — désormais uniformisé).
 * Scan des plannings JSON : pas de colonne `coro_count` en base.
 */
export async function getCoroEquity(
  now: Date = new Date(),
): Promise<Record<string, number>> {
  return accumulateFromScheduleWindow(
    now,
    computeWeeklyCoro,
    (total, doc, n) => {
      total[doc] = (total[doc] || 0) + n
    },
    "CORO",
  )
}

/**
 * Équité Groupe 1 (Cs / ETT / Stress / EE) — fenêtre glissante 6 mois.
 * Scan JSON (pas de colonnes DB). Tous les médecins listés sont comptés.
 */
export async function getGroupe1Equity(
  now: Date = new Date(),
): Promise<Record<string, Groupe1EquityCounts>> {
  return accumulateFromScheduleWindow(
    now,
    computeWeeklyGroupe1Clinical,
    (total, doc, weekVal) => {
      if (!total[doc]) total[doc] = { cs: 0, ett: 0, stress: 0, ee: 0 }
      total[doc].cs += weekVal.cs
      total[doc].ett += weekVal.ett
      total[doc].stress += weekVal.stress
      total[doc].ee += (weekVal.ee || 0)
    },
    "Groupe1 Cs/ETT/Stress/EE",
  )
}

/** @deprecated Alias — préférer `getCoroEquity` (fenêtre 6 mois, plus mensuel). */
export const getMonthlyCoroEquity = getCoroEquity

/**
 * Compte Garde week-end (Samedi/Dimanche) uniquement pour une semaine -
 * distinct de `weekend_count` en base qui mélange astreinte + garde
 * week-end ensemble. Confirmé utilisateur 31/07/2026 : Groupe 1 (M/O/W) a
 * besoin de la garde week-end isolée, pas mélangée à l'astreinte.
 */
export function computeWeeklyGardeWeekend(scheduleData: ScheduleData): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const [rowKey, dayData] of Object.entries(scheduleData || {})) {
    if (!GARDE_ROWS.has(rowKey)) continue
    for (const [day, cell] of Object.entries(dayData || {})) {
      if (!WEEKEND_DAYS.has(day.toUpperCase())) continue
      const doctors = Array.isArray((cell as { value?: unknown })?.value)
        ? ((cell as { value: string[] }).value as string[])
        : []
      for (const doc of doctors) {
        if (!doc || doc === "CH" || doc === "I") continue
        if (!isListedDoctor(doc)) continue
        counts[doc] = (counts[doc] || 0) + 1
      }
    }
  }
  return counts
}

/** Équité Garde week-end (Samedi/Dimanche uniquement) — fenêtre glissante 6 mois. */
export async function getGardeWeekendEquity(
  now: Date = new Date(),
): Promise<Record<string, number>> {
  return accumulateFromScheduleWindow(
    now,
    computeWeeklyGardeWeekend,
    (total, doc, n) => {
      total[doc] = (total[doc] || 0) + n
    },
    "Garde week-end",
  )
}

/** Compte Rythmo (Groupe 2 : A, U, P) pour une semaine. */
export function computeWeeklyRythmo(scheduleData: ScheduleData): Record<string, number> {
  return computeWeeklyRowBucket(scheduleData, RYTHMO_ROWS)
}

/** Équité Rythmo (Groupe 2 : A, U, P) — fenêtre glissante 6 mois. */
export async function getRythmoEquity(
  now: Date = new Date(),
): Promise<Record<string, number>> {
  return accumulateFromScheduleWindow(
    now,
    computeWeeklyRythmo,
    (total, doc, n) => {
      total[doc] = (total[doc] || 0) + n
    },
    "Rythmo",
  )
}
