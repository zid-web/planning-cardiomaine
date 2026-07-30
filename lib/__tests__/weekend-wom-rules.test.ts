/**
 * Run: bunx tsx lib/__tests__/weekend-wom-rules.test.ts
 */
import assert from "node:assert/strict"
import {
  applyFriSatAtlNightCoupling,
  applySaturdayGardeSingleDoctor,
  applyWeekendWomRules,
  isWomComboWeekend,
  proposeWeekendWomPattern,
} from "@/lib/weekend-wom-rules"
import { applyStructuralConstraints } from "@/lib/apply-structural-constraints"
import { generateWeekSchedule } from "@/lib/schedule-utils"

function main() {
  // Combo vs mono : ~10/13 semaines paires
  assert.equal(isWomComboWeekend("2026-W31"), false, "impaire = CH, pas combo WOM")
  assert.equal(isWomComboWeekend("2026-W32"), true, "W32 paire → combo (index 15%13=2 < 10)")
  // Even index 10,11,12 within block → mono
  // W22 → evenIndex=10 → mono
  assert.equal(isWomComboWeekend("2026-W22"), false, "W22 evenIndex 10 → mono")
  assert.equal(isWomComboWeekend("2026-W20"), true, "W20 evenIndex 9 → combo")

  const combo = proposeWeekendWomPattern("2026-W32")
  assert.ok(combo && combo.kind === "combo")
  if (combo?.kind === "combo") {
    assert.notEqual(combo.atlSat, combo.atlSun)
    assert.ok(["M", "O", "W"].includes(combo.atlSat))
    assert.ok(["M", "O", "W"].includes(combo.atlSun))
  }

  const mono = proposeWeekendWomPattern("2026-W22")
  assert.ok(mono && mono.kind === "mono")

  // Ven ATL Nuit ← Sam ATL Nuit
  let schedule = generateWeekSchedule("2026-W32", [])
  schedule["Astreintes ATL Nuit"].SAMEDI = {
    value: ["M"],
    type: "doctor",
    status: "validated",
  }
  schedule["Astreintes ATL Nuit"].VENDREDI = {
    value: [],
    type: "empty",
    status: "validated",
  }
  schedule = applyFriSatAtlNightCoupling(schedule)
  assert.deepEqual(schedule["Astreintes ATL Nuit"].VENDREDI.value, ["M"])

  // Override admin Ven ≠ Sam : ne pas écraser
  schedule["Astreintes ATL Nuit"].VENDREDI = {
    value: ["O"],
    type: "doctor",
    status: "validated",
  }
  schedule = applyFriSatAtlNightCoupling(schedule)
  assert.deepEqual(schedule["Astreintes ATL Nuit"].VENDREDI.value, ["O"])
  assert.deepEqual(schedule["Astreintes ATL Nuit"].SAMEDI.value, ["M"])

  // Garde Sam : Matin → Midi/Nuit
  schedule = generateWeekSchedule("2026-W32", [])
  schedule["Garde Matin"].SAMEDI = { value: ["W"], type: "doctor", status: "validated" }
  schedule["Garde Midi"].SAMEDI = { value: [], type: "empty", status: "validated" }
  schedule["Garde Nuit"].SAMEDI = { value: [], type: "empty", status: "validated" }
  schedule = applySaturdayGardeSingleDoctor(schedule)
  assert.deepEqual(schedule["Garde Midi"].SAMEDI.value, ["W"])
  assert.deepEqual(schedule["Garde Nuit"].SAMEDI.value, ["W"])

  // Combo inject sur week-end ATL vide (semaine paire)
  let empty = generateWeekSchedule("2026-W32", [])
  for (const row of [
    "Astreintes ATL Matin",
    "Astreintes ATL Midi",
    "Astreintes ATL Nuit",
  ]) {
    empty[row].SAMEDI = { value: [], type: "empty", status: "validated" }
    empty[row].DIMANCHE = { value: [], type: "empty", status: "validated" }
  }
  empty["Astreintes ATL Nuit"].VENDREDI = {
    value: [],
    type: "empty",
    status: "validated",
  }
  for (const row of ["Garde Matin", "Garde Midi", "Garde Nuit"]) {
    empty[row].SAMEDI = { value: [], type: "empty", status: "validated" }
    empty[row].DIMANCHE = { value: [], type: "empty", status: "validated" }
  }
  // Retirer CH éventuel (W32 paire — pas de CH weekend)
  empty = applyWeekendWomRules(empty, "2026-W32")
  const satAtl = empty["Astreintes ATL Nuit"].SAMEDI.value[0]
  const sunAtl = empty["Astreintes ATL Nuit"].DIMANCHE.value[0]
  assert.ok(satAtl && sunAtl && satAtl !== sunAtl, "combo : Sat≠Sun ATL")
  assert.deepEqual(empty["Astreintes ATL Nuit"].VENDREDI.value, [satAtl], "Ven=Sat ATL")
  assert.deepEqual(empty["Garde Matin"].SAMEDI.value, [sunAtl], "Garde Sam = Sun ATL")
  assert.deepEqual(empty["Garde Midi"].SAMEDI.value, [sunAtl])
  assert.deepEqual(empty["Garde Nuit"].SAMEDI.value, [sunAtl])
  assert.deepEqual(empty["Garde Matin"].DIMANCHE.value, [satAtl], "Garde Dim = Sat ATL")
  assert.deepEqual(empty["Garde Midi"].DIMANCHE.value, [satAtl])
  assert.deepEqual(empty["Garde Nuit"].DIMANCHE.value, [satAtl])

  // Mono : même ATL Sam+Dim, pas de garde forcée si déjà mono pattern
  let monoWeek = generateWeekSchedule("2026-W22", [])
  for (const row of [
    "Astreintes ATL Matin",
    "Astreintes ATL Midi",
    "Astreintes ATL Nuit",
  ]) {
    monoWeek[row].SAMEDI = { value: [], type: "empty", status: "validated" }
    monoWeek[row].DIMANCHE = { value: [], type: "empty", status: "validated" }
  }
  monoWeek["Astreintes ATL Nuit"].VENDREDI = {
    value: [],
    type: "empty",
    status: "validated",
  }
  for (const row of ["Garde Matin", "Garde Midi", "Garde Nuit"]) {
    monoWeek[row].SAMEDI = { value: [], type: "empty", status: "validated" }
    monoWeek[row].DIMANCHE = { value: [], type: "empty", status: "validated" }
  }
  monoWeek = applyWeekendWomRules(monoWeek, "2026-W22")
  const monoDoc = monoWeek["Astreintes ATL Nuit"].SAMEDI.value[0]
  assert.ok(monoDoc)
  assert.deepEqual(monoWeek["Astreintes ATL Nuit"].DIMANCHE.value, [monoDoc])
  assert.deepEqual(monoWeek["Astreintes ATL Matin"].SAMEDI.value, [monoDoc])
  assert.deepEqual(monoWeek["Astreintes ATL Nuit"].VENDREDI.value, [monoDoc])
  // Mono : ne remplit pas les gardes automatiquement
  assert.deepEqual(monoWeek["Garde Matin"].SAMEDI.value, [])
  assert.deepEqual(monoWeek["Garde Matin"].DIMANCHE.value, [])

  // Structural : override admin garde survit
  let override = generateWeekSchedule("2026-W32", [])
  override["Garde Matin"].SAMEDI = { value: ["A"], type: "doctor", status: "validated" }
  override["Garde Midi"].SAMEDI = { value: ["A"], type: "doctor", status: "validated" }
  override["Garde Nuit"].SAMEDI = { value: ["A"], type: "doctor", status: "validated" }
  override = applyStructuralConstraints(override, "2026-W32", [])
  assert.deepEqual(override["Garde Matin"].SAMEDI.value, ["A"])
  assert.deepEqual(override["Garde Midi"].SAMEDI.value, ["A"])
  assert.deepEqual(override["Garde Nuit"].SAMEDI.value, ["A"])

  console.log("✅ weekend-wom-rules tests passed")
}

main()
