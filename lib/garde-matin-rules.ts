/**
 * Garde Matin du lundi au vendredi (consigne 18/11/2026) :
 * - l'interne **I** est en doublon avec le médecin de Garde Matin (uniquement cette ligne) ;
 * - le médecin de Garde Matin est aussi affecté en **Matin - Cs PSS**, avec l'indice **(4)**
 *   (4 patients à voir en consultation), quel que soit le médecin (y compris U, B, S).
 *
 * Le nombre de patients est porté par la case (`CellData.patientCounts`) et affiché à côté
 * des initiales. Cette Cs PSS n'est pas obligatoire : si l'admin retire le médecin de garde
 * de la case, il n'y est plus remis (`CellData.csPssDeclined`) tant qu'il reste de garde. Si le médecin de garde change, l'ancien est retiré de la Cs PSS (seulement
 * s'il y avait été ajouté par cette règle, c'est-à-dire avec son indice).
 */

import { isListedDoctor } from "@/lib/doctor-code"
import { dateStrForWeekDay, isDoctorOnVacationForFixed } from "@/lib/fixed-assignments"
import { holidayNameForWeekDay } from "@/lib/holiday-closed"
import type { CellData, DoctorVacation, ScheduleData } from "@/lib/types"

export const GARDE_MATIN_ROW = "Garde Matin"
export const GARDE_CS_PSS_ROW = "Matin - Cs PSS"
export const GARDE_CS_PSS_PATIENTS = 4
const INTERN = "I"
const WEEKDAYS = ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI"] as const

function internAway(schedule: ScheduleData, weekKey: string, day: string, vacations: DoctorVacation[]): boolean {
  if (((schedule["Congés"]?.[day]?.value ?? []) as string[]).includes(INTERN)) return true
  const date = dateStrForWeekDay(weekKey, day)
  return Boolean(date && isDoctorOnVacationForFixed(INTERN, date, vacations))
}

export function applyGardeMatinInternAndCsPss(
  schedule: ScheduleData,
  weekKey: string,
  vacations: DoctorVacation[] = [],
): ScheduleData {
  if (!schedule[GARDE_MATIN_ROW]) return schedule
  let next = schedule
  const setCell = (row: string, day: string, cell: CellData) => {
    next = { ...next, [row]: { ...(next[row] ?? {}), [day]: cell } }
  }

  for (const day of WEEKDAYS) {
    const gm = next[GARDE_MATIN_ROW]?.[day]
    const gmValue = ((gm?.value ?? []) as string[]).filter(Boolean)
    // FV et CH (externes) ne font ni binôme avec I ni Cs PSS
    const garde = gmValue.find((d) => d !== INTERN && d !== "CH" && d !== "FV" && isListedDoctor(d)) ?? null

    // 1) I en doublon sur la Garde Matin
    if (gm && garde && !gmValue.includes(INTERN) && !internAway(next, weekKey, day, vacations)) {
      setCell(GARDE_MATIN_ROW, day, { ...gm, value: [...gmValue, INTERN], type: "doctor" })
    }

    // 2) Médecin de Garde Matin en Matin - Cs PSS avec (4)
    const cs = next[GARDE_CS_PSS_ROW]?.[day]
    if (!next[GARDE_CS_PSS_ROW]) continue
    let value = ((cs?.value ?? []) as string[]).slice()
    const counts: Record<string, number> = { ...(cs?.patientCounts ?? {}) }
    // L'admin a retiré le médecin de garde de la Cs PSS (noté au retrait, dans la grille) : on ne
    // le remet plus — cette Cs PSS n'est pas obligatoire (consigne 19/11/2026). Un nouveau médecin
    // de garde réactive la règle.
    let declined = cs?.csPssDeclined
    if (declined && declined !== garde) declined = undefined
    if (declined && declined === garde) delete counts[garde]
    // Ancien médecin de garde (ajouté par la règle) : retiré
    for (const doc of Object.keys(counts)) {
      if (doc === garde) continue
      const i = value.indexOf(doc)
      if (i >= 0) value.splice(i, 1)
      delete counts[doc]
    }
    const holiday = holidayNameForWeekDay(weekKey, day)
    if (holiday && garde && counts[garde]) {
      const i = value.indexOf(garde)
      if (i >= 0) value.splice(i, 1)
      delete counts[garde]
    }
    const canAdd = Boolean(garde) && !holiday && !cs?.manuallyCleared && declined !== garde
    if (canAdd && garde) {
      if (!value.includes(garde)) value = [...value, garde]
      counts[garde] = GARDE_CS_PSS_PATIENTS
    }
    const before = JSON.stringify([cs?.value ?? [], cs?.patientCounts ?? {}, cs?.csPssDeclined ?? null])
    const after = JSON.stringify([value, counts, declined ?? null])
    if (before === after) continue
    const wasEmpty = ((cs?.value ?? []) as string[]).length === 0
    setCell(GARDE_CS_PSS_ROW, day, {
      ...(cs ?? { status: "validated" }),
      value,
      type: value.length ? "doctor" : "empty",
      // Case vide remplie d'après une garde proposée → proposition ; sinon on garde le statut
      status: wasEmpty && gm?.status === "pending" ? "pending" : cs?.status ?? "validated",
      patientCounts: Object.keys(counts).length ? counts : undefined,
      csPssDeclined: declined,
    })
  }
  return next
}

/**
 * U : Cs Tessée fixes le lundi et le mardi, **seulement s'il n'est pas de garde ce jour-là**
 * (la garde passe en priorité — consigne 18/11/2026). Même règle que la génération
 * (`enforceUCsTesseeGuardRule`), appliquée ici en permanence, saisies comprises.
 */
export function applyUGardePriorityOverCsTessee(schedule: ScheduleData): ScheduleData {
  let next = schedule
  for (const day of ["LUNDI", "MARDI"] as const) {
    const onGuard = ["Garde Matin", "Garde Midi", "Garde Nuit"].some((r) =>
      ((next[r]?.[day]?.value ?? []) as string[]).includes("U"),
    )
    if (!onGuard) continue
    for (const row of ["Matin - Cs Tessée", "Apm - Cs Tessée"]) {
      const cell = next[row]?.[day]
      const value = (cell?.value ?? []) as string[]
      if (!cell || !value.includes("U")) continue
      const kept = value.filter((d) => d !== "U")
      next = { ...next, [row]: { ...next[row], [day]: { ...cell, value: kept, type: kept.length ? "doctor" : "empty" } } }
    }
  }
  return next
}

/**
 * S : ETT pédiatrique du mercredi après-midi (Apm - ETT salle 1) **annulée quand S est de
 * garde le mercredi midi** — la garde passe en priorité (consigne 18/11/2026). Seul S est
 * retiré de la case (un remplaçant éventuel reste).
 */
export function applySGardePriorityOverEttPed(schedule: ScheduleData): ScheduleData {
  const day = "MERCREDI"
  const row = "Apm - ETT salle 1"
  if (!((schedule["Garde Midi"]?.[day]?.value ?? []) as string[]).includes("S")) return schedule
  const cell = schedule[row]?.[day]
  const value = (cell?.value ?? []) as string[]
  if (!cell || !value.includes("S")) return schedule
  const kept = value.filter((d) => d !== "S")
  return { ...schedule, [row]: { ...schedule[row], [day]: { ...cell, value: kept, type: kept.length ? "doctor" : "empty" } } }
}
