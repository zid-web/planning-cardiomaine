'use server'

import { DoctorVacation } from '@/lib/types'
import { STAFF_INITIALS } from './constants'
import { NCT_DATES_2026, NCT_DATES_2025_DEC } from './guard-scheduler'
import {
  format,
  parseISO,
  isBefore,
  isAfter,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isMonday,
  isTuesday,
  isWednesday,
  isThursday,
  isFriday,
  isSaturday,
  isSunday,
  addWeeks,
} from 'date-fns'
import { fr } from 'date-fns/locale'

const AVAILABLE_DOCTORS = ['A', 'Z', 'S', 'B', 'G', 'O', 'W', 'M', 'P', 'H', 'U', 'K', 'V', 'FV']
const GENERAL_DOCTORS = ['A', 'Z', 'S', 'B', 'G', 'O', 'W', 'M', 'P', 'H']
const ASTREINTE_DOCTORS = ['W', 'M', 'O'] // Mutualisés avec CH
const NCT_DOCTORS = ['W', 'M']

interface EquityTracker {
  [doctorId: string]: {
    count: number
    astreinteNuitCount: number
    weekendCount: number
    nctCount: number
  }
}

interface Guard {
  date: string
  day: string
  doctor: string
  type: string
  notes?: string
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
  // CH n'est jamais affecté par les vacances (structure externe)
  if (doctorId !== 'CH' && isDoctorOnVacation(doctorId, dateStr, vacations)) {
    return {
      allowed: false,
      reason: `Ce médecin est en congés ce jour-là (${dateStr})`,
    }
  }

  // Contraintes FV
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
  existingGuards: Guard[]
): EquityTracker {
  const equity: EquityTracker = {}

  doctors.forEach((doctor) => {
    equity[doctor] = { count: 0, astreinteNuitCount: 0, weekendCount: 0, nctCount: 0 }
  })

  existingGuards.forEach((guard) => {
    if (equity[guard.doctor]) {
      equity[guard.doctor].count++
      if (guard.type === 'Astreinte Nuit') {
        equity[guard.doctor].astreinteNuitCount++
      }
      if (
        guard.type === 'Astreinte Nuit' ||
        guard.type === 'Astreinte Matin' ||
        guard.type === 'Astreinte Midi'
      ) {
        equity[guard.doctor].weekendCount++
      }
      if (guard.type === 'NCT') {
        equity[guard.doctor].nctCount++
      }
    }
  })

  return equity
}

/**
 * Sélectionne le médecin avec la charge la plus faible
 */
function selectByEquity(
  eligibleDoctors: string[],
  equity: EquityTracker,
  countType: 'astreinteNuitCount' | 'weekendCount'
): string {
  if (eligibleDoctors.length === 0) return ''
  return eligibleDoctors.sort(
    (a, b) => equity[a][countType] - equity[b][countType]
  )[0]
}

/**
 * Récupère les numéros de semaine pour les weekends
 */
function getWeekendNumber(date: Date): number {
  const year = date.getFullYear()
  const firstDay = new Date(year, 0, 1)
  const days = Math.floor((date.getTime() - firstDay.getTime()) / (24 * 60 * 60 * 1000))
  return Math.floor(days / 7) + 1
}

/**
 * Détermine si le weekend est couvert par CH ou par un médecin (M/O/W)
 */
function shouldWeekendBeCH(weekendNumber: number): boolean {
  // Alternance: CH aux weekends pairs (2, 4, 6...), médecin aux impairs (1, 3, 5...)
  return weekendNumber % 2 === 0
}

/**
 * Génère les gardes/astreintes pour une semaine donnée
 */
