import { createClient } from "@/lib/supabase/server"
import { isListedDoctor } from "@/lib/doctor-code"
import type { ScheduleData } from "@/lib/types"

export type EquityCounts = {
  astreinte_count: number
  garde_count: number
  nct_count: number
  weekend_count: number
}

/** Lignes planning UI → buckets d’équité (doit rester aligné avec le solveur). */
export const ASTREINTE_ROWS = new Set([
  "Astreintes ATL Matin",
  "Astreintes ATL Midi",
  "Astreintes ATL Nuit",
])
export const GARDE_ROWS = new Set(["Garde Matin", "Garde Midi", "Garde Nuit"])
export const NCT_ROWS = new Set(["Hors site - NCT"])
export const WEEKEND_DAYS = new Set(["SAMEDI", "DIMANCHE"])

function emptyCounts(): EquityCounts {
  return { astreinte_count: 0, garde_count: 0, nct_count: 0, weekend_count: 0 }
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
 */
export function accumulateEquityFromSchedules(
  schedules: Array<{ week_key?: string; schedule_data?: ScheduleData | null }>,
): Record<string, EquityCounts> {
  const total: Record<string, EquityCounts> = {}
  for (const row of schedules) {
    if (!row?.schedule_data || row.week_key === "full_schedule") continue
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
 * Équité cumulée depuis doctor_equity_weekly (ou table/vue totals).
 * Retourne null si la table est indisponible ; {} si vide (→ repli scan JSON).
 */
export async function getCumulativeEquityFromTable(): Promise<Record<string, EquityCounts> | null> {
  try {
    const supabase = await createClient()

    // Source de vérité : snapshots hebdo (indépendant du nommage view vs table totals)
    const { data, error } = await supabase
      .from("doctor_equity_weekly")
      .select("doctor_id, astreinte_count, garde_count, nct_count, weekend_count")

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
