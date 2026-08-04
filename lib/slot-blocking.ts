/**
 * Règles d’assignation bloquantes (matin / après-midi / garde / ½-off / congés).
 * Exception : cumul Astreinte ATL Matin/Midi + Coro correspondant.
 * Doublon Cs : 2× le même médecin dans la **même** case → ².
 * Doublon ETT / EE : présent sur **les deux salles** du même créneau → ²
 *   (ETT salle 1+2, EE1+EE2).
 * Jamais Cs PSS + Cs Tessée le même matin/apm.
 * Interne **I** sur Garde Matin : le médecin associé peut aussi faire Cs / ETT / EE
 * le même matin (pas Coro / Rythmo / Rééducation). **S+I** peut aussi garder l’IRM.
 * **S** mercredi apm : ETT ped (salle 1) + Garde Midi / ATL Midi autorisés.
 * Une garde admin peut remplacer l’IRM fixe sur le même créneau.
 */

import { DAYS } from "@/lib/constants"
import { isListedDoctor } from "@/lib/doctor-code"
import { isAtlEligibleForCell, isCoroEligibleDoctor } from "@/lib/group-clinical-rules"
import { HALF_DAY_OFF_APM_ROW, HALF_DAY_OFF_MATIN_ROW } from "@/lib/half-day-off"
import {
  appendSpecialDoctorLabel,
  isEttPedWithGardeOrAtlMidi,
} from "@/lib/special-activity-labels"
import { isStressSlotClosed } from "@/lib/stress-rules"
import type { DoctorVacation, ScheduleData } from "@/lib/types"
import { isDoctorUnavailable } from "@/lib/assignment-validation"
import { isRoomUnderMaintenanceOnDate } from "@/lib/room-maintenance"
import { isNurse, isValidNursePartner, nurseRequiresBinome } from "@/lib/nurse-rules"

export type DayPeriod = "matin" | "apm" | "nuit" | "day" | "meta"

const GARDE_ROWS = ["Garde Matin", "Garde Midi", "Garde Nuit"] as const
const LFB_ROW = "Hors site - LFB"
const CDL_ROW = "Hors site - CDL"
const IRM_ROW = "Hors site - IRM"
const ATL_ROWS = [
  "Astreintes ATL Matin",
  "Astreintes ATL Midi",
  "Astreintes ATL Nuit",
] as const

/** Code de l’interne (associé à un médecin sur Garde Matin). */
export const INTERN_CODE = "I"

export function isGardeRow(rowKey: string): boolean {
  return (GARDE_ROWS as readonly string[]).includes(rowKey)
}

export function isWeekendDay(day: string): boolean {
  return day === "SAMEDI" || day === "DIMANCHE"
}

export function isAtlRow(rowKey: string): boolean {
  return (ATL_ROWS as readonly string[]).includes(rowKey)
}

/** Case garde qui contient déjà un remplaçant (texte libre). */
export function cellHasRemplacant(
  schedule: ScheduleData,
  rowKey: string,
  day: string,
): boolean {
  const cell = schedule[rowKey]?.[day]
  if (!cell) return false
  if (cell.remplacant?.trim()) return true
  return (cell.value || []).some((v) => Boolean(v) && !isListedDoctor(v))
}

/** Doublon même cellule (2ᵉ clic) : Cs uniquement. */
export const SAME_CELL_DOUBLON_ROWS = new Set([
  "Matin - Cs PSS",
  "Matin - Cs Tessée",
  "Apm - Cs PSS",
  "Apm - Cs Tessée",
])

/** @deprecated alias — préférer SAME_CELL_DOUBLON_ROWS */
export const CS_SAME_CELL_DOUBLON_ROWS = SAME_CELL_DOUBLON_ROWS

export const ETT_DOUBLON_PAIRS: Record<"Matin" | "Apm", [string, string]> = {
  Matin: ["Matin - ETT salle 1", "Matin - ETT salle 2"],
  Apm: ["Apm - ETT salle 1", "Apm - ETT salle 2"],
}

/** Doublon EE = présent sur EE1 et EE2 le même créneau (comme ETT). */
export const EE_DOUBLON_PAIRS: Record<"Matin" | "Apm", [string, string]> = {
  Matin: ["Matin - EE1", "Matin - EE2"],
  Apm: ["Apm - EE1", "Apm - EE2"],
}

/** @deprecated alias — préférer SAME_CELL_DOUBLON_ROWS */
export const DOUBLON_ELIGIBLE_ROWS = SAME_CELL_DOUBLON_ROWS

