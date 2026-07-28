/**
 * Regression: calculateEquityPoints historically read cell.doctor / cell.activity
 * which do not exist on CellData — equity was silently 0 for everyone.
 *
 * Run: npx tsx lib/__tests__/equity-tracking.test.ts
 */
import assert from "node:assert/strict"
import {
  accumulateEquityFromSchedules,
  computeWeeklyCoro,
  computeWeeklyEquity,
  computeWeeklyGroupe1Clinical,
  CS_ROWS,
  ETT_ROWS,
  equityRollingWindowStart,
  EQUITY_ROLLING_MONTHS,
  GROUPE1_ECHO_DOCTORS,
  isWeekKeyInEquityWindow,
  isoWeekKeyToMonday,
  STRESS_ROWS,
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
  "Matin - Coro": {
    LUNDI: cell(["W"]),
    MARDI: cell(["O"]),
  },
  "Apm - Coro": {
    LUNDI: cell(["M"]),
  },
  "Matin - Cs PSS": {
    LUNDI: cell(["Z"]), // ignored by computeWeeklyEquity (garde/astreinte)
  },
  "Matin - Cs Tessée": {
    MARDI: cell(["B", "B"]), // doublon Cs → +2
  },
  "Apm - Cs PSS": {
    MERCREDI: cell(["H"]),
  },
  "Matin - ETT salle 1": {
    LUNDI: cell(["G"]),
  },
  "Matin - ETT salle 2": {
    LUNDI: cell(["G"]), // deux salles → +2
  },
  "Apm - ETT salle 1": {
    MARDI: cell(["S"]),
  },
  "Matin - Stress": {
    JEUDI: cell(["Z"]),
  },
  "Apm - Stress": {
    VENDREDI: cell(["B"]),
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
  assert.equal(week.Z, undefined, "consultations ignored by garde/astreinte equity")
  assert.equal(week.SHOULD_IGNORE, undefined, "legacy cell.doctor ignored")

  const coro = computeWeeklyCoro(sampleWeek)
  assert.equal(coro.W, 1, "W Matin Coro")
  assert.equal(coro.O, 1, "O Matin Coro")
  assert.equal(coro.M, 1, "M Apm Coro")
  assert.equal(coro.Z, undefined, "Cs not coro")

  // Groupe 1 : Cs / ETT / Stress (vacations cliniques séparées)
  assert.ok(CS_ROWS.has("Matin - Cs PSS"))
  assert.ok(ETT_ROWS.has("Apm - ETT salle 2"))
  assert.ok(STRESS_ROWS.has("Apm - Stress"))
  assert.ok(GROUPE1_ECHO_DOCTORS.has("B") && GROUPE1_ECHO_DOCTORS.has("S"))
  const g1 = computeWeeklyGroupe1Clinical(sampleWeek)
  assert.equal(g1.Z?.cs, 1, "Z Matin Cs PSS")
  assert.equal(g1.B?.cs, 2, "B doublon Cs Tessée")
  assert.equal(g1.H?.cs, 1, "H Apm Cs PSS")
  assert.equal(g1.G?.ett, 2, "G ETT salle 1+2")
  assert.equal(g1.S?.ett, 1, "S Apm ETT salle 1")
  assert.equal(g1.Z?.stress, 1, "Z Matin Stress")
  assert.equal(g1.B?.stress, 1, "B Apm Stress")
  assert.equal(g1.W, undefined, "W hors Cs/ETT/Stress cette semaine")
  assert.equal(g1.O, undefined, "O hors Cs/ETT/Stress")

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

  // Fenêtre glissante 6 mois
  assert.equal(EQUITY_ROLLING_MONTHS, 6)
  const now = new Date(Date.UTC(2026, 6, 27)) // 2026-07-27
  const start = equityRollingWindowStart(now)
  assert.equal(start.getUTCFullYear(), 2026)
  assert.equal(start.getUTCMonth(), 0) // janvier
  assert.ok(isoWeekKeyToMonday("2026-W30"))
  assert.equal(isWeekKeyInEquityWindow("2026-W30", now), true)
  assert.equal(isWeekKeyInEquityWindow("2026-W06", now), true) // début février 2026
  assert.equal(isWeekKeyInEquityWindow("2026-W05", now), false, "lundi W05 = 26 jan < 27 jan")
  assert.equal(isWeekKeyInEquityWindow("2026-W01", now), false, "lundi W01 = fin 2025, hors fenêtre")
  assert.equal(isWeekKeyInEquityWindow("2025-W20", now), false, "plus vieux que 6 mois")
  assert.equal(isWeekKeyInEquityWindow("full_schedule", now), false)

  const filtered = accumulateEquityFromSchedules(
    [
      { week_key: "2026-W29", schedule_data: sampleWeek },
      { week_key: "2025-W10", schedule_data: sampleWeek },
    ],
    { now },
  )
  assert.equal(filtered.W?.astreinte_count, 1, "old week dropped by rolling window")

  const unfiltered = accumulateEquityFromSchedules(
    [
      { week_key: "2026-W29", schedule_data: sampleWeek },
      { week_key: "2025-W10", schedule_data: sampleWeek },
    ],
    { rollingWindow: false },
  )
  assert.equal(unfiltered.W?.astreinte_count, 2, "rollingWindow:false keeps all")

  // Fenêtre 6 mois aussi pour Groupe1 (accumulate via week filter helper)
  const g1OldDropped = accumulateEquityFromSchedules(
    [
      { week_key: "2026-W29", schedule_data: sampleWeek },
      { week_key: "2025-W10", schedule_data: sampleWeek },
    ],
    { now },
  )
  assert.equal(g1OldDropped.W?.astreinte_count, 1)
  // computeWeeklyGroupe1Clinical + fenêtre manuelle
  let g1InWindow = 0
  let g1OutWindow = 0
  for (const wk of ["2026-W29", "2025-W10"] as const) {
    const counts = computeWeeklyGroupe1Clinical(sampleWeek)
    if (isWeekKeyInEquityWindow(wk, now)) g1InWindow += counts.B?.cs || 0
    else g1OutWindow += counts.B?.cs || 0
  }
  assert.equal(g1InWindow, 2, "B cs only from in-window week")
  assert.equal(g1OutWindow, 2, "out-window week still computable but filtered by caller")

  console.log("✅ equity-tracking regression tests passed")
}

main()
