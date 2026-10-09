/**
 * Run: bunx tsx lib/__tests__/intern-guard.test.ts
 * L'interne I ne fait jamais de garde de nuit : Garde Matin uniquement.
 */
import assert from "node:assert/strict"
import { applyStructuralConstraints, stripInternFromOtherRows } from "@/lib/apply-structural-constraints"
import { generateWeekSchedule } from "@/lib/schedule-utils"

function main() {
  const wk = "2026-W42"

  // Proposition solveur : I seul sur Garde Nuit → retiré, et non recopié sur Garde Matin
  const s = generateWeekSchedule(wk, [])
  s["Garde Nuit"].MERCREDI = { value: ["I"], type: "doctor", status: "pending" }
  const out = applyStructuralConstraints(s, wk, [])
  assert.deepEqual(out["Garde Nuit"].MERCREDI.value, [])
  assert.ok(!out["Garde Matin"].MERCREDI.value.includes("I"))
  assert.equal(out["Garde Nuit"].MERCREDI.type, "empty")

  // Médecin + I sur Garde Nuit : le médecin est conservé, I retiré
  const s2 = generateWeekSchedule(wk, [])
  s2["Garde Nuit"].JEUDI = { value: ["A", "I"], type: "doctor", status: "pending" }
  const o2 = applyStructuralConstraints(s2, wk, [])
  assert.ok(o2["Garde Nuit"].JEUDI.value.includes("A"))
  assert.ok(!o2["Garde Nuit"].JEUDI.value.includes("I"))

  // Garde Matin avec I : conservé (cas légitime)
  const s3 = generateWeekSchedule(wk, [])
  s3["Garde Matin"].MARDI = { value: ["B", "I"], type: "doctor", status: "validated", manualAssignment: true }
  const o3 = applyStructuralConstraints(s3, wk, [])
  assert.ok(o3["Garde Matin"].MARDI.value.includes("I"))

  // I ailleurs (Garde Midi, astreinte…) : retiré aussi
  const s4 = generateWeekSchedule(wk, [])
  s4["Garde Midi"].LUNDI = { value: ["I"], type: "doctor", status: "pending" }
  s4["Astreintes ATL Nuit"].LUNDI = { value: ["I"], type: "doctor", status: "pending" }
  const o4 = stripInternFromOtherRows(s4)
  assert.deepEqual(o4["Garde Midi"].LUNDI.value, [])
  assert.deepEqual(o4["Astreintes ATL Nuit"].LUNDI.value, [])

  console.log("✅ intern-guard tests passed")
}

main()
