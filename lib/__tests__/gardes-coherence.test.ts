/**
 * Run: bunx tsx lib/__tests__/gardes-coherence.test.ts
 * Gardes de nuit : jamais deux nuits consécutives (y compris dimanche → lundi d'une autre semaine) ;
 * les incohérences sont détectées comme à la saisie manuelle et signalées.
 */
import assert from "node:assert/strict"
import { applyStructuralConstraints } from "@/lib/apply-structural-constraints"
import { applyClinicalPriorityRules, validateProposalsLikeManual, type RejectedProposal } from "@/lib/clinical-priority"
import { computeRuleConflicts, ruleConflictKey } from "@/lib/rule-conflicts"
import { canAssignDoctorToSlot } from "@/lib/slot-blocking"
import { generateWeekSchedule } from "@/lib/schedule-utils"

const wk = "2026-W44" // lundi 26/10/2026 ; dimanche précédent = 25/10
const prop = (value: string[]) => ({ value, type: "doctor" as const, status: "pending" as const })
const manual = (value: string[]) => ({ value, type: "doctor" as const, status: "validated" as const, manualAssignment: true })

function main() {
  // Dimanche précédent → lundi : refusé (contexte hors semaine), accepté sans ce contexte
  const base = generateWeekSchedule(wk, [])
  const refused = canAssignDoctorToSlot("A", "2026-10-26", "Garde Nuit", "LUNDI", base, [], { previousSundayGuardDoctor: "A" })
  assert.equal(refused.allowed, false)
  assert.match(refused.reason || "", /dimanche précédent/)
  assert.equal(canAssignDoctorToSlot("A", "2026-10-26", "Garde Nuit", "LUNDI", base, []).allowed, true)
  assert.equal(
    canAssignDoctorToSlot("B", "2026-10-26", "Garde Nuit", "LUNDI", base, [], { previousSundayGuardDoctor: "A" }).allowed,
    true,
  )

  // Proposition du solveur : A déjà de garde dimanche → sa nuit du lundi est écartée
  const s = generateWeekSchedule(wk, [])
  s["Garde Nuit"].LUNDI = prop(["A"])
  const rej: RejectedProposal[] = []
  const out = validateProposalsLikeManual(s, wk, [], rej, { previousSundayGuardDoctor: "A" })
  assert.deepEqual(out["Garde Nuit"].LUNDI.value, [])
  assert.ok(rej.some((r) => r.doctor === "A" && /dimanche précédent/.test(r.reason)))
  // … et le point d'entrée complet applique le même contexte
  const full = applyClinicalPriorityRules(s, wk, [], [], undefined, { previousSundayGuardDoctor: "A" })
  assert.ok(!full["Garde Nuit"].LUNDI.value.includes("A"))

  // Deux nuits consécutives en semaine : écartées à la génération, signalées à l'affichage
  const w = generateWeekSchedule(wk, [])
  w["Garde Nuit"].LUNDI = prop(["B"])
  w["Garde Nuit"].MARDI = prop(["B"])
  const rejW: RejectedProposal[] = []
  const vw = validateProposalsLikeManual(w, wk, [], rejW)
  assert.deepEqual(vw["Garde Nuit"].MARDI.value, [])
  assert.ok(rejW.some((r) => /consécutives/.test(r.reason)))

  const m = generateWeekSchedule(wk, [])
  m["Garde Nuit"].MERCREDI = manual(["H"])
  m["Garde Nuit"].JEUDI = manual(["H"]) // saisie manuelle déjà en place : incohérence visible
  const conflicts = computeRuleConflicts(m, wk, [])
  assert.match(conflicts.get(ruleConflictKey("Garde Nuit", "JEUDI", "H")) || "", /consécutives/)
  assert.match(conflicts.get(ruleConflictKey("Garde Nuit", "MERCREDI", "H")) || "", /consécutives/)
  // Lundi : le dimanche précédent compte aussi dans la détection
  const c2 = computeRuleConflicts({ ...generateWeekSchedule(wk, []), "Garde Nuit": { ...generateWeekSchedule(wk, [])["Garde Nuit"], LUNDI: manual(["A"]) } }, wk, [], {
    previousSundayGuardDoctor: "A",
  })
  assert.match(c2.get(ruleConflictKey("Garde Nuit", "LUNDI", "A")) || "", /dimanche précédent/)

  // Pas de fausses alertes sur un planning structurel standard (week-end ATL exclu)
  let falseAlarms = 0
  for (let n = 40; n <= 52; n++) {
    const k = `2026-W${n}`
    const sched = applyStructuralConstraints(generateWeekSchedule(k, []), k, [])
    falseAlarms += computeRuleConflicts(sched, k, []).size
  }
  assert.equal(falseAlarms, 0, `aucune fausse alerte sur les semaines structurelles (${falseAlarms})`)

  console.log("✅ gardes-coherence tests passed")
}

main()
