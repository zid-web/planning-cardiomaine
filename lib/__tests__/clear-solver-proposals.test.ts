/**
 * Run: bunx tsx lib/__tests__/clear-solver-proposals.test.ts
 */
import assert from "node:assert/strict"
import { clearSolverProposals } from "@/lib/clear-solver-proposals"
import { applyStructuralConstraints } from "@/lib/apply-structural-constraints"
import { generateWeekSchedule } from "@/lib/schedule-utils"
import { countSolverProposalCells } from "@/lib/guard-api-mapping"

function main() {
  const wk = "2026-W41"
  let s = applyStructuralConstraints(generateWeekSchedule(wk, []), wk, [])
  const before = structuredClone(s)

  // Propositions solveur (pending)
  s["Garde Nuit"].MARDI = { value: ["B"], type: "doctor", status: "pending" }
  s["Matin - Coro"].LUNDI = { value: ["M"], type: "doctor", status: "pending" }
  s["Matin - Cs PSS"].MERCREDI = { value: ["H", "Dupont"], type: "doctor", status: "pending", remplacant: "Dupont" }
  // Saisie manuelle admin (validée) + saisie pending d'un admin non auto-validant
  s["Garde Nuit"].JEUDI = { value: ["S"], type: "doctor", status: "validated", manualAssignment: true }
  s["Apm - Coro"].VENDREDI = {
    value: ["W"],
    type: "doctor",
    status: "pending",
    request: { requester: "X", status: "pending", timestamp: 1 },
  }
  s["Garde Midi"].LUNDI = { value: ["U"], type: "doctor", status: "pending", manualAssignment: true }

  assert.equal(countSolverProposalCells(s), 4) // 3 propositions + 1 manuelle pending sans demande

  const { schedule: out, cleared } = clearSolverProposals(s)
  assert.equal(cleared, 3)
  assert.equal(countSolverProposalCells(out), 1) // la saisie manuelle reste

  assert.deepEqual(out["Garde Nuit"].MARDI.value, [])
  assert.equal(out["Garde Nuit"].MARDI.type, "empty")
  assert.notEqual(out["Garde Nuit"].MARDI.manuallyCleared, true)
  assert.deepEqual(out["Matin - Coro"].LUNDI.value, [])
  // Remplaçant conservé
  assert.deepEqual(out["Matin - Cs PSS"].MERCREDI.value, ["Dupont"])
  assert.equal(out["Matin - Cs PSS"].MERCREDI.remplacant, "Dupont")
  // Manuel / demandes intacts
  assert.deepEqual(out["Garde Nuit"].JEUDI.value, ["S"])
  assert.deepEqual(out["Apm - Coro"].VENDREDI.value, ["W"])
  assert.equal(out["Apm - Coro"].VENDREDI.status, "pending")
  assert.deepEqual(out["Garde Midi"].LUNDI.value, ["U"])
  // Entrée non mutée
  assert.deepEqual(s["Garde Nuit"].MARDI.value, ["B"])

  // Contraintes structurelles inchangées (IRM, FV, CH…) : cases validées intactes
  assert.deepEqual(out["Hors site - IRM"].LUNDI.value, before["Hors site - IRM"].LUNDI.value)
  assert.deepEqual(out["Garde Nuit"].LUNDI.value, before["Garde Nuit"].LUNDI.value)
  const re = applyStructuralConstraints(out, wk, [])
  assert.deepEqual(
    re["Astreintes ATL Nuit"].LUNDI.value,
    before["Astreintes ATL Nuit"].LUNDI.value,
  )

  // Idempotent
  assert.equal(clearSolverProposals(out).cleared, 0)

  console.log("✅ clear-solver-proposals tests passed")
}

main()
