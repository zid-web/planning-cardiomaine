/**
 * Run: npx tsx lib/__tests__/night-guard-proposals.test.ts
 */
import assert from "node:assert/strict"
import { constraints2026, generateNightGuardProposals } from "@/lib/guard-scheduler"

function main() {
  // Une semaine ISO complète : lundi 20 → dimanche 26 juillet 2026
  const start = new Date(2026, 6, 20) // month 0-indexed
  const end = new Date(2026, 6, 26)

  const emptyConstraints = {
    ...constraints2026,
    vacations2026: {},
    fixedGuards2026: [],
    fixedAstreintes2026: [],
  }

  const proposals = generateNightGuardProposals(start, end, emptyConstraints)
  const byDay = proposals.map((p) => p.day)

  // Lundi exclu (FV) → 6 propositions Mar–Dim
  assert.equal(proposals.length, 6, `expected 6 (Tue–Sun), got ${proposals.length}: ${byDay.join(",")}`)
  assert.equal(byDay.includes("LUNDI"), false, "Lundi must be excluded when FV available")
  for (const day of ["MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI", "DIMANCHE"]) {
    assert.ok(byDay.includes(day), `missing ${day}`)
  }

  // FV en vacances le lundi → proposition Lundi aussi (7 jours)
  const withFvVacation = {
    ...emptyConstraints,
    vacations2026: { FV: ["2026-07-20"] },
  }
  const withMonday = generateNightGuardProposals(start, end, withFvVacation)
  assert.equal(withMonday.length, 7, `expected 7 when FV on vacation, got ${withMonday.length}`)
  assert.ok(
    withMonday.some((p) => p.day === "LUNDI"),
    "Lundi proposed when FV on vacation",
  )
  assert.notEqual(
    withMonday.find((p) => p.day === "LUNDI")?.user,
    "FV",
    "replacement must not be FV",
  )

  console.log("✅ night-guard-proposals tests passed")
}

main()