export function isDoublonEligibleRow(rowKey: string): boolean {
  return SAME_CELL_DOUBLON_ROWS.has(rowKey)
}

export function isEttRow(rowKey: string): boolean {
  return /ETT salle [12]/.test(rowKey)
}

export function isEeRow(rowKey: string): boolean {
  return rowKey === "Matin - EE1" || rowKey === "Matin - EE2" || rowKey === "Apm - EE1" || rowKey === "Apm - EE2"
}

function ettPairForRow(rowKey: string): [string, string] | null {
  if (rowKey.startsWith("Matin - ETT")) return ETT_DOUBLON_PAIRS.Matin
  if (rowKey.startsWith("Apm - ETT")) return ETT_DOUBLON_PAIRS.Apm
  return null
}

function eePairForRow(rowKey: string): [string, string] | null {
  if (rowKey === "Matin - EE1" || rowKey === "Matin - EE2") return EE_DOUBLON_PAIRS.Matin
  if (rowKey === "Apm - EE1" || rowKey === "Apm - EE2") return EE_DOUBLON_PAIRS.Apm
  return null
}

/** Paire de salles pour un doublon croisé (ETT ou EE), sinon null. */
export function roomDoublonPairForRow(rowKey: string): [string, string] | null {
  return ettPairForRow(rowKey) || eePairForRow(rowKey)
}

/** Autre salle d’une paire ETT/EE (pour doublon croisé), sinon null. */
export function sisterRoomForDoublon(rowKey: string): string | null {
  const pair = roomDoublonPairForRow(rowKey)
  if (!pair) return null
  if (pair[0] === rowKey) return pair[1]
  if (pair[1] === rowKey) return pair[0]
  return null
}

/** Cliniques matin autorisées avec Garde Matin + I. */
export function isInternCompatibleMorningClinical(rowKey: string): boolean {
  if (rowKey.startsWith("Matin - Cs")) return true
  if (rowKey.startsWith("Matin - ETT")) return true
  if (rowKey === "Matin - EE1" || rowKey === "Matin - EE2") return true
  return false
}

/** Activités explicitement interdites en cumul avec Garde Matin + I. */
export function isInternForbiddenClinical(rowKey: string): boolean {
  const r = rowKey.toLowerCase()
  return (
    r.includes("coro") ||
    r.includes("rythmo") ||
    r.includes("réeducation") ||
    r.includes("reeducation")
  )
}

/** Médecin présent sur Garde Matin avec l’interne I (ou I avec un médecin). */
export function isPairedWithInternOnGardeMatin(
  schedule: ScheduleData,
  day: string,
  doctorId: string,
): boolean {
  const vals = schedule["Garde Matin"]?.[day]?.value || []
  if (!vals.includes(INTERN_CODE)) return false
  if (doctorId === INTERN_CODE) {
    return vals.some((d) => d && d !== INTERN_CODE && isListedDoctor(d))
  }
  return vals.includes(doctorId)
}

/**
 * Appariement effectif ou prospectif (ex. I déjà sur Garde Matin, on y ajoute le médecin
 * alors qu’il a déjà un Cs — ou l’inverse).
 */
export function wouldBePairedWithIntern(
  schedule: ScheduleData,
  day: string,
  doctorId: string,
  targetRow: string,
): boolean {
  const vals = schedule["Garde Matin"]?.[day]?.value || []
  if (!vals.includes(INTERN_CODE)) return false
  if (doctorId === INTERN_CODE) {
    if (targetRow === "Garde Matin") {
      return vals.some((d) => d && d !== INTERN_CODE && isListedDoctor(d))
    }
    return isPairedWithInternOnGardeMatin(schedule, day, doctorId)
  }
  if (vals.includes(doctorId)) return true
  // I déjà présent : ajouter ce médecin sur Garde Matin = association
  if (targetRow === "Garde Matin") return true
  return false
}

/**
 * Classe une ligne planning dans une période de conflit.
 * IRM : Lundi = matin, Vendredi = après-midi ; sinon « day ».
 */
