/**
 * Run: npx tsx lib/__tests__/clinical-rotation-diversity.test.ts
 */
import assert from "node:assert/strict"
import { applyClinicalRotationRules } from "@/lib/clinical-rotation-diversity"
import { generateWeekSchedule } from "@/lib/schedule-utils"
import { DOC022_CLINICAL_ELIGIBILITY } from "@/lib/group-clinical-rules"
import type { ScheduleData } from "@/lib/types"

function setCell(schedule: ScheduleData, row: string, day: string, doctor: string, status: "validated" | "pending") {
  schedule[row][day] = { value: [doctor], type: "doctor", status }
}

function main() {
  const weekKey = "2026-W40" // LUNDI 2026-09-28 → VENDREDI 2026-10-02

  // 1. Stress : répétition 2 jours consécutifs (pending) corrigée
  let schedule = generateWeekSchedule(weekKey)
  setCell(schedule, "Apm - Stress", "LUNDI", "H", "pending")
  setCell(schedule, "Apm - Stress", "MARDI", "H", "pending") // même médecin le lendemain
  let after = applyClinicalRotationRules(schedule, weekKey, [])
  assert.notEqual(
    after["Apm - Stress"].MARDI.value[0],
    "H",
    "Stress : H ne doit plus être reproposé le lendemain (pending)",
  )
  assert.ok(
    (DOC022_CLINICAL_ELIGIBILITY.stress as readonly string[]).includes(after["Apm - Stress"].MARDI.value[0]),
    "le remplaçant doit être éligible Stress",
  )

  // 2. Stress : une case VALIDÉE manuellement n'est jamais touchée, même en cas de répétition
  schedule = generateWeekSchedule(weekKey)
  setCell(schedule, "Apm - Stress", "LUNDI", "H", "pending")
  setCell(schedule, "Apm - Stress", "MARDI", "H", "validated") // saisie manuelle volontaire
  after = applyClinicalRotationRules(schedule, weekKey, [])
  assert.equal(
    after["Apm - Stress"].MARDI.value[0],
    "H",
    "case validée manuellement jamais modifiée, même si répétition",
  )

  // 3. Rééducation : jamais le même médecin sur les 3 créneaux Lun/Mer/Ven (pending)
  schedule = generateWeekSchedule(weekKey)
  setCell(schedule, "Apm - RÉEDUCATION", "LUNDI", "Z", "pending")
  setCell(schedule, "Apm - RÉEDUCATION", "MERCREDI", "Z", "pending") // répétition
  setCell(schedule, "Apm - RÉEDUCATION", "VENDREDI", "B", "pending")
  after = applyClinicalRotationRules(schedule, weekKey, [])
  assert.equal(after["Apm - RÉEDUCATION"].LUNDI.value[0], "Z")
  assert.notEqual(
    after["Apm - RÉEDUCATION"].MERCREDI.value[0],
    "Z",
    "Rééducation : Z ne doit pas réapparaître le mercredi",
  )
  assert.notEqual(
    after["Apm - RÉEDUCATION"].MERCREDI.value[0],
    "B",
    "le remplaçant du mercredi ne doit pas non plus dupliquer vendredi",
  )
  assert.equal(after["Apm - RÉEDUCATION"].VENDREDI.value[0], "B")

  // 4. Cs PSS : case vide remplie en priorité par un coro/rythmo/écho libre
  schedule = generateWeekSchedule(weekKey)
  // M (coro) n'est affecté nulle part ce jour-là → doit être proposé sur Cs PSS
  after = applyClinicalRotationRules(schedule, weekKey, [])
  const lundiCsPssApm = after["Apm - Cs PSS"].LUNDI.value[0]
  assert.ok(lundiCsPssApm, "Cs PSS lundi apm doit être rempli par défaut (personne d'autre occupé)")
  assert.ok(
    ["M", "O", "W", "P", "A", "H", "Z", "G"].includes(lundiCsPssApm),
    "le médecin proposé sur Cs PSS doit venir des groupes coro/rythmo/écho",
  )

  // 5. Cs PSS : U, B, S ne sont jamais proposés (exclusivement Cs Tessée)
  for (const day of ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI"]) {
    for (const row of ["Matin - Cs PSS", "Apm - Cs PSS"]) {
      const val = after[row][day]?.value?.[0]
      if (val) {
        assert.ok(!["U", "B", "S"].includes(val), `${val} ne doit jamais être sur ${row} ${day}`)
      }
    }
  }

  // 6. Cs PSS : un médecin déjà occupé en Coro ce jour-là n'est pas proposé sur Cs PSS ce même jour
  schedule = generateWeekSchedule(weekKey)
  setCell(schedule, "Apm - Coro", "JEUDI", "M", "validated")
  after = applyClinicalRotationRules(schedule, weekKey, [])
  assert.notEqual(
    after["Apm - Cs PSS"].JEUDI.value[0],
    "M",
    "M déjà en Coro jeudi apm ne doit pas être proposé sur Cs PSS jeudi apm",
  )

  console.log("✅ clinical-rotation-diversity tests passed")
}

main()
