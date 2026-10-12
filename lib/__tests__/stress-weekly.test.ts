/**
 * Run: bunx tsx lib/__tests__/stress-weekly.test.ts
 * Stress : un médecin une seule fois par semaine (roulement) quand il y a assez de médecins disponibles.
 */
import assert from "node:assert/strict"
import { applyClinicalPriorityRules } from "@/lib/clinical-priority"
import { applyClinicalRotationRules } from "@/lib/clinical-rotation-diversity"
import { stressRepeatWarning, doctorsOnStress } from "@/lib/stress-weekly"
import { generateWeekSchedule } from "@/lib/schedule-utils"
import { applyStructuralConstraints } from "@/lib/apply-structural-constraints"
import type { DoctorVacation } from "@/lib/types"

const wk = "2026-W44" // lundi 26/10/2026
const prop = (value: string[]) => ({ value, type: "doctor" as const, status: "pending" as const })
const stressDoctors = (s: ReturnType<typeof generateWeekSchedule>) => {
  const list: string[] = []
  for (const row of ["Matin - Stress", "Apm - Stress"])
    for (const day of ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI"])
      for (const d of s[row][day].value) if (!["Val", "Véro", "Laura"].includes(d)) list.push(d)
  return list
}

function main() {
  // Le solveur répète H trois fois au Stress : remplacé tant qu'il y a des médecins disponibles
  const s = applyStructuralConstraints(generateWeekSchedule(wk, []), wk, []) // D tient le Stress du jeudi
  s["Matin - Stress"].LUNDI = prop(["H"])
  s["Apm - Stress"].LUNDI = prop(["H"])
  s["Matin - Stress"].MARDI = prop(["H"])
  const out = applyClinicalRotationRules(s, wk, [])
  const docs = stressDoctors(out).filter((d) => d !== "D")
  assert.equal(new Set(docs).size, docs.length, `aucun médecin deux fois au Stress : ${docs.join(",")}`)
  assert.ok(docs.length >= 3)

  // Cases validées / manuelles intactes, et elles comptent dans le roulement
  const m = generateWeekSchedule(wk, [])
  m["Matin - Stress"].LUNDI = { value: ["H"], type: "doctor", status: "validated", manualAssignment: true }
  m["Apm - Stress"].MARDI = prop(["H"])
  const om = applyClinicalPriorityRules(m, wk, [])
  assert.deepEqual(om["Matin - Stress"].LUNDI.value, ["H"])
  assert.ok(!om["Apm - Stress"].MARDI.value.includes("H"), "H déjà au Stress (saisie manuelle) : remplacé")

  // Pas assez de médecins disponibles (tous les autres éligibles en congés) : répétition tolérée
  const others = ["A", "B", "Z", "K", "G", "S"]
  const vacations: DoctorVacation[] = others.map((id) => ({
    id: `v-${id}`, doctor_id: id, start_date: "2026-10-26", end_date: "2026-10-30", reason: "congé",
  })) as DoctorVacation[]
  const t = generateWeekSchedule(wk, vacations)
  t["Matin - Stress"].LUNDI = prop(["H"])
  t["Apm - Stress"].LUNDI = prop(["H"])
  const ot = applyClinicalPriorityRules(t, wk, vacations)
  assert.ok(doctorsOnStress(ot).has("H"))
  assert.ok(
    ["Matin - Stress", "Apm - Stress"].every((r) => ot[r].LUNDI.value.length === 0 || ot[r].LUNDI.value.includes("H")),
    "répétition tolérée faute de remplaçant disponible",
  )

  // Avertissement à la saisie manuelle : seulement s'il existe un autre médecin disponible
  const w = generateWeekSchedule(wk, [])
  w["Matin - Stress"].LUNDI = { value: ["H"], type: "doctor", status: "validated" }
  const warn = stressRepeatWarning(w, wk, "Apm - Stress", "MARDI", "H", [])
  assert.match(warn || "", /déjà au Stress cette semaine/)
  assert.equal(stressRepeatWarning(w, wk, "Apm - Stress", "MARDI", "Z", []), null)
  assert.equal(stressRepeatWarning(w, wk, "Matin - Cs PSS", "MARDI", "H", []), null)
  const w2 = generateWeekSchedule(wk, vacations)
  w2["Matin - Stress"].LUNDI = { value: ["H"], type: "doctor", status: "validated" }
  assert.equal(stressRepeatWarning(w2, wk, "Apm - Stress", "MARDI", "H", vacations), null, "pas assez de médecins : pas d'alerte")

  // Pré-op : un médecin différent chaque jour
  const po = applyStructuralConstraints(generateWeekSchedule(wk, []), wk, [])
  for (const d of ["LUNDI", "MARDI", "MERCREDI"]) po["Pré-op"][d] = prop(["A"])
  const opOut = applyClinicalRotationRules(po, wk, [])
  const opDocs = ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI"].flatMap((d) => opOut["Pré-op"][d].value)
  assert.ok(opDocs.length >= 4, `Pré-op rempli : ${opDocs.join(",")}`)
  assert.equal(new Set(opDocs).size, opDocs.length, `Pré-op : médecins tous différents (${opDocs.join(",")})`)
  // Une Pré-op saisie à la main n'est jamais déplacée et compte dans la rotation
  const pm = generateWeekSchedule(wk, [])
  pm["Pré-op"].LUNDI = { value: ["A"], type: "doctor", status: "validated", manualAssignment: true }
  pm["Pré-op"].MARDI = prop(["A"])
  const opm = applyClinicalPriorityRules(pm, wk, [])
  assert.deepEqual(opm["Pré-op"].LUNDI.value, ["A"])
  assert.ok(!opm["Pré-op"].MARDI.value.includes("A"))

  // Idempotent
  const again = applyClinicalPriorityRules(opOut, wk, [])
  assert.deepEqual(JSON.stringify(again["Pré-op"]), JSON.stringify(opOut["Pré-op"]))

  console.log("✅ stress-weekly tests passed")
}

main()