export function periodOfRow(rowKey: string, day?: string): DayPeriod {
  if (
    rowKey === "Congés" ||
    rowKey === "Vacances" ||
    rowKey === "Congrès" ||
    rowKey === "Notes du jour" ||
    rowKey === HALF_DAY_OFF_MATIN_ROW ||
    rowKey === HALF_DAY_OFF_APM_ROW
  ) {
    return "meta"
  }
  if (rowKey === "Garde Nuit" || rowKey === "Astreintes ATL Nuit") return "nuit"
  if (rowKey === "Garde Matin" || rowKey === "Astreintes ATL Matin") return "matin"
  if (rowKey === "Garde Midi" || rowKey === "Astreintes ATL Midi") return "apm"
  if (rowKey.startsWith("Matin -")) return "matin"
  if (rowKey.startsWith("Apm -")) return "apm"
  if (rowKey === "Pré-op" || rowKey === "Entrées PSS") return "matin"
  // IRM = S Lundi matin + Vendredi après-midi (pas journée entière)
  if (rowKey === IRM_ROW) {
    if (day === "LUNDI") return "matin"
    if (day === "VENDREDI") return "apm"
    return "day"
  }
  if (rowKey === LFB_ROW || rowKey === CDL_ROW || rowKey.startsWith("Hors site -")) {
    return "day"
  }
  return "meta"
}

/** Garde admin peut remplacer l’IRM fixe du même créneau. */
function gardeDisplacesIrm(targetRow: string, otherRow: string): boolean {
  return (
    GARDE_ROWS.includes(targetRow as (typeof GARDE_ROWS)[number]) &&
    otherRow === IRM_ROW
  )
}

function isAtlCoroPair(a: string, b: string): boolean {
  return (
    (a === "Matin - Coro" && b === "Astreintes ATL Matin") ||
    (a === "Astreintes ATL Matin" && b === "Matin - Coro") ||
    (a === "Apm - Coro" && b === "Astreintes ATL Midi") ||
    (a === "Astreintes ATL Midi" && b === "Apm - Coro")
  )
}

function isRoomDoublonPair(a: string, b: string): boolean {
  for (const pairs of [ETT_DOUBLON_PAIRS, EE_DOUBLON_PAIRS]) {
    for (const [x, y] of Object.values(pairs)) {
      if ((a === x && b === y) || (a === y && b === x)) return true
    }
  }
  return false
}

export type CompatibilityContext = {
  schedule: ScheduleData
  day: string
  doctorId: string
  /** Ligne en cours d’assignation (pour appariement prospectif avec I). */
  targetRow?: string
}

/**
 * Deux lignes peuvent coexister le même créneau pour le même médecin.
 * Avec `ctx` : exceptions Garde Matin + I (Cs/ETT/EE), S+I+IRM,
 * et S mercredi apm ETT ped + Garde Midi / ATL Midi.
 */
export function areCompatibleSamePeriod(
  rowA: string,
  rowB: string,
  ctx?: CompatibilityContext,
): boolean {
  if (rowA === rowB) return true
  if (isAtlCoroPair(rowA, rowB)) return true
  if (isRoomDoublonPair(rowA, rowB)) return true

  // S mercredi : ETT pédiatrique + garde/astreinte Midi
  if (
    ctx?.doctorId === "S" &&
    ctx.day === "MERCREDI" &&
    isEttPedWithGardeOrAtlMidi(rowA, rowB)
  ) {
    return true
  }

  if (ctx && wouldBePairedWithIntern(ctx.schedule, ctx.day, ctx.doctorId, ctx.targetRow || "Garde Matin")) {
    const hasGardeMatin = rowA === "Garde Matin" || rowB === "Garde Matin"
    const other = rowA === "Garde Matin" ? rowB : rowB === "Garde Matin" ? rowA : null

    if (hasGardeMatin && other) {
      if (isInternForbiddenClinical(other)) return false
      if (isInternCompatibleMorningClinical(other)) return true
      // S associé à I : peut garder l’IRM en plus de la Garde Matin
      if (ctx.doctorId === "S" && other === IRM_ROW) return true
    }
  }

  return false
}

function doctorOnRow(schedule: ScheduleData, rowKey: string, day: string, doctorId: string): boolean {
  return (schedule[rowKey]?.[day]?.value || []).includes(doctorId)
}

/** Nombre d’occurrences d’un médecin dans une cellule (doublon = 2). */
export function countDoctorInCell(
  schedule: ScheduleData,
  rowKey: string,
  day: string,
  doctorId: string,
): number {
  return (schedule[rowKey]?.[day]?.value || []).filter((d) => d === doctorId).length
}

function previousDayName(day: string): string | null {
  const idx = DAYS.indexOf(day as (typeof DAYS)[number])
  if (idx <= 0) return null
  return DAYS[idx - 1]
}

