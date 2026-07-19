/**
 * Utilitaires pour intégrer le composant VoiceAndUploadPanel
 * Construit les payloads et transforme les réponses du solveur
 */

import type { ScheduleData, FullSchedule, CellData } from '@/lib/types'
import type { DoctorVacation } from '@/lib/types'
import { DAYS, DOCTOR_METADATA } from '@/lib/constants'
import { getWeekNumber } from '@/lib/schedule-utils'

/**
 * Payload attendu par l'API /voice-command
 */
export interface GenerateWeekRequest {
  week_start_date: string // YYYY-MM-DD
  week_type: number // 1 (semaine impaire) ou 2 (semaine paire)
  medecins: Array<{
    id: string
    statut: string // 'permanent', 'astreinte_coro', 'fv', 'ch', 'daas', 'd'
    points_astreinte: number
    points_garde: number
    points_nct: number
    points_weekend: number
  }>
  vacations: Array<{
    doctor_id: string
    start_date: string
    end_date: string
  }>
  weekend_mode: 'CH' | 'ROTATION'
  last_nct_doctor: string | null
  existing_schedule?: Record<string, string[]> // Format: "rowKey|dayKey" -> ["doctor1", "doctor2"]
}

/**
 * Réponse de l'API /voice-command
 */
export interface GenerateWeekResponse {
  assignments: Array<{
    date: string // YYYY-MM-DD
    day: string // LUNDI, MARDI, etc.
    slot: string // 'matin', 'apres_midi', 'nuit'
    activity: string // 'Garde Matin', 'Astreinte Nuit', etc.
    doctors: string[] // ['P', 'Z', etc.]
  }>
  warnings: string[]
}

/**
 * Construit le payload currentWeekRequest pour l'API
 */
export function buildCurrentWeekRequest(
  weekStartDate: string,
  schedule: ScheduleData,
  vacations: DoctorVacation[],
  lastNctDoctor: string | null = null
): GenerateWeekRequest {
  const weekNumber = getWeekNumber(new Date(weekStartDate))
  const weekType = weekNumber % 2 === 0 ? 2 : 1 // Pair ou impair

  // Médecins avec leur statut
  const medecins = Object.keys(DOCTOR_METADATA).map((id) => {
    const metadata = DOCTOR_METADATA[id]
    let statut = 'permanent'
    
    if (['M', 'O', 'W'].includes(id)) statut = 'astreinte_coro'
    else if (id === 'FV') statut = 'fv'
    else if (id === 'DAAS') statut = 'daas'
    else if (id === 'D') statut = 'd'
    else if (id === 'CH') statut = 'ch'

    return {
      id,
      statut,
      points_astreinte: 0,
      points_garde: 0,
      points_nct: 0,
      points_weekend: 0,
    }
  })

  // Vacances
  const vacationPayload = vacations.map((v) => ({
    doctor_id: v.doctor_id,
    start_date: v.start_date,
    end_date: v.end_date,
  }))

  // Assignations existantes en format "rowKey|dayKey" -> ["doctors"]
  const existingSchedule: Record<string, string[]> = {}
  Object.entries(schedule).forEach(([rowKey, daysData]) => {
    Object.entries(daysData).forEach(([dayKey, cellData]) => {
      if (cellData.value && cellData.value.length > 0) {
        const key = `${rowKey}|${dayKey}`
        existingSchedule[key] = cellData.value
      }
    })
  })

  return {
    week_start_date: weekStartDate,
    week_type: weekType,
    medecins,
    vacations: vacationPayload,
    weekend_mode: 'ROTATION',
    last_nct_doctor: lastNctDoctor,
    existing_schedule: existingSchedule,
  }
}

/**
 * Mapping des activités du solveur vers les lignes du planning
 */
const ACTIVITY_TO_ROW: Record<string, Record<string, string>> = {
  matin: {
    'Astreinte Matin': 'Astreintes ATL Matin',
    'Garde Matin': 'Garde Matin',
    'Coro Matin': 'Matin - Coro',
  },
  apres_midi: {
    'Astreinte Apres-midi': 'Astreintes ATL Midi',
    'Garde Apres-midi': 'Garde Midi',
    'Coro Apres-midi': 'Apm - Coro',
  },
  nuit: {
    'Astreinte Nuit': 'Astreintes ATL Nuit',
    'Garde Nuit': 'Garde Nuit',
    'NCT': 'Hors site - NCT',
  },
  weekend: {
    'Astreinte Weekend': 'Garde Matin',
  },
}

/**
 * Convertit la réponse du solveur en ScheduleData
 */
export function convertSolverResponseToScheduleData(
  response: GenerateWeekResponse,
  weekStartDate: string
): ScheduleData {
  // Initialiser schedule vide
  const schedule: ScheduleData = {}
  
  // Initialiser toutes les lignes avec tous les jours
  const allRows = [
    'Cs PSS',
    'Cs Tessée',
    'Visite',
    'Stress',
    'ETT salle 1',
    'ETT salle 2',
    'RÉEDUCATION',
    'EE1',
    'EE2',
    'Rythmo',
    'Coro',
    'Entrées PSS',
    'Pré-op',
    'Astreintes ATL Matin',
    'Astreintes ATL Midi',
    'Astreintes ATL Nuit',
    'Garde Matin',
    'Garde Midi',
    'Garde Nuit',
    'Hors site - NCT',
    'Hors site - CDL',
    'Hors site - IRM',
    'Hors site - Scinti',
    'Hors site - LFB',
    'Hors site - PSSL',
    '1/2 journée off Matin',
    'Congés',
    'Matin - Coro',
    'Apm - Coro',
  ]

  allRows.forEach((rowKey) => {
    schedule[rowKey] = {}
    DAYS.forEach((day) => {
      schedule[rowKey][day] = {
        value: [],
        type: 'empty',
        status: 'validated',
      }
    })
  })

  // Remplir avec les assignations du solveur
  response.assignments.forEach((assignment) => {
    const { day, slot, activity, doctors } = assignment
    
    // Mapper activity -> rowKey
    const activityMap = ACTIVITY_TO_ROW[slot] || {}
    const rowKey = activityMap[activity]

    if (rowKey && schedule[rowKey]) {
      schedule[rowKey][day] = {
        value: doctors,
        type: 'doctor',
        status: 'validated',
      }
    }
  })

  return schedule
}

/**
 * Extrait la date YYYY-MM-DD d'un jour de la semaine
 */
export function getDateForDay(weekStartDate: string, dayName: string): string {
  const dayIndex = DAYS.indexOf(dayName)
  if (dayIndex === -1) return ''

  const startDate = new Date(weekStartDate + 'T00:00:00Z')
  const targetDate = new Date(startDate)
  targetDate.setUTCDate(targetDate.getUTCDate() + dayIndex)

  return targetDate.toISOString().split('T')[0]
}
