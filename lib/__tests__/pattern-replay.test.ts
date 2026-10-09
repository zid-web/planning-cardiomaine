/**
 * Run: bunx tsx lib/__tests__/pattern-replay.test.ts
 * Le générateur rejoue les schémas du remplissage manuel sur les cases vides.
 */
import assert from "node:assert/strict"
import { buildPatternStats, learnedCandidates, learnedPartners } from "@/lib/pattern-replay"
import { applyClinicalPriorityRules } from "@/lib/clinical-priority"
import { buildHistoricalPatternsPayload } from "@/lib/pattern-analysis"
import { generateWeekSchedule } from "@/lib/schedule-utils"
import type { ScheduleData } from "@/lib/types"

const manual = (value: string[]) => ({ value, type: "doctor" as const, status: "validated" as const, manualAssignment: true })

function history(n: number, patch: (s: ScheduleData) => void) {
  return Array.from({ length: n }, (_, i) => {
    const weekKey = `2026-W${String(20 + i).padStart(2, "0")}`
    const s = generateWeekSchedule(weekKey, [])
    patch(s)
    return { weekKey, schedule: s }
  })
}

function main() {
  const weeks = history(8, (s) => {
    s["Matin - Stress"].MARDI = manual(["Z"])
    s["Matin - Cs PSS"].JEUDI = manual(["W", "U", "A"]) // U exclu du Cs PSS ; W est éligible
    s["Matin - EE2"].LUNDI = manual(["Val", "A"])
    s["Apm - Stress"].MERCREDI = { value: ["B"], type: "doctor", status: "pending" } // proposition : ignorée
  })
  const stats = buildPatternStats(weeks)
  assert.equal(stats.weeksUsed, 8)
  assert.deepEqual(learnedCandidates(stats, "Matin - Stress", "MARDI"), ["Z"])
  assert.deepEqual(learnedPartners(stats, "Matin - EE2", "LUNDI", "Val"), ["A"])
  assert.deepEqual(learnedCandidates(stats, "Apm - Stress", "MERCREDI"), [], "les propositions non validées ne comptent pas")

  // Semaine à venir : cases vides → schémas rejoués
  const wk = "2026-W44"
  const empty = generateWeekSchedule(wk, [])
  empty["Matin - EE2"].LUNDI = { value: ["Val"], type: "doctor", status: "validated" }
  const out = applyClinicalPriorityRules(empty, wk, [], [], stats)
  assert.deepEqual(out["Matin - Stress"].MARDI.value, ["Z"], "Z mis au Stress mardi comme à la main")
  assert.ok(out["Matin - Cs PSS"].JEUDI.value.includes("W") || out["Matin - Coro"].JEUDI.value.length > 0)
  assert.ok(!out["Matin - Cs PSS"].JEUDI.value.includes("U"), "U jamais en Cs PSS, même si appris")
  assert.deepEqual(out["Matin - EE2"].LUNDI.value, ["Val", "A"], "binôme de Val appris")
  assert.equal(out["Matin - EE2"].LUNDI.status, "pending")

  // Sans historique : aucun binôme inventé
  const none = applyClinicalPriorityRules(empty, wk, [], [], buildPatternStats([]))
  assert.deepEqual(none["Matin - EE2"].LUNDI.value, ["Val"])

  // Case validée / vidée à la main : jamais touchée
  const guarded = generateWeekSchedule(wk, [])
  guarded["Matin - Stress"].MARDI = manual(["H"])
  guarded["Matin - Stress"].MERCREDI = { value: [], type: "empty", status: "validated", manuallyCleared: true }
  const og = applyClinicalPriorityRules(guarded, wk, [], [], stats)
  assert.deepEqual(og["Matin - Stress"].MARDI.value, ["H"])
  assert.deepEqual(og["Matin - Stress"].MERCREDI.value, [])

  // Payload solveur : propositions ignorées, saisies manuelles ×2
  const payload = buildHistoricalPatternsPayload(weeks.map((w) => w.schedule))
  assert.equal(payload["Matin - Stress"].MARDI.frequency.Z, 16)
  assert.ok(!payload["Apm - Stress"]?.MERCREDI, "pending ignoré dans le payload")

  console.log("✅ pattern-replay tests passed")
}

main()
