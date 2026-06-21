import { STAFF_INITIALS } from "@/lib/constants"
import type { ScheduleData } from "@/lib/types"

// Calculate workload statistics for all doctors
export function calculateWorkloadStats(schedule: ScheduleData): Record<string, number> {
  const doctorCounts: Record<string, number> = {}
  STAFF_INITIALS.forEach((d) => (doctorCounts[d] = 0))

  Object.entries(schedule).forEach(([rowKey, rowData]) => {
    if (rowKey === "Notes du jour") return

    Object.values(rowData).forEach((cell) => {
      if (cell && Array.isArray(cell.value)) {
        cell.value.forEach((doc: string) => {
          if (doctorCounts[doc] !== undefined) doctorCounts[doc]++
        })
      }
    })
  })

  return doctorCounts
}

// Fallback: Minimal Coverage Heuristic
export function generateFallbackSchedule(weekKey: string): ScheduleData {
  console.log("[v0] Running Fallback Generation...")
  // This would generate a basic valid schedule
  // For now, we rely on the existing generator but we could add safety rules here
  return {} as ScheduleData // Placeholder
}
