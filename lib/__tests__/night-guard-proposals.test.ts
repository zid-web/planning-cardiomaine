/**
 * Run: npx tsx lib/__tests__/night-guard-proposals.test.ts
 */
import assert from "node:assert/strict"
import { constraints2026, generateNightGuardProposals } from "@/lib/guard-scheduler"

function main() {
  // Semaine ISO : lundi 20 → dimanche 26 juillet 2026 (NCT jeudi 23 = M)
  const start = new Date(2026, 6, 20)
  const end = new Date(2026, 6, 26)

  const emptyConstraints = {
    ...constraints2026,
    vacations2026: {},
    fixedGuards2026: [],
    fixedAstreintes2026: [],
  }

  const proposals = generateNightGuardProposals(start, end, emptyConstraints)
  const byDay = Object.fromEntries(proposals.map((p) => [p.day, p.user]))

  assert.equal(proposals.length, 6, `expected 6 (Tue–Sun), got ${proposals.length}`)
  assert.equal(byDay.LUNDI, undefined, "Lundi exclu quand FV dispo")

  // Mardi → M ou W
  assert.ok(["M", "W"].includes(byDay.MARDI), `Mardi prefer M/W, got ${byDay.MARDI}`)

  // Mercredi → S/U/P ; M interdit (NCT jeudi)
  assert.ok(["S", "U", "P"].includes(byDay.MERCREDI), `Mercredi prefer S/U/P, got ${byDay.MERCREDI}`)
  assert.notEqual(byDay.MERCREDI, "M", "M ne doit pas avoir garde la veille de son NCT")

  // Jeudi → O ou G
  assert.ok(["O", "G"].includes(byDay.JEUDI), `Jeudi prefer O/G, got ${byDay.JEUDI}`)

  // Vendredi → pool B/G/A/P/Z/H/S ; jamais O/W/M
  assert.ok(
    ["B", "G", "A", "P", "Z", "H", "S"].includes(byDay.VENDREDI),
    `Vendredi pool, got ${byDay.VENDREDI}`,
  )
  assert.ok(!["O", "W", "M"].includes(byDay.VENDREDI), "O/W/M jamais vendredi nuit")

  // FV en vacances lundi → U préféré
  const withFvVacation = {
    ...emptyConstraints,
    vacations2026: { FV: ["2026-07-20"] },
  }
  const withMonday = generateNightGuardProposals(start, end, withFvVacation)
  const monday = withMonday.find((p) => p.day === "LUNDI")
  assert.ok(monday, "Lundi proposé si FV absent")
  assert.equal(monday!.user, "U", `Lundi prefer U si FV absent, got ${monday!.user}`)

  console.log("✅ night-guard-proposals preference tests passed")
}

main()
