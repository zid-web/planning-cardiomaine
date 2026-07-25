import Papa from "papaparse"
import * as XLSX from "xlsx"
import { DAYS } from "@/lib/constants"

export type PlanningImportResult = {
  mapped: Record<string, string[]>
  warnings: string[]
  rowCount: number
}

function normalizeHeader(key: string) {
  return key.trim()
}

function parseDoctorsCell(raw: unknown): string[] {
  if (raw == null || raw === "") return []
  return String(raw)
    .split(/[,|;/\s]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
}

/** Convertit des lignes tabulaires (CSV/XLSX) en clés `Activité||JOUR` → médecins. */
export function rowsToMappedSchedule(
  rows: Record<string, string>[],
): PlanningImportResult {
  const mapped: Record<string, string[]> = {}
  const warnings: string[] = []
  let rowCount = 0

  for (const raw of rows) {
    const row: Record<string, string> = {}
    for (const [k, v] of Object.entries(raw)) {
      row[normalizeHeader(k)] = v == null ? "" : String(v)
    }

    const activity = (
      row.activite ||
      row.Activité ||
      row.Activite ||
      row.activity ||
      row.Activity ||
      row.ACTIVITE ||
      ""
    ).trim()

    if (!activity) {
      warnings.push("Ligne ignorée : colonne activité manquante")
      continue
    }

    rowCount += 1
    let anyDay = false
    for (const day of DAYS) {
      const rawCell =
        row[day] ||
        row[day.toLowerCase()] ||
        row[day.charAt(0) + day.slice(1).toLowerCase()] ||
        ""
      const doctors = parseDoctorsCell(rawCell)
      if (doctors.length) {
        mapped[`${activity}||${day}`] = doctors
        anyDay = true
      }
    }
    if (!anyDay) {
      warnings.push(`Aucune affectation pour « ${activity} »`)
    }
  }

  return { mapped, warnings, rowCount }
}

export function parseCsvToMapped(text: string): PlanningImportResult {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  })
  if (parsed.errors.length) {
    throw new Error(parsed.errors[0]?.message || "CSV invalide")
  }
  return rowsToMappedSchedule(parsed.data)
}

export function parseExcelToMapped(file: ArrayBuffer): PlanningImportResult {
  const wb = XLSX.read(file, { type: "array" })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) throw new Error("Fichier Excel vide")
  const sheet = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
    defval: "",
  })
  return rowsToMappedSchedule(rows)
}

export function isPlanningSpreadsheet(file: File) {
  const name = file.name.toLowerCase()
  return (
    name.endsWith(".csv") ||
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    file.type === "text/csv" ||
    file.type === "application/vnd.ms-excel" ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  )
}

export function isPlanningPdf(file: File) {
  const name = file.name.toLowerCase()
  return name.endsWith(".pdf") || file.type === "application/pdf"
}
