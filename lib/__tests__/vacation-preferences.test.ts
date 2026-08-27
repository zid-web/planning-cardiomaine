/**
 * Run: bunx tsx lib/__tests__/vacation-preferences.test.ts
 */
import assert from "node:assert/strict"
import { generateWeekSchedule } from "@/lib/schedule-utils"
import {
  applyFixedClinicalAssignments,
  applyNurseFixedAssignments,
  dateStrForWeekDay,
} from "@/lib/fixed-assignments"
import { applyClosedSlotsClear, isSlotClosed } from "@/lib/closed-slots"
import { DOC022_FIXED_CLINICAL_SLOTS } from "@/lib/group-clinical-rules"
import { canNurseTakeRow, ensureNurseDoctorBinomeProposals } from "@/lib/nurse-rules"
import {
  adjacentWeekdayNightGuard,
  applyOffSiteSlotRestriction,
  applySlotBlockingStrips,
  canAssignDoctorToSlot,
  isIrmSlotClosed,
  isNonBlockingRow,
  periodOfRow,
} from "@/lib/slot-blocking"
import {
  applyStructuralConstraints,
  applyWeekdayGardeCoupling,
} from "@/lib/apply-structural-constraints"
import {
  defaultLfbDoctor,
  lfbDoctorForWeekNum,
  LFB_POOL,
} from "@/lib/week-generation-params"
import {
  applyPreferenceBias,
  isDayAfterNightGuard,
  preferredPartnerForNurseSlot,
  PREFERENCE_BONUS,
} from "@/lib/vacation-preferences"
import { STRESS_PARTNER_POOL } from "@/lib/nurse-rules"
import { formatPersonLabel } from "@/lib/doctor-code"
import { isOffSiteRow, offSiteSlotOf, setOffSiteSlot } from "@/lib/off-site-slots"
import { spreadVisiteAcrossWeek } from "@/lib/visite-rotation"
import type { DoctorVacation } from "@/lib/types"

