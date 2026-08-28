/**
 * Règles de binôme infirmière/médecin (Val, Véro, Laura) - confirmé
 * utilisateur 31/07/2026.
 *
 * - Val : ETT2 et ETT Tessé -> SEULE, jamais de binôme.
 *         Stress et EE -> binôme OBLIGATOIRE avec un médecin du pool
 *         correspondant.
 * - Véro, Laura : ne font jamais ETT2 ni ETT Tessé - uniquement Stress/EE,
 *         toujours en binôme.
 * - Val en ETT : TOUJOURS ETT salle 2, jamais ETT salle 1 (consigne 26/08/2026).
 * - Laura en congés : repli systématique sur Val (consigne 26/08/2026).
 * - "La vacation est considérée comme indisponible si l'un du couple
 *   (infirmière/médecin) est absent" : si le partenaire prévu est en congé,
 *   la case devient indisponible pour l'infirmière aussi (et vice versa) -
 *   voir `isNursePairAvailable`, à combiner avec le planning hebdomadaire
 *   Val/Véro (bloc 3/4) pour identifier le partenaire du jour.
 */

import type { DoctorVacation, ScheduleData } from "@/lib/types"
import { dateStrForWeekDay, isDoctorOnVacationForFixed } from "@/lib/fixed-assignments"
import { preferredPartnerForNurseSlot } from "@/lib/vacation-preferences"
import { NURSES } from "@/lib/constants"

export { NURSES } from "@/lib/constants"
export type NurseId = (typeof NURSES)[number]

export function isNurse(doctorId: string): doctorId is NurseId {
  return (NURSES as readonly string[]).includes(doctorId)
}

/**
 * Lignes ETT interdites par infirmière (consigne utilisateur 26/08/2026).
 * Val en ETT = **toujours** ETT salle 2, jamais salle 1 (ETT Tessé reste un
 * site distinct et lui reste ouvert).
 */
export const NURSE_FORBIDDEN_ROWS: Record<string, readonly string[]> = {
  Val: ["Matin - ETT salle 1", "Apm - ETT salle 1"],
}

/**
 * Infirmière de repli quand la titulaire est en congés (consigne utilisateur
 * 26/08/2026 : Laura absente → Val systématiquement).
 */
export const NURSE_ABSENCE_FALLBACK: Record<string, string> = {
  Laura: "Val",
}

/** L'infirmière peut-elle prendre cette ligne ? (false = affectation interdite) */
export function canNurseTakeRow(nurseId: string, rowKey: string): boolean {
  const forbidden = NURSE_FORBIDDEN_ROWS[nurseId]
  if (!forbidden) return true
  return !forbidden.includes(rowKey)
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
 * Val est à l'ETT Tessé les mardis et mercredis matin dans les deux parités
 * (consigne 26/08/2026).
 *
 * Semaine impaire : Lun absence fixe ; Mar ETT Tessé matin (am libre/flexible) ;
 * Mer ETT Tessé matin + ETT2 am ;
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
    // Val est à l'ETT Tessé les mardis et mercredis matin dans les deux
    // parités (consigne 26/08/2026) : le Stress du mardi matin revient à Véro
    // toutes les semaines et EE1 matin est fermée le mercredi.
    { row: "Matin - ETT Tessé", day: "MARDI", slot: "matin" },
    // Mardi am : libre/flexible (alternance manuelle avec Véro) - non forcé.
    { row: "Matin - ETT Tessé", day: "MERCREDI", slot: "matin" },
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
 * Planning fixe de Véro :
 *
 * Semaine paire : Lun absence fixe ; Mar Stress matin (Val à ETT Tessé) ;
 * Mer Stress matin ; Jeu miroir D (Stress matin + D) ; Ven Stress matin.
 *
 * Semaine impaire : Lun Stress matin+am ; Mar Stress matin ; Mer Stress matin ;
 * Jeu miroir D (Stress matin + D) ; Ven absence fixe.
 * Véro est au Stress **tous** les mardis et mercredis matin (consigne 26/08/2026).
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
      // Mardi am : libre - non forcé.
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
    { row: "Matin - Stress", day: "MARDI", slot: "matin" }, // Véro est au Stress tous les mardis matin (consigne 26/08/2026)
    // Mardi am : libre - non forcé.
    { row: "Matin - Stress", day: "MERCREDI", slot: "matin" }, // Mercredi : Véro est sur Stress -> Val est sur EE1
    // Mercredi am : absence fixe - rien à ajouter.
    ...thursdaySlots,
    // Vendredi : absence fixe - rien à ajouter.
  ]
}

/**
 * Assure qu'une infirmière (Véro ou Val) positionnée sur une vacation Stress/EE
 * dispose systématiquement d'un médecin partenaire associé (cases à double affectation).
 *
 * Pour Véro le jeudi matin sur Matin - Stress : obligatoirement couplée avec D.
 * Pour les autres vacations Stress/EE avec Véro ou Val : propose un médecin
 * disponible du pool correspondant (STRESS_PARTNER_POOL / EE_PARTNER_POOL).
 */
/** Paires de salles EE d'un même créneau. */
const EE_ROOM_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["Matin - EE1", "Matin - EE2"],
  ["Apm - EE1", "Apm - EE2"],
]

/**
 * Val sur EE tient **les deux salles** du créneau, avec le **même médecin**
 * (consigne utilisateur 27/08/2026). Elle n'était jusqu'ici placée que sur EE1.
 *
 * Le miroir est prudent :
 * - jamais dans une salle déjà occupée par une autre infirmière (Val et Véro
 *   ne sont jamais dans la même case) ;
 * - le médecin n'est recopié que si la salle cible n'en a pas — une saisie
 *   manuelle différente (ex. DAAS sur EE2 le lundi) est conservée ;
 * - une case explicitement vidée par l'admin n'est jamais re-remplie.
 */
