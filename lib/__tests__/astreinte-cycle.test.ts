/**
 * Run: bunx tsx lib/__tests__/astreinte-cycle.test.ts
 */
import assert from "node:assert/strict"
import {
  astreinteWeekTypeForWeek,
  chNightWeekdaysForWeek,
  isChAstreinteWeek,
  isWomAstreinteWeek,
  listWomAstreinteWeekKeys,
  womWeekIndexInHalfYear,
} from "@/lib/astreinte-cycle"
import {
  applyChAstreinteConstraints,
  applyStructuralConstraints,
} from "@/lib/apply-structural-constraints"
import { generateAstreinteRotation } from "@/lib/guard-scheduler"
import { generateWeekSchedule } from "@/lib/schedule-utils"
import {
  isWomComboWeekend,
  listWomComboWeekKeys,
  proposeWeekendWomPattern,
} from "@/lib/weekend-wom-rules"
import type { ScheduleData } from "@/lib/types"

const ATL_NUIT = "Astreintes ATL Nuit"
const ATL_ROWS = ["Astreintes ATL Matin", "Astreintes ATL Midi", "Astreintes ATL Nuit"]

function chNights(s: ScheduleData): string[] {
  return ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI"].filter((d) =>
    (s[ATL_NUIT]?.[d]?.value || []).includes("CH"),
  )
}

function chOnWeekend(s: ScheduleData): boolean {
  return ["SAMEDI", "DIMANCHE"].every((d) =>
    ATL_ROWS.every((r) => (s[r]?.[d]?.value || []).includes("CH")),
  )
}

