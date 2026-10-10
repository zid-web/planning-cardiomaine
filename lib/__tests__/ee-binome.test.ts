/**
 * Run: bunx tsx lib/__tests__/ee-binome.test.ts
 * EE1 / EE2 : médecin en binôme avec Val/Véro ; seuls O, V, DAAS peuvent être seuls ;
 * une infirmière sur les deux salles n'a qu'un seul médecin (le même).
 */
import assert from "node:assert/strict"
import { canAssignDoctorToSlot, EE_SOLO_DOCTORS } from "@/lib/slot-blocking"
import { mirrorEeDoctorForSharedNurse } from "@/lib/nurse-rules"
import { applyClinicalPriorityRules } from "@/lib/clinical-priority"
import { generateWeekSchedule } from "@/lib/schedule-utils"

const wk = "2026-W44" // lundi 26/10/2026
const cell = (value: string[], status: "validated" | "pending" = "validated") => ({ value, type: "doctor" as const, status })

function main() {
  assert.deepEqual([...EE_SOLO_DOCTORS].sort(), ["DAAS", "O", "V"])

  // Seuls O, V, DAAS seuls en EE ; les autres médecins refusés sans infirmière
  const s = generateWeekSchedule(wk, [])
  for (const d of ["O", "V", "DAAS"]) {
    assert.equal(canAssignDoctorToSlot(d, "2026-10-28", "Matin - EE2", "MERCREDI", s, []).allowed, true, `${d} peut être seul`)
  }
  const refused = canAssignDoctorToSlot("H", "2026-10-28", "Matin - EE2", "MERCREDI", s, [])
  assert.equal(refused.allowed, false)
  assert.match(refused.reason || "", /seuls O, V et DAAS/)

  // Avec Val ou Véro : binôme autorisé
  s["Matin - EE2"].MERCREDI = cell(["Val"])
  assert.equal(canAssignDoctorToSlot("H", "2026-10-28", "Matin - EE2", "MERCREDI", s, []).allowed, true)
  s["Matin - EE2"].MERCREDI = cell(["Véro"])
  assert.equal(canAssignDoctorToSlot("H", "2026-10-28", "Matin - EE2", "MERCREDI", s, []).allowed, true)

  // Un seul médecin partenaire par infirmière
  s["Matin - EE2"].MERCREDI = cell(["Val", "H"])
  const second = canAssignDoctorToSlot("Z", "2026-10-28", "Matin - EE2", "MERCREDI", s, [])
  assert.equal(second.allowed, false)
  assert.match(second.reason || "", /un seul médecin/)

  // Infirmière sur EE1 et EE2 : le même médecin sur les deux salles
  const t = generateWeekSchedule(wk, [])
  t["Apm - EE1"].LUNDI = cell(["Véro", "H"])
  t["Apm - EE2"].LUNDI = cell(["Véro"])
  assert.equal(canAssignDoctorToSlot("Z", "2026-10-26", "Apm - EE2", "LUNDI", t, []).allowed, false)
  assert.equal(canAssignDoctorToSlot("H", "2026-10-26", "Apm - EE2", "LUNDI", t, []).allowed, true)
  // Recopie automatique du médecin sur l'autre salle
  const m = mirrorEeDoctorForSharedNurse(t)
  assert.deepEqual(m["Apm - EE2"].LUNDI.value, ["Véro", "H"])

  // Propositions : un médecin (hors O/V/DAAS) seul en EE est écarté ; O reste possible
  const p = generateWeekSchedule(wk, [])
  p["Matin - EE2"].MARDI = cell(["H"], "pending")
  p["Apm - EE2"].MARDI = cell(["O"], "pending")
  const rej: { row: string; doctor: string }[] = []
  const out = applyClinicalPriorityRules(p, wk, [], rej as never)
  assert.ok(!(out["Matin - EE2"].MARDI.value.includes("H")), "H seul en EE refusé")
  assert.ok(rej.some((r) => r.row === "Matin - EE2" && r.doctor === "H"))
  for (const row of ["Matin - EE1", "Matin - EE2", "Apm - EE1", "Apm - EE2"]) {
    for (const day of ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI"]) {
      const v = out[row][day].value
      const hasNurse = v.some((d) => ["Val", "Véro", "Laura"].includes(d))
      for (const d of v) {
        if (["Val", "Véro", "Laura"].includes(d)) continue
        assert.ok(hasNurse || ["O", "V", "DAAS", "T"].includes(d), `${row} ${day}: ${d} seul en EE`)
      }
    }
  }

  console.log("✅ ee-binome tests passed")
}

main()
