"use server"

import { createClient } from "@/lib/supabase/server"
import {
  buildWeekImportPreviews,
  mergeOcrIntoExisting,
  scheduleFromPdfExtraction,
  type PdfWeekExtraction,
  type WeekImportPreview,
} from "@/lib/history-import"
import { computeRowPatternsFromSchedules, type PatternProposal } from "@/lib/pattern-analysis"
import type { ScheduleData } from "@/lib/types"
import { getScheduleFromDb, saveScheduleToDb } from "@/app/actions/schedule-actions"

export type ImportHistoryResult = {
  success: boolean
  imported: number
  skipped: number
  weekKeys: string[]
  errors: string[]
}

export async function previewHistoryImport(weeks: PdfWeekExtraction[]): Promise<WeekImportPreview[]> {
  return buildWeekImportPreviews(weeks || [])
}

/**
 * Importe les semaines sélectionnées après review humaine.
 * Fusionne avec l'existant (ne remplit que les cellules vides).
 */
export async function commitHistoryImport(
  weeks: PdfWeekExtraction[],
  selectedPageIndexes: number[],
  currentUser: string,
): Promise<ImportHistoryResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, imported: 0, skipped: 0, weekKeys: [], errors: ["Non authentifié"] }
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") {
    return { success: false, imported: 0, skipped: 0, weekKeys: [], errors: ["Admin requis"] }
  }

  const selected = new Set(selectedPageIndexes)
  let imported = 0
  let skipped = 0
  const weekKeys: string[] = []
  const errors: string[] = []

  for (const week of weeks || []) {
    if (!selected.has(week.page_index)) {
      skipped += 1
      continue
    }
    const preview = buildWeekImportPreviews([week])[0]
    if (!preview.weekKey) {
      errors.push(`Page ${week.page_index + 1}: semaine indéterminable`)
      skipped += 1
      continue
    }
    const { schedule: ocrSchedule, high } = scheduleFromPdfExtraction(week.raw_extraction)
    if (high === 0) {
      errors.push(`${preview.weekKey}: aucune cellule high-confidence`)
      skipped += 1
      continue
    }

    try {
      const existingRow = await getScheduleFromDb(preview.weekKey)
      const existing = (existingRow?.schedule_data as ScheduleData | undefined) || null
      const merged = mergeOcrIntoExisting(existing, ocrSchedule)
      await saveScheduleToDb(preview.weekKey, merged, currentUser || user.email || "admin", {
        source: "pdf",
      })
      weekKeys.push(preview.weekKey)
      imported += 1
    } catch (err) {
      const msg = err instanceof Error ? err.message : "erreur inconnue"
      errors.push(`${preview.weekKey}: ${msg}`)
    }
  }

  return {
    success: imported > 0,
    imported,
    skipped,
    weekKeys,
    errors,
  }
}

/**
 * Patterns de fréquence sur les N dernières semaines (hors lignes solveur/RYTHMO).
 * Si `forWeekKey` + schedule courant fourni côté client, filtrer les cellules déjà remplies
 * est fait côté client via `applyPatternProposals`.
 */
export async function fetchHistoricalPatterns(
  lookbackWeeks = 12,
): Promise<{ success: boolean; patterns: PatternProposal[]; weeksScanned: number; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, patterns: [], weeksScanned: 0, error: "Non authentifié" }

  const { data, error } = await supabase
    .from("schedules")
    .select("week_key, schedule_data")
    .neq("week_key", "full_schedule")
    .order("week_key", { ascending: false })
    .limit(Math.max(4, Math.min(lookbackWeeks, 26)))

  if (error) {
    return { success: false, patterns: [], weeksScanned: 0, error: error.message }
  }

  const schedules = (data || [])
    .map((r) => r.schedule_data as ScheduleData)
    .filter((s) => s && typeof s === "object")

  const patterns = computeRowPatternsFromSchedules(schedules)
  return { success: true, patterns, weeksScanned: schedules.length }
}