function main() {
  // --- Calendrier ---
  // 2026 inchangé : paire = WOM, impaire = CH
  assert.equal(isWomAstreinteWeek("2026-W40"), true)
  assert.equal(isWomAstreinteWeek("2026-W41"), false)
  assert.equal(isWomAstreinteWeek("2026-W52"), true)
  assert.equal(isChAstreinteWeek("2026-W53"), true)
  // 2027 inversé : S1 = WOM (W/O/M Lun/Mar + Ven/Sam/Dim, CH Mer/Jeu)
  assert.equal(isWomAstreinteWeek("2027-W01"), true)
  assert.equal(isChAstreinteWeek("2027-W02"), true)
  assert.equal(isWomAstreinteWeek("2027-W03"), true)
  assert.equal(isWomAstreinteWeek("2027-W52"), false)
  assert.equal(isWomAstreinteWeek("2028-W01"), true)
  // Année à 53 semaines (2032) : l'alternance continue sans doublon
  assert.notEqual(isWomAstreinteWeek("2032-W53"), isWomAstreinteWeek("2033-W01"))
  assert.notEqual(isWomAstreinteWeek("2032-W52"), isWomAstreinteWeek("2032-W53"))

  assert.deepEqual([...chNightWeekdaysForWeek("2027-W01")].sort(), ["JEUDI", "MERCREDI"])
  assert.deepEqual(
    [...chNightWeekdaysForWeek("2027-W02")].sort(),
    ["LUNDI", "MARDI", "VENDREDI"],
  )
  assert.equal(astreinteWeekTypeForWeek("2026-W40"), 2)
  assert.equal(astreinteWeekTypeForWeek("2026-W41"), 1)
  assert.equal(astreinteWeekTypeForWeek("2027-W01"), 2)
  assert.equal(astreinteWeekTypeForWeek("2027-W02"), 1)

  // Semestres : 13 semaines WOM par semestre (2026 et 2027)
  assert.equal(listWomAstreinteWeekKeys(2026).length, 26)
  assert.equal(listWomAstreinteWeekKeys(2027).length, 26)
  assert.equal(womWeekIndexInHalfYear("2026-W02"), 0)
  assert.equal(womWeekIndexInHalfYear("2026-W28"), 0)
  assert.equal(womWeekIndexInHalfYear("2027-W01"), 0)
  assert.equal(womWeekIndexInHalfYear("2027-W25"), 12)
  assert.equal(womWeekIndexInHalfYear("2027-W27"), 0)
  assert.equal(womWeekIndexInHalfYear("2027-W02"), null)

  // --- Week-end WOM 2027 : semaines impaires ---
  const combos2027 = listWomComboWeekKeys(2027)
  assert.equal(combos2027.length, 10)
  for (const k of combos2027) assert.equal(isWomAstreinteWeek(k), true, k)
  assert.ok(proposeWeekendWomPattern("2027-W01"))
  assert.equal(proposeWeekendWomPattern("2027-W02"), null)
  assert.equal(isWomComboWeekend("2027-W02"), false)

  // --- Contraintes structurelles 2027 ---
  const w01 = applyStructuralConstraints(generateWeekSchedule("2027-W01", []), "2027-W01", [])
  assert.deepEqual(chNights(w01), ["MERCREDI", "JEUDI"])
  assert.equal(
    ["SAMEDI", "DIMANCHE"].some((d) =>
      ATL_ROWS.some((r) => (w01[r]?.[d]?.value || []).includes("CH")),
    ),
    false,
    "pas de CH le week-end d'une semaine WOM",
  )

  const w02 = applyStructuralConstraints(generateWeekSchedule("2027-W02", []), "2027-W02", [])
  assert.deepEqual(chNights(w02), ["LUNDI", "MARDI", "VENDREDI"])
  assert.equal(chOnWeekend(w02), true)

  // 2026 inchangé
  const w41 = applyStructuralConstraints(generateWeekSchedule("2026-W41", []), "2026-W41", [])
  assert.deepEqual(chNights(w41), ["LUNDI", "MARDI", "VENDREDI"])

  // --- Échange manuel CH ↔ W (S1 2027) : conservé ---
  const swap = structuredClone(w01)
  swap[ATL_NUIT].MERCREDI = {
    value: ["W"],
    type: "doctor",
    status: "validated",
    manualAssignment: true,
  }
  swap[ATL_NUIT].LUNDI = {
    value: ["CH"],
    type: "doctor",
    status: "validated",
    manualAssignment: true,
  }
  const swapped = applyStructuralConstraints(swap, "2027-W01", [])
  assert.deepEqual(swapped[ATL_NUIT].MERCREDI.value, ["W"])
  assert.deepEqual(swapped[ATL_NUIT].LUNDI.value, ["CH"])
  assert.deepEqual(swapped[ATL_NUIT].JEUDI.value, ["CH"])

  // Week-end d'une semaine CH repris par W à la main : conservé
  const weSwap = structuredClone(w02)
  weSwap["Astreintes ATL Nuit"].SAMEDI = {
    value: ["O"],
    type: "doctor",
    status: "validated",
    manualAssignment: true,
  }
  const weSwapped = applyChAstreinteConstraints(weSwap, "2027-W02")
  assert.deepEqual(weSwapped["Astreintes ATL Nuit"].SAMEDI.value, ["O"])

  // Case vidée par l'admin : pas de CH réinjecté
  const cleared = structuredClone(w01)
  cleared[ATL_NUIT].JEUDI = {
    value: [],
    type: "empty",
    status: "validated",
    manuallyCleared: true,
  }
  assert.deepEqual(applyChAstreinteConstraints(cleared, "2027-W01")[ATL_NUIT].JEUDI.value, [])

  // --- Données héritées / solveur non aligné ---
  const legacy = structuredClone(w01)
  // CH posé par l'ancien roulement (sans saisie admin) → retiré
  legacy[ATL_NUIT].LUNDI = { value: ["CH"], type: "doctor", status: "validated" }
  // Proposition solveur W sur une nuit CH → CH ajouté, proposition gardée
  legacy[ATL_NUIT].MERCREDI = { value: ["W"], type: "doctor", status: "pending" }
  const fixed = applyChAstreinteConstraints(legacy, "2027-W01")
  assert.deepEqual(fixed[ATL_NUIT].LUNDI.value, [])
  assert.deepEqual(fixed[ATL_NUIT].MERCREDI.value, ["W", "CH"])
  assert.equal(fixed[ATL_NUIT].MERCREDI.status, "pending")

  // CH jamais en Garde, même saisi à la main
  const garde = structuredClone(w01)
  garde["Garde Nuit"].MERCREDI = {
    value: ["CH"],
    type: "doctor",
    status: "validated",
    manualAssignment: true,
  }
  assert.ok(
    !applyChAstreinteConstraints(garde, "2027-W01")["Garde Nuit"].MERCREDI.value.includes("CH"),
  )

  // --- Rotation de référence ---
  const rot = generateAstreinteRotation(1, 2027, 2, 2027)
  assert.equal(rot[0].wednesday, "CH")
  assert.equal(rot[0].thursday, "CH")
  assert.notEqual(rot[0].monday, "CH")
  assert.notEqual(rot[0].saturday1, "CH")
  assert.equal(rot[1].monday, "CH")
  assert.equal(rot[1].saturday1, "CH")

  console.log("✅ astreinte-cycle tests passed")
}

main()
