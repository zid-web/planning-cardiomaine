/**
 * Règles d’assignation bloquantes (matin / après-midi / garde / ½-off / congés).
 * Exception : cumul Astreinte ATL Matin/Midi + Coro correspondant.
 * Doublon Cs : 2× le même médecin dans la **même** case Cs (PSS *ou* Tessée) → ².
 * Doublon ETT : présent sur **ETT salle 1 et salle 2** le même créneau → ².
 * Jamais Cs PSS + Cs Tessée le même matin/apm.
 */

import { DAYS } from "@/lib/constants"
import { isListedDoctor } from "@/lib/doctor-code"
import { HALF_DAY_OFF_APM_ROW, HALF_DAY_OFF_MATIN_ROW } from "@/lib/half-day-off"
import type { DoctorVacation, ScheduleData } from "@/lib/types"
import { isDoctorUnavailable } from "@/lib/assignment-validation"

export type DayPeriod = "matin" | "apm" | "nuit" | "day" | "meta"

const GARDE_ROWS = ["Garde Matin", "Garde Midi", "Garde Nuit"] as const
const LFB_ROW = "Hors site - LFB"
const CDL_ROW = "Hors site - CDL"

/** Doublon Cs = 2× dans la même cellule (2ᵉ clic). */
export const CS_SAME_CELL_DOUBLON_ROWS = new Set([
  "Matin - Cs PSS",
  "Matin - Cs Tessée",
  "Apm - Cs PSS",
  "Apm - Cs Tessée",
])

export const ETT_DOUBLON_PAIRS: Record<"Matin" | "Apm", [string, string]> = {
  Matin: ["Matin - ETT salle 1", "Matin - ETT salle 2"],
  Apm: ["Apm - ETT salle 1", "Apm - ETT salle 2"],
}

/** @deprecated alias — préférer CS_SAME_CELL_DOUBLON_ROWS */
export const DOUBLON_ELIGIBLE_ROWS = CS_SAME_CELL_DOUBLON_ROWS

export function isDoublonEligibleRow(rowKey: string): boolean {
  return CS_SAME_CELL_DOUBLON_ROWS.has(rowKey)
}

export function isEttRow(rowKey: string): boolean {
  return /ETT salle [12]/.test(rowKey)
}

function ettPairForRow(rowKey: string): [string, string] | null {
  if (rowKey.startsWith("Matin - ETT")) return ETT_DOUBLON_PAIRS.Matin
  if (rowKey.startsWith("Apm - ETT")) return ETT_DOUBLON_PAIRS.Apm
  return null
}