function hasAnyGarde(schedule: ScheduleData, day: string, doctorId: string): boolean {
  return GARDE_ROWS.some((row) => doctorOnRow(schedule, row, day, doctorId))
}

/** LFB / CDL interdits le jour d’une garde et le lendemain. */
export function isLfbCdlBlockedByGarde(
  schedule: ScheduleData,
  day: string,
  doctorId: string,
): { blocked: boolean; reason?: string } {
  if (hasAnyGarde(schedule, day, doctorId)) {
    return {
      blocked: true,
      reason: `${doctorId} a une garde ce jour — LFB/CDL impossibles.`,
    }
  }
  const prev = previousDayName(day)
  if (prev && hasAnyGarde(schedule, prev, doctorId)) {
    return {
      blocked: true,
      reason: `${doctorId} a une garde la veille (${prev}) — LFB/CDL impossibles.`,
    }
  }
  return { blocked: false }
}

function periodsConflict(target: DayPeriod, occupied: DayPeriod): boolean {
  if (target === "meta" || occupied === "meta") return false
  if (target === occupied) return true
  if (target === "day" && (occupied === "matin" || occupied === "apm" || occupied === "day")) {
    return true
  }
  if (occupied === "day" && (target === "matin" || target === "apm" || target === "day")) {
    return true
  }
  return false
}

/**
 * Vérifie toutes les règles bloquantes pour une assignation manuelle.
 */
