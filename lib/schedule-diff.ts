import { DAYS } from "@/lib/constants"
import type { ScheduleData } from "@/lib/types"

export type CellChange = {
  row_key: string
  day_name: string
  old_value: string[]
  new_value: string[]
}

export type ScheduleSaveSource =
  | "ui"
  | "voice"
  | "pdf"
  | "csv"
  | "solver"
  | "change_request"
  | "system"

function valuesEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

/** Diff cellule par cellule entre deux plannings (ignore les métadonnées status/request). */
export function diffScheduleCells(
  prev: ScheduleData | null | undefined,
  next: ScheduleData,
): CellChange[] {
  const changes: CellChange[] = []
  const rowKeys = new Set([...Object.keys(prev || {}), ...Object.keys(next || {})])

  for (const row of rowKeys) {
    for (const day of DAYS) {
      const oldV = prev?.[row]?.[day]?.value || []
      const newV = next?.[row]?.[day]?.value || []
      if (!valuesEqual(oldV, newV)) {
        changes.push({
          row_key: row,
          day_name: day,
          old_value: [...oldV],
          new_value: [...newV],
        })
      }
    }
  }

  return changes
}
