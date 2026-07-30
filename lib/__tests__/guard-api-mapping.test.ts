/**
 * Run: npx tsx lib/__tests__/guard-api-mapping.test.ts
 */
import assert from "node:assert/strict"
import {
  isSolverProposalCell,
  mergeAssignmentsIntoSchedule,
  mergeSolverWeekIntoExisting,
  resolveRowKey,
} from "@/lib/guard-api-mapping"
import { generateWeekSchedule } from "@/lib/schedule-utils"
import type { ScheduleData } from "@/lib/types"

function main() {
  // Vacations / congés / pré-op / rythmo doivent mapper (sinon Générer les ignore)
  assert.equal(resolveRowKey("matin", "VACANCES", "LUNDI"), "Congés")
  assert.equal(resolveRowKey("weekend", "VACANCES", "SAMEDI"), "Congés")
  assert.equal(resolveRowKey("matin", "CONGE", "LUNDI"), "Congés")
  assert.equal(resolveRowKey("am", "CONGRES", "MERCREDI"), "Congrès")
  assert.equal(resolveRowKey("am", "PRE_OP", "LUNDI"), "Pré-op")
  assert.equal(resolveRowKey("nuit", "PRE_OP", "DIMANCHE"), "Pré-op")
  assert.equal(resolveRowKey("matin", "RYTHMO", "MARDI"), "Matin - Rythmo")
  assert.equal(resolveRowKey("am", "RYTHMO", "LUNDI"), "Apm - Rythmo")
  assert.equal(resolveRowKey("matin", "CORO", "LUNDI"), "Matin - Coro")
  assert.equal(resolveRowKey("am", "CORO", "LUNDI"), "Apm - Coro")

  // Weekend ASTREINTE → ATL Matin ; GARDE → Garde Matin ; VACANCES ne doit PAS y aller
  assert.equal(resolveRowKey("weekend", "ASTREINTE", "SAMEDI"), "Astreintes ATL Matin")
  assert.equal(resolveRowKey("weekend", "GARDE", "SAMEDI"), "Garde Matin")
  assert.notEqual(resolveRowKey("weekend", "VACANCES", "SAMEDI"), "Garde Matin")
  assert.notEqual(resolveRowKey("weekend", "ASTREINTE", "SAMEDI"), "Garde Matin")

  const base = generateWeekSchedule("2026-W30")
  const merged = mergeAssignmentsIntoSchedule(base, [
    {
      date: "2026-07-20",
      day_name: "LUNDI",
      slot: "matin",
      activity: "CORO",
      doctor: "W",
    },
    {
      date: "2026-07-20",
      day_name: "LUNDI",
      slot: "am",
      activity: "CORO",
      doctor: "M",
    },
    {
      date: "2026-07-20",
      day_name: "LUNDI",
      slot: "matin",
      activity: "VACANCES",
      doctor: "Z",
    },
    {
      date: "2026-07-20",
      day_name: "LUNDI",
      slot: "matin",
      activity: "CONGE",
      doctor: "Z",
    },
    {
      date: "2026-07-20",
      day_name: "LUNDI",
      slot: "am",
      activity: "PRE_OP",
      doctor: "A",
    },
  ])

  // Coro / Pré-op = propositions pending ; Congés structurels ignorés par le merge Générer
  assert.deepEqual(merged["Matin - Coro"].LUNDI.value, ["W"])
  assert.equal(merged["Matin - Coro"].LUNDI.status, "pending")
  assert.deepEqual(merged["Apm - Coro"].LUNDI.value, ["M"])
  assert.equal(merged["Apm - Coro"].LUNDI.status, "pending")
  assert.ok(!merged["Congés"].LUNDI.value.includes("Z"), "Congés hors propositions Générer")
  assert.deepEqual(merged["Pré-op"].LUNDI.value, ["A"])
  assert.equal(merged["Pré-op"].LUNDI.status, "pending")
  assert.equal(isSolverProposalCell("Matin - Coro", merged["Matin - Coro"].LUNDI), true)
  assert.equal(isSolverProposalCell("Matin - Rythmo", { status: "validated", value: ["P"] }), false)
  assert.equal(
    isSolverProposalCell("Garde Nuit", {
      status: "pending",
      value: ["W"],
      request: { requester: "W", status: "pending", timestamp: 1 },
    }),
    false,
    "demande de changement ≠ proposition solveur",
  )

  // Historique Cs / ETT + hors site CDL (émis HIST:: / HORSSITE:: côté Render)
  const histMerged = mergeAssignmentsIntoSchedule(generateWeekSchedule("2026-W30"), [
    {
      date: "2026-07-20",
      day_name: "LUNDI",
      slot: "matin",
      activity: "Cs PSS",
      doctor: "B",
      note: "assigné par le solveur (historique)",
    },
    {
      date: "2026-07-20",
      day_name: "LUNDI",
      slot: "matin",
      activity: "ETT salle 1",
      doctor: "S",
      note: "assigné par le solveur (historique)",
    },
    {
      date: "2026-07-20",
      day_name: "LUNDI",
      slot: "am",
      activity: "Stress",
      doctor: "G",
      note: "assigné par le solveur (historique)",
    },
    {
      date: "2026-07-21",
      day_name: "MARDI",
      slot: "matin",
      activity: "CDL",
      doctor: "V",
      note: "assigné par le solveur (hors site)",
    },
    {
      date: "2026-07-21",
      day_name: "MARDI",
      slot: "matin",
      activity: "IRM",
      doctor: "S",
      note: "assigné par le solveur (hors site)",
    },
  ])
  assert.deepEqual(histMerged["Matin - Cs PSS"].LUNDI.value, ["B"])
  assert.equal(histMerged["Matin - Cs PSS"].LUNDI.status, "pending")
  assert.equal(isSolverProposalCell("Matin - Cs PSS", histMerged["Matin - Cs PSS"].LUNDI), true)
  assert.deepEqual(histMerged["Matin - ETT salle 1"].LUNDI.value, ["S"])
  assert.equal(isSolverProposalCell("Matin - ETT salle 1", histMerged["Matin - ETT salle 1"].LUNDI), true)
  assert.deepEqual(histMerged["Apm - Stress"].LUNDI.value, ["G"])
  assert.deepEqual(histMerged["Hors site - CDL"].MARDI.value, ["V"])
  assert.equal(isSolverProposalCell("Hors site - CDL", histMerged["Hors site - CDL"].MARDI), true)
  assert.deepEqual(histMerged["Hors site - IRM"].MARDI.value, ["S"])
  assert.equal(isSolverProposalCell("Hors site - IRM", histMerged["Hors site - IRM"].MARDI), true)

  // Merge Générer : préserve Cs déjà rempli si le solveur ne propose rien sur cette case,
  // propose Coro + Cs historique en pending
  const existing: ScheduleData = generateWeekSchedule("2026-W30")
  existing["Matin - Cs PSS"].LUNDI.value = ["B"]
  existing["Matin - Coro"].LUNDI.value = ["O"]

  const generated: ScheduleData = generateWeekSchedule("2026-W30")
  generated["Matin - Coro"].LUNDI = { value: ["W"], type: "doctor", status: "pending" }
  generated["Apm - Coro"].LUNDI = { value: ["M"], type: "doctor", status: "pending" }
  generated["Matin - Cs PSS"].LUNDI.value = []
  generated["Matin - Cs Tessée"].MARDI = { value: ["P"], type: "doctor", status: "pending" }

  const after = mergeSolverWeekIntoExisting(existing, generated)
  assert.deepEqual(after["Matin - Cs PSS"].LUNDI.value, ["B"], "Cs manuel préservé si solveur vide")
  assert.deepEqual(after["Matin - Cs Tessée"].MARDI.value, ["P"], "Cs historique proposé")
  assert.equal(after["Matin - Cs Tessée"].MARDI.status, "pending")
  assert.deepEqual(
    after["Matin - Coro"].LUNDI.value,
    ["O"],
    "Coro validé manuel prime sur proposition solveur",
  )
  assert.equal(after["Matin - Coro"].LUNDI.status, "validated")
  assert.deepEqual(after["Apm - Coro"].LUNDI.value, ["M"])

  // ETT ped validé manuel : Générer ne remplace pas
  existing["Apm - ETT salle 1"].MERCREDI = {
    value: ["P"],
    type: "doctor",
    status: "validated",
  }
  generated["Apm - ETT salle 1"].MERCREDI = {
    value: ["S"],
    type: "doctor",
    status: "pending",
  }
  const afterEtt = mergeSolverWeekIntoExisting(existing, generated)
  assert.deepEqual(
    afterEtt["Apm - ETT salle 1"].MERCREDI.value,
    ["P"],
    "ETT ped manuel validé prime sur Générer",
  )
  assert.equal(afterEtt["Apm - ETT salle 1"].MERCREDI.status, "validated")

  // Case vide ETT : proposition Générer acceptée
  existing["Apm - ETT salle 1"].MERCREDI = { value: [], type: "empty", status: "validated" }
  const afterEttEmpty = mergeSolverWeekIntoExisting(existing, generated)
  assert.deepEqual(afterEttEmpty["Apm - ETT salle 1"].MERCREDI.value, ["S"])
  assert.equal(afterEttEmpty["Apm - ETT salle 1"].MERCREDI.status, "pending")

  // Week-end garde : préserver le remplaçant quand le solveur propose un médecin
  existing["Garde Matin"].SAMEDI = {
    value: ["Dr Martin"],
    remplacant: "Dr Martin",
    type: "doctor",
    status: "validated",
  }
  generated["Garde Matin"].SAMEDI = { value: ["B"], type: "doctor", status: "pending" }
  const afterWe = mergeSolverWeekIntoExisting(existing, generated)
  assert.ok(afterWe["Garde Matin"].SAMEDI.value.includes("Dr Martin"), "remplacant préservé")
  assert.ok(afterWe["Garde Matin"].SAMEDI.value.includes("B"), "médecin solveur ajouté")
  assert.equal(afterWe["Garde Matin"].SAMEDI.remplacant, "Dr Martin")

  // CH jamais écrit sur une ligne Garde via merge assignments
  const withCh = mergeAssignmentsIntoSchedule(generateWeekSchedule("2026-W30"), [
    {
      date: "2026-07-25",
      day_name: "SAMEDI",
      slot: "weekend",
      activity: "GARDE",
      doctor: "CH",
    },
    {
      date: "2026-07-25",
      day_name: "SAMEDI",
      slot: "weekend",
      activity: "GARDE",
      doctor: "O",
    },
  ])
  assert.ok(!withCh["Garde Matin"].SAMEDI.value.includes("CH"), "CH exclu des gardes")
  assert.ok(withCh["Garde Matin"].SAMEDI.value.includes("O"))

  // Doublon Cs solveur : 2 Assignment identiques → ["Z","Z"] (pas dédupliqués)
  const csDoublon = mergeAssignmentsIntoSchedule(generateWeekSchedule("2026-W30"), [
    {
      date: "2026-07-20",
      day_name: "LUNDI",
      slot: "am",
      activity: "Cs PSS",
      doctor: "Z",
      note: "assigné par le solveur (historique)",
    },
    {
      date: "2026-07-20",
      day_name: "LUNDI",
      slot: "am",
      activity: "Cs PSS",
      doctor: "Z",
      note: "assigné par le solveur (doublon)",
    },
    {
      date: "2026-07-21",
      day_name: "MARDI",
      slot: "am",
      activity: "Cs PSS",
      doctor: "H",
      note: "assigné par le solveur (historique)",
    },
    {
      date: "2026-07-21",
      day_name: "MARDI",
      slot: "am",
      activity: "Cs PSS",
      doctor: "H",
      note: "assigné par le solveur (doublon)",
    },
    {
      date: "2026-07-22",
      day_name: "MERCREDI",
      slot: "am",
      activity: "Cs PSS",
      doctor: "B",
      note: "assigné par le solveur (historique)",
    },
  ])
  assert.deepEqual(
    csDoublon["Apm - Cs PSS"].LUNDI.value,
    ["Z", "Z"],
    "doublon Z Lundi Apm Cs PSS préservé",
  )
  assert.deepEqual(
    csDoublon["Apm - Cs PSS"].MARDI.value,
    ["H", "H"],
    "doublon H Mardi Apm Cs PSS préservé",
  )
  assert.deepEqual(
    csDoublon["Apm - Cs PSS"].MERCREDI.value,
    ["B"],
    "occurrence unique inchangée",
  )

  // Autres lignes : déduplication toujours active (ex. Coro)
  const coroDup = mergeAssignmentsIntoSchedule(generateWeekSchedule("2026-W30"), [
    {
      date: "2026-07-20",
      day_name: "LUNDI",
      slot: "matin",
      activity: "CORO",
      doctor: "W",
    },
    {
      date: "2026-07-20",
      day_name: "LUNDI",
      slot: "matin",
      activity: "CORO",
      doctor: "W",
    },
  ])
  assert.deepEqual(coroDup["Matin - Coro"].LUNDI.value, ["W"], "Coro reste dédupliqué")

  // mergeSolverWeekIntoExisting : conserver ["Z","Z"] déjà dans le planning généré
  const genDoublon: ScheduleData = generateWeekSchedule("2026-W30")
  genDoublon["Apm - Cs PSS"].LUNDI = {
    value: ["Z", "Z"],
    type: "doctor",
    status: "pending",
  }
  const afterDoublon = mergeSolverWeekIntoExisting(generateWeekSchedule("2026-W30"), genDoublon)
  assert.deepEqual(
    afterDoublon["Apm - Cs PSS"].LUNDI.value,
    ["Z", "Z"],
    "merge week préserve le doublon Cs",
  )

  console.log("✅ guard-api-mapping vacation/coro tests passed")
}

main()
