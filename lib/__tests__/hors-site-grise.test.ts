/**
 * Run: bunx tsx lib/__tests__/hors-site-grise.test.ts
 * Hors site inoccupé hors de ses jours d'affectation : grisé (mais toujours modifiable).
 */
import assert from "node:assert/strict"
import { isIdleHorsSiteGrey, isSlotClosed } from "@/lib/closed-slots"
import { buildPlanningPdf } from "@/lib/planning-pdf"
import { generateWeekSchedule } from "@/lib/schedule-utils"

async function main() {
  // CDL mardi · LFB / PSSL jeudi · IRM lundi + vendredi : jours d'affectation, jamais grisés
  assert.equal(isIdleHorsSiteGrey("Hors site - CDL", "MARDI", false), false)
  assert.equal(isIdleHorsSiteGrey("Hors site - LFB", "JEUDI", false), false)
  assert.equal(isIdleHorsSiteGrey("Hors site - PSSL", "JEUDI", false), false)
  assert.equal(isIdleHorsSiteGrey("Hors site - IRM", "LUNDI", false), false)
  assert.equal(isIdleHorsSiteGrey("Hors site - IRM", "VENDREDI", false), false)

  // Hors de ces jours et inoccupés : grisés
  assert.equal(isIdleHorsSiteGrey("Hors site - CDL", "LUNDI", false), true)
  assert.equal(isIdleHorsSiteGrey("Hors site - LFB", "MARDI", false), true)
  assert.equal(isIdleHorsSiteGrey("Hors site - PSSL", "VENDREDI", false), true)
  assert.equal(isIdleHorsSiteGrey("Hors site - IRM", "MERCREDI", false), true)

  // Occupés (saisie manuelle) : dégrisés
  assert.equal(isIdleHorsSiteGrey("Hors site - CDL", "LUNDI", true), false)
  assert.equal(isIdleHorsSiteGrey("Hors site - IRM", "MERCREDI", true), false)

  // Jamais fermées (toujours modifiables) ; autres lignes non concernées
  assert.equal(isSlotClosed("Hors site - CDL", "LUNDI"), false)
  // Scinti : lundi, mardi, mercredi ; grisée jeudi et vendredi si inoccupée
  for (const d of ["LUNDI", "MARDI", "MERCREDI"]) assert.equal(isIdleHorsSiteGrey("Hors site - Scinti", d, false), false)
  for (const d of ["JEUDI", "VENDREDI"]) assert.equal(isIdleHorsSiteGrey("Hors site - Scinti", d, false), true)
  assert.equal(isIdleHorsSiteGrey("Hors site - Scinti", "JEUDI", true), false)
  assert.equal(isIdleHorsSiteGrey("Matin - Cs PSS", "LUNDI", false), false)
  assert.equal(isIdleHorsSiteGrey("Hors site - NCT", "LUNDI", false), false, "NCT : calendrier NCT")

  // Le PDF se génère toujours avec ces cases grisées
  const s = generateWeekSchedule("2026-W44", [])
  s["Hors site - CDL"].LUNDI = { value: ["O"], type: "doctor", status: "validated", manualAssignment: true }
  const bytes = await buildPlanningPdf("2026-W44", s)
  assert.ok(bytes.byteLength > 1000)

  console.log("✅ hors-site-grise tests passed")
}

main()
