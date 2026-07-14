import type { ExceptionalRotationConstraint, ExceptionalRotationRule, ScheduleData, CellData } from "@/lib/types"
import { DAYS } from "@/lib/constants"

/**
 * Get the exceptional rotation rule for a specific date
 */
export function getExceptionalRotationRule(
  date: string,
  dayOfWeek: string,
  constraints: ExceptionalRotationConstraint[]
): ExceptionalRotationRule | null {
  for (const constraint of constraints) {
    if (!constraint.isActive) continue

    const constraintStartDate = new Date(constraint.startDate)
    const constraintEndDate = new Date(constraint.endDate)
    const checkDate = new Date(date)

    if (checkDate >= constraintStartDate && checkDate <= constraintEndDate) {
      const rule = constraint.rules.find((r) => r.date === date && r.dayOfWeek === dayOfWeek)
      if (rule) return rule
    }
  }
  return null
}

/**
 * Get the next doctor in round-robin rotation based on history
 */
export function getNextRotationDoctor(
  rule: ExceptionalRotationRule,
  rotationHistory: Array<{ date: string; doctor: string; assignedBy: string }>,
  allDoctors: string[]
): string {
  if (rule.allowedDoctors.length === 0) return ""
  if (rule.allowedDoctors.length === 1) return rule.allowedDoctors[0]

  // For round-robin: find the doctor who was assigned least recently
  const doctorLastAssigned: Record<string, number> = {}

  for (const doctor of rule.allowedDoctors) {
    const lastEntry = rotationHistory
      .filter((h) => h.doctor === doctor)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]

    doctorLastAssigned[doctor] = lastEntry ? new Date(lastEntry.date).getTime() : -Infinity
  }

  // Find doctor with earliest last assignment
  let nextDoctor = rule.allowedDoctors[0]
  let earliestTime = doctorLastAssigned[nextDoctor]

  for (const doctor of rule.allowedDoctors) {
    if (doctorLastAssigned[doctor] < earliestTime) {
      nextDoctor = doctor
      earliestTime = doctorLastAssigned[doctor]
    }
  }

  return nextDoctor
}

/**
 * Apply exceptional rotation rules to the schedule
 */
export function applyExceptionalRotation(
  schedule: ScheduleData,
  weekKey: string,
  constraints: ExceptionalRotationConstraint[],
  vacations: Record<string, string[]>,
  doctorCodes: string[]
): ScheduleData {
  const updatedSchedule = JSON.parse(JSON.stringify(schedule)) as ScheduleData

  for (const constraint of constraints) {
    if (!constraint.isActive) continue

    for (const rule of constraint.rules) {
      const astreinteType = rule.astreinteType

      // Map astreinte types to row names
      let rowNames: string[] = []
      if (astreinteType === "Nuit") {
        rowNames = ["Astreinte Nuit"]
      } else if (astreinteType === "Matin") {
        rowNames = ["Astreinte Matin"]
      } else if (astreinteType === "Apm") {
        rowNames = ["Astreinte Apm"]
      } else if (astreinteType === "Matin + Apm") {
        rowNames = ["Astreinte Matin", "Astreinte Apm"]
      } else if (astreinteType === "Entier") {
        rowNames = ["Astreinte Matin", "Astreinte Apm", "Astreinte Nuit"]
      }

      // Get day name from date
      const dayName = DAYS[new Date(rule.date).getDay() === 0 ? 6 : new Date(rule.date).getDay() - 1]

      for (const rowName of rowNames) {
        if (!updatedSchedule[rowName]) {
          updatedSchedule[rowName] = {}
        }

        // Initialize cell if it doesn't exist
        if (!updatedSchedule[rowName][dayName]) {
          updatedSchedule[rowName][dayName] = {
            value: [],
            type: "doctor",
            status: "validated",
            metadata: {
              cellType: "exceptional_rotation",
              rotationBadge: "Roulement exceptionnel",
            },
          } as CellData
        }

        const cell = updatedSchedule[rowName][dayName] as CellData

        // Check if already manually overridden
        if (cell.metadata?.cellType === "manually_overridden") {
          continue
        }

        // For fixed assignments, assign the fixed doctor
        if (rule.rotationMode === "fixed") {
          const fixedDoctor = rule.allowedDoctors[0]
          cell.value = [fixedDoctor]
          cell.metadata = {
            cellType: "exceptional_rotation",
            rotationBadge: "Roulement exceptionnel",
          }
          cell.status = "validated"
        } else if (rule.rotationMode === "round_robin") {
          // For round-robin, find the next doctor not on vacation
          let availableDoctors = rule.allowedDoctors.filter((doctor) => {
            const vacationDates = vacations[doctor] || []
            return !vacationDates.includes(rule.date)
          })

          if (availableDoctors.length === 0) {
            // If all are on vacation, use all anyway
            availableDoctors = rule.allowedDoctors
          }

          const nextDoctor = getNextRotationDoctor(
            { ...rule, allowedDoctors: availableDoctors },
            constraint.rotationHistory,
            availableDoctors
          )

          cell.value = [nextDoctor]
          cell.metadata = {
            cellType: "exceptional_rotation",
            rotationBadge: "Roulement exceptionnel",
          }
          cell.status = "validated"

          // Record in rotation history
          constraint.rotationHistory.push({
            date: rule.date,
            doctor: nextDoctor,
            assignedBy: "system",
          })
        }
      }
    }
  }

  return updatedSchedule
}

/**
 * Check if a user can override exceptional rotation assignments
 */
export function canAdminOverride(isAdmin: boolean): boolean {
  return isAdmin
}

/**
 * Validate that a doctor is allowed for a specific rule
 */
export function validateExceptionalRotationAssignment(rule: ExceptionalRotationRule, doctor: string): boolean {
  return rule.allowedDoctors.includes(doctor)
}

/**
 * Check if a date falls within any active exceptional rotation period
 */
export function isDateInExceptionalRotation(
  date: string,
  constraints: ExceptionalRotationConstraint[]
): boolean {
  const checkDate = new Date(date)

  for (const constraint of constraints) {
    if (!constraint.isActive) continue

    const startDate = new Date(constraint.startDate)
    const endDate = new Date(constraint.endDate)

    if (checkDate >= startDate && checkDate <= endDate) {
      return true
    }
  }

  return false
}