export function ensureValOnBothEeRooms(schedule: ScheduleData): ScheduleData {
  const DAYS_LIST = ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI", "DIMANCHE"]
  let next = schedule

  for (const day of DAYS_LIST) {
    for (const [roomA, roomB] of EE_ROOM_PAIRS) {
      const inA = (next[roomA]?.[day]?.value || []).includes("Val")
      const inB = (next[roomB]?.[day]?.value || []).includes("Val")
      if (inA === inB) continue // absente des deux, ou déjà sur les deux

      const source = inA ? roomA : roomB
      const target = inA ? roomB : roomA
      const targetCell = next[target]?.[day]
      if (!targetCell || targetCell.manuallyCleared) continue

      const targetValues = targetCell.value || []
      // Une autre infirmière tient déjà cette salle : ne pas la doubler.
      if (targetValues.some((d) => isNurse(d) && d !== "Val")) continue

      const sourceValues = next[source]?.[day]?.value || []
      const sourceDoctor = sourceValues.find((d) => !isNurse(d))
      const targetHasDoctor = targetValues.some((d) => !isNurse(d))

      const merged = [...targetValues, "Val"]
      if (sourceDoctor && !targetHasDoctor) merged.push(sourceDoctor)

      next = {
        ...next,
        [target]: {
          ...next[target],
          [day]: {
            ...targetCell,
            value: Array.from(new Set(merged)),
            type: "doctor",
            status: targetCell.status === "pending" ? "pending" : "validated",
          },
        },
      }
    }
  }

  return next
}

export function ensureNurseDoctorBinomeProposals(
  schedule: ScheduleData,
  weekKey: string,
  vacations: DoctorVacation[] = [],
): ScheduleData {
  let next = schedule
  const dateStrFn = (day: string) => dateStrForWeekDay(weekKey, day)

  const NURSE_STRESS_EE_ROWS = [
    "Matin - Stress", "Apm - Stress",
    "Matin - EE1", "Apm - EE1",
    "Matin - EE2", "Apm - EE2",
  ] as const

  const DAYS_LIST = ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI", "DIMANCHE"]

  // 0. Sécurité : Val et Véro ne sont JAMAIS ensemble dans la même case
  for (const rowKey of NURSE_STRESS_EE_ROWS) {
    if (!next[rowKey]) continue
    for (const day of DAYS_LIST) {
      const cell = next[rowKey][day]
      if (!cell) continue
      const vals = cell.value || []
      if (vals.includes("Val") && vals.includes("Véro")) {
        // Enlever Val de cette case
        const cleaned = vals.filter((d) => d !== "Val")
        next = {
          ...next,
          [rowKey]: {
            ...next[rowKey],
            [day]: {
              ...cell,
              value: cleaned,
            },
          },
        }
      }
    }
  }

  // 1. Jeudi Matin - Stress : D + Véro systématiques (double affectation)
  const thuDate = dateStrFn("JEUDI")
  if (thuDate && next["Matin - Stress"]?.JEUDI) {
    const dAbs = isDoctorOnVacationForFixed("D", thuDate, vacations)
    const veroAbs = isDoctorOnVacationForFixed("Véro", thuDate, vacations)
    if (!dAbs && !veroAbs) {
      const cell = next["Matin - Stress"].JEUDI
      const current = cell.value || []
      const hasD = current.includes("D")
      const hasVero = current.includes("Véro")
      if (!hasD || !hasVero) {
        const merged = Array.from(new Set([...current.filter(d => d !== "Val"), "D", "Véro"]))
        next = {
          ...next,
          ["Matin - Stress"]: {
            ...next["Matin - Stress"],
            JEUDI: {
              ...cell,
              value: merged,
              type: "doctor",
              status: cell.status === "pending" ? "pending" : "validated",
            },
          },
        }
      }
    }
  }

  // 2. Pour toute vacation Stress/EE où Véro ou Val est présente sans médecin

  for (const rowKey of NURSE_STRESS_EE_ROWS) {
    if (!next[rowKey]) continue
    const pool = rowKey.includes("Stress") ? STRESS_PARTNER_POOL : EE_PARTNER_POOL

    for (const day of DAYS_LIST) {
      const cell = next[rowKey][day]
      if (!cell) continue
      const vals = cell.value || []
      const hasNurse = vals.some((d) => isNurse(d))
      if (!hasNurse) continue

      // Y a-t-il déjà un médecin dans cette case ?
      const hasDoctorPartner = vals.some((d) => !isNurse(d) && d !== "CH")
      if (!hasDoctorPartner) {
        const dateStr = dateStrFn(day)
        const isAvailable = (doc: string) =>
          !dateStr || !isDoctorOnVacationForFixed(doc, dateStr, vacations)
        // Préférence groupe pour cette case (K mardi matin, S vendredi matin…),
        // sinon premier médecin disponible du pool.
        const preferred = preferredPartnerForNurseSlot(rowKey, day, pool, {
          weekKey,
          schedule: next,
          vacations,
          dateStrForDay: dateStrFn,
        })
        const candidate =
          preferred && isAvailable(preferred) ? preferred : pool.find(isAvailable)
        if (candidate) {
          next = {
            ...next,
            [rowKey]: {
              ...next[rowKey],
              [day]: {
                ...cell,
                value: Array.from(new Set([...vals, candidate])),
                type: "doctor",
                status: cell.status === "pending" ? "pending" : "validated",
              },
            },
          }
        }
      }
    }
  }

  return next
}

