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
  console.log('🔍 [populateCongesRowFromVacations] START - weekKey:', weekKey, 'vacations count:', vacations.length)
  
  if (!schedule.Congés) {
    console.log('🔍 [populateCongesRowFromVacations] ERROR: schedule.Congés is undefined')
    return schedule
  }

  // Extraire l'année et la semaine du weekKey (format: "2026-W03")
  const [yearStr, weekStr] = weekKey.split('-W')
  const year = parseInt(yearStr, 10)
  const weekNum = parseInt(weekStr, 10)
  console.log('🔍 [populateCongesRowFromVacations] Calculated year:', year, 'weekNum:', weekNum)

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

    console.log(`🔍 [populateCongesRowFromVacations] Processing day: ${dayName} (${dateStr})`)

    // Trouver tous les médecins en vacances ce jour-là
    const doctorsOnVacationThisDay: string[] = []

    vacations.forEach((vacation) => {
      const startDate = parseISO(vacation.start_date)
      const endDate = parseISO(vacation.end_date)
      const checkDate = parseISO(dateStr)

      console.log(`  🔍 Vacation check: doctor_id=${vacation.doctor_id}, start=${vacation.start_date}, end=${vacation.end_date}, checkDate=${dateStr}`)

      // Vérifier si ce jour est dans la période de vacances: startDate <= checkDate <= endDate
      if (
        !isBefore(checkDate, startDate) &&
        !isAfter(checkDate, endDate)
      ) {
        // Convert email to doctor_code using EMAIL_TO_INITIAL if needed
        const initial = EMAIL_TO_INITIAL[vacation.doctor_id] || vacation.doctor_id
        console.log(`    ✅ Match! doctor_id=${vacation.doctor_id} → initial=${initial}`)
        doctorsOnVacationThisDay.push(initial)
      }
    })

    // ✅ CORRECTION : remplacer la valeur par la liste des initiales dédupliquées
    // au lieu de fusionner avec l'ancienne valeur (qui contenait l'email)
    const uniqueInitials = [...new Set(doctorsOnVacationThisDay)]
    console.log(`  🔍 Final initials for ${dayName}: [${uniqueInitials.join(', ')}]`)
    schedule.Congés[dayName].value = uniqueInitials
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
