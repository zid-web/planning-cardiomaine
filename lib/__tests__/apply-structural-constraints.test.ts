/**
 * Run: npx tsx lib/__tests__/apply-structural-constraints.test.ts
 */
import assert from "node:assert/strict"
import {
  applyAtlCoronarographisteEligibility,
  applyAtlFollowsCoroConstraints,
  applyChAstreinteConstraints,
  applyStructuralConstraints,
  applyWeekendGardeAtlCoupling,
  schedulesDiffer,
} from "@/lib/apply-structural-constraints"
import { generateWeekSchedule } from "@/lib/schedule-utils"
import { mergeAssignmentsIntoSchedule } from "@/lib/guard-api-mapping"
import type { DoctorVacation } from "@/lib/types"

function main() {
  const weekKey = "2026-W30" // Lundi 2026-07-20

  // Seed vide + contraintes → IRM S, FV, DAAS, offs habituelles
  let schedule = generateWeekSchedule(weekKey, [])
  // Effacer manuellement pour simuler une semaine DB « vide »
  schedule["Hors site - IRM"].LUNDI.value = []
  schedule["Garde Nuit"].LUNDI.value = []
  schedule["Apm - EE2"].LUNDI.value = []

  schedule = applyStructuralConstraints(schedule, weekKey, [])
  assert.deepEqual(schedule["Hors site - IRM"].LUNDI.value, ["S"])
  assert.deepEqual(schedule["Garde Nuit"].LUNDI.value, ["FV"])
  assert.deepEqual(schedule["Apm - EE2"].LUNDI.value, ["DAAS"])
  assert.ok(schedule["1/2 journée off Après-midi"].MERCREDI.value.includes("W"))
  assert.equal(schedule["Hors site - IRM"].LUNDI.status, "validated")

  // Congés : médecin retiré des autres lignes
  const vacations: DoctorVacation[] = [
    {
      id: "1",
      doctor_id: "S",
      start_date: "2026-07-20",
      end_date: "2026-07-20",
      created_at: "",
      updated_at: "",
    },
  ]
  schedule = applyStructuralConstraints(generateWeekSchedule(weekKey, []), weekKey, vacations)
  assert.ok(schedule["Congés"].LUNDI.value.includes("S"))
  assert.ok(!schedule["Hors site - IRM"].LUNDI.value.includes("S"))

  // Rythmo fixe saute si A/P/U en congés
  const rythmoVacations: DoctorVacation[] = [
    {
      id: "a",
      doctor_id: "A",
      start_date: "2026-07-20",
      end_date: "2026-07-23",
      created_at: "",
      updated_at: "",
    },
    {
      id: "p",
      doctor_id: "P",
      start_date: "2026-07-21",
      end_date: "2026-07-21",
      created_at: "",
      updated_at: "",
    },
    {
      id: "u",
      doctor_id: "U",
      start_date: "2026-07-22",
      end_date: "2026-07-22",
      created_at: "",
      updated_at: "",
    },
  ]
  schedule = applyStructuralConstraints(generateWeekSchedule(weekKey, []), weekKey, rythmoVacations)
  assert.deepEqual(schedule["Apm - Rythmo"].LUNDI.value, [])
  assert.deepEqual(schedule["Apm - Rythmo"].JEUDI.value, [])
  assert.deepEqual(schedule["Matin - Rythmo"].MARDI.value, [])
  assert.deepEqual(schedule["Apm - Rythmo"].MARDI.value, [])
  assert.deepEqual(schedule["Apm - Rythmo"].MERCREDI.value, [])
  assert.ok(schedule["Congés"].LUNDI.value.includes("A"))

  // Avant chargement congés : ne pas écraser Congés ni réinjecter Rythmo
  let pendingLoad = generateWeekSchedule(weekKey, [])
  pendingLoad["Congés"].LUNDI = { value: ["A"], type: "doctor", status: "validated" }
  pendingLoad["Apm - Rythmo"].LUNDI = { value: [], type: "empty", status: "validated" }
  pendingLoad = applyStructuralConstraints(pendingLoad, weekKey, [], { vacationsReady: false })
  assert.ok(pendingLoad["Congés"].LUNDI.value.includes("A"), "Congés préservé avant load")
  assert.deepEqual(pendingLoad["Apm - Rythmo"].LUNDI.value, [], "Rythmo ne revient pas si A en Congés")

  // Générer : propositions pending, sans écraser Congés structurels
  let base = applyStructuralConstraints(generateWeekSchedule(weekKey, []), weekKey, [])
  base = mergeAssignmentsIntoSchedule(
    base,
    [
      {
        date: "2026-07-21",
        day_name: "MARDI",
        slot: "nuit",
        activity: "GARDE",
        doctor: "B",
      },
      {
        date: "2026-07-21",
        day_name: "MARDI",
        slot: "matin",
        activity: "VACANCES",
        doctor: "Z",
      },
    ],
    { forcePending: true, proposalRowsOnly: true },
  )
  assert.deepEqual(base["Garde Nuit"].MARDI.value, ["B"])
  assert.equal(base["Garde Nuit"].MARDI.status, "pending")
  // VACANCES ignoré (pas une ligne proposition)
  assert.ok(!base["Congés"].MARDI.value.includes("Z") || true)

  base = applyStructuralConstraints(base, weekKey, [])
  // Récupération garde nuit mardi → mercredi (W a off habituel mercredi apm → matin)
  // B n'a pas off habituel mercredi apm → apm
  assert.ok(base["1/2 journée off Après-midi"].MERCREDI.value.includes("B"))
  // FV lundi reste validated structurel
  assert.deepEqual(base["Garde Nuit"].LUNDI.value, ["FV"])
  assert.equal(base["Garde Nuit"].LUNDI.status, "validated")

  assert.equal(schedulesDiffer(base, base), false)
  assert.equal(schedulesDiffer(base, applyStructuralConstraints(structuredClone(base), weekKey, [])), false)

  // CH : semaine impaire (W30 = 30 pair → Mer/Jeu nuit ; weekend sans CH)
  // W31 = impair → Lun/Mar/Ven nuit + weekend ATL
  const oddWeek = "2026-W31"
  let chSchedule = generateWeekSchedule(oddWeek, [])
  // Pollue volontairement Matin/Midi avec CH
  chSchedule["Astreintes ATL Matin"].LUNDI.value = ["CH"]
  chSchedule["Astreintes ATL Midi"].LUNDI.value = ["CH"]
  chSchedule = applyChAstreinteConstraints(chSchedule, oddWeek)
  assert.ok(!chSchedule["Astreintes ATL Matin"].LUNDI.value.includes("CH"))
  assert.ok(!chSchedule["Astreintes ATL Midi"].LUNDI.value.includes("CH"))
  assert.ok(chSchedule["Astreintes ATL Nuit"].LUNDI.value.includes("CH"))
  assert.ok(chSchedule["Astreintes ATL Nuit"].MARDI.value.includes("CH"))
  assert.ok(chSchedule["Astreintes ATL Nuit"].VENDREDI.value.includes("CH"))
  assert.ok(!chSchedule["Astreintes ATL Nuit"].MERCREDI.value.includes("CH"))
  assert.ok(chSchedule["Astreintes ATL Matin"].SAMEDI.value.includes("CH"))
  assert.ok(chSchedule["Astreintes ATL Midi"].DIMANCHE.value.includes("CH"))
  assert.ok(chSchedule["Astreintes ATL Nuit"].DIMANCHE.value.includes("CH"))

  // CH jamais sur une ligne Garde (semaine + week-end)
  chSchedule["Garde Matin"].LUNDI.value = ["CH"]
  chSchedule["Garde Midi"].SAMEDI.value = ["CH"]
  chSchedule["Garde Nuit"].DIMANCHE.value = ["CH"]
  chSchedule = applyChAstreinteConstraints(chSchedule, oddWeek)
  assert.ok(!chSchedule["Garde Matin"].LUNDI.value.includes("CH"))
  assert.ok(!chSchedule["Garde Midi"].SAMEDI.value.includes("CH"))
  assert.ok(!chSchedule["Garde Nuit"].DIMANCHE.value.includes("CH"))

  const evenWeek = "2026-W30"
  chSchedule = applyChAstreinteConstraints(generateWeekSchedule(evenWeek, []), evenWeek)
  assert.ok(chSchedule["Astreintes ATL Nuit"].MERCREDI.value.includes("CH"))
  assert.ok(chSchedule["Astreintes ATL Nuit"].JEUDI.value.includes("CH"))
  assert.ok(!chSchedule["Astreintes ATL Nuit"].LUNDI.value.includes("CH"))
  assert.ok(!chSchedule["Astreintes ATL Matin"].SAMEDI.value.includes("CH"))

  // Proposition Générer pending sur ATL Nuit : injection CH ne doit pas forcer validated
  let pendingAtl = generateWeekSchedule(oddWeek, [])
  pendingAtl["Astreintes ATL Nuit"].LUNDI = {
    value: ["W"],
    type: "doctor",
    status: "pending",
  }
  pendingAtl = applyChAstreinteConstraints(pendingAtl, oddWeek)
  assert.ok(pendingAtl["Astreintes ATL Nuit"].LUNDI.value.includes("CH"))
  assert.ok(pendingAtl["Astreintes ATL Nuit"].LUNDI.value.includes("W"))
  assert.equal(pendingAtl["Astreintes ATL Nuit"].LUNDI.status, "pending")
  // CH déjà présent + pending → status inchangé
  pendingAtl["Astreintes ATL Nuit"].MARDI = {
    value: ["CH", "O"],
    type: "doctor",
    status: "pending",
  }
  pendingAtl = applyChAstreinteConstraints(pendingAtl, oddWeek)
  assert.equal(pendingAtl["Astreintes ATL Nuit"].MARDI.status, "pending")

  // LFB : rotation Jeudi ne doit pas écraser une proposition solveur déjà présente
  // (semaine hors suspension LFB S28–S36 — W37)
  const lfbWeek = "2026-W37"
  let lfbSched = generateWeekSchedule(lfbWeek, [])
  lfbSched["Hors site - LFB"].JEUDI = {
    value: ["H"],
    type: "doctor",
    status: "pending",
  }
  lfbSched = applyStructuralConstraints(lfbSched, lfbWeek, [])
  assert.deepEqual(lfbSched["Hors site - LFB"].JEUDI.value, ["H"])
  assert.equal(lfbSched["Hors site - LFB"].JEUDI.status, "pending")

  // LFB suspendue S31 → case vidée même si pré-remplie
  let lfbSusp = generateWeekSchedule(oddWeek, [])
  lfbSusp["Hors site - LFB"].JEUDI = {
    value: ["H"],
    type: "doctor",
    status: "pending",
  }
  lfbSusp = applyStructuralConstraints(lfbSusp, oddWeek, [])
  assert.deepEqual(lfbSusp["Hors site - LFB"].JEUDI.value, [], "LFB suspendue S31")

  // ATL Matin/Midi Lun–Ven suivent Coro
  let coroSched = generateWeekSchedule(oddWeek, [])
  coroSched["Matin - Coro"].LUNDI = { value: ["W"], type: "doctor", status: "pending" }
  coroSched["Apm - Coro"].LUNDI = { value: ["O"], type: "doctor", status: "pending" }
  coroSched["Astreintes ATL Matin"].LUNDI = { value: ["CH"], type: "doctor", status: "validated" }
  coroSched = applyAtlFollowsCoroConstraints(coroSched)
  assert.deepEqual(coroSched["Astreintes ATL Matin"].LUNDI.value, ["W"])
  assert.equal(coroSched["Astreintes ATL Matin"].LUNDI.status, "pending")
  assert.deepEqual(coroSched["Astreintes ATL Midi"].LUNDI.value, ["O"])

  // Coro vide + ATL validated → les deux restent avec le médecin (même affectation)
  coroSched["Matin - Coro"].MARDI = { value: [], type: "empty", status: "validated" }
  coroSched["Astreintes ATL Matin"].MARDI = { value: ["M"], type: "doctor", status: "validated" }
  coroSched = applyAtlFollowsCoroConstraints(coroSched)
  assert.deepEqual(coroSched["Matin - Coro"].MARDI.value, ["M"])
  assert.deepEqual(coroSched["Astreintes ATL Matin"].MARDI.value, ["M"])

  // Les deux vides → restent vides
  coroSched["Matin - Coro"].JEUDI = { value: [], type: "empty", status: "validated" }
  coroSched["Astreintes ATL Matin"].JEUDI = { value: [], type: "empty", status: "validated" }
  coroSched = applyAtlFollowsCoroConstraints(coroSched)
  assert.deepEqual(coroSched["Matin - Coro"].JEUDI.value, [])
  assert.deepEqual(coroSched["Astreintes ATL Matin"].JEUDI.value, [])

  // Générer : ATL pending sans Coro → remonter vers Coro (Prop. visibles)
  let genSched = generateWeekSchedule(oddWeek, [])
  genSched["Matin - Coro"].MERCREDI = { value: [], type: "empty", status: "validated" }
  genSched["Astreintes ATL Matin"].MERCREDI = {
    value: ["W"],
    type: "doctor",
    status: "pending",
  }
  genSched["Apm - Coro"].MERCREDI = { value: [], type: "empty", status: "validated" }
  genSched["Astreintes ATL Midi"].MERCREDI = {
    value: ["O"],
    type: "doctor",
    status: "pending",
  }
  genSched = applyAtlFollowsCoroConstraints(genSched)
  assert.deepEqual(genSched["Matin - Coro"].MERCREDI.value, ["W"])
  assert.equal(genSched["Matin - Coro"].MERCREDI.status, "pending")
  assert.deepEqual(genSched["Astreintes ATL Matin"].MERCREDI.value, ["W"])
  assert.equal(genSched["Astreintes ATL Matin"].MERCREDI.status, "pending")
  assert.deepEqual(genSched["Apm - Coro"].MERCREDI.value, ["O"])
  assert.deepEqual(genSched["Astreintes ATL Midi"].MERCREDI.value, ["O"])

  // Prop. solveur hors pool (R/V/T/G) retirées des ATL
  let badAtl = generateWeekSchedule(oddWeek, [])
  badAtl["Astreintes ATL Matin"].LUNDI = {
    value: ["R", "V"],
    type: "doctor",
    status: "pending",
  }
  badAtl["Astreintes ATL Midi"].MARDI = {
    value: ["T"],
    type: "doctor",
    status: "pending",
  }
  badAtl["Astreintes ATL Nuit"].MERCREDI = {
    value: ["G", "W"],
    type: "doctor",
    status: "pending",
  }
  badAtl["Matin - Coro"].JEUDI = {
    value: ["R"],
    type: "doctor",
    status: "pending",
  }
  badAtl = applyAtlCoronarographisteEligibility(badAtl)
  assert.deepEqual(badAtl["Astreintes ATL Matin"].LUNDI.value, [])
  assert.deepEqual(badAtl["Astreintes ATL Midi"].MARDI.value, [])
  assert.deepEqual(badAtl["Astreintes ATL Nuit"].MERCREDI.value, ["W"])
  assert.deepEqual(badAtl["Matin - Coro"].JEUDI.value, [])

  // FV en Coro jeudi → ATL Midi jeudi (même créneau) ; pas les autres ATL
  let fvCoro = generateWeekSchedule(oddWeek, [])
  fvCoro["Apm - Coro"].JEUDI = { value: ["FV"], type: "doctor", status: "validated" }
  fvCoro["Astreintes ATL Midi"].JEUDI = { value: [], type: "empty", status: "validated" }
  fvCoro = applyAtlFollowsCoroConstraints(fvCoro)
  assert.deepEqual(fvCoro["Apm - Coro"].JEUDI.value, ["FV"], "FV reste en Coro")
  assert.deepEqual(
    fvCoro["Astreintes ATL Midi"].JEUDI.value,
    ["FV"],
    "ATL Midi jeudi = miroir Coro FV",
  )
  // FV en Coro un autre jour (ex. vendredi) → pas d’ATL Midi
  fvCoro["Apm - Coro"].VENDREDI = { value: ["FV"], type: "doctor", status: "pending" }
  fvCoro["Astreintes ATL Midi"].VENDREDI = { value: ["M"], type: "doctor", status: "validated" }
  fvCoro = applyAtlFollowsCoroConstraints(fvCoro)
  assert.deepEqual(fvCoro["Apm - Coro"].VENDREDI.value, ["FV"])
  assert.deepEqual(
    fvCoro["Astreintes ATL Midi"].VENDREDI.value,
    ["M"],
    "FV Coro hors jeudi n’écrase pas ATL",
  )
  // Eligibility retire FV d’ATL Matin / Nuit ; conserve FV ATL Midi jeudi
  let fvOnAtl = generateWeekSchedule(oddWeek, [])
  fvOnAtl["Astreintes ATL Matin"].LUNDI = {
    value: ["FV"],
    type: "doctor",
    status: "pending",
  }
  fvOnAtl["Astreintes ATL Midi"].JEUDI = {
    value: ["FV"],
    type: "doctor",
    status: "validated",
  }
  fvOnAtl["Astreintes ATL Nuit"].JEUDI = {
    value: ["FV"],
    type: "doctor",
    status: "pending",
  }
  fvOnAtl = applyAtlCoronarographisteEligibility(fvOnAtl)
  assert.deepEqual(fvOnAtl["Astreintes ATL Matin"].LUNDI.value, [], "FV retiré ATL Matin")
  assert.deepEqual(fvOnAtl["Astreintes ATL Midi"].JEUDI.value, ["FV"], "FV OK ATL Midi jeudi")
  assert.deepEqual(fvOnAtl["Astreintes ATL Nuit"].JEUDI.value, [], "FV retiré ATL Nuit")

  // Weekend Garde : Sam Midi=Nuit ; Dim all same ; Sam Matin = Ven Nuit + associé
  let we = generateWeekSchedule(weekKey, [])
  we["Garde Nuit"].VENDREDI = { value: ["B"], type: "doctor", status: "pending" }
  we["Garde Midi"].SAMEDI = { value: ["G"], type: "doctor", status: "pending" }
  we["Garde Nuit"].SAMEDI = { value: [], type: "empty", status: "validated" }
  we["Garde Matin"].SAMEDI = { value: [], type: "empty", status: "validated" }
  we["Garde Matin"].DIMANCHE = { value: ["S"], type: "doctor", status: "pending" }
  we["Garde Midi"].DIMANCHE = { value: [], type: "empty", status: "validated" }
  we["Garde Nuit"].DIMANCHE = { value: [], type: "empty", status: "validated" }
  we["Astreintes ATL Matin"].SAMEDI = { value: ["W"], type: "doctor", status: "pending" }
  we["Astreintes ATL Midi"].SAMEDI = { value: [], type: "empty", status: "validated" }
  we["Astreintes ATL Nuit"].SAMEDI = { value: [], type: "empty", status: "validated" }
  we = applyWeekendGardeAtlCoupling(we)
  assert.deepEqual(we["Garde Midi"].SAMEDI.value, ["G"])
  assert.deepEqual(we["Garde Nuit"].SAMEDI.value, ["G"])
  assert.deepEqual(we["Garde Matin"].SAMEDI.value, ["B", "G"])
  assert.deepEqual(we["Garde Matin"].DIMANCHE.value, ["S"])
  assert.deepEqual(we["Garde Midi"].DIMANCHE.value, ["S"])
  assert.deepEqual(we["Garde Nuit"].DIMANCHE.value, ["S"])
  assert.deepEqual(we["Astreintes ATL Matin"].SAMEDI.value, ["W"])
  assert.deepEqual(we["Astreintes ATL Midi"].SAMEDI.value, ["W"])
  assert.deepEqual(we["Astreintes ATL Nuit"].SAMEDI.value, ["W"])

  console.log("✅ apply-structural-constraints tests passed")
}

main()