export function canAssignDoctorToSlot(
  doctorId: string,
  dateStr: string,
  rowKey: string,
  day: string,
  schedule: ScheduleData,
  vacations: DoctorVacation[],
): { allowed: boolean; reason?: string } {
  // Remplaçant texte libre : pas de règles listées
  if (!isListedDoctor(doctorId)) {
    return { allowed: true }
  }

  // K est exclu d'office le Lundi et le Vendredi (règle fixe indisponibilité permanente)
  if (doctorId === "K" && (day === "LUNDI" || day === "VENDREDI")) {
    return {
      allowed: false,
      reason: "K n'est jamais présent le Lundi et le Vendredi (règle fixe).",
    }
  }

  // Stress : jamais Mer/Ven après-midi
  if (isStressSlotClosed(rowKey, day)) {
    return {
      allowed: false,
      reason: "Pas de vacation Stress le mercredi ni le vendredi après-midi.",
    }
  }

  // Rythmo : non disponible Lundi matin et Jeudi matin
  if (rowKey.includes("Rythmo") && rowKey.includes("Matin") && (day === "LUNDI" || day === "JEUDI")) {
    return {
      allowed: false,
      reason: "Rythmo non disponible le lundi matin et le jeudi matin.",
    }
  }

  // Pas de Coro, Astreintes ATL ou Rythmo le lendemain d'une GARDE DE NUIT
  // (Pour M, O, W sur Coro/ATL, cette règle ne s'applique que lorsque les 3 sont présents ; elle tombe automatiquement si 1 ou 2 d'entre eux sont absents/en congés)
  const prevDay = previousDayName(day)
  if (prevDay && doctorOnRow(schedule, "Garde Nuit", prevDay, doctorId)) {
    const isRythmo = rowKey.includes("Rythmo")
    const isCoroOrAtl = rowKey.includes("Coro") || rowKey.includes("Astreintes ATL")

    if (isRythmo) {
      return {
        allowed: false,
        reason: `${doctorId} a fait une garde de nuit la veille (${prevDay}) — Rythmo interdit le lendemain.`,
      }
    }

    if (isCoroOrAtl) {
      if (["M", "O", "W"].includes(doctorId)) {
        const isVac = (doc: string, d: string) => {
          const vals = schedule["Congés"]?.[d]?.value || []
          return vals.includes(doc)
        }
        const all3Present = ["M", "O", "W"].every((doc) => !isVac(doc, prevDay) && !isVac(doc, day))
        if (all3Present) {
          return {
            allowed: false,
            reason: `${doctorId} a fait une garde de nuit la veille (${prevDay}) et les 3 coronarographistes (M, O, W) sont présents — Coro/ATL interdit le lendemain.`,
          }
        }
      } else {
        return {
          allowed: false,
          reason: `${doctorId} a fait une garde de nuit la veille (${prevDay}) — Coro/ATL interdit le lendemain.`,
        }
      }
    }
  }

  // CH : astreintes ATL uniquement — jamais de garde
  if (doctorId === "CH") {
    if (isGardeRow(rowKey)) {
      return {
        allowed: false,
        reason: "CH n’est autorisé que pour les astreintes ATL — jamais de garde.",
      }
    }
    if (isAtlRow(rowKey) || rowKey === "Congés" || rowKey === "Vacances") {
      return { allowed: true }
    }
    return {
      allowed: false,
      reason: "CH n’est assignable que sur les lignes Astreintes ATL.",
    }
  }

  // ATL : M/O/W/CH ; FV uniquement Midi jeudi (= Coro)
  if (isAtlRow(rowKey)) {
    if (!isAtlEligibleForCell(doctorId, rowKey, day)) {
      return {
        allowed: false,
        reason:
          doctorId === "FV"
            ? "FV n’est en ATL que le jeudi après-midi (avec Coro)."
            : "Astreinte ATL réservée à M, O, W et CH (FV = Midi jeudi seulement).",
      }
    }
  }

  // ETT Tessé : réservé à Val, S, B (confirmé utilisateur 31/07/2026)
  if (rowKey === "Matin - ETT Tessé" || rowKey === "Apm - ETT Tessé") {
    if (!["Val", "S", "B"].includes(doctorId)) {
      return {
        allowed: false,
        reason: "ETT Tessé réservé à Val, S et B.",
      }
    }
  }

  // Binôme infirmière/médecin (Val/Véro/Laura) sur Stress/EE (confirmé
  // utilisateur 31/07/2026) : le médecin déjà présent doit être un
  // partenaire valide pour l'infirmière qu'on ajoute (et vice versa).
  if (nurseRequiresBinome(rowKey)) {
    const currentListed = schedule[rowKey]?.[day]?.value || []
    if (isNurse(doctorId)) {
      const otherDoctor = currentListed.find((d) => !isNurse(d))
      if (otherDoctor && !isValidNursePartner(otherDoctor, rowKey)) {
        return {
          allowed: false,
          reason: `${otherDoctor} n'est pas un partenaire valide pour ${doctorId} sur cette vacation.`,
        }
      }
    } else {
      const otherNurse = currentListed.find((d) => isNurse(d))
      if (otherNurse && !isValidNursePartner(doctorId, rowKey)) {
        return {
          allowed: false,
          reason: `${doctorId} n'est pas un partenaire valide pour ${otherNurse} sur cette vacation.`,
        }
      }
    }
  }

  // Coro salle = M/O/W/FV (pas CH, pas R/V/T/G…)
  if (rowKey === "Matin - Coro" || rowKey === "Apm - Coro") {
    if (!isCoroEligibleDoctor(doctorId)) {
      return {
        allowed: false,
        reason: "Coro réservé aux coronarographistes (M, O, W, FV).",
      }
    }
    // Salle de coro en maintenance sur cette période (bug corrigé le
    // 31/07/2026) : la génération automatique respectait déjà cette
    // suspension, mais la saisie manuelle directe l'ignorait.
    const coroSlot = rowKey === "Matin - Coro" ? "matin" : "am"
    if (isRoomUnderMaintenanceOnDate(dateStr, coroSlot)) {
      return {
        allowed: false,
        reason: "Salle de coronarographie indisponible (maintenance) sur cette période.",
      }
    }
  }

  // Interne I : uniquement Garde Matin (associé à un médecin)
  if (doctorId === INTERN_CODE) {
    if (rowKey !== "Garde Matin") {
      return {
        allowed: false,
        reason: "L’interne I n’est assignable que sur Garde Matin (avec un médecin).",
      }
    }
    return { allowed: true }
  }

  if (rowKey === "Congés" || rowKey === "Vacances") {
    return { allowed: true }
  }
  if (isDoctorUnavailable(doctorId, dateStr, vacations)) {
    return {
      allowed: false,
      reason: `${doctorId} est en congés ce jour — assignation impossible.`,
    }
  }
  // Note: la ligne Congés est reconstruite depuis doctor_vacations ; on ne bloque
  // plus sur une case Congés orpheline (sinon S reste inutilisable après modification).

  // Garde week-end avec remplaçant : toujours autoriser l’association avec un médecin listé
  // (ignore ½-off et exclusion mutuelle de créneau pour cette case).
  if (isGardeRow(rowKey) && isWeekendDay(day) && cellHasRemplacant(schedule, rowKey, day)) {
    return { allowed: true }
  }

  // Coro / Rythmo / Rééducation interdits si déjà Garde Matin + I
  if (wouldBePairedWithIntern(schedule, day, doctorId, rowKey) && isInternForbiddenClinical(rowKey)) {
    return {
      allowed: false,
      reason: `${doctorId} est en Garde Matin avec I — Coro / Rythmo / Rééducation interdits.`,
    }
  }

  const targetPeriod = periodOfRow(rowKey, day)
  const compatCtx: CompatibilityContext = { schedule, day, doctorId, targetRow: rowKey }

  if (doctorOnRow(schedule, HALF_DAY_OFF_MATIN_ROW, day, doctorId)) {
    const isAstreinteOrGarde = rowKey.includes("Astreintes ATL") || rowKey.includes("Garde")
    if (!isAstreinteOrGarde && (targetPeriod === "matin" || targetPeriod === "day")) {
      return {
        allowed: false,
        reason: `${doctorId} est en ½ journée off Matin — pas d’activité le matin.`,
      }
    }
  }

  if (doctorOnRow(schedule, HALF_DAY_OFF_APM_ROW, day, doctorId)) {
    // Règle d'exception : M/W sur Coro Apm ou ATL Midi le mercredi, ou toute Astreinte/Garde
    const isAstreinteOrGarde = rowKey.includes("Astreintes ATL") || rowKey.includes("Garde")
    const isWednesdayCoroApmBypass =
      day === "MERCREDI" &&
      (doctorId === "M" || doctorId === "W") &&
      (rowKey === "Apm - Coro" || rowKey === "Astreintes ATL Midi")

    if (!isAstreinteOrGarde && !isWednesdayCoroApmBypass && (targetPeriod === "apm" || targetPeriod === "day")) {
      return {
        allowed: false,
        reason: `${doctorId} est en ½ journée off Après-midi — pas d’activité l’après-midi.`,
      }
    }
  }

  if (rowKey === HALF_DAY_OFF_MATIN_ROW || rowKey === HALF_DAY_OFF_APM_ROW) {
    return { allowed: true }
  }

  if (
    (rowKey.includes("Astreintes ATL Midi") || (rowKey.includes("Coro") && (rowKey.includes("Apm") || rowKey.includes("Midi")))) &&
    ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI"].includes(day) &&
    dateStr
  ) {
    const d = new Date(dateStr)
    if (!Number.isNaN(d.getTime())) {
      const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
      const dayJan4 = jan4.getUTCDay() || 7
      const mon1 = new Date(jan4.getTime() - (dayJan4 - 1) * 86400000)
      const weekNum = Math.floor((d.getTime() - mon1.getTime()) / (7 * 86400000)) + 1
      if (weekNum >= 31 && weekNum <= 34) {
        return {
          allowed: false,
          reason: "Astreinte ATL Midi et Coro AM fermées de S31 à S34 inclus.",
        }
      }
    }
  }

  if (rowKey === LFB_ROW || rowKey === CDL_ROW) {
    const gardeBlock = isLfbCdlBlockedByGarde(schedule, day, doctorId)
    if (gardeBlock.blocked) return { allowed: false, reason: gardeBlock.reason }
  }

  if (GARDE_ROWS.includes(rowKey as (typeof GARDE_ROWS)[number])) {
    if (doctorOnRow(schedule, LFB_ROW, day, doctorId) || doctorOnRow(schedule, CDL_ROW, day, doctorId)) {
      return {
        allowed: false,
        reason: `${doctorId} est en LFB/CDL ce jour — garde impossible (retirez LFB/CDL d’abord).`,
      }
    }
    const nextDay = DAYS[DAYS.indexOf(day as (typeof DAYS)[number]) + 1]
    if (
      nextDay &&
      (doctorOnRow(schedule, LFB_ROW, nextDay, doctorId) ||
        doctorOnRow(schedule, CDL_ROW, nextDay, doctorId))
    ) {
      return {
        allowed: false,
        reason: `${doctorId} est en LFB/CDL le lendemain (${nextDay}) — garde impossible.`,
      }
    }
  }

  // Exclusion mutuelle (sauf paires ATL+Coro, ETT, Garde Matin+I, S+I+IRM, garde↔IRM)
  if (targetPeriod !== "meta") {
    for (const otherRow of Object.keys(schedule)) {
      if (otherRow === rowKey) continue
      if (periodOfRow(otherRow, day) === "meta") continue
      if (!doctorOnRow(schedule, otherRow, day, doctorId)) continue
      if (!periodsConflict(targetPeriod, periodOfRow(otherRow, day))) continue
      if (areCompatibleSamePeriod(rowKey, otherRow, compatCtx)) continue
      // Admin assigne une garde : l’IRM fixe cède le créneau (strips le retireront)
      if (gardeDisplacesIrm(rowKey, otherRow)) continue
      return {
        allowed: false,
        reason: `${doctorId} est déjà sur « ${otherRow} » — pas deux tâches sur le même créneau (sauf ATL+Coro, ETT/EE 1+2, ou Garde Matin+I).`,
      }
    }
  }

  return { allowed: true }
}

