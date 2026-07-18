import { DoctorVacation } from './types'
import { FullSchedule } from './types'
import { DAYS, EMAIL_TO_INITIAL } from './constants'
import { parseISO, isBefore, isAfter } from 'date-fns'

/**
 * Remplir automatiquement la ligne "Congés" avec les initiales des médecins en vacances
 * RÈGLE ABSOLUE: Chaque médecin en vacances doit avoir son initiale dans la case "Congés"
 * correspondant à chaque jour de sa période de vacances
 */
export function populateCongesRowFromVacations(
  schedule: FullSchedule,
  vacations: DoctorVacation[],
  weekKey: string
): FullSchedule {
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

      // Vérifier si ce jour est dans la période de vacances
      if (
        (isBefore(checkDate, startDate) && isBefore(startDate, endDate)) ||
        isBefore(checkDate, endDate) &&
        (isAfter(checkDate, startDate) || isBefore(checkDate, startDate))
      ) {
        // En fait, simplement vérifier: startDate <= checkDate <= endDate
        if (
          !isBefore(checkDate, startDate) &&
          !isAfter(checkDate, endDate)
        ) {
          // Convert email to doctor_code using EMAIL_TO_INITIAL if needed
          const initial = EMAIL_TO_INITIAL[vacation.doctor_id] || vacation.doctor_id
          doctorsOnVacationThisDay.push(initial)
        }
      }
    })

    // Ajouter les médecins en vacances à la case "Congés" du jour
    if (doctorsOnVacationThisDay.length > 0) {
      const currentValue = schedule.Congés[dayName].value || []
      const newValue = [
        ...currentValue,
        ...doctorsOnVacationThisDay.filter((doc) => !currentValue.includes(doc)),
      ]
      schedule.Congés[dayName].value = newValue
    }
  })

  return schedule
}

/**
 * Vérifie si tous les médecins en vacances sont présents dans la ligne "Congés"
 */
export function validateCongesRowCompleteness(
  schedule: FullSchedule,
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

    // Médecins supposés être en congés ce jour
    const doctorsShouldBe = new Set<string>()
    vacations.forEach((vacation) => {
      const startDate = parseISO(vacation.start_date)
      const endDate = parseISO(vacation.end_date)
      const checkDate = parseISO(dateStr)

      if (
        !isBefore(checkDate, startDate) &&
        !isAfter(checkDate, endDate)
      ) {
        // Convert email to doctor_code using EMAIL_TO_INITIAL if needed
        const initial = EMAIL_TO_INITIAL[vacation.doctor_id] || vacation.doctor_id
        doctorsShouldBe.add(initial)
      }
    })

    // Médecins présents dans la ligne Congés
    const congesCurrent = new Set(schedule.Congés[dayName].value || [])

    // Vérifier si tous les médecins en vacances sont présents
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
