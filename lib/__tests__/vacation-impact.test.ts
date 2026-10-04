/**
 * Run: bunx tsx lib/__tests__/vacation-impact.test.ts
 */
import assert from "node:assert/strict"
import { listRemovedAssignments, weekOverlapsRange } from "@/lib/vacation-impact"
import { applyStructuralConstraints } from "@/lib/apply-structural-constraints"
import { generateWeekSchedule } from "@/lib/schedule-utils"
import type { DoctorVacation } from "@/lib/types"

function main() {
  // Chevauchement semaine / période
  assert.equal(weekOverlapsRange("2026-10-05", "2026-10-11", "2026-10-07", "2026-10-09"), true)
  assert.equal(weekOverlapsRange("2026-10-05", "2026-10-11", "2026-10-11", "2026-10-20"), true) // dimanche inclus
  assert.equal(weekOverlapsRange("2026-10-05", "2026-10-11", "2026-10-12", "2026-10-20"), false)
  assert.equal(weekOverlapsRange("2026-10-05", "2026-10-11", "2026-09-20", "2026-10-04"), false)

  // Cas réel : B a une garde de nuit le mercredi, puis un congé couvre ce jour
  const wk = "2026-W41" // lundi 5/10 → dimanche 11/10
  let before = applyStructuralConstraints(generateWeekSchedule(wk, []), wk, [])
  before["Garde Nuit"].MERCREDI = { value: ["B"], type: "doctor", status: "validated" }
  before["Matin - Cs PSS"].JEUDI = { value: ["B"], type: "doctor", status: "validated" }
  before["Matin - Cs PSS"].VENDREDI = { value: ["Z"], type: "doctor", status: "validated" }

  const leave: DoctorVacation[] = [
    { id: "v", doctor_id: "B", start_date: "2026-10-07", end_date: "2026-10-08", created_at: "", updated_at: "" },
  ]
  const after = applyStructuralConstraints(structuredClone(before), wk, leave, { isFreshWeek: false })
  const removed = listRemovedAssignments(before, after, "B", wk)

  // B est retiré de la garde de nuit du mercredi et du Cs du jeudi ; Z (pas en congé) n'est pas touché
  assert.ok(removed.some((r) => r.row === "Garde Nuit" && r.day === "MERCREDI"), "garde du mercredi retirée")
  assert.ok(removed.some((r) => r.row === "Matin - Cs PSS" && r.day === "JEUDI"), "Cs du jeudi retiré")
  assert.ok(after["Congés"].MERCREDI.value.includes("B"), "B apparaît dans la ligne Congés")
  assert.equal(after["Matin - Cs PSS"].VENDREDI.value.includes("Z"), true)
  // La ligne Congés elle-même n'est jamais comptée comme affectation retirée
  assert.ok(removed.every((r) => r.row !== "Congés" && !r.row.startsWith("1/2 journée off")))
  // Un autre médecin n'a rien perdu
  assert.deepEqual(listRemovedAssignments(before, after, "Z", wk), [])
  // Sans changement : rien
  assert.deepEqual(listRemovedAssignments(after, after, "B", wk), [])
  // Entrées absentes : tableau vide
  assert.deepEqual(listRemovedAssignments(undefined, after, "B", wk), [])

  console.log("✅ vacation-impact tests passed")
}

main()
