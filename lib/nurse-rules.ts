/**
 * Règles de binôme infirmière/médecin (Val, Véro, Laura) - confirmé
 * utilisateur 31/07/2026.
 *
 * - Val : ETT2 et ETT Tessé -> SEULE, jamais de binôme.
 *         Stress et EE -> binôme OBLIGATOIRE avec un médecin du pool
 *         correspondant.
 * - Véro, Laura : ne font jamais ETT2 ni ETT Tessé - uniquement Stress/EE,
 *         toujours en binôme.
 * - "La vacation est considérée comme indisponible si l'un du couple
 *   (infirmière/médecin) est absent" : si le partenaire prévu est en congé,
 *   la case devient indisponible pour l'infirmière aussi (et vice versa) -
 *   voir `isNursePairAvailable`, à combiner avec le planning hebdomadaire
 *   Val/Véro (bloc 3/4) pour identifier le partenaire du jour.
 */

export const NURSES = ["Val", "Véro", "Laura"] as const
export type NurseId = (typeof NURSES)[number]

export function isNurse(doctorId: string): doctorId is NurseId {
  return (NURSES as readonly string[]).includes(doctorId)
}

/** Lignes où Val peut être seule, sans binôme (ETT2 et ETT Tessé). */
export const NURSE_SOLO_ROWS = [
  "Matin - ETT salle 2",
  "Apm - ETT salle 2",
  "Matin - ETT Tessé",
  "Apm - ETT Tessé",
]

/** Lignes qui exigent un binôme (Stress et EE, matin ET après-midi). */
export const NURSE_BINOME_ROWS = [
  "Matin - Stress",
  "Apm - Stress",
  "Matin - EE1",
  "Apm - EE1",
  "Matin - EE2",
  "Apm - EE2",
]

/** Pool de médecins partenaires possibles pour Stress avec une infirmière. */
export const STRESS_PARTNER_POOL = ["Z", "B", "D", "H", "G", "S", "K"]

/** Pool de médecins partenaires possibles pour EE (EE1/EE2) avec une infirmière. */
export const EE_PARTNER_POOL = ["Z", "B", "D", "K", "R", "O", "P", "U", "A", "M", "W", "V", "H", "S", "G"]

function isStressRow(rowKey: string): boolean {
  return rowKey === "Matin - Stress" || rowKey === "Apm - Stress"
}

function isEeRow(rowKey: string): boolean {
  return (
    rowKey === "Matin - EE1" ||
    rowKey === "Apm - EE1" ||
    rowKey === "Matin - EE2" ||
    rowKey === "Apm - EE2"
  )
}

/**
 * Un médecin donné peut-il être le partenaire d'une infirmière sur cette ligne ?
 */
export function isValidNursePartner(doctorId: string, rowKey: string): boolean {
  if (isStressRow(rowKey)) return STRESS_PARTNER_POOL.includes(doctorId)
  if (isEeRow(rowKey)) return EE_PARTNER_POOL.includes(doctorId)
  return false
}

/**
 * Une infirmière nécessite-t-elle un binôme sur cette ligne ? (false pour
 * ETT2/ETT Tessé - Val peut y être seule ; true pour Stress/EE).
 */
export function nurseRequiresBinome(rowKey: string): boolean {
  return isStressRow(rowKey) || isEeRow(rowKey)
}

export type ValFixedSlot = { row: string; day: string; slot: "matin" | "am" }

/**
 * Planning fixe de Val (confirmé utilisateur 31/07/2026), selon parité de
 * semaine et statut du 1er jeudi du mois pour D (voir stress-rules.ts,
 * `isFirstThursdayOfMonth`) :
 *
 * Semaine paire : Lun Stress matin+am ; Mar ETT Tessé matin + EE am ;
 * Mer ETT Tessé matin + ETT2 am ; Jeu Stress matin + EE am ;
 * Ven ETT2 matin, absence fixe am.
 *
 * Semaine impaire : Lun absence fixe ; Mar Stress matin (am libre/flexible,
 * non forcé - alternance manuelle avec Véro) ; Mer Stress matin + ETT2 am ;
 * Jeu EE matin (D est toujours Stress le matin) + [EE si D fait Stress
 * l'am (1er jeudi du mois), Stress si D fait EE l'am (autres jeudis)] ;
 * Ven ETT2 matin + EE am.
 *
 * N'inclut PAS le binôme médecin requis sur Stress/EE (voir
 * `nurseRequiresBinome`/`isValidNursePartner` - à associer séparément lors
 * de l'application, pas de partenaire imposé ici).
 */
