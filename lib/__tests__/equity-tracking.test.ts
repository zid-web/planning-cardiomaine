/**
 * Regression: calculateEquityPoints historically read cell.doctor / cell.activity
 * which do not exist on CellData — equity was silently 0 for everyone.
 *
 * Run: npx tsx lib/__tests__/equity-tracking.test.ts
 */
import assert from "node:assert/strict"
import {
  accumulateEquityFromSchedules,
  computeWeeklyEquity,
} from "@/lib/equity-tracking"
import type { ScheduleData } from "@/lib/types"

function cell(docs: string[]) {
  return { value: docs, status: "validated" as const }
}

const sampleWeek: ScheduleData = {
  "Astreintes ATL Matin": {
    LUNDI: cell(["W"]),
    MARDI: cell(["P"]),
    SAMEDI: cell(["M"]),
  },
  "Garde Nuit": {
    LUNDI: cell(["O"]),
    DIMANCHE: cell(["W"]),
  },
  "Hors site - NCT": {
    MERCREDI: cell(["P"]),
  },
  "Matin - Cs PSS": {
    LUNDI: cell(["Z"]), // must be ignored (not equity row)
  },
  // Legacy broken shape must NOT be counted as doctors
  "Garde Matin": {
    JEUDI: { doctor: "SHOULD_IGNORE", activity: "GARDE", value: ["S"], status: "validated" } as any,
  },
}

function main() {
  const week = computeWeeklyEquity(sampleWeek)

  assert.equal(week.W?.astreinte_count, 1, "W astreinte LUNDI")
  assert.equal(week.P?.astreinte_count, 1, "P astreinte MARDI")
  assert.equal(week.M?.astreinte_count, 1, "M astreinte SAMEDI")
  assert.equal(week.M?.weekend_count, 1, "M weekend from SAMEDI astreinte")
  assert.equal(week.O?.garde_count, 1, "O garde nuit")
  assert.equal(week.W?.garde_count, 1, "W garde dimanche")
  assert.equal(week.W?.weekend_count, 1, "W weekend from DIMANCHE garde")
  assert.equal(week.P?.nct_count, 1, "P NCT")
  assert.equal(week.S?.garde_count, 1, "S from value[], not cell.doctor")
  assert.equal(week.Z, undefined, "consultations ignored")
  assert.equal(week.SHOULD_IGNORE, undefined, "legacy cell.doctor ignored")

  // Broken historical reader simulation: cell.doctor only → would yield 0
  let brokenZero = 0
  Object.values(sampleWeek).forEach((row) => {
    Object.values(row).forEach((c: any) => {
      if (c?.doctor) brokenZero++
    })
  })
  assert.equal(brokenZero, 1, "fixture still has one legacy doctor field")
  const realTotal =
    (week.W?.astreinte_count || 0) +
    (week.W?.garde_count || 0) +
    (week.P?.astreinte_count || 0) +
    (week.P?.nct_count || 0) +
    (week.M?.astreinte_count || 0) +
    (week.O?.garde_count || 0) +
    (week.S?.garde_count || 0)
  assert.ok(realTotal >= 7, `real equity must be non-zero, got ${realTotal}`)

  const acc = accumulateEquityFromSchedules([
    { week_key: "2026-W29", schedule_data: sampleWeek },
    { week_key: "full_schedule", schedule_data: sampleWeek },
  ])
  assert.equal(acc.W?.astreinte_count, 1, "full_schedule blob excluded")

  console.log("✅ equity-tracking regression tests passed")
}

main()
