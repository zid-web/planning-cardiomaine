/**
 * Entrées PSS (consigne 12/10/2026) :
 * - lundi et mardi : binôme = le médecin de garde de l'après-midi (Garde Midi) + un autre médecin ;
 * - mercredi → vendredi : uniquement le médecin de garde de l'après-midi.
 * L'autre médecin du lundi/mardi reste un choix (solveur / admin) : on garantit seulement la présence
 * du médecin de garde et un maximum de deux médecins sur les cases proposées par le solveur.
 */

import type { CellData, ScheduleData } from "@/lib/types"

export const ENTREES_PSS_ROW = "Entrées PSS"
export const ENTREES_PSS_PAIR_DAYS = ["LUNDI", "MARDI"] as const
export const ENTREES_PSS_SOLO_DAYS = ["MERCREDI", "JEUDI", "VENDREDI"] as const

function gardeMidiDoctor(schedule: ScheduleData, day: string): string | null {
  const v = (schedule["Garde Midi"]?.[day]?.value ?? []).find((d) => d && d !== "I")
  return v ?? null
}

export function applyEntreesPssRules(schedule: ScheduleData): ScheduleData {
  if (!schedule[ENTREES_PSS_ROW]) return schedule
  const row = { ...schedule[ENTREES_PSS_ROW] }
  let changed = false
  const set = (day: string, value: string[], status: CellData["status"]) => {
    const prev = row[day]
    if (prev && prev.value.join("|") === value.join("|")) return
    row[day] = { ...(prev ?? { status }), value, type: value.length ? "doctor" : "empty", status: prev?.status ?? status } as CellData
    changed = true
  }

  for (const day of ENTREES_PSS_SOLO_DAYS) {
    const garde = gardeMidiDoctor(schedule, day)
    if (garde) set(day, [garde], "pending")
    else if (row[day]?.value?.length && !row[day]?.manuallyCleared) set(day, [], "pending")
  }
  for (const day of ENTREES_PSS_PAIR_DAYS) {
    const garde = gardeMidiDoctor(schedule, day)
    const cur = row[day]?.value ?? []
    if (!garde || cur.includes(garde)) continue
    // Le médecin de garde passe en premier ; le binôme garde au plus un autre médecin.
    const other = cur.find((d) => d !== garde)
    set(day, other ? [garde, other] : [garde], "pending")
  }
  return changed ? { ...schedule, [ENTREES_PSS_ROW]: row } : schedule
}
