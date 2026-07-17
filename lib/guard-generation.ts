'use server'

import { DoctorVacation } from '@/lib/types'
import { STAFF_INITIALS } from './constants'
import { NCT_DATES_2026, NCT_DATES_2025_DEC } from './guard-scheduler'
import { format, parseISO, isBefore, isAfter, startOfWeek, endOfWeek, eachDayOfInterval, isMonday, isTuesday, isWednesday, isThursday, isFriday, isSaturday, isSunday } from 'date-fns'
import { fr } from 'date-fns/locale'

const AVAILABLE_DOCTORS = ['A', 'Z', 'S', 'B', 'G', 'O', 'W', 'M', 'P', 'H', 'U', 'K', 'V', 'FV']
const GENERAL_DOCTORS = ['A', 'Z', 'S', 'B', 'G', 'O', 'W', 'M', 'P', 'H']
const ASTREINTE_DOCTORS = ['W', 'M', 'O']
const NCT_DOCTORS = ['W', 'M']

interface EquityTracker {
  [doctorId: string]: {
    count: number
    astreinteCount: number
    nctCount: number
  }
}

/**
 * Vérifie si un médecin est en vacances à une date donnée
 */
export function isDoctorOnVacation(
  doctorId: string,
  dateStr: string,
  vacations: DoctorVacation[]
): boolean {
  const doctorVacations = vacations.filter((v) => v.doctor_id === doctorId)
  const targetDate = parseISO(dateStr)

  return doctorVacations.some((vacation) => {
    const startDate = parseISO(vacation.start_date)
    const endDate = parseISO(vacation.end_date)
    return !isBefore(targetDate, startDate) && !isAfter(targetDate, endDate)
  })
}

/**
 * Vérifie si un médecin peut être assigné à une activité/jour spécifique
 */
export function canAssignDoctorToDate(
  doctorId: string,
  dateStr: string,
  activity: string,
  vacations: DoctorVacation[]
): { allowed: boolean; reason?: string } {
  // Vérifier les vacances
  if (isDoctorOnVacation(doctorId, dateStr, vacations)) {
    return {
      allowed: false,
      reason: `Ce médecin est en congés ce jour-là (${dateStr})`,
    }
  }

  // Vérifier les contraintes FV
  if (doctorId === 'FV') {
    const date = parseISO(dateStr)
    const dayName = format(date, 'EEEE', { locale: fr }).toUpperCase()

    if (activity === 'Garde Nuit' && dayName !== 'LUNDI') {
      return {
        allowed: false,
        reason: 'FV ne peut faire de garde de nuit que le lundi',
      }
    }

    if (activity === 'Coro' && dayName !== 'JEUDI') {
      return {
        allowed: false,
        reason: 'FV ne peut faire de coro que le jeudi',
      }
    }
  }

  return { allowed: true }
}

/**
 * Calcule l'équité de charge pour les gardes
 */
function calculateEquity(
  doctors: string[],
  existingGuards: Array<{ doctor: string; type: string }>
): EquityTracker {
  const equity: EquityTracker = {}

  doctors.forEach((doctor) => {
    equity[doctor] = { count: 0, astreinteCount: 0, nctCount: 0 }
  })

  existingGuards.forEach((guard) => {
    if (equity[guard.doctor]) {
      equity[guard.doctor].count++
      if (
        guard.type === 'Astreinte Nuit' ||
        guard.type === 'Astreinte Matin' ||
        guard.type === 'Astreinte Midi'
      ) {
        equity[guard.doctor].astreinteCount++
      }
      if (guard.type === 'NCT') {
        equity[guard.doctor].nctCount++
      }
    }
  })

  return equity
}

/**
 * Sélectionne le médecin avec la charge la plus faible (équité)
 */
function selectByEquity(eligibleDoctors: string[], equity: EquityTracker): string {
  if (eligibleDoctors.length === 0) return ''
  return eligibleDoctors.sort(
    (a, b) => equity[a].count - equity[b].count || equity[a].astreinteCount - equity[b].astreinteCount
  )[0]
}

/**
 * Sélectionne aléatoirement parmi les médecins éligibles (favorise l'équité)
 */
function selectRandomByEquity(eligibleDoctors: string[], equity: EquityTracker): string {
  if (eligibleDoctors.length === 0) return ''
  if (eligibleDoctors.length === 1) return eligibleDoctors[0]

  const sorted = [...eligibleDoctors].sort((a, b) => equity[a].count - equity[b].count)
  const topCandidates = sorted.slice(0, Math.min(3, sorted.length))
  return topCandidates[Math.floor(Math.random() * topCandidates.length)]
}

/**
 * Récupère le numéro de semaine (1 ou 2) pour la rotation des astreintes
 */
function getAstreinteWeekNumber(dateStr: string): 1 | 2 {
  const date = parseISO(dateStr)
  const weekStart = startOfWeek(date, { weekStartsOn: 1 })
  const dayOfWeek = (date.getDate() - weekStart.getDate() + 1)
  const isoWeek = Math.ceil((date.getDate() + weekStart.getDay()) / 7)
  return isoWeek % 2 === 1 ? 1 : 2
}

/**
 * Récupère le numéro de semaine ISO
 */
function getISOWeekNumber(dateStr: string): number {
  const date = parseISO(dateStr)
  const firstThursday = new Date(date.getFullYear(), 0, 4)
  const weekStart = startOfWeek(firstThursday, { weekStartsOn: 1 })
  const diff = date.getTime() - weekStart.getTime()
  return Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1
}

/**
 * Génère les gardes/astreintes pour une semaine donnée
 */