function main() {
  // --- K souvent au Stress mardi matin, rarement le mercredi ---
  const patterns = {
    "Matin - Stress": {
      MARDI: { eligible_doctors: ["B", "Z"], frequency: { B: 5, Z: 3 } },
      MERCREDI: { eligible_doctors: ["K", "G"], frequency: { K: 4, G: 1 } },
    },
  }
  const biased = applyPreferenceBias(patterns)

  assert.ok(
    biased["Matin - Stress"].MARDI.eligible_doctors.includes("K"),
    "K devient éligible au Stress mardi matin",
  )
  assert.equal(
    biased["Matin - Stress"].MARDI.frequency.K,
    5 + PREFERENCE_BONUS,
    "K passe devant le meilleur autre candidat du mardi",
  )
  assert.equal(
    biased["Matin - Stress"].MERCREDI.eligible_doctors.includes("K"),
    false,
    "K est écarté du Stress mercredi matin",
  )
  assert.equal(biased["Matin - Stress"].MERCREDI.frequency.K, undefined)
  assert.deepEqual(biased["Matin - Stress"].MERCREDI.eligible_doctors, ["G"])

  // L'entrée d'origine n'est pas mutée
  assert.equal(patterns["Matin - Stress"].MERCREDI.frequency.K, 4)
  assert.deepEqual(patterns["Matin - Stress"].MARDI.eligible_doctors, ["B", "Z"])

  // « rarement » ≠ « jamais » : seul candidat connu → on le garde
  const soloK = applyPreferenceBias({
    "Matin - Stress": { MERCREDI: { eligible_doctors: ["K"], frequency: { K: 2 } } },
  })
  assert.deepEqual(soloK["Matin - Stress"].MERCREDI.eligible_doctors, ["K"])

  // Case sans historique : la préférence « souvent » crée l'entrée
  const fromEmpty = applyPreferenceBias({})
  assert.deepEqual(fromEmpty["Matin - Stress"].MARDI.eligible_doctors, ["K"])
  assert.equal(fromEmpty["Matin - Stress"].MARDI.frequency.K, PREFERENCE_BONUS)

  // --- S vendredi matin : congés et lendemain de garde annulent la préférence ---
  assert.equal(
    applyPreferenceBias({})["Matin - Stress"].VENDREDI.eligible_doctors.includes("S"),
    true,
    "S est privilégié au Stress vendredi matin par défaut",
  )

  const weekKey = "2026-W30"
  const sVacation: DoctorVacation[] = [
    {
      id: "1",
      doctor_id: "S",
      start_date: "2026-07-24",
      end_date: "2026-07-24",
      created_at: "",
      updated_at: "",
    },
  ]
  const onLeave = applyPreferenceBias(
    {},
    {
      weekKey,
      vacations: sVacation,
      dateStrForDay: (day) => dateStrForWeekDay(weekKey, day),
    },
  )
  assert.equal(
    onLeave["Matin - Stress"].VENDREDI,
    undefined,
    "S en congés : pas de préférence vendredi matin",
  )

  let sched = generateWeekSchedule(weekKey, [])
  sched["Garde Nuit"].JEUDI = { value: ["S"], type: "doctor", status: "validated" }
  assert.equal(isDayAfterNightGuard(sched, "VENDREDI", "S"), true)
  assert.equal(isDayAfterNightGuard(sched, "JEUDI", "S"), false)
  const afterGuard = applyPreferenceBias({}, { weekKey, schedule: sched })
  assert.equal(
    afterGuard["Matin - Stress"]?.VENDREDI,
    undefined,
    "S au lendemain de garde : pas de préférence vendredi matin",
  )
  // La préférence du mardi reste intacte
  assert.equal(afterGuard["Matin - Stress"].MARDI.frequency.K, PREFERENCE_BONUS)

  // --- Choix du partenaire d'une infirmière ---
  assert.equal(
    preferredPartnerForNurseSlot("Matin - Stress", "MARDI", STRESS_PARTNER_POOL),
    "K",
  )
  assert.equal(
    preferredPartnerForNurseSlot("Matin - Stress", "VENDREDI", STRESS_PARTNER_POOL),
    "S",
  )
  assert.equal(
    preferredPartnerForNurseSlot("Matin - Stress", "MERCREDI", STRESS_PARTNER_POOL),
    null,
    "aucune préférence positive le mercredi matin",
  )
  assert.equal(
    preferredPartnerForNurseSlot("Matin - Stress", "MARDI", ["B", "Z"]),
    null,
    "préférence ignorée si K n'est pas dans le pool",
  )

  // Véro seule sur Stress mardi matin → K proposé comme binôme
  sched = generateWeekSchedule(weekKey, [])
  sched["Matin - Stress"].MARDI = { value: ["Véro"], type: "doctor", status: "validated" }
  const paired = ensureNurseDoctorBinomeProposals(sched, weekKey, [])
  assert.ok(
    paired["Matin - Stress"].MARDI.value.includes("K"),
    "K est le partenaire proposé à Véro le mardi matin",
  )
  assert.ok(paired["Matin - Stress"].MARDI.value.includes("Véro"))

  // Vendredi matin : S proposé (pool trié autrement, la préférence prime)
  sched = generateWeekSchedule(weekKey, [])
  sched["Matin - Stress"].VENDREDI = { value: ["Laura"], type: "doctor", status: "validated" }
  const pairedFri = ensureNurseDoctorBinomeProposals(sched, weekKey, [])
  assert.ok(
    pairedFri["Matin - Stress"].VENDREDI.value.includes("S"),
    "S est le partenaire proposé le vendredi matin",
  )

  // --- Val en ETT : toujours salle 2 ---
  assert.equal(canNurseTakeRow("Val", "Matin - ETT salle 2"), true)
  assert.equal(canNurseTakeRow("Val", "Apm - ETT salle 2"), true)
  assert.equal(canNurseTakeRow("Val", "Matin - ETT salle 1"), false)
  assert.equal(canNurseTakeRow("Val", "Apm - ETT salle 1"), false)
  assert.equal(canNurseTakeRow("Val", "Matin - ETT Tessé"), true, "ETT Tessé reste ouvert")
  assert.equal(canNurseTakeRow("Véro", "Matin - ETT salle 1"), true, "règle propre à Val")

  sched = generateWeekSchedule(weekKey, [])
  let r = canAssignDoctorToSlot("Val", "2026-07-20", "Matin - ETT salle 1", "LUNDI", sched, [])
  assert.equal(r.allowed, false, "Val jamais sur ETT salle 1")
  r = canAssignDoctorToSlot("Val", "2026-07-20", "Matin - ETT salle 2", "LUNDI", sched, [])
  assert.equal(r.allowed, true, "Val reste assignable sur ETT salle 2")

  // --- Laura en congés → repli systématique sur Val ---
  // Semaine impaire : Laura est sur « Matin - Stress » vendredi ; Val est sur
  // « Matin - ETT salle 2 » le même matin (libérée par le repli).
  const oddWeek = "2026-W31"
  const fridayStr = dateStrForWeekDay(oddWeek, "VENDREDI")!
  let nurseSched = applyNurseFixedAssignments(generateWeekSchedule(oddWeek, []), oddWeek, [])
  assert.deepEqual(
    nurseSched["Matin - Stress"].VENDREDI.value,
    ["Laura"],
    "sans congés, Laura tient le Stress du vendredi matin",
  )
  assert.ok(nurseSched["Matin - ETT salle 2"].VENDREDI.value.includes("Val"))

  const lauraOff: DoctorVacation[] = [
    {
      id: "2",
      doctor_id: "Laura",
      start_date: fridayStr,
      end_date: fridayStr,
      created_at: "",
      updated_at: "",
    },
  ]
  nurseSched = applyNurseFixedAssignments(
    generateWeekSchedule(oddWeek, []),
    oddWeek,
    lauraOff,
  )
  assert.deepEqual(
    nurseSched["Matin - Stress"].VENDREDI.value,
    ["Val"],
    "Laura absente : Val prend systématiquement le relais",
  )
  assert.equal(
    nurseSched["Matin - ETT salle 2"].VENDREDI.value.includes("Val"),
    false,
    "Val libère son ETT salle 2 du même matin (une vacation par créneau)",
  )

  // --- EE1 matin fermée sauf le jeudi ---
  for (const day of ["LUNDI", "MARDI", "MERCREDI", "VENDREDI"]) {
    assert.equal(isSlotClosed("Matin - EE1", day), true, `EE1 matin fermée ${day}`)
  }
  assert.equal(isSlotClosed("Matin - EE1", "JEUDI"), false, "EE1 matin ouverte le jeudi")
  assert.equal(isSlotClosed("Apm - EE1", "MERCREDI"), false, "EE1 après-midi reste ouverte")
  assert.equal(isSlotClosed("Matin - EE2", "LUNDI"), false, "EE2 matin reste ouverte")
  // La fermeture Stress historique passe par le même point d'entrée
  assert.equal(isSlotClosed("Apm - Stress", "MERCREDI"), true)
  assert.equal(isSlotClosed("Apm - Stress", "JEUDI"), false)

  sched = generateWeekSchedule(weekKey, [])
  r = canAssignDoctorToSlot("H", "2026-07-20", "Matin - EE1", "LUNDI", sched, [])
  assert.equal(r.allowed, false, "EE1 matin non assignable le lundi")
  assert.match(r.reason || "", /EE1 n’ouvre le matin que le jeudi/)
  // (H est déjà sur LFB le jeudi dans une semaine vierge — on teste avec G)
  r = canAssignDoctorToSlot("G", "2026-07-23", "Matin - EE1", "JEUDI", sched, [])
  assert.equal(r.allowed, true, `EE1 matin assignable le jeudi: ${r.reason}`)

  sched["Matin - EE1"].LUNDI = { value: ["H"], type: "doctor", status: "validated" }
  sched["Matin - EE1"].JEUDI = { value: ["Val"], type: "doctor", status: "validated" }
  const cleared = applyClosedSlotsClear(sched)
  assert.deepEqual(cleared["Matin - EE1"].LUNDI.value, [], "case fermée vidée")
  assert.equal(cleared["Matin - EE1"].LUNDI.type, "empty")
  assert.deepEqual(cleared["Matin - EE1"].JEUDI.value, ["Val"], "jeudi préservé")

  // --- H souvent en EE2 lundi matin (le créneau fixe DOC022 de V est retiré) ---
  const eeBias = applyPreferenceBias({})
  assert.deepEqual(eeBias["Matin - EE2"].LUNDI.eligible_doctors, ["H"])
  assert.equal(
    DOC022_FIXED_CLINICAL_SLOTS.some((s) => s.row === "Matin - EE2" && s.day === "LUNDI"),
    false,
    "plus de créneau fixe DOC022 sur EE2 lundi matin",
  )

  // --- R souvent en EE2 mercredi matin ; sa Scinti du mardi est inchangée ---
  assert.deepEqual(eeBias["Matin - EE2"].MERCREDI.eligible_doctors, ["R"])
  assert.ok(
    DOC022_FIXED_CLINICAL_SLOTS.some(
      (s) => s.row === "Hors site - Scinti" && s.day === "MARDI" && s.doctor === "R",
    ),
    "Scinti R mardi matin conservée",
  )
  assert.equal(
    eeBias["Matin - EE2"].MARDI,
    undefined,
    "aucune préférence EE2 le mardi matin",
  )

  // --- O souvent en EE2 vendredi matin, mais plus en créneau fixe ---
  assert.deepEqual(eeBias["Matin - EE2"].VENDREDI.eligible_doctors, ["O"])
  assert.equal(
    DOC022_FIXED_CLINICAL_SLOTS.some((s) => s.row === "Matin - EE2"),
    false,
    "plus aucun créneau fixe sur EE2 matin",
  )
  const noFixedEe2 = applyFixedClinicalAssignments(
    generateWeekSchedule(weekKey, []),
    weekKey,
    [],
  )
  assert.deepEqual(
    noFixedEe2["Matin - EE2"].VENDREDI.value,
    [],
    "EE2 vendredi matin n'est plus pré-remplie avec O",
  )
  r = canAssignDoctorToSlot("O", "2026-07-24", "Matin - EE2", "VENDREDI", noFixedEe2, [])
  assert.equal(r.allowed, true, `O reste assignable à la main: ${r.reason}`)

  // --- T toujours sur EE1 mercredi après-midi ---
  assert.ok(
    DOC022_FIXED_CLINICAL_SLOTS.some(
      (s) => s.row === "Apm - EE1" && s.day === "MERCREDI" && s.doctor === "T",
    ),
    "créneau fixe T sur EE1 mercredi après-midi",
  )
  // Scinti est une demi-journée matin : T reste libre l'après-midi
  assert.equal(periodOfRow("Hors site - Scinti", "MERCREDI"), "matin")
  assert.equal(periodOfRow("Hors site - Scinti", "JEUDI"), "day")
  const fixedSched = applyFixedClinicalAssignments(
    generateWeekSchedule(weekKey, []),
    weekKey,
    [],
  )
  assert.deepEqual(fixedSched["Apm - EE1"].MERCREDI.value, ["T"])
  assert.deepEqual(fixedSched["Hors site - Scinti"].MERCREDI.value, ["T"])
  r = canAssignDoctorToSlot("T", "2026-07-22", "Apm - EE1", "MERCREDI", fixedSched, [])
  assert.equal(r.allowed, true, `T doit rester assignable l'après-midi: ${r.reason}`)

  // --- Véro au Stress tous les mardis et mercredis matin (deux parités) ---
  for (const wk of ["2026-W30", "2026-W31"]) {
    const nurse = applyNurseFixedAssignments(generateWeekSchedule(wk, []), wk, [])
    for (const day of ["MARDI", "MERCREDI"]) {
      assert.ok(
        nurse["Matin - Stress"][day].value.includes("Véro"),
        `Véro au Stress ${day} matin (${wk})`,
      )
    }
    assert.deepEqual(
      nurse["Matin - EE1"].MARDI.value,
      [],
      `plus d'infirmière sur EE1 mardi matin (${wk})`,
    )
    assert.deepEqual(
      nurse["Matin - EE1"].MERCREDI.value,
      [],
      `plus d'infirmière sur EE1 mercredi matin (${wk})`,
    )
  }
  // --- Val à l'ETT Tessé mardi et mercredi matin dans les deux parités ---
  for (const wk of ["2026-W30", "2026-W31"]) {
    const nurse = applyNurseFixedAssignments(generateWeekSchedule(wk, []), wk, [])
    for (const day of ["MARDI", "MERCREDI"]) {
      assert.deepEqual(
        nurse["Matin - ETT Tessé"][day].value,
        ["Val"],
        `Val à l'ETT Tessé ${day} matin (${wk})`,
      )
    }
  }

  // Le jeudi matin reste ouvert : Val y garde son EE1 en semaine impaire
  const oddNurse = applyNurseFixedAssignments(
    generateWeekSchedule("2026-W31", []),
    "2026-W31",
    [],
  )
  assert.deepEqual(oddNurse["Matin - EE1"].JEUDI.value, ["Val"])

  // --- Libellé d'affichage : pas de « Dr. » pour les infirmières ---
  assert.equal(formatPersonLabel("Val"), "Val")
  assert.equal(formatPersonLabel("Véro"), "Véro")
  assert.equal(formatPersonLabel("Laura"), "Laura")
  assert.equal(formatPersonLabel("CH"), "CH", "CH = structure externe, pas un Dr.")
  assert.equal(formatPersonLabel("S"), "Dr. S")
  assert.equal(formatPersonLabel("K"), "Dr. K")
  assert.equal(formatPersonLabel(""), "—")
  assert.equal(formatPersonLabel(null), "—")
  assert.equal(formatPersonLabel("  Val  "), "Val", "libellé trimé")

  // --- IRM strictement réservée à S ---
  sched = generateWeekSchedule(weekKey, [])
  r = canAssignDoctorToSlot("G", "2026-07-20", "Hors site - IRM", "LUNDI", sched, [])
  assert.equal(r.allowed, false, "IRM interdite aux autres médecins")
  assert.match(r.reason || "", /strictement réservée à S/)
  r = canAssignDoctorToSlot("S", "2026-07-20", "Hors site - IRM", "LUNDI", sched, [])
  assert.equal(r.allowed, true, `S reste assignable à l'IRM: ${r.reason}`)

  const sOff: DoctorVacation[] = [
    {
      id: "3",
      doctor_id: "S",
      start_date: "2026-07-20",
      end_date: "2026-07-20",
      created_at: "",
      updated_at: "",
    },
  ]
  assert.equal(
    isIrmSlotClosed("Hors site - IRM", "2026-07-20", sOff),
    true,
    "case IRM grisée quand S est en congés",
  )
  assert.equal(isIrmSlotClosed("Hors site - IRM", "2026-07-20", []), false)
  assert.equal(isIrmSlotClosed("Hors site - IRM", null, sOff), false, "sans date, case ouverte")
  assert.equal(isIrmSlotClosed("Matin - Coro", "2026-07-20", sOff), false, "ne vise que l'IRM")

  // --- Vacations non bloquantes : Entrées PSS et Visite ---
  assert.equal(isNonBlockingRow("Entrées PSS"), true)
  assert.equal(isNonBlockingRow("Pré-op"), true)
  assert.equal(isNonBlockingRow("Matin - Visite"), true)
  assert.equal(isNonBlockingRow("Matin - Coro"), false)
  // Il n'existe pas de « Apm - Visite » dans la grille
  assert.equal(generateWeekSchedule(weekKey, [])["Apm - Visite"], undefined)

  sched = generateWeekSchedule(weekKey, [])
  sched["Entrées PSS"].LUNDI = { value: ["B"], type: "doctor", status: "validated" }
  sched["Pré-op"].LUNDI = { value: ["Z"], type: "doctor", status: "validated" }
  sched["Matin - Visite"].LUNDI = { value: ["U"], type: "doctor", status: "validated" }
  r = canAssignDoctorToSlot("Z", "2026-07-20", "Matin - ETT salle 1", "LUNDI", sched, [])
  assert.equal(r.allowed, true, `Pré-op ne bloque pas la matinée: ${r.reason}`)
  r = canAssignDoctorToSlot("B", "2026-07-20", "Matin - Cs PSS", "LUNDI", sched, [])
  assert.equal(r.allowed, true, `Entrées PSS ne bloque pas la matinée: ${r.reason}`)
  r = canAssignDoctorToSlot("U", "2026-07-20", "Matin - Cs PSS", "LUNDI", sched, [])
  assert.equal(r.allowed, true, `la Visite ne bloque pas la matinée: ${r.reason}`)
  // Les deux vacations survivent aux strips (pas de conflit de créneau)
  sched["Matin - Cs PSS"].LUNDI = { value: ["B", "U"], type: "doctor", status: "validated" }
  const keptNonBlocking = applySlotBlockingStrips(sched)
  assert.deepEqual(keptNonBlocking["Entrées PSS"].LUNDI.value, ["B"])
  assert.deepEqual(keptNonBlocking["Pré-op"].LUNDI.value, ["Z"])
  assert.deepEqual(keptNonBlocking["Matin - Visite"].LUNDI.value, ["U"])
  assert.deepEqual(keptNonBlocking["Matin - Cs PSS"].LUNDI.value, ["B", "U"])

  // --- Jamais deux gardes de nuit consécutives (Lun-Ven) ---
  sched = generateWeekSchedule(weekKey, [])
  sched["Garde Nuit"].MARDI = { value: ["G"], type: "doctor", status: "validated" }
  assert.equal(adjacentWeekdayNightGuard(sched, "MERCREDI", "G"), "MARDI")
  assert.equal(adjacentWeekdayNightGuard(sched, "LUNDI", "G"), "MARDI", "la veille compte aussi")
  assert.equal(adjacentWeekdayNightGuard(sched, "JEUDI", "G"), null)
  r = canAssignDoctorToSlot("G", "2026-07-22", "Garde Nuit", "MERCREDI", sched, [])
  assert.equal(r.allowed, false, "pas deux nuits consécutives")
  assert.match(r.reason || "", /deux nuits consécutives/)
  r = canAssignDoctorToSlot("G", "2026-07-23", "Garde Nuit", "JEUDI", sched, [])
  assert.equal(r.allowed, true, `nuit non adjacente autorisée: ${r.reason}`)
  // Week-end exempt : Ven Nuit -> Sam est un enchaînement voulu
  sched["Garde Nuit"].VENDREDI = { value: ["H"], type: "doctor", status: "validated" }
  r = canAssignDoctorToSlot("H", "2026-07-25", "Garde Nuit", "SAMEDI", sched, [])
  assert.equal(r.allowed, true, `week-end exempt: ${r.reason}`)

  // --- Gardes de semaine : Matin/Midi/Nuit au même médecin ---
  sched = generateWeekSchedule(weekKey, [])
  sched["Garde Nuit"].MERCREDI = { value: ["G"], type: "doctor", status: "validated" }
  // Exception saisie à la main le jeudi matin : elle doit survivre
  sched["Garde Matin"].JEUDI = { value: ["H"], type: "doctor", status: "validated" }
  sched["Garde Nuit"].JEUDI = { value: ["Z"], type: "doctor", status: "validated" }
  const coupled = applyWeekdayGardeCoupling(sched)
  assert.deepEqual(coupled["Garde Matin"].MERCREDI.value, ["G"])
  assert.deepEqual(coupled["Garde Midi"].MERCREDI.value, ["G"])
  assert.deepEqual(coupled["Garde Nuit"].MERCREDI.value, ["G"])
  assert.deepEqual(
    coupled["Garde Matin"].JEUDI.value,
    ["H"],
    "exception manuelle jamais écrasée",
  )
  assert.deepEqual(coupled["Garde Midi"].JEUDI.value, ["Z"])

  // --- Rotation LFB : une seule source, H -> S -> G ---
  assert.deepEqual([...LFB_POOL], ["H", "S", "G"])
  assert.equal(lfbDoctorForWeekNum(37), "S")
  assert.equal(lfbDoctorForWeekNum(38), "G")
  assert.equal(lfbDoctorForWeekNum(39), "H")
  // Le titulaire proposé et celui que la contrainte structurelle pose doivent
  // coïncider — ils divergeaient deux semaines sur trois.
  for (const w of [37, 38, 39, 40, 41, 42]) {
    const wkKey = `2026-W${w}`
    const built = applyStructuralConstraints(generateWeekSchedule(wkKey, []), wkKey, [])
    assert.deepEqual(
      built["Hors site - LFB"].JEUDI.value,
      [defaultLfbDoctor(w)],
      `LFB S${w} : proposition et contrainte structurelle doivent coïncider`,
    )
  }

  // --- FV n'est jamais propagé par le couplage des gardes de semaine ---
  // Externe : Garde Nuit du lundi et Coro du jeudi apm, rien d'autre.
  const fvWeek = "2026-W40"
  const fvBuilt = applyStructuralConstraints(generateWeekSchedule(fvWeek, []), fvWeek, [])
  assert.deepEqual(fvBuilt["Garde Nuit"].LUNDI.value, ["FV"])
  assert.deepEqual(
    fvBuilt["Garde Matin"].LUNDI.value,
    [],
    "FV ne doit pas être propagé sur la Garde Matin du lundi",
  )
  assert.deepEqual(fvBuilt["Garde Midi"].LUNDI.value, [])
  // O reste librement assignable sur cette Garde Matin, avec l'interne I
  const mondayStr = dateStrForWeekDay(fvWeek, "LUNDI")!
  r = canAssignDoctorToSlot("O", mondayStr, "Garde Matin", "LUNDI", fvBuilt, [])
  assert.equal(r.allowed, true, `O doit rester assignable: ${r.reason}`)
  fvBuilt["Garde Matin"].LUNDI = { value: ["I"], type: "doctor", status: "validated" }
  r = canAssignDoctorToSlot("O", mondayStr, "Garde Matin", "LUNDI", fvBuilt, [])
  assert.equal(r.allowed, true, `O assignable à côté de I: ${r.reason}`)

  // --- Créneau hors site porté par la case (matin / apm / journée) ---
  const offWeek = "2026-W40"
  const thuStr = dateStrForWeekDay(offWeek, "JEUDI")!
  let off = generateWeekSchedule(offWeek, [])
  off["Hors site - LFB"].JEUDI = { value: ["H"], type: "doctor", status: "validated" }

  // Défaut : journée entière → indisponible matin ET après-midi
  assert.equal(offSiteSlotOf(off, "Hors site - LFB", "JEUDI"), "day")
  assert.equal(periodOfRow("Hors site - LFB", "JEUDI", off), "day")
  assert.equal(
    canAssignDoctorToSlot("H", thuStr, "Matin - Cs PSS", "JEUDI", off, []).allowed,
    false,
  )
  assert.equal(
    canAssignDoctorToSlot("H", thuStr, "Apm - Cs PSS", "JEUDI", off, []).allowed,
    false,
  )

  // Hors site le matin → disponible l'après-midi
  const offMatin = setOffSiteSlot(off, "Hors site - LFB", "JEUDI", "matin")
  assert.equal(periodOfRow("Hors site - LFB", "JEUDI", offMatin), "matin")
  assert.equal(
    canAssignDoctorToSlot("H", thuStr, "Apm - Cs PSS", "JEUDI", offMatin, []).allowed,
    true,
    "hors site le matin : l'après-midi reste libre",
  )
  assert.equal(
    canAssignDoctorToSlot("H", thuStr, "Matin - Cs PSS", "JEUDI", offMatin, []).allowed,
    false,
    "le matin reste occupé",
  )

  // Hors site l'après-midi → disponible le matin
  const offApm = setOffSiteSlot(off, "Hors site - LFB", "JEUDI", "apm")
  assert.equal(periodOfRow("Hors site - LFB", "JEUDI", offApm), "apm")
  assert.equal(
    canAssignDoctorToSlot("H", thuStr, "Matin - Cs PSS", "JEUDI", offApm, []).allowed,
    true,
    "hors site l'après-midi : le matin reste libre",
  )
  assert.equal(
    canAssignDoctorToSlot("H", thuStr, "Apm - Cs PSS", "JEUDI", offApm, []).allowed,
    false,
  )

  // setOffSiteSlot(null) efface le choix explicite → retour au défaut
  assert.equal(
    offSiteSlotOf(setOffSiteSlot(offApm, "Hors site - LFB", "JEUDI", null), "Hors site - LFB", "JEUDI"),
    "day",
  )
  // Ne modifie pas l'objet reçu
  assert.equal(off["Hors site - LFB"].JEUDI.offSiteSlot, undefined)

  // Rétrocompatibilité : les plannings enregistrés sans le champ gardent
  // exactement le comportement des anciennes tables statiques.
  off = generateWeekSchedule(offWeek, [])
  assert.equal(offSiteSlotOf(off, "Hors site - IRM", "LUNDI"), "matin")
  assert.equal(offSiteSlotOf(off, "Hors site - IRM", "VENDREDI"), "apm")
  assert.equal(offSiteSlotOf(off, "Hors site - CDL", "MARDI"), "matin")
  assert.equal(offSiteSlotOf(off, "Hors site - Scinti", "MERCREDI"), "matin")
  assert.equal(offSiteSlotOf(off, "Hors site - PSSL", "JEUDI"), "day")
  assert.equal(offSiteSlotOf(off, "Matin - Coro", "LUNDI"), null, "ne vise que le hors site")
  assert.equal(isOffSiteRow("Hors site - NCT"), true)
  assert.equal(isOffSiteRow("Matin - Coro"), false)

  // --- Visite : un changement manuel se reporte du lundi au vendredi ---
  const visWeek = "2026-W40"
  const visRow = "Matin - Visite"
  let vis = generateWeekSchedule(visWeek, [])
  const rotationDoctor = vis[visRow].LUNDI.value[0]
  assert.ok(rotationDoctor, "la semaine générée porte déjà un titulaire de visite")

  vis[visRow].MERCREDI = { value: ["B"], type: "doctor", status: "validated" }
  const spread = spreadVisiteAcrossWeek(vis, visWeek, "MERCREDI", [])
  for (const day of ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI"]) {
    assert.deepEqual(spread[visRow][day].value, ["B"], `visite reportée sur ${day}`)
  }
  // Le week-end n'est pas touché
  assert.deepEqual(spread[visRow].SAMEDI.value, [])

  // Contrainte le matin d'un jour : congés → case laissée vide ce jour-là
  const bOff: DoctorVacation[] = [
    {
      id: "4",
      doctor_id: "B",
      start_date: dateStrForWeekDay(visWeek, "JEUDI")!,
      end_date: dateStrForWeekDay(visWeek, "JEUDI")!,
      created_at: "",
      updated_at: "",
    },
  ]
  const spreadOff = spreadVisiteAcrossWeek(vis, visWeek, "MERCREDI", bOff)
  assert.deepEqual(spreadOff[visRow].JEUDI.value, [], "jour de congés laissé vide")
  assert.deepEqual(spreadOff[visRow].LUNDI.value, ["B"], "les autres jours suivent")

  // Contrainte ½ journée off matin → même traitement
  const visHalf = structuredClone(vis)
  visHalf["1/2 journée off Matin"].VENDREDI = {
    value: ["B"],
    type: "doctor",
    status: "validated",
  }
  const spreadHalf = spreadVisiteAcrossWeek(visHalf, visWeek, "MERCREDI", [])
  assert.deepEqual(spreadHalf[visRow].VENDREDI.value, [], "½ off matin : pas de visite")
  assert.deepEqual(spreadHalf[visRow].JEUDI.value, ["B"])

  // Case explicitement vidée par l'admin : jamais re-remplie
  const visCleared = structuredClone(vis)
  visCleared[visRow].MARDI = {
    value: [],
    type: "empty",
    status: "validated",
    manuallyCleared: true,
  }
  const spreadCleared = spreadVisiteAcrossWeek(visCleared, visWeek, "MERCREDI", [])
  assert.deepEqual(spreadCleared[visRow].MARDI.value, [], "case vidée à la main respectée")
  assert.deepEqual(spreadCleared[visRow].LUNDI.value, ["B"])

  // L'objet d'origine n'est pas muté
  assert.deepEqual(vis[visRow].LUNDI.value, [rotationDoctor])

  // La visite ne bloque ni le matin ni l'après-midi
  const thuVisite = dateStrForWeekDay(visWeek, "JEUDI")!
  assert.equal(
    canAssignDoctorToSlot("B", thuVisite, "Apm - Cs PSS", "JEUDI", spread, []).allowed,
    true,
    "visite le matin : l'après-midi reste libre",
  )
  assert.equal(
    canAssignDoctorToSlot("B", thuVisite, "Matin - ETT salle 1", "JEUDI", spread, []).allowed,
    true,
    "visite non bloquante : autre tâche possible le matin",
  )

  // --- Le sélecteur de créneau hors site impose / lève la restriction ---
  const restrWeek = "2026-W40"
  const restrDay = "JEUDI"
  const buildRestr = () => {
    const base = generateWeekSchedule(restrWeek, [])
    base["Hors site - LFB"][restrDay] = { value: ["H"], type: "doctor", status: "validated" }
    base["Matin - Cs PSS"][restrDay] = { value: ["H"], type: "doctor", status: "validated" }
    base["Apm - Cs PSS"][restrDay] = { value: ["H"], type: "doctor", status: "validated" }
    return base
  }

  // « Matin » : la matinée est prise, l'après-midi reste au médecin
  const toMatin = applyOffSiteSlotRestriction(
    setOffSiteSlot(buildRestr(), "Hors site - LFB", restrDay, "matin"),
    "Hors site - LFB",
    restrDay,
  )
  assert.deepEqual(toMatin.next["Matin - Cs PSS"][restrDay].value, [])
  assert.deepEqual(toMatin.next["Apm - Cs PSS"][restrDay].value, ["H"])
  assert.deepEqual(toMatin.removed, [{ row: "Matin - Cs PSS", doctor: "H" }])

  // « Après-midi » : symétrique
  const toApm = applyOffSiteSlotRestriction(
    setOffSiteSlot(buildRestr(), "Hors site - LFB", restrDay, "apm"),
    "Hors site - LFB",
    restrDay,
  )
  assert.deepEqual(toApm.next["Matin - Cs PSS"][restrDay].value, ["H"])
  assert.deepEqual(toApm.next["Apm - Cs PSS"][restrDay].value, [])

  // « Journée » : la restriction est imposée sur les deux demi-journées
  const toDay = applyOffSiteSlotRestriction(
    setOffSiteSlot(buildRestr(), "Hors site - LFB", restrDay, "day"),
    "Hors site - LFB",
    restrDay,
  )
  assert.deepEqual(toDay.next["Matin - Cs PSS"][restrDay].value, [])
  assert.deepEqual(toDay.next["Apm - Cs PSS"][restrDay].value, [])
  assert.equal(toDay.removed.length, 2)
  assert.equal(
    canAssignDoctorToSlot("H", dateStrForWeekDay(restrWeek, restrDay)!, "Apm - Cs PSS", restrDay, toDay.next, [])
      .allowed,
    false,
    "en journée entière, l'après-midi est de nouveau interdit",
  )

  // Une garde n'est jamais retirée en silence : elle est signalée
  const withGarde = buildRestr()
  withGarde["Garde Matin"][restrDay] = { value: ["H"], type: "doctor", status: "validated" }
  const gardeKept = applyOffSiteSlotRestriction(
    setOffSiteSlot(withGarde, "Hors site - LFB", restrDay, "day"),
    "Hors site - LFB",
    restrDay,
  )
  assert.deepEqual(gardeKept.next["Garde Matin"][restrDay].value, ["H"], "garde conservée")
  assert.deepEqual(gardeKept.conflicts, [{ row: "Garde Matin", doctor: "H" }])

  // Ligne non hors site : sans effet
  const noop = applyOffSiteSlotRestriction(buildRestr(), "Matin - Cs PSS", restrDay)
  assert.deepEqual(noop.removed, [])
  assert.deepEqual(noop.conflicts, [])

  console.log("✅ vacation-preferences tests passed")
}

main()