export function generateWeeklyGuards(
  weekKey: string,
  vacations: DoctorVacation[] = [],
  existingGuards: Guard[] = []
): {
  guards: Guard[]
  equity: EquityTracker
  weekNumber: number
} {
  const guards: Guard[] = []
  const equity = calculateEquity(ASTREINTE_DOCTORS.concat(GENERAL_DOCTORS), existingGuards)

  // Parser la clé de semaine
  let weekStart: Date
  if (weekKey.includes('W')) {
    const [year, week] = weekKey.split('-W')
    weekStart = parseISO(`${year}-01-04`)
    weekStart = startOfWeek(weekStart, { weekStartsOn: 1 })
    weekStart.setDate(weekStart.getDate() + (parseInt(week) - 1) * 7)
  } else {
    weekStart = parseISO(weekKey)
  }

  const weekNumber = getWeekendNumber(weekStart)
  const days = eachDayOfInterval({
    start: weekStart,
    end: endOfWeek(weekStart, { weekStartsOn: 1 }),
  })

  // ========================================
  // RÈGLE 6: FV - assignations fixes
  // ========================================
  days.forEach((day) => {
    const dateStr = format(day, 'yyyy-MM-dd')
    const dayName = format(day, 'EEEE', { locale: fr }).toUpperCase()

    if (dayName === 'LUNDI' && !isDoctorOnVacation('FV', dateStr, vacations)) {
      guards.push({
        date: dateStr,
        day: dayName,
        doctor: 'FV',
        type: 'Garde Nuit',
        notes: 'FV fixe lundi',
      })
    }

    if (dayName === 'JEUDI' && !isDoctorOnVacation('FV', dateStr, vacations)) {
      guards.push({
        date: dateStr,
        day: dayName,
        doctor: 'FV',
        type: 'Coro Après-midi',
        notes: 'FV fixe jeudi après-midi',
      })
    }
  })

  // ========================================
  // SEMAINE (Lundi-Vendredi)
  // ========================================
  days.forEach((day) => {
    const dateStr = format(day, 'yyyy-MM-dd')
    const dayName = format(day, 'EEEE', { locale: fr }).toUpperCase()

    if (!['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI'].includes(dayName)) return

    // RÈGLE 1: Astreinte NUIT en semaine - W/M/O vs CH
    if (!guards.find((g) => g.date === dateStr && g.type === 'Astreinte Nuit')) {
      const availableAstreinte = ASTREINTE_DOCTORS.filter(
        (d) => !isDoctorOnVacation(d, dateStr, vacations)
      )

      if (availableAstreinte.length > 0) {
        const selected = selectByEquity(availableAstreinte, equity, 'astreinteNuitCount')
        guards.push({
          date: dateStr,
          day: dayName,
          doctor: selected,
          type: 'Astreinte Nuit',
          notes: 'Rotation W/M/O',
        })
        equity[selected].astreinteNuitCount++
      } else {
        // Tous en vacances, assigner CH
        guards.push({
          date: dateStr,
          day: dayName,
          doctor: 'CH',
          type: 'Astreinte Nuit',
          notes: 'Centre Hospitalier (tous nos médecins en vacances)',
        })
      }
    }

    // RÈGLE 2: Astreinte MATIN et APRÈS-MIDI en semaine - suit la coro
    // On crée des astreintes qui suivent les assignations coro
    const hasCoroMatin = guards.find(
      (g) =>
        g.date === dateStr &&
        (g.type === 'Coro Matin' || g.type.includes('Matin')) &&
        g.doctor !== 'CH'
    )
    const hasCoroApres = guards.find(
      (g) =>
        g.date === dateStr &&
        (g.type === 'Coro Après-midi' || g.type.includes('Après')) &&
        g.doctor !== 'CH'
    )

    if (hasCoroMatin && !guards.find((g) => g.date === dateStr && g.type === 'Astreinte Matin')) {
      guards.push({
        date: dateStr,
        day: dayName,
        doctor: hasCoroMatin.doctor,
        type: 'Astreinte Matin',
        notes: 'Suit la coro matin',
      })
    }

    if (hasCoroApres && !guards.find((g) => g.date === dateStr && g.type === 'Astreinte Après-midi')) {
      guards.push({
        date: dateStr,
        day: dayName,
        doctor: hasCoroApres.doctor,
        type: 'Astreinte Après-midi',
        notes: 'Suit la coro après-midi',
      })
    }

    // RÈGLE 5: NCT jeudi uniquement - alternance W/M
    if (dayName === 'JEUDI') {
      const nctDate = NCT_DATES_2026.find((nct) => nct.date === dateStr)
      if (nctDate && !guards.find((g) => g.date === dateStr && g.type === 'NCT')) {
        guards.push({
          date: dateStr,
          day: dayName,
          doctor: nctDate.user,
          type: 'NCT',
          notes: 'Alternance W/M uniquement',
        })
        equity[nctDate.user].nctCount++
      }
    }
  })

  // ========================================
  // RÈGLE 3: WEEKEND - alternance par weekend entier
  // ========================================
  const weekendStart = days.find((d) => isSaturday(d)) || days[5]
  if (weekendStart) {
    const isCHWeekend = shouldWeekendBeCH(weekNumber)

    if (isCHWeekend) {
      // CH couvre le weekend entier
      ['SAMEDI', 'DIMANCHE'].forEach((dayName) => {
        const dayObj = days.find((d) => format(d, 'EEEE', { locale: fr }).toUpperCase() === dayName)
        if (dayObj) {
          const dateStr = format(dayObj, 'yyyy-MM-dd')
          guards.push({
            date: dateStr,
            day: dayName,
            doctor: 'CH',
            type: dayName === 'SAMEDI' ? 'Astreinte Weekend' : 'Astreinte Weekend',
            notes: 'Centre Hospitalier (weekend complet)',
          })
        }
      })
    } else {
      // M/O/W en rotation - sélection par équité
      const available = ASTREINTE_DOCTORS.filter(
        (d) =>
          !isDoctorOnVacation(d, format(weekendStart, 'yyyy-MM-dd'), vacations)
      )

      if (available.length > 0) {
        const selected = selectByEquity(available, equity, 'weekendCount')

        ['SAMEDI', 'DIMANCHE'].forEach((dayName) => {
          const dayObj = days.find((d) => format(d, 'EEEE', { locale: fr }).toUpperCase() === dayName)
          if (dayObj) {
            const dateStr = format(dayObj, 'yyyy-MM-dd')
            guards.push({
              date: dateStr,
              day: dayName,
              doctor: selected,
              type: 'Astreinte Weekend',
              notes: `Rotation M/O/W - ${selected} couvre le weekend entier`,
            })
          }
        })
        equity[selected].weekendCount += 2
      }
    }
  }

  return { guards, equity, weekNumber }
}

/**
 * Génère un exemple de test pour semaine 3/2026 (19-25 janvier)
 */
export function generateTestWeek3Example() {
  const vacations: DoctorVacation[] = []
  const result = generateWeeklyGuards('2026-W03', vacations, [])

  console.log('[v0] Generated guards for week 3 (2026-01-19 to 2026-01-25)')
  console.log('[v0] Result:', JSON.stringify(result, null, 2))

  return result
}
