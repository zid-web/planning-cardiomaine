/**
 * Run: bunx tsx lib/__tests__/val-restore.test.ts
 * Val retrouve son planning fixe sur les semaines déjà chargées (en cours / à venir).
 */
import assert from "node:assert/strict"
import { applyStructuralConstraints } from "@/lib/apply-structural-constraints"
import { canAssignDoctorToSlot } from "@/lib/slot-blocking"
import { generateWeekSchedule } from "@/lib/schedule-utils"

const future = "2030-W10"
const past = "2020-W10"
const cnt = (s: ReturnType<typeof generateWeekSchedule>) =>
  Object.values(s).flatMap((d) => Object.values(d)).filter((c) => (c.value || []).includes("Val")).length

function main() {
  // Semaine déjà chargée, Val absente de toutes ses cases → restaurée (semaine à venir)
  const blank = generateWeekSchedule(future, [])
  const restored = applyStructuralConstraints(blank, future, [], { isFreshWeek: false })
  assert.ok(cnt(restored) >= 8, "Val retrouve ses vacations fixes")
  assert.ok(restored["Matin - ETT Tessé"].MARDI.value.includes("Val"))

  // Historique : jamais retouché
  const old = applyStructuralConstraints(generateWeekSchedule(past, []), past, [], { isFreshWeek: false })
  assert.equal(cnt(old), 0, "les semaines passées ne sont pas modifiées")

  // Case vidée à la main : jamais réinjectée ; saisie différente : jamais écrasée
  const edited = generateWeekSchedule(future, [])
  edited["Matin - ETT Tessé"].MARDI = { value: [], type: "empty", status: "validated", manuallyCleared: true }
  edited["Matin - ETT Tessé"].MERCREDI = { value: ["P"], type: "doctor", status: "validated" }
  const kept = applyStructuralConstraints(edited, future, [], { isFreshWeek: false })
  assert.deepEqual(kept["Matin - ETT Tessé"].MARDI.value, [])
  assert.deepEqual(kept["Matin - ETT Tessé"].MERCREDI.value, ["P"])

  // Binôme médecin conservé / ajoutable sur Stress et EE
  const paired = generateWeekSchedule(future, [])
  const row = restored["Apm - EE1"] ? "Apm - EE1" : "Matin - EE1"
  const day = Object.entries(restored[row]).find(([, c]) => c.value.includes("Val"))?.[0] as string
  paired[row][day] = { value: ["Val", "A"], type: "doctor", status: "validated" }
  const withPartner = applyStructuralConstraints(paired, future, [], { isFreshWeek: false })
  assert.ok(withPartner[row][day].value.includes("A") && withPartner[row][day].value.includes("Val"))
  const base = generateWeekSchedule(future, [])
  base["Matin - Stress"].LUNDI = { value: ["Val"], type: "doctor", status: "validated" }
  // Aucun pool imposé à Val : au moins un médecin libre du créneau est acceptable
  assert.ok(
    ["A", "B", "H", "S", "U", "G", "Z", "P", "M", "W", "O"].some(
      (d) => canAssignDoctorToSlot(d, "2030-03-04", "Matin - Stress", "LUNDI", base, []).allowed,
    ),
  )

  console.log("✅ val-restore tests passed")
}

main()
