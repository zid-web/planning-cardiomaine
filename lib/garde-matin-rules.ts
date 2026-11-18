/**
 * Garde Matin du lundi au vendredi (consigne 18/11/2026) :
 * - l'interne **I** est en doublon avec le médecin de Garde Matin (uniquement cette ligne) ;
 * - le médecin de Garde Matin est aussi affecté en **Matin - Cs PSS**, avec l'indice **(4)**
 *   (4 patients à voir en consultation), quel que soit le médecin (y compris U, B, S).
 *
 * Le nombre de patients est porté par la case (`CellData.patientCounts`) et affiché à côté
 * des initiales. Si le médecin de garde change, l'ancien est retiré de la Cs PSS (seulement
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
    const garde = gmValue.find((d) => d !== INTERN && d !== "CH" && isListedDoctor(d)) ?? null

    // 1) I en doublon sur la Garde Matin
    if (gm && garde && !gmValue.includes(INTERN) && !internAway(next, weekKey, day, vacations)) {
      setCell(GARDE_MATIN_ROW, day, { ...gm, value: [...gmValue, INTERN], type: "doctor" })
    }

    // 2) Médecin de Garde Matin en Matin - Cs PSS avec (4)
    const cs = next[GARDE_CS_PSS_ROW]?.[day]
    if (!next[GARDE_CS_PSS_ROW]) continue
    let value = ((cs?.value ?? []) as string[]).slice()
    const counts: Record<string, number> = { ...(cs?.patientCounts ?? {}) }
    // Ancien médecin de garde (ajouté par la règle) : retiré
    for (const doc of Object.keys(counts)) {
      if (doc === garde) continue
      const i = value.indexOf(doc)
      if (i >= 0) value.splice(i, 1)
      delete counts[doc]
    }
    const holiday = holidayNameForWeekDay(weekKey, day)
    const canAdd = Boolean(garde) && !holiday && !cs?.manuallyCleared
    if (canAdd && garde) {
      if (!value.includes(garde)) value = [...value, garde]
      counts[garde] = GARDE_CS_PSS_PATIENTS
    }
    const before = JSON.stringify([cs?.value ?? [], cs?.patientCounts ?? {}])
    const after = JSON.stringify([value, counts])
    if (before === after) continue
    const wasEmpty = ((cs?.value ?? []) as string[]).length === 0
    setCell(GARDE_CS_PSS_ROW, day, {
      ...(cs ?? { status: "validated" }),
      value,
      type: value.length ? "doctor" : "empty",
      // Case vide remplie d'après une garde proposée → proposition ; sinon on garde le statut
      status: wasEmpty && gm?.status === "pending" ? "pending" : cs?.status ?? "validated",
      patientCounts: Object.keys(counts).length ? counts : undefined,
    })
  }
  return next
}
