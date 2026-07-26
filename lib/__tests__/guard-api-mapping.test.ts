/**
 * Run: npx tsx lib/__tests__/guard-api-mapping.test.ts
 */
import assert from "node:assert/strict"
import {
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

  // Weekend ASTREINTE reste sur Garde Matin ; VACANCES ne doit PAS y aller
  assert.equal(resolveRowKey("weekend", "ASTREINTE", "SAMEDI"), "Garde Matin")
  assert.notEqual(resolveRowKey("weekend", "VACANCES", "SAMEDI"), "Garde Matin")

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

  // Merge Générer : préserve Cs déjà rempli, propose Coro en pending
  const existing: ScheduleData = generateWeekSchedule("2026-W30")
  existing["Matin - Cs PSS"].LUNDI.value = ["B"]
  existing["Matin - Coro"].LUNDI.value = ["O"]

  const generated: ScheduleData = generateWeekSchedule("2026-W30")
  generated["Matin - Coro"].LUNDI = { value: ["W"], type: "doctor", status: "pending" }
  generated["Apm - Coro"].LUNDI = { value: ["M"], type: "doctor", status: "pending" }
  generated["Matin - Cs PSS"].LUNDI.value = []

  const after = mergeSolverWeekIntoExisting(existing, generated)
  assert.deepEqual(after["Matin - Cs PSS"].LUNDI.value, ["B"], "Cs manuel préservé")
  assert.deepEqual(after["Matin - Coro"].LUNDI.value, ["W"], "Coro proposé par le solveur")
  assert.equal(after["Matin - Coro"].LUNDI.status, "pending")
  assert.deepEqual(after["Apm - Coro"].LUNDI.value, ["M"])

  console.log("✅ guard-api-mapping vacation/coro tests passed")
}

main()
