/**
 * Run: bunx tsx lib/__tests__/weekend-wom-rules.test.ts
 */
import assert from "node:assert/strict"
import {
  applyFriSatAtlNightCoupling,
  applySaturdayGardeSingleDoctor,
  applyWeekendComboCrossCoupling,
  applyWeekendWomRules,
  isWomComboWeekend,
  listWomComboWeekKeys,
  proposeWeekendWomPattern,
  WOM_COMBO_PER_HALF_YEAR,
} from "@/lib/weekend-wom-rules"
import { applyStructuralConstraints } from "@/lib/apply-structural-constraints"
import { generateWeekSchedule } from "@/lib/schedule-utils"

/** Combo prédéfini 2026 H1 (index 7) */
const COMBO_WEEK = "2026-W16"
/** Mono 2026 H1 (index 9 — hors liste des 5) */
const MONO_WEEK = "2026-W20"

function clearWeekendAtlAndGarde(schedule: ReturnType<typeof generateWeekSchedule>) {
  for (const row of [
    "Astreintes ATL Matin",
    "Astreintes ATL Midi",
    "Astreintes ATL Nuit",
  ]) {
    schedule[row].SAMEDI = { value: [], type: "empty", status: "validated" }
    schedule[row].DIMANCHE = { value: [], type: "empty", status: "validated" }
  }
  schedule["Astreintes ATL Nuit"].VENDREDI = {
    value: [],
    type: "empty",
    status: "validated",
  }
  for (const row of ["Garde Matin", "Garde Midi", "Garde Nuit"]) {
    schedule[row].SAMEDI = { value: [], type: "empty", status: "validated" }
    schedule[row].DIMANCHE = { value: [], type: "empty", status: "validated" }
  }
  return schedule
}

