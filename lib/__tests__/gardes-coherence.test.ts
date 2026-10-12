/**
 * Run: bunx tsx lib/__tests__/gardes-coherence.test.ts
 * Gardes de nuit : jamais deux nuits consécutives (y compris dimanche → lundi d'une autre semaine) ;
 * les incohérences sont détectées comme à la saisie manuelle et signalées.
 */
import assert from "node:assert/strict"
import { applyStructuralConstraints } from "@/lib/apply-structural-constraints"
import { applyClinicalPriorityRules, validateProposalsLikeManual, type RejectedProposal } from "@/lib/clinical-priority"
import { computeRuleConflicts, ruleConflictKey } from "@/lib/rule-conflicts"
import { canAssignDoctorToSlot, FRIDAY_NIGHT_GUARD_POOL } from "@/lib/slot-blocking"
import { NIGHT_GUARD_DAY_RULES } from "@/lib/guard-scheduler"
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

  // Cas S44 : U proposé les nuits des jeudi 29 et vendredi 30/10 (semaine, hors week-end)
  const u = generateWeekSchedule(wk, [])
  for (const r of ["Garde Matin", "Garde Midi", "Garde Nuit"]) {
    u[r].JEUDI = prop(["U"])
    u[r].VENDREDI = prop(["U"])
  }
  const ru: RejectedProposal[] = []
  const vu = validateProposalsLikeManual(u, wk, [], ru)
  assert.deepEqual(vu["Garde Nuit"].JEUDI.value, ["U"])
  for (const r of ["Garde Matin", "Garde Midi", "Garde Nuit"]) assert.deepEqual(vu[r].VENDREDI.value, [], `${r} vendredi écartée`)
  // Le moteur de structure ne recrée pas la 2e nuit en recopiant Garde Matin/Midi vers la nuit
  const au = applyStructuralConstraints(vu, wk, [])
  assert.deepEqual(au["Garde Nuit"].VENDREDI.value, [], "pas de 2e nuit recréée par le couplage")
  // Deux nuits consécutives en milieu de semaine : le couplage ne les recrée pas non plus
  const mw = generateWeekSchedule(wk, [])
  for (const r of ["Garde Matin", "Garde Midi", "Garde Nuit"]) {
    mw[r].MARDI = prop(["B"])
    mw[r].MERCREDI = prop(["B"])
  }
  const amw = applyStructuralConstraints(validateProposalsLikeManual(mw, wk, [], []), wk, [])
  assert.ok(!amw["Garde Nuit"].MARDI.value.includes("B") || !amw["Garde Nuit"].MERCREDI.value.includes("B"))
  // Dimanche précédent → lundi : le couplage respecte aussi le contexte
  const sm = generateWeekSchedule(wk, [])
  sm["Garde Matin"].LUNDI = prop(["A"])
  const asm = applyStructuralConstraints(sm, wk, [], { previousSundayGuardDoctor: "A" })
  assert.ok(!asm["Garde Nuit"].LUNDI.value.includes("A"), "pas de nuit lundi pour le médecin de garde dimanche")

  // Garde de nuit du vendredi : pool exclusif, aligné sur le planificateur (O, W, M jamais ; tout le monde sinon)
  assert.deepEqual([...FRIDAY_NIGHT_GUARD_POOL], [...(NIGHT_GUARD_DAY_RULES.VENDREDI.only as readonly string[])])
  for (const d of ["O", "W", "M"]) {
    assert.equal(canAssignDoctorToSlot(d, "2026-10-30", "Garde Nuit", "VENDREDI", generateWeekSchedule(wk, []), []).allowed, false, d)
  }
  assert.equal(canAssignDoctorToSlot("B", "2026-10-30", "Garde Nuit", "VENDREDI", generateWeekSchedule(wk, []), []).allowed, true)

  console.log("✅ gardes-coherence tests passed")
}

main()
