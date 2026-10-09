/**
 * Run: bunx tsx lib/__tests__/weekend-remplacant-seul.test.ts
 * Garde de week-end : un remplaçant peut la faire seul, sans médecin associé automatique.
 */
import assert from "node:assert/strict"
import { applyStructuralConstraints } from "@/lib/apply-structural-constraints"
import { generateWeekSchedule } from "@/lib/schedule-utils"

function main() {
  for (const wk of ["2026-W42", "2026-W43", "2026-W44"]) {
    // Dimanche : Garde Matin/Midi = M (proposition), Garde Nuit = remplaçant → pas de M ajouté à la nuit
    const s = generateWeekSchedule(wk, [])
    s["Garde Matin"].DIMANCHE = { value: ["M"], type: "doctor", status: "pending" }
    s["Garde Midi"].DIMANCHE = { value: ["M"], type: "doctor", status: "pending" }
    s["Garde Nuit"].DIMANCHE = { value: ["Klazen"], type: "doctor", status: "validated", manualAssignment: true }
    const out = applyStructuralConstraints(s, wk, [])
    assert.deepEqual(out["Garde Nuit"].DIMANCHE.value, ["Klazen"], `${wk} : remplaçant seul`)

    // Samedi idem
    const s2 = generateWeekSchedule(wk, [])
    s2["Garde Midi"].SAMEDI = { value: ["B"], type: "doctor", status: "pending" }
    s2["Garde Nuit"].SAMEDI = { value: ["Klazen"], type: "doctor", status: "validated", manualAssignment: true }
    assert.deepEqual(applyStructuralConstraints(s2, wk, [])["Garde Nuit"].SAMEDI.value, ["Klazen"])

    // Remplaçant sur toute la journée du dimanche : aucun médecin ajouté nulle part
    const s3 = generateWeekSchedule(wk, [])
    for (const r of ["Garde Matin", "Garde Midi", "Garde Nuit"]) {
      s3[r].DIMANCHE = { value: ["Klazen"], type: "doctor", status: "validated", manualAssignment: true }
    }
    const o3 = applyStructuralConstraints(s3, wk, [])
    for (const r of ["Garde Matin", "Garde Midi", "Garde Nuit"]) assert.deepEqual(o3[r].DIMANCHE.value, ["Klazen"])

    // Association manuelle explicite (médecin + remplaçant saisis par l'admin) : conservée
    const s4 = generateWeekSchedule(wk, [])
    s4["Garde Nuit"].DIMANCHE = { value: ["M", "Klazen"], type: "doctor", status: "validated", manualAssignment: true }
    assert.deepEqual(applyStructuralConstraints(s4, wk, [])["Garde Nuit"].DIMANCHE.value, ["M", "Klazen"])
  }
  console.log("✅ weekend-remplacant-seul tests passed")
}

main()