function main() {
  // Exactement 5 combos / semestre (10 / an)
  assert.equal(WOM_COMBO_PER_HALF_YEAR, 5)
  const combo2026 = listWomComboWeekKeys(2026)
  assert.equal(combo2026.length, 10, "5 × 2 semestres")
  assert.deepEqual(combo2026.slice(0, 5), [
    "2026-W04",
    "2026-W10",
    "2026-W16",
    "2026-W22",
    "2026-W26",
  ])
  assert.deepEqual(combo2026.slice(5), [
    "2026-W30",
    "2026-W36",
    "2026-W42",
    "2026-W48",
    "2026-W52",
  ])

  assert.equal(isWomComboWeekend("2026-W31"), false, "impaire = CH, pas combo WOM")
  assert.equal(isWomComboWeekend(COMBO_WEEK), true, "W16 = combo prédéfini")
  assert.equal(isWomComboWeekend("2026-W22"), true, "W22 = combo prédéfini")
  assert.equal(isWomComboWeekend(MONO_WEEK), false, "W20 hors liste → mono")
  assert.equal(isWomComboWeekend("2026-W32"), false, "W32 index 2 hors liste → mono")
  assert.equal(isWomComboWeekend("2026-W04"), true)

  const combo = proposeWeekendWomPattern(COMBO_WEEK)
  assert.ok(combo && combo.kind === "combo")
  if (combo?.kind === "combo") {
    assert.notEqual(combo.atlSat, combo.atlSun)
    assert.ok(["M", "O", "W"].includes(combo.atlSat))
    assert.ok(["M", "O", "W"].includes(combo.atlSun))
  }

  const mono = proposeWeekendWomPattern(MONO_WEEK)
  assert.ok(mono && mono.kind === "mono")

  // Ven ATL Nuit ← Sam ATL Nuit
  let schedule = generateWeekSchedule(COMBO_WEEK, [])
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
  schedule = generateWeekSchedule(COMBO_WEEK, [])
  schedule["Garde Matin"].SAMEDI = { value: ["W"], type: "doctor", status: "validated" }
  schedule["Garde Midi"].SAMEDI = { value: [], type: "empty", status: "validated" }
  schedule["Garde Nuit"].SAMEDI = { value: [], type: "empty", status: "validated" }
  schedule = applySaturdayGardeSingleDoctor(schedule)
  assert.deepEqual(schedule["Garde Midi"].SAMEDI.value, ["W"])
  assert.deepEqual(schedule["Garde Nuit"].SAMEDI.value, ["W"])

  // Combo inject sur week-end ATL vide (semaine combo prédéfinie)
  let empty = clearWeekendAtlAndGarde(generateWeekSchedule(COMBO_WEEK, []))
  empty = applyWeekendWomRules(empty, COMBO_WEEK)
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

  // Combo croisement soft : Sat ATL=A + Garde Sam=B → Dim Garde=A, Sun ATL=B
  let cross = clearWeekendAtlAndGarde(generateWeekSchedule(COMBO_WEEK, []))
  for (const row of [
    "Astreintes ATL Matin",
    "Astreintes ATL Midi",
    "Astreintes ATL Nuit",
  ]) {
    cross[row].SAMEDI = { value: ["M"], type: "doctor", status: "validated" }
  }
  for (const row of ["Garde Matin", "Garde Midi", "Garde Nuit"]) {
    cross[row].SAMEDI = { value: ["W"], type: "doctor", status: "validated" }
  }
  cross = applyWeekendWomRules(cross, COMBO_WEEK)
  assert.deepEqual(cross["Astreintes ATL Nuit"].VENDREDI.value, ["M"], "Ven ATL = Sat ATL")
  assert.deepEqual(cross["Astreintes ATL Matin"].DIMANCHE.value, ["W"], "Sun ATL = Garde Sam")
  assert.deepEqual(cross["Astreintes ATL Midi"].DIMANCHE.value, ["W"])
  assert.deepEqual(cross["Astreintes ATL Nuit"].DIMANCHE.value, ["W"])
  assert.deepEqual(cross["Garde Matin"].DIMANCHE.value, ["M"], "Garde Dim = Sat ATL")
  assert.deepEqual(cross["Garde Midi"].DIMANCHE.value, ["M"])
  assert.deepEqual(cross["Garde Nuit"].DIMANCHE.value, ["M"])
  assert.deepEqual(cross["Garde Matin"].SAMEDI.value, ["W"])
  assert.deepEqual(cross["Astreintes ATL Matin"].SAMEDI.value, ["M"])

  // applyWeekendComboCrossCoupling seul sur combo
  let softOnly = clearWeekendAtlAndGarde(generateWeekSchedule(COMBO_WEEK, []))
  softOnly["Astreintes ATL Matin"].SAMEDI = { value: ["O"], type: "doctor", status: "validated" }
  softOnly["Astreintes ATL Midi"].SAMEDI = { value: ["O"], type: "doctor", status: "validated" }
  softOnly["Astreintes ATL Nuit"].SAMEDI = { value: ["O"], type: "doctor", status: "validated" }
  softOnly["Garde Midi"].SAMEDI = { value: ["M"], type: "doctor", status: "validated" }
  softOnly = applyWeekendComboCrossCoupling(softOnly, COMBO_WEEK)
  assert.deepEqual(softOnly["Garde Matin"].DIMANCHE.value, ["O"])
  assert.deepEqual(softOnly["Garde Midi"].DIMANCHE.value, ["O"])
  assert.deepEqual(softOnly["Garde Nuit"].DIMANCHE.value, ["O"])
  assert.deepEqual(softOnly["Astreintes ATL Matin"].DIMANCHE.value, ["M"])
  assert.deepEqual(softOnly["Astreintes ATL Nuit"].VENDREDI.value, ["O"])

  // Mono : pas de croisement combo même si Sat ATL ≠ Garde Sam
  let monoCross = clearWeekendAtlAndGarde(generateWeekSchedule(MONO_WEEK, []))
  for (const row of [
    "Astreintes ATL Matin",
    "Astreintes ATL Midi",
    "Astreintes ATL Nuit",
  ]) {
    monoCross[row].SAMEDI = { value: ["M"], type: "doctor", status: "validated" }
  }
  for (const row of ["Garde Matin", "Garde Midi", "Garde Nuit"]) {
    monoCross[row].SAMEDI = { value: ["W"], type: "doctor", status: "validated" }
  }
  monoCross = applyWeekendComboCrossCoupling(monoCross, MONO_WEEK)
  assert.deepEqual(monoCross["Garde Matin"].DIMANCHE.value, [], "mono : pas de croisement")
  assert.deepEqual(monoCross["Astreintes ATL Matin"].DIMANCHE.value, [])

  // Mono Sat≠Sun manuel : ne force PAS le pattern combo (gardes restent vides)
  let monoManual = clearWeekendAtlAndGarde(generateWeekSchedule(MONO_WEEK, []))
  for (const row of [
    "Astreintes ATL Matin",
    "Astreintes ATL Midi",
    "Astreintes ATL Nuit",
  ]) {
    monoManual[row].SAMEDI = { value: ["M"], type: "doctor", status: "validated" }
    monoManual[row].DIMANCHE = { value: ["W"], type: "doctor", status: "validated" }
  }
  monoManual = applyWeekendWomRules(monoManual, MONO_WEEK)
  assert.deepEqual(monoManual["Astreintes ATL Matin"].SAMEDI.value, ["M"], "manuel Sat conservé")
  assert.deepEqual(monoManual["Astreintes ATL Matin"].DIMANCHE.value, ["W"], "manuel Dim conservé")
  assert.deepEqual(monoManual["Garde Matin"].SAMEDI.value, [], "mono : pas de Garde Sam forcée")
  assert.deepEqual(monoManual["Garde Matin"].DIMANCHE.value, [], "mono : pas de Garde Dim forcée")

  // Mono : même ATL Sam+Dim, pas de garde forcée
  let monoWeek = clearWeekendAtlAndGarde(generateWeekSchedule(MONO_WEEK, []))
  monoWeek = applyWeekendWomRules(monoWeek, MONO_WEEK)
  const monoDoc = monoWeek["Astreintes ATL Nuit"].SAMEDI.value[0]
  assert.ok(monoDoc)
  assert.deepEqual(monoWeek["Astreintes ATL Nuit"].DIMANCHE.value, [monoDoc])
  assert.deepEqual(monoWeek["Astreintes ATL Matin"].SAMEDI.value, [monoDoc])
  assert.deepEqual(monoWeek["Astreintes ATL Nuit"].VENDREDI.value, [monoDoc])
  assert.deepEqual(monoWeek["Garde Matin"].SAMEDI.value, [])
  assert.deepEqual(monoWeek["Garde Matin"].DIMANCHE.value, [])

  // Structural : override admin garde survit (combo week)
  let override = generateWeekSchedule(COMBO_WEEK, [])
  override["Garde Matin"].SAMEDI = { value: ["A"], type: "doctor", status: "validated" }
  override["Garde Midi"].SAMEDI = { value: ["A"], type: "doctor", status: "validated" }
  override["Garde Nuit"].SAMEDI = { value: ["A"], type: "doctor", status: "validated" }
  override = applyStructuralConstraints(override, COMBO_WEEK, [])
  assert.deepEqual(override["Garde Matin"].SAMEDI.value, ["A"])
  assert.deepEqual(override["Garde Midi"].SAMEDI.value, ["A"])
  assert.deepEqual(override["Garde Nuit"].SAMEDI.value, ["A"])

  console.log("✅ weekend-wom-rules tests passed")
}

main()
