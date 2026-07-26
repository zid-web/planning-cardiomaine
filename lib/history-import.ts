import { DAYS } from "@/lib/constants"
import { generateWeekSchedule, getWeekNumber } from "@/lib/schedule-utils"
import type { CellData, ScheduleData } from "@/lib/types"

/** Aligné sur guard-api `SOLVER_MANAGED_ROW_KEYS` (ASTREINTE/GARDE/NCT/CORO). */
export const SOLVER_MANAGED_ROW_KEYS = new Set([
  "Astreintes ATL Matin",
  "Astreintes ATL Midi",
  "Astreintes ATL Nuit",
  "Garde Matin",
  "Garde Midi",
  "Garde Nuit",
  "Hors site - NCT",
  "Matin - Coro",
  "Apm - Coro",
])

/** RYTHMO déjà géré par règles fixes côté solveur — hors analyse de fréquence. */
export const FREQUENCY_EXCLUDED_ROW_KEYS = new Set([
  ...SOLVER_MANAGED_ROW_KEYS,
  "Matin - Rythmo",
  "Apm - Rythmo",
  "Notes du jour",
  "Vacances",
  "Congrès",
  "Congés",
])

export type PdfExtractedCell = {
  day_name: string
  doctors: string[]
  raw_text?: string
  confidence?: "high" | "low" | string
}

export type PdfExtractedRow = {
  row_label?: string
  matched_row_key?: string | null
  cells?: PdfExtractedCell[]
}

export type PdfWeekExtraction = {
  page_index: number
  raw_extraction: {
    week_label?: string | null
    dates_by_day?: Record<string, string>
    rows?: PdfExtractedRow[]
    warnings?: string[]
  }
  mapped_existing_schedule?: Record<string, string[]>
  warnings?: string[]
}

export type WeekImportPreview = {
  page_index: number
  weekKey: string | null
  week_label: string | null
  dates_by_day: Record<string, string>
  highConfidenceCells: number
  lowConfidenceCells: number
  warnings: string[]
  selected: boolean
  error?: string
}

export function weekKeyFromDatesByDay(datesByDay: Record<string, string> | undefined): string | null {
  if (!datesByDay) return null
  for (const iso of Object.values(datesByDay)) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) continue
    const [y, m, d] = iso.split("-").map(Number)
    const date = new Date(y, (m || 1) - 1, d || 1)
    const { year, week } = getWeekNumber(date)
    return `${year}-W${String(week).padStart(2, "0")}`
  }
  return null
}

/**
 * Construit un ScheduleData à partir de raw_extraction.rows.
 * Ne prend que matched_row_key non-null + cellules confidence high.
 */
export function scheduleFromPdfExtraction(
  raw: PdfWeekExtraction["raw_extraction"] | undefined,
): { schedule: ScheduleData; high: number; low: number } {
  const weekKeyHint = weekKeyFromDatesByDay(raw?.dates_by_day) || "imported"
  const schedule = generateWeekSchedule(weekKeyHint)
  let high = 0
  let low = 0

  for (const row of raw?.rows || []) {
    const rowKey = row.matched_row_key
    if (!rowKey || !schedule[rowKey]) continue

    for (const cell of row.cells || []) {
      const day = (cell.day_name || "").toUpperCase()
      if (!DAYS.includes(day)) continue
      const conf = (cell.confidence || "low").toLowerCase()
      if (conf !== "high") {
        low += 1
        continue
      }
      const doctors = (cell.doctors || []).filter(Boolean)
      if (!doctors.length) continue
      schedule[rowKey][day] = {
        value: [...doctors],
        type: "doctor",
        status: "validated",
      }
      high += 1
    }
  }

  return { schedule, high, low }
}

/**
 * Fusionne OCR dans l'existant : ne remplit que les cellules vides.
 * Les saisies manuelles déjà présentes sont préservées.
 */
export function mergeOcrIntoExisting(existing: ScheduleData | null | undefined, ocr: ScheduleData): ScheduleData {
  const base = existing && Object.keys(existing).length ? structuredClone(existing) : generateWeekSchedule("merged")
  // Ensure all OCR row keys exist
  for (const rowKey of Object.keys(ocr)) {
    if (!base[rowKey]) base[rowKey] = ocr[rowKey]
  }

  for (const [rowKey, days] of Object.entries(ocr)) {
    if (!base[rowKey]) continue
    for (const day of DAYS) {
      const ocrCell = days?.[day]
      if (!ocrCell?.value?.length) continue
      const cur = base[rowKey][day]
      const curVal = cur?.value || []
      if (curVal.length > 0) continue // préserver saisie existante
      base[rowKey][day] = {
        ...(cur || ({} as CellData)),
        value: [...ocrCell.value],
        type: ocrCell.type || "doctor",
        status: ocrCell.status || "validated",
      }
    }
  }
  return base
}

export function buildWeekImportPreviews(weeks: PdfWeekExtraction[]): WeekImportPreview[] {
  return weeks.map((w) => {
    const dates = w.raw_extraction?.dates_by_day || {}
    const weekKey = weekKeyFromDatesByDay(dates)
    const { high, low } = scheduleFromPdfExtraction(w.raw_extraction)
    const warnings = [
      ...(w.warnings || []),
      ...(w.raw_extraction?.warnings || []),
    ]
    return {
      page_index: w.page_index,
      weekKey,
      week_label: w.raw_extraction?.week_label ?? null,
      dates_by_day: dates,
      highConfidenceCells: high,
      lowConfidenceCells: low,
      warnings,
      selected: Boolean(weekKey && high > 0),
      error: weekKey ? undefined : "Impossible de déduire la semaine (dates illisibles)",
    }
  })
}
