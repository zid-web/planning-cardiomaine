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

/** Un médecin donné peut-il être le partenaire d'une infirmière sur cette ligne ? */
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