/** Doublon Cs (2× même case) ou ETT/EE (les deux salles) → exposant ². */
export function isDoctorDoublonInCell(
  schedule: ScheduleData,
  day: string,
  doctorId: string,
  rowKey: string,
): boolean {
  if (!isListedDoctor(doctorId)) return false

  if (isDoublonEligibleRow(rowKey)) {
    return countDoctorInCell(schedule, rowKey, day, doctorId) >= 2
  }

  const pair = roomDoublonPairForRow(rowKey)
  if (pair) {
    const [a, b] = pair
    return doctorOnRow(schedule, a, day, doctorId) && doctorOnRow(schedule, b, day, doctorId)
  }

  return false
}

export function formatDoctorWithDoublon(
  schedule: ScheduleData,
  day: string,
  doctorId: string,
  rowKey: string,
): string {
  const base = isDoctorDoublonInCell(schedule, day, doctorId, rowKey)
    ? `${doctorId}²`
    : doctorId
  return appendSpecialDoctorLabel(base, rowKey, day, doctorId)
}

export function stripDoctorFromRow(
  schedule: ScheduleData,
  rowKey: string,
  day: string,
  doctorId: string,
): ScheduleData {
  if (!schedule[rowKey]?.[day]) return schedule
  const cell = schedule[rowKey][day]
  const values = cell.value || []
  if (!values.includes(doctorId)) return schedule
  const filtered = values.filter((d) => d !== doctorId)
  return {
    ...schedule,
    [rowKey]: {
      ...schedule[rowKey],
      [day]: {
        ...cell,
        value: filtered,
        type: filtered.length ? "doctor" : "empty",
      },
    },
  }
}