export function valFixedSlotsForWeek(weekKey: string, isFirstThursday: boolean): ValFixedSlot[] {
  const odd = isOddIsoWeekLocal(weekKey)
  if (!odd) {
    return [
      { row: "Matin - Stress", day: "LUNDI", slot: "matin" },
      { row: "Apm - Stress", day: "LUNDI", slot: "am" },
      { row: "Matin - ETT Tessé", day: "MARDI", slot: "matin" },
      { row: "Apm - EE1", day: "MARDI", slot: "am" },
      { row: "Matin - ETT Tessé", day: "MERCREDI", slot: "matin" },
      { row: "Apm - ETT salle 2", day: "MERCREDI", slot: "am" },
      { row: "Matin - Stress", day: "JEUDI", slot: "matin" },
      { row: "Apm - EE1", day: "JEUDI", slot: "am" },
      { row: "Matin - ETT salle 2", day: "VENDREDI", slot: "matin" },
      // Vendredi am : absence fixe - rien à ajouter.
    ]
  }
  // Semaine impaire
  const slots: ValFixedSlot[] = [
    // Lundi : absence fixe - rien à ajouter.
    { row: "Matin - Stress", day: "MARDI", slot: "matin" },
    // Mardi am : libre/flexible (alternance manuelle avec Véro) - non forcé.
    { row: "Matin - Stress", day: "MERCREDI", slot: "matin" },
    { row: "Apm - ETT salle 2", day: "MERCREDI", slot: "am" },
    { row: "Matin - EE1", day: "JEUDI", slot: "matin" }, // D toujours Stress le matin -> Val toujours EE
    { row: "Matin - ETT salle 2", day: "VENDREDI", slot: "matin" },
    { row: "Apm - EE1", day: "VENDREDI", slot: "am" },
  ]
  // Jeudi après-midi : complément exact de D (D Stress 1er jeudi -> Val EE ;
  // D EE les autres jeudis -> Val Stress).
  slots.push({
    row: isFirstThursday ? "Apm - EE1" : "Apm - Stress",
    day: "JEUDI",
    slot: "am",
  })
  return slots
}

function isOddIsoWeekLocal(weekKey: string): boolean {
  const weekNum = Number.parseInt(weekKey.split("-W")[1] || "1", 10)
  return weekNum % 2 === 1
}

/**
 * Planning fixe de Laura (infirmière) - confirmé utilisateur 31/07/2026 :
 * repli automatique de Véro sur "Stress matin" le vendredi, semaines
 * impaires uniquement (Véro est en absence fixe ce jour-là ces semaines-là).
 * Comme les autres infirmières, Stress reste soumis au binôme obligatoire
 * (voir `nurseRequiresBinome`/`isValidNursePartner`).
 */
export function lauraFixedSlotsForWeek(weekKey: string): ValFixedSlot[] {
  const odd = isOddIsoWeekLocal(weekKey)
  if (!odd) return []
  return [{ row: "Matin - Stress", day: "VENDREDI", slot: "matin" }]
}

/**
 * Planning fixe de Véro (confirmé utilisateur 31/07/2026) :
 *
 * Semaine paire : Lun absence fixe ; Mar Stress matin (am libre, alternance
 * manuelle avec Val) ; Mer Stress matin + absence fixe am ; Jeu suit
 * EXACTEMENT le roulement de D (Stress matin toujours ; am Stress si 1er
 * jeudi du mois, sinon EE1+EE2) ; Ven Stress matin + EE am.
 *
 * Semaine impaire : Lun Stress matin+am ; Mar Stress matin (am libre) ;
 * Mer Stress matin + absence fixe am ; Jeu même roulement que D ;
 * Ven absence fixe (repli possible : Laura, Stress matin uniquement, pas
 * automatique - à assigner manuellement si besoin).
 */
export function veroFixedSlotsForWeek(weekKey: string, isFirstThursday: boolean): ValFixedSlot[] {
  const odd = isOddIsoWeekLocal(weekKey)
  const thursdaySlots: ValFixedSlot[] = [
    { row: "Matin - Stress", day: "JEUDI", slot: "matin" },
  ]
  if (isFirstThursday) {
    thursdaySlots.push({ row: "Apm - Stress", day: "JEUDI", slot: "am" })
  } else {
    thursdaySlots.push({ row: "Apm - EE1", day: "JEUDI", slot: "am" })
    thursdaySlots.push({ row: "Apm - EE2", day: "JEUDI", slot: "am" })
  }

  if (!odd) {
    return [
      // Lundi : absence fixe - rien à ajouter.
      { row: "Matin - Stress", day: "MARDI", slot: "matin" },
      // Mardi am : libre (alternance manuelle avec Val) - non forcé.
      { row: "Matin - Stress", day: "MERCREDI", slot: "matin" },
      // Mercredi am : absence fixe - rien à ajouter.
      ...thursdaySlots,
      { row: "Matin - Stress", day: "VENDREDI", slot: "matin" },
      { row: "Apm - EE1", day: "VENDREDI", slot: "am" },
    ]
  }
  return [
    { row: "Matin - Stress", day: "LUNDI", slot: "matin" },
    { row: "Apm - Stress", day: "LUNDI", slot: "am" },
    { row: "Matin - Stress", day: "MARDI", slot: "matin" },
    // Mardi am : libre (alternance manuelle avec Val) - non forcé.
    { row: "Matin - Stress", day: "MERCREDI", slot: "matin" },
    // Mercredi am : absence fixe - rien à ajouter.
    ...thursdaySlots,
    // Vendredi : absence fixe - rien à ajouter (repli Laura possible,
    // manuel uniquement, voir doc ci-dessus).
  ]
}