export function generateWeeklyGuards(
  weekKey: string,
  vacations: DoctorVacation[] = [],
  existingGuards: Array<{ date: string; doctor: string; type: string }> = []
): {
  guards: Array<{ date: string; day: string; doctor: string; type: string }>
  equity: EquityTracker
} {
  const guards: Array<{ date: string; day: string; doctor: string; type: string }> = []
  const equity = calculateEquity(GENERAL_DOCTORS, existingGuards)

  // Parser la clé de semaine (format: "2026-W01" ou similaire)
  let weekStart: Date
  if (weekKey.includes('W')) {
    const [year, week] = weekKey.split('-W')
    weekStart = parseISO(`${year}-01-04`)
    weekStart = startOfWeek(weekStart, { weekStartsOn: 1 })
    weekStart.setDate(weekStart.getDate() + (parseInt(week) - 1) * 7)
  } else {
    weekStart = parseISO(weekKey)
  }

  const days = eachDayOfInterval({
    start: weekStart,
    end: endOfWeek(weekStart, { weekStartsOn: 1 }),
  })

  const astreinteWeekType = getAstreinteWeekNumber(format(weekStart, 'yyyy-MM-dd'))

  days.forEach((day) => {
    const dateStr = format(day, 'yyyy-MM-dd')
    const dayName = format(day, 'EEEE', { locale: fr }).toUpperCase()

    // Exclure les médecins en vacances
    const availableDoctors = GENERAL_DOCTORS.filter(
      (doc) => !isDoctorOnVacation(doc, dateStr, vacations)
    )

    // RÈGLE 6: FV - Assignation fixe automatique
    if (dayName === 'LUNDI' && !isDoctorOnVacation('FV', dateStr, vacations)) {
      guards.push({ date: dateStr, day: dayName, doctor: 'FV', type: 'Garde Nuit' })
    }

    if (dayName === 'JEUDI' && !isDoctorOnVacation('FV', dateStr, vacations)) {
      guards.push({ date: dateStr, day: dayName, doctor: 'FV', type: 'Coro' })
    }

    // RÈGLE 3: Rotation astreinte nuit (lundi-vendredi)
    if (['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI'].includes(dayName)) {
      const nctDateStr = NCT_DATES_2026.find((nct) => nct.date === dateStr)
      const isNCTDay = !!nctDateStr

      if (astreinteWeekType === 1) {
        // Semaine type 1: Lundi=CH, Mardi=CH, Mercredi=W, Jeudi=M, Vendredi=CH
        let astreinteDoctor = ''
        if (dayName === 'MERCREDI') astreinteDoctor = 'W'
        if (dayName === 'JEUDI') astreinteDoctor = 'M'

        if (astreinteDoctor) {
          if (!isDoctorOnVacation(astreinteDoctor, dateStr, vacations)) {
            guards.push({
              date: dateStr,
              day: dayName,
              doctor: astreinteDoctor,
              type: 'Astreinte Nuit',
            })
            if (equity[astreinteDoctor]) equity[astreinteDoctor].astreinteCount++
          } else {
            // Remplacer par équité si en vacances
            const replacements = ASTREINTE_DOCTORS.filter(
              (d) => !isDoctorOnVacation(d, dateStr, vacations)
            )
            const replacement = selectByEquity(replacements, equity)
            if (replacement) {
              guards.push({
                date: dateStr,
                day: dayName,
                doctor: replacement,
                type: 'Astreinte Nuit',
              })
              if (equity[replacement]) equity[replacement].astreinteCount++
            }
          }
        }
      } else {
        // Semaine type 2: Lundi=aléatoire, Mardi=aléatoire, Mercredi=CH, Jeudi=CH
        if (['LUNDI', 'MARDI'].includes(dayName)) {
          const eligible = ASTREINTE_DOCTORS.filter(
            (d) => !isDoctorOnVacation(d, dateStr, vacations)
          )
          const selected = selectRandomByEquity(eligible, equity)
          if (selected) {
            guards.push({
              date: dateStr,
              day: dayName,
              doctor: selected,
              type: 'Astreinte Nuit',
            })
            if (equity[selected]) equity[selected].astreinteCount++
          }
        }
      }

      // RÈGLE 5: NCT jeudi alternance W/M
      if (dayName === 'JEUDI' && isNCTDay && nctDateStr) {
        guards.push({
          date: dateStr,
          day: dayName,
          doctor: nctDateStr.user,
          type: 'NCT',
        })
        if (equity[nctDateStr.user]) equity[nctDateStr.user].nctCount++
      }
    }

    // RÈGLE 4: Astreinte weekend (samedi/dimanche)
    if (['SAMEDI', 'DIMANCHE'].includes(dayName)) {
      const eligible = ASTREINTE_DOCTORS.filter(
        (d) => !isDoctorOnVacation(d, dateStr, vacations)
      )
      const selected = selectRandomByEquity(eligible, equity)
      if (selected) {
        const type = dayName === 'SAMEDI' ? 'Astreinte Matin' : 'Astreinte Midi'
        guards.push({
          date: dateStr,
          day: dayName,
          doctor: selected,
          type,
        })
        if (equity[selected]) equity[selected].astreinteCount++
      }
    }
  })

  return { guards, equity }
}

/**
 * Fonction de test avec semaine d'exemple
 */
export function testGenerateWeeklyGuards() {
  const exampleWeekKey = '2026-W03'
  const vacations: DoctorVacation[] = [
    {
      id: '1',
      doctor_id: 'Z',
      start_date: '2026-01-19',
      end_date: '2026-01-25',
      created_at: '',
      updated_at: '',
    },
  ]

  const result = generateWeeklyGuards(exampleWeekKey, vacations)

  console.log('[v0] Generated guards for week', exampleWeekKey)
  console.log('[v0] Result:', JSON.stringify(result, null, 2))

  return result
}
