/**
 * Run: npx tsx lib/__tests__/history-import.test.ts
 */
import assert from "node:assert/strict"
import {
  buildWeekImportPreviews,
  mergeOcrIntoExisting,
  scheduleFromPdfExtraction,
  weekKeyFromDatesByDay,
  type PdfWeekExtraction,
} from "@/lib/history-import"
import {
  computeRowPatternsFromSchedules,
  fillClinicalVacationsFromPatterns,
  isClinicalVacationRow,
} from "@/lib/pattern-analysis"
import { generateWeekSchedule } from "@/lib/schedule-utils"

function main() {
  const week: PdfWeekExtraction = {
    page_index: 0,
    raw_extraction: {
      week_label: "SEMAINE 36",
      dates_by_day: { LUNDI: "2026-08-31", JEUDI: "2026-09-03" },
      rows: [
        {
          row_label: "Cs PSS matin",
          matched_row_key: "Matin - Cs PSS",
          cells: [
            { day_name: "LUNDI", doctors: ["P"], raw_text: "P", confidence: "high" },
            { day_name: "MARDI", doctors: ["Z"], raw_text: "?", confidence: "low" },
          ],
        },
        {
          row_label: "Garde Nuit",
          matched_row_key: "Garde Nuit",
          cells: [{ day_name: "LUNDI", doctors: ["W"], raw_text: "W", confidence: "high" }],
        },
      ],
      warnings: ["cellule floue mardi"],
    },
    mapped_existing_schedule: {},
    warnings: [],
  }

  const wk = weekKeyFromDatesByDay(week.raw_extraction.dates_by_day)
  assert.ok(wk && /^2026-W\d{2}$/.test(wk))

  const { schedule, high, low } = scheduleFromPdfExtraction(week.raw_extraction)
  assert.equal(high, 2)
  assert.equal(low, 1)
  assert.deepEqual(schedule["Matin - Cs PSS"].LUNDI.value, ["P"])
  assert.deepEqual(schedule["Matin - Cs PSS"].MARDI.value, []) // low ignored
  assert.deepEqual(schedule["Garde Nuit"].LUNDI.value, ["W"])

  const existing = generateWeekSchedule(wk!)
  existing["Matin - Cs PSS"].LUNDI = { value: ["S"], type: "doctor", status: "validated" }
  const merged = mergeOcrIntoExisting(existing, schedule)
  assert.deepEqual(merged["Matin - Cs PSS"].LUNDI.value, ["S"], "manual kept")
  assert.deepEqual(merged["Garde Nuit"].LUNDI.value, ["W"], "empty filled from OCR")

  const previews = buildWeekImportPreviews([week])
  assert.equal(previews[0].selected, true)
  assert.equal(previews[0].lowConfidenceCells, 1)

  // Patterns: Cs LUNDI appears as P twice, Z once → P
  const s1 = generateWeekSchedule("2026-W35")
  const s2 = generateWeekSchedule("2026-W36")
  const s3 = generateWeekSchedule("2026-W37")
  s1["Matin - Cs PSS"].LUNDI = { value: ["P"], type: "doctor", status: "validated" }
  s2["Matin - Cs PSS"].LUNDI = { value: ["P"], type: "doctor", status: "validated" }
  s3["Matin - Cs PSS"].LUNDI = { value: ["Z"], type: "doctor", status: "validated" }
  s1["Garde Nuit"].LUNDI = { value: ["W"], type: "doctor", status: "validated" } // excluded
  const patterns = computeRowPatternsFromSchedules([s1, s2, s3])
  const cs = patterns.find((p) => p.row_key === "Matin - Cs PSS" && p.day_name === "LUNDI")
  assert.ok(cs)
  assert.deepEqual(cs!.doctors, ["P"])
  assert.equal(
    patterns.some((p) => p.row_key === "Garde Nuit"),
    false,
    "solver rows excluded",
  )

  // Générer doit pouvoir remplir Cs/ETT/EE via les mêmes patterns
  assert.equal(isClinicalVacationRow("Matin - Cs PSS"), true)
  assert.equal(isClinicalVacationRow("Apm - ETT salle 2"), true)
  assert.equal(isClinicalVacationRow("Matin - EE1"), true)
  assert.equal(isClinicalVacationRow("Apm - Stress"), true)
  assert.equal(isClinicalVacationRow("Matin - Coro"), false)
  assert.equal(isClinicalVacationRow("Garde Nuit"), false)

  const target = generateWeekSchedule("2026-W38")
  s1["Matin - ETT salle 1"].MARDI = { value: ["A"], type: "doctor", status: "validated" }
  s2["Matin - ETT salle 1"].MARDI = { value: ["A"], type: "doctor", status: "validated" }
  s3["Matin - ETT salle 1"].MARDI = { value: ["B"], type: "doctor", status: "validated" }
  const filled = fillClinicalVacationsFromPatterns(target, [s1, s2, s3])
  assert.ok(filled.applied >= 1)
  assert.deepEqual(filled.next["Matin - Cs PSS"].LUNDI.value, ["P"])
  assert.deepEqual(filled.next["Matin - ETT salle 1"].MARDI.value, ["A"])
  assert.equal(filled.next["Matin - Cs PSS"].LUNDI.status, "pending")

  console.log("✅ history-import / pattern-analysis tests passed")
}

main()
