import type { DoctorVacation, ScheduleData } from './types'
import { DAYS } from './constants'
import { parseISO, isBefore, isAfter } from 'date-fns'

/**
 * Remplir automatiquement la ligne "Congés" avec les initiales des médecins en vacances
 * RÈGLE ABSOLUE: Chaque médecin en vacances doit avoir son initiale dans la case "Congés"
 * correspondant à chaque jour de sa période de vacances
 *
 * Note: `schedule` is a **week** ScheduleData (not FullSchedule).
 */
export function populateCongesRowFromVacations(
  schedule: ScheduleData,
  vacations: DoctorVacation[],
  weekKey: string
): ScheduleData {
  if (!schedule.Congés) {
    return schedule
  }

  // Extraire l'année et la semaine du weekKey (format: "2026-W03")
  const [yearStr, weekStr] = weekKey.split('-W')
  const year = parseInt(yearStr, 10)
  const weekNum = parseInt(weekStr, 10)

  // Calculer le lundi de cette semaine
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dayJan4 = jan4.getUTCDay() || 7
  const monday1 = new Date(jan4.getTime() - (dayJan4 - 1) * 86400000)
  const targetMonday = new Date(monday1.getTime() + (weekNum - 1) * 7 * 86400000)

  // Pour chaque jour de la semaine
  DAYS.forEach((dayName, dayIndex) => {
    const currentDate = new Date(targetMonday)
    currentDate.setUTCDate(targetMonday.getUTCDate() + dayIndex)
    const dateStr = currentDate.toISOString().split('T')[0] // Format: YYYY-MM-DD

    // Trouver tous les médecins en vacances ce jour-là
    const doctorsOnVacationThisDay: string[] = []

    vacations.forEach((vacation) => {
      const startDate = parseISO(vacation.start_date)
      const endDate = parseISO(vacation.end_date)
      const checkDate = parseISO(dateStr)

      if (!isBefore(checkDate, startDate) && !isAfter(checkDate, endDate)) {
        doctorsOnVacationThisDay.push(vacation.doctor_id)
      }
    })

    // Ajouter les médecins en vacances à la case "Congés" du jour
    if (doctorsOnVacationThisDay.length > 0) {
      const cell = schedule.Congés[dayName] ?? {
        value: [],
        type: "empty" as const,
        status: "validated" as const,
      }
      const currentValue = cell.value || []
      const newValue = [
        ...currentValue,
        ...doctorsOnVacationThisDay.filter((doc) => !currentValue.includes(doc)),
      ]
      schedule.Congés[dayName] = {
        ...cell,
        value: newValue,
        type: cell.type || "doctor",
        status: cell.status || "validated",
      }
    }
  })

  return schedule
}

/**
 * Vérifie si tous les médecins en vacances sont présents dans la ligne "Congés"
 */
export function validateCongesRowCompleteness(
  schedule: ScheduleData,
  vacations: DoctorVacation[],
  weekKey: string
): { isComplete: boolean; missingDoctors: Set<string>; issueDetails: string[] } {
  const missingDoctors = new Set<string>()
  const issueDetails: string[] = []

  if (!schedule.Congés) {
    return { isComplete: false, missingDoctors, issueDetails: ['Ligne Congés manquante'] }
  }

  const [yearStr, weekStr] = weekKey.split('-W')
  const year = parseInt(yearStr, 10)
  const weekNum = parseInt(weekStr, 10)

  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dayJan4 = jan4.getUTCDay() || 7
  const monday1 = new Date(jan4.getTime() - (dayJan4 - 1) * 86400000)
  const targetMonday = new Date(monday1.getTime() + (weekNum - 1) * 7 * 86400000)

  DAYS.forEach((dayName, dayIndex) => {
    const currentDate = new Date(targetMonday)
    currentDate.setUTCDate(targetMonday.getUTCDate() + dayIndex)
    const dateStr = currentDate.toISOString().split('T')[0]

    const doctorsShouldBe = new Set<string>()
    vacations.forEach((vacation) => {
      const startDate = parseISO(vacation.start_date)
      const endDate = parseISO(vacation.end_date)
      const checkDate = parseISO(dateStr)

      if (!isBefore(checkDate, startDate) && !isAfter(checkDate, endDate)) {
        doctorsShouldBe.add(vacation.doctor_id)
      }
    })

    const congesCurrent = new Set(schedule.Congés[dayName]?.value || [])

    doctorsShouldBe.forEach((doc) => {
      if (!congesCurrent.has(doc)) {
        missingDoctors.add(doc)
        issueDetails.push(
          `Jour ${dayName}: ${doc} est en congés mais pas dans la ligne Congés`
        )
      }
    })
  })

  return {
    isComplete: missingDoctors.size === 0,
    missingDoctors,
    issueDetails,
  }
}
