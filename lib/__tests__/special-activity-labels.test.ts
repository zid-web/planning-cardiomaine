/**
 * Run: bunx tsx lib/__tests__/special-activity-labels.test.ts
 */
import assert from "node:assert/strict"
import {
  appendSpecialDoctorLabel,
  getSpecialActivityDisplayName,
  getSpecialActivityDisplayNameForDoctors,
  getSpecialLabel,
  isEttPedWithGardeOrAtlMidi,
} from "@/lib/special-activity-labels"
import {
  applySlotBlockingStrips,
  areCompatibleSamePeriod,
  formatDoctorWithDoublon,
} from "@/lib/slot-blocking"
import { generateWeekSchedule } from "@/lib/schedule-utils"

function main() {
  assert.equal(getSpecialLabel("Apm - ETT salle 1", "MERCREDI", "S"), "ped")
  assert.equal(getSpecialLabel("Apm - ETT salle 1", "MERCREDI", "O"), null)
  assert.equal(getSpecialLabel("Apm - ETT salle 1", "LUNDI", "S"), null)
  assert.equal(getSpecialLabel("Apm - Cs PSS", "MARDI", "A"), "PM")
  assert.equal(getSpecialLabel("Apm - Cs PSS", "LUNDI", "P"), "PM")
  assert.equal(getSpecialLabel("Apm - Cs PSS", "MARDI", "P"), null)
  assert.equal(getSpecialLabel("Matin - Cs PSS", "LUNDI", "P"), null)

  assert.equal(
    getSpecialActivityDisplayName("Apm - ETT salle 1", "MERCREDI", "S"),
    "ETT pédiatrique",
  )
  assert.equal(getSpecialActivityDisplayName("Apm - Cs PSS", "MARDI", "A"), "Contrôle PM")
  assert.equal(getSpecialActivityDisplayName("Apm - Cs PSS", "LUNDI", "P"), "Contrôle PM")
  assert.equal(
    getSpecialActivityDisplayNameForDoctors("Apm - Cs PSS", "LUNDI", ["O", "P"]),
    "Contrôle PM",
  )

  assert.equal(appendSpecialDoctorLabel("S", "Apm - ETT salle 1", "MERCREDI", "S"), "S (ped)")
  assert.equal(appendSpecialDoctorLabel("S²", "Apm - ETT salle 1", "MERCREDI", "S"), "S² (ped)")
  assert.equal(appendSpecialDoctorLabel("A", "Apm - Cs PSS", "MARDI", "A"), "A (PM)")
  assert.equal(appendSpecialDoctorLabel("P", "Apm - Cs PSS", "LUNDI", "P"), "P (PM)")
  assert.equal(appendSpecialDoctorLabel("A", "Apm - Cs PSS", "LUNDI", "A"), "A")

  // Badge grid : formatDoctorWithDoublon compose doublon + étiquette
  let schedule = generateWeekSchedule("2026-W30", [])
  schedule["Apm - ETT salle 1"].MERCREDI = {
    value: ["S"],
    type: "doctor",
    status: "validated",
  }
  assert.equal(
    formatDoctorWithDoublon(schedule, "MERCREDI", "S", "Apm - ETT salle 1"),
    "S (ped)",
  )
  schedule["Apm - Cs PSS"].MARDI = { value: ["A"], type: "doctor", status: "validated" }
  assert.equal(formatDoctorWithDoublon(schedule, "MARDI", "A", "Apm - Cs PSS"), "A (PM)")
  schedule["Apm - Cs PSS"].LUNDI = { value: ["P"], type: "doctor", status: "validated" }
  assert.equal(formatDoctorWithDoublon(schedule, "LUNDI", "P", "Apm - Cs PSS"), "P (PM)")

  // S mercredi : ETT ped + Garde Midi / ATL Midi coexistent (affichage des deux)
  assert.equal(isEttPedWithGardeOrAtlMidi("Apm - ETT salle 1", "Garde Midi"), true)
  assert.equal(isEttPedWithGardeOrAtlMidi("Apm - ETT salle 1", "Astreintes ATL Midi"), true)
  assert.equal(isEttPedWithGardeOrAtlMidi("Apm - ETT salle 1", "Garde Matin"), false)

  const ctx = {
    schedule,
    day: "MERCREDI",
    doctorId: "S",
  }
  assert.equal(
    areCompatibleSamePeriod("Apm - ETT salle 1", "Garde Midi", ctx),
    true,
    "S mercredi ETT ped + Garde Midi",
  )
  assert.equal(
    areCompatibleSamePeriod("Apm - ETT salle 1", "Astreintes ATL Midi", ctx),
    true,
    "S mercredi ETT ped + ATL Midi",
  )
  assert.equal(
    areCompatibleSamePeriod("Apm - ETT salle 1", "Garde Midi", {
      ...ctx,
      day: "MARDI",
    }),
    false,
    "pas d’exception hors mercredi",
  )

  // Strips ne retirent pas l’ETT ped quand Garde Midi est aussi présente
  schedule["Apm - ETT salle 1"].MERCREDI = {
    value: ["S"],
    type: "doctor",
    status: "validated",
  }
  schedule["Garde Midi"].MERCREDI = {
    value: ["S"],
    type: "doctor",
    status: "validated",
  }
  const stripped = applySlotBlockingStrips(schedule)
  assert.ok(
    (stripped["Apm - ETT salle 1"].MERCREDI.value || []).includes("S"),
    "ETT ped conservé",
  )
  assert.ok((stripped["Garde Midi"].MERCREDI.value || []).includes("S"), "Garde Midi conservée")

  console.log("✅ special-activity-labels tests passed")
}

main()