/** Classe une ligne planning dans une période de conflit.
 * IRM : Lundi = matin, Vendredi = après-midi (commentaire métier), sinon « day ».
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
  if (rowKey === "Hors site - IRM") {
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
    otherRow === "Hors site - IRM"
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

function isEttDoublonPair(a: string, b: string): boolean {
  for (const [x, y] of Object.values(ETT_DOUBLON_PAIRS)) {
    if ((a === x && b === y) || (a === y && b === x)) return true
  }
  return false
}

/** Deux lignes peuvent coexister le même créneau pour le même médecin. */
export function areCompatibleSamePeriod(rowA: string, rowB: string): boolean {
  if (rowA === rowB) return true
  if (isAtlCoroPair(rowA, rowB)) return true
  if (isEttDoublonPair(rowA, rowB)) return true
  return false
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

function doctorOnRow(schedule: ScheduleData, rowKey: string, day: string, doctorId: string): boolean {
  return (schedule[rowKey]?.[day]?.value || []).includes(doctorId)
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
  // Hors-site « day » bloque matin ET après-midi (et inversement)
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
  if (!isListedDoctor(doctorId) || doctorId === "CH") {
    return { allowed: true }
  }

  // Congés / Vacances : ligne dédiée OK ; sinon jamais d’autre assignation
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

  const targetPeriod = periodOfRow(rowKey, day)

  // ½ journée off Matin → aucun créneau matin (ni day)
  if (doctorOnRow(schedule, HALF_DAY_OFF_MATIN_ROW, day, doctorId)) {
    if (targetPeriod === "matin" || targetPeriod === "day") {
      return {
        allowed: false,
        reason: `${doctorId} est en ½ journée off Matin — pas d’activité le matin.`,
      }
    }
  }

  // ½ journée off Après-midi → pas d’activité apm / day (matin OK)
  if (doctorOnRow(schedule, HALF_DAY_OFF_APM_ROW, day, doctorId)) {
    if (targetPeriod === "apm" || targetPeriod === "day") {
      return {
        allowed: false,
        reason: `${doctorId} est en ½ journée off Après-midi — pas d’activité l’après-midi.`,
      }
    }
  }

  // Assigner sur la ligne ½-off : OK (marqueurs)
  if (rowKey === HALF_DAY_OFF_MATIN_ROW || rowKey === HALF_DAY_OFF_APM_ROW) {
    return { allowed: true }
  }

  // LFB / CDL : jour de garde ou lendemain
  if (rowKey === LFB_ROW || rowKey === CDL_ROW) {
    const gardeBlock = isLfbCdlBlockedByGarde(schedule, day, doctorId)
    if (gardeBlock.blocked) return { allowed: false, reason: gardeBlock.reason }
  }

  // Inversement : si on assigne une garde, LFB/CDL déjà présents → bloquer
  if (GARDE_ROWS.includes(rowKey as (typeof GARDE_ROWS)[number])) {
    if (doctorOnRow(schedule, LFB_ROW, day, doctorId) || doctorOnRow(schedule, CDL_ROW, day, doctorId)) {
      return {
        allowed: false,
        reason: `${doctorId} est en LFB/CDL ce jour — garde impossible (retirez LFB/CDL d’abord).`,
      }
    }
    const next = DAYS[DAYS.indexOf(day as (typeof DAYS)[number]) + 1]
    if (
      next &&
      (doctorOnRow(schedule, LFB_ROW, next, doctorId) || doctorOnRow(schedule, CDL_ROW, next, doctorId))
    ) {
      return {
        allowed: false,
        reason: `${doctorId} est en LFB/CDL le lendemain (${next}) — garde impossible.`,
      }
    }
  }

  // Exclusion mutuelle matin / apm / day / nuit (sauf paires autorisées / garde↔IRM)
  if (targetPeriod !== "meta") {
    for (const otherRow of Object.keys(schedule)) {
      if (otherRow === rowKey) continue
      if (periodOfRow(otherRow, day) === "meta") continue
      if (!doctorOnRow(schedule, otherRow, day, doctorId)) continue
      if (!periodsConflict(targetPeriod, periodOfRow(otherRow, day))) continue
      if (areCompatibleSamePeriod(rowKey, otherRow)) continue
      // Admin assigne une garde : l’IRM fixe cède le créneau (strips le retireront)
      if (gardeDisplacesIrm(rowKey, otherRow)) continue
      return {
        allowed: false,
        reason: `${doctorId} est déjà sur « ${otherRow} » — pas deux tâches sur le même créneau (sauf ATL+Coro ou doublon ETT 1+2).`,
      }
    }
  }

  return { allowed: true }
}

/** Doublon Cs (2× même case) ou ETT (salle 1 + salle 2) → exposant ². */
export function isDoctorDoublonInCell(
  schedule: ScheduleData,
  day: string,
  doctorId: string,
  rowKey: string,
): boolean {
  if (!isListedDoctor(doctorId)) return false

  // Cs : 2 occurrences dans la même case
  if (isDoublonEligibleRow(rowKey)) {
    return countDoctorInCell(schedule, rowKey, day, doctorId) >= 2
  }

  // ETT : présent sur les deux salles du même créneau
  const pair = ettPairForRow(rowKey)
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
  return isDoctorDoublonInCell(schedule, day, doctorId, rowKey) ? `${doctorId}²` : doctorId
}

/**
 * Retire un médecin des lignes incompatibles avec une règle (strip structurel).
 */
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
 */
export function applySlotBlockingStrips(schedule: ScheduleData): ScheduleData {
  let next = schedule

  for (const day of DAYS) {
    for (const doctorId of collectDoctorsOnDay(next, day)) {
      if (!isListedDoctor(doctorId) || doctorId === "CH") continue

      // ½ off Matin → vider activités matin + day
      if (doctorOnRow(next, HALF_DAY_OFF_MATIN_ROW, day, doctorId)) {
        for (const row of Object.keys(next)) {
          const p = periodOfRow(row, day)
          if (p === "matin" || p === "day") {
            next = stripDoctorFromRow(next, row, day, doctorId)
          }
        }
      }

      // ½ off Apm → vider activités apm + day
      if (doctorOnRow(next, HALF_DAY_OFF_APM_ROW, day, doctorId)) {
        for (const row of Object.keys(next)) {
          const p = periodOfRow(row, day)
          if (p === "apm" || p === "day") {
            next = stripDoctorFromRow(next, row, day, doctorId)
          }
        }
      }

      // Congés ligne → déjà stripé ailleurs ; double sécurité hors Congés
      if (doctorOnRow(next, "Congés", day, doctorId)) {
        for (const row of Object.keys(next)) {
          if (row === "Congés" || row === "Vacances" || row === "Notes du jour") continue
          next = stripDoctorFromRow(next, row, day, doctorId)
        }
      }

      // LFB/CDL vs garde (jour + lendemain)
      if (isLfbCdlBlockedByGarde(next, day, doctorId).blocked) {
        next = stripDoctorFromRow(next, LFB_ROW, day, doctorId)
        next = stripDoctorFromRow(next, CDL_ROW, day, doctorId)
      }

      // Exclusion mutuelle : pour chaque période, garder une activité « primaire »
      // + paires compatibles. On retire les conflits en priorisant Garde > ATL/Coro > reste.
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
        // Priorité aux gardes / ATL / Coro (matin-apm) sur LFB/CDL…
        const hasHighMatinApm = Object.keys(next).some((row) => {
          const p = periodOfRow(row, day)
          if (p !== "matin" && p !== "apm") return false
          if (!doctorOnRow(next, row, day, doctorId)) return false
          return conflictPriority(row) >= 75
        })
        if (hasHighMatinApm) {
          for (const row of Object.keys(next)) {
            if (periodOfRow(row, day) === "day") {
              next = stripDoctorFromRow(next, row, day, doctorId)
            }
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

  // Choisir un ancrage (priorité haute), retirer tout incompatible avec l’ensemble retenu
  const sorted = [...occupied].sort((a, b) => conflictPriority(b) - conflictPriority(a))
  const keep = new Set<string>()
  keep.add(sorted[0])
  for (const row of sorted.slice(1)) {
    const ok = [...keep].every((k) => areCompatibleSamePeriod(k, row))
    if (ok) keep.add(row)
  }

  let next = schedule
  for (const row of occupied) {
    if (!keep.has(row)) {
      next = stripDoctorFromRow(next, row, day, doctorId)
    }
  }
  return next
}