/**
 * Applique les strips bloquants (½-off, exclusion créneau, LFB/CDL vs garde).
 * Ne touche pas Congés / Notes. Idempotent.
 * Préserve Garde Matin + I + cliniques autorisées (+ IRM pour S+I).
 * Garde sans I remplace l’IRM sur le même créneau.
 */
export function applySlotBlockingStrips(schedule: ScheduleData): ScheduleData {
  let next = schedule

  for (const day of DAYS) {
    for (const doctorId of collectDoctorsOnDay(next, day)) {
      if (!isListedDoctor(doctorId) || doctorId === "CH" || doctorId === INTERN_CODE) continue

      if (doctorOnRow(next, HALF_DAY_OFF_MATIN_ROW, day, doctorId)) {
        for (const row of Object.keys(next)) {
          const p = periodOfRow(row, day)
          if (p === "matin" || p === "day") {
            const isAstreinteOrGarde = row.includes("Astreintes ATL") || isGardeRow(row)
            if (isAstreinteOrGarde) continue
            next = stripDoctorFromRow(next, row, day, doctorId)
          }
        }
      }

      if (doctorOnRow(next, HALF_DAY_OFF_APM_ROW, day, doctorId)) {
        for (const row of Object.keys(next)) {
          const p = periodOfRow(row, day)
          if (p === "apm" || p === "day") {
            const isAstreinteOrGarde = row.includes("Astreintes ATL") || isGardeRow(row)
            if (isAstreinteOrGarde) continue
            next = stripDoctorFromRow(next, row, day, doctorId)
          }
        }
      }

      if (doctorOnRow(next, "Congés", day, doctorId)) {
        for (const row of Object.keys(next)) {
          if (row === "Congés" || row === "Vacances" || row === "Notes du jour") continue
          next = stripDoctorFromRow(next, row, day, doctorId)
        }
      }

      if (isLfbCdlBlockedByGarde(next, day, doctorId).blocked) {
        next = stripDoctorFromRow(next, LFB_ROW, day, doctorId)
        next = stripDoctorFromRow(next, CDL_ROW, day, doctorId)
      }

      // Strip Coro / Rythmo / Rééducation si Garde Matin + I
      if (isPairedWithInternOnGardeMatin(next, day, doctorId)) {
        for (const row of Object.keys(next)) {
          if (isInternForbiddenClinical(row)) {
            next = stripDoctorFromRow(next, row, day, doctorId)
          }
        }
      }

      next = resolvePeriodConflicts(next, day, doctorId, "matin")
      next = resolvePeriodConflicts(next, day, doctorId, "apm")
      next = resolvePeriodConflicts(next, day, doctorId, "nuit")
      next = resolvePeriodConflicts(next, day, doctorId, "day")

      // Hors-site « day » incompatible avec matin/apm (et inversement)
      // IRM lundi/vendredi est déjà classé matin/apm via periodOfRow(day).
      const onDay = Object.keys(next).some(
        (row) => periodOfRow(row, day) === "day" && doctorOnRow(next, row, day, doctorId),
      )
      const onMatinApm = Object.keys(next).some((row) => {
        const p = periodOfRow(row, day)
        return (p === "matin" || p === "apm") && doctorOnRow(next, row, day, doctorId)
      })
      if (onDay && onMatinApm) {
        // S+I+IRM : ne pas stripper l’IRM (même si classé day sur un autre jour)
        const preserveIrm =
          doctorId === "S" &&
          isPairedWithInternOnGardeMatin(next, day, doctorId) &&
          doctorOnRow(next, IRM_ROW, day, doctorId)

        // Priorité aux gardes / ATL / Coro (matin-apm) sur LFB/CDL…
        const hasHighMatinApm = Object.keys(next).some((row) => {
          const p = periodOfRow(row, day)
          if (p !== "matin" && p !== "apm") return false
          if (!doctorOnRow(next, row, day, doctorId)) return false
          return conflictPriority(row) >= 75
        })
        if (hasHighMatinApm) {
          for (const row of Object.keys(next)) {
            if (periodOfRow(row, day) !== "day") continue
            if (preserveIrm && row === IRM_ROW) continue
            next = stripDoctorFromRow(next, row, day, doctorId)
          }
        } else {
          for (const row of Object.keys(next)) {
            const p = periodOfRow(row, day)
            if (p === "matin" || p === "apm") {
              next = stripDoctorFromRow(next, row, day, doctorId)
            }
          }
        }
      }
    }
  }

  return next
}

function collectDoctorsOnDay(schedule: ScheduleData, day: string): string[] {
  const set = new Set<string>()
  for (const row of Object.keys(schedule)) {
    for (const d of schedule[row]?.[day]?.value || []) {
      if (d) set.add(d)
    }
  }
  return [...set]
}

function conflictPriority(rowKey: string): number {
  if (rowKey.startsWith("Garde ")) return 100
  if (rowKey.startsWith("Astreintes ATL")) return 80
  if (rowKey.includes("Coro")) return 75
  if (rowKey === HALF_DAY_OFF_MATIN_ROW || rowKey === HALF_DAY_OFF_APM_ROW) return 90
  if (rowKey === "Congés") return 95
  return 10
}

function resolvePeriodConflicts(
  schedule: ScheduleData,
  day: string,
  doctorId: string,
  period: DayPeriod,
): ScheduleData {
  if (period === "meta") return schedule
  const occupied = Object.keys(schedule).filter(
    (row) => periodOfRow(row, day) === period && doctorOnRow(schedule, row, day, doctorId),
  )
  if (occupied.length <= 1) return schedule

  const ctx: CompatibilityContext = { schedule, day, doctorId }
  const sorted = [...occupied].sort((a, b) => conflictPriority(b) - conflictPriority(a))
  const keep = new Set<string>()
  keep.add(sorted[0])
  for (const row of sorted.slice(1)) {
    const ok = [...keep].every((k) => areCompatibleSamePeriod(k, row, ctx))
    if (ok) keep.add(row)
  }

  let next = schedule
  for (const row of occupied) {
    if (!keep.has(row)) {
      // Garde sans I remplace IRM ; S+I conserve IRM
      if (
        row === IRM_ROW &&
        doctorId === "S" &&
        isPairedWithInternOnGardeMatin(next, day, doctorId)
      ) {
        keep.add(row)
        continue
      }
      // Garde week-end + remplaçant : ne pas retirer le médecin associé
      if (isGardeRow(row) && isWeekendDay(day) && cellHasRemplacant(next, row, day)) {
        keep.add(row)
        continue
      }
      next = stripDoctorFromRow(next, row, day, doctorId)
    }
  }
  return next
}
