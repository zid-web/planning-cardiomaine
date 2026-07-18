'use server'

import { createClient } from '@/lib/supabase/server'
import { DoctorVacation, ScheduleData } from '@/lib/types'
import { DAYS } from '@/lib/constants'
import { format, parseISO } from 'date-fns'

const GUARD_API_URL = 'https://guard-api-cardiomaine.onrender.com'

interface EquityData {
  doctor_id: string
  astreinte_count: number
  nct_count: number
  weekend_count: number
}

interface GuardAPIRequest {
  week_start_date: string
  week_type: 1 | 2
  weekend_mode: 'CH' | 'ROTATION'
  vacations: Array<{ doctor_id: string; start_date: string; end_date: string }>
  equity: EquityData[]
  last_nct_doctor: string
}

interface GuardAPIResponse {
  week_start_date: string
  week_type: 1 | 2
  assignments: Array<{
    date: string
    day_name: string
    slot: string
    activity: string
    doctor: string
    note?: string
  }>
  warnings: string[]
}

/**
 * Détermine le type de semaine (1 ou 2) en alternant par rapport à une semaine de référence
 * Référence: 2026-01-19 (semaine 3) = type 1
 */
function getWeekType(weekStartDate: string): 1 | 2 {
  const referenceDate = parseISO('2026-01-19') // Semaine 3 = type 1
  const currentDate = parseISO(weekStartDate)
  const daysDiff = Math.floor(
    (currentDate.getTime() - referenceDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
  )
  const weeksFromReference = daysDiff
  return (weeksFromReference % 2 === 0 ? 1 : 2) as 1 | 2
}

/**
 * Détermine le mode weekend (CH ou ROTATION) en alternant
 * Référence: semaine 3/2026 (weekend 19-25 jan) = CH (impair)
 */
function getWeekendMode(weekStartDate: string): 'CH' | 'ROTATION' {
  const date = parseISO(weekStartDate)
  const year = date.getFullYear()
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(year, 0, 0).getTime()) / (24 * 60 * 60 * 1000)
  )
  const weekendNumber = Math.ceil(dayOfYear / 7)

  // Semaine 3 (weekend 3) = CH (impair)
  return weekendNumber % 2 === 1 ? 'CH' : 'ROTATION'
}

/**
 * Calcule les compteurs d'équité actuels depuis l'historique des gardes
 */
async function calculateCurrentEquity(): Promise<EquityData[]> {
  const supabase = await createClient()

  // Récupérer tous les schedules
  const { data: schedules, error } = await supabase
    .from('schedules')
    .select('schedule_data')
    .order('week_key', { ascending: true })

  if (error || !schedules) {
    console.warn('[v0] Could not fetch schedules for equity calculation:', error)
    return []
  }

  const equity: { [key: string]: EquityData } = {}

  // Initialiser les compteurs
  const doctors = [
    'A',
    'Z',
    'S',
    'B',
    'G',
    'O',
    'W',
    'M',
    'P',
    'H',
    'U',
    'K',
    'V',
  ]
  doctors.forEach((doc) => {
    equity[doc] = { doctor_id: doc, astreinte_count: 0, nct_count: 0, weekend_count: 0 }
  })

  // Parcourir tous les schedules et compter
  schedules.forEach((schedule) => {
    const scheduleData = schedule.schedule_data as ScheduleData

    if (!scheduleData) return

    // Compter les astreintes et NCT
    Object.entries(scheduleData).forEach(([activity, dayData]) => {
      if (activity === 'Congés' || activity === 'Notes du jour') return

      Object.entries(dayData).forEach(([day, cellData]) => {
        if (
          activity === 'Astreinte Nuit' ||
          activity === 'Astreinte Matin' ||
          activity === 'Astreinte Midi'
        ) {
          const doctors = (cellData as any).value || []
          doctors.forEach((doc: string) => {
            if (equity[doc]) equity[doc].astreinte_count++
          })
        }

        if (activity === 'NCT') {
          const doctors = (cellData as any).value || []
          doctors.forEach((doc: string) => {
            if (equity[doc]) equity[doc].nct_count++
          })
        }

        if (activity === 'Astreinte Weekend') {
          const doctors = (cellData as any).value || []
          doctors.forEach((doc: string) => {
            if (equity[doc]) equity[doc].weekend_count++
          })
        }
      })
    })
  })

  return Object.values(equity).filter((e) => e.astreinte_count > 0 || e.nct_count > 0 || e.weekend_count > 0)
}

/**
 * Récupère le dernier médecin qui a fait une NCT
 */
async function getLastNCTDoctor(): Promise<string> {
  const supabase = await createClient()

  const { data: schedules, error } = await supabase
    .from('schedules')
    .select('schedule_data')
    .order('week_key', { ascending: false })
    .limit(4)

  if (error || !schedules) return 'W' // Défaut

  for (const schedule of schedules) {
    const scheduleData = schedule.schedule_data as ScheduleData
    if (!scheduleData?.NCT) continue

    for (const dayData of Object.values(scheduleData.NCT)) {
      const doctors = (dayData as any).value || []
      if (doctors.length > 0) {
        return doctors[0] // Retourner le premier médecin trouvé
      }
    }
  }

  return 'W' // Défaut si aucune NCT trouvée
}

/**
 * Appelle l'API externe pour générer les gardes
 */
export async function generateGuardsViaAPI(
  weekKey: string,
  vacations: DoctorVacation[]
): Promise<{
  success: boolean
  error?: string
  schedule?: ScheduleData
  warnings?: string[]
}> {
  try {
    // Déterminer week_type et weekend_mode
    const weekStartDate = `${weekKey.split('-W')[0]}-${String(parseInt(weekKey.split('-W')[1]) * 7 - 5)
      .padStart(2, '0')}`
    const mondayOfWeek = new Date(parseISO(weekKey.split('-W')[0] + '-01-01'))
    mondayOfWeek.setDate(
      mondayOfWeek.getDate() + (parseInt(weekKey.split('-W')[1]) - 1) * 7 + (1 - mondayOfWeek.getDay())
    )
    const weekStartISO = format(mondayOfWeek, 'yyyy-MM-dd')

    const weekType = getWeekType(weekStartISO)
    const weekendMode = getWeekendMode(weekStartISO)

    // Calculer l'équité et récupérer la dernière NCT
    const [equityData, lastNCTDoctor] = await Promise.all([
      calculateCurrentEquity(),
      getLastNCTDoctor(),
    ])

    // Construire la requête
    const request: GuardAPIRequest = {
      week_start_date: weekStartISO,
      week_type: weekType,
      weekend_mode: weekendMode,
      vacations: vacations.map((v) => ({
        doctor_id: v.doctor_id,
        start_date: v.start_date,
        end_date: v.end_date,
      })),
      equity: equityData,
      last_nct_doctor: lastNCTDoctor,
    }

    console.log('[v0] Sending to Guard API:', JSON.stringify(request, null, 2))

    // Appeler l'API
    const response = await fetch(`${GUARD_API_URL}/generate-week`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      timeout: 65000, // 65 secondes pour gérer le délai de démarrage
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[v0] Guard API error:', response.status, errorText)
      return {
        success: false,
        error: `API error: ${response.status} - ${errorText}`,
      }
    }

    const apiResponse: GuardAPIResponse = await response.json()

    // Convertir la réponse au format schedule_data
    const schedule = convertAPIResponseToSchedule(apiResponse)

    return {
      success: true,
      schedule,
      warnings: apiResponse.warnings,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[v0] Error generating guards via API:', error)
    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Convertit la réponse API au format schedule_data
 */
function convertAPIResponseToSchedule(apiResponse: GuardAPIResponse): ScheduleData {
  const schedule: ScheduleData = {}

  // Initialiser toutes les activités pour tous les jours
  DAYS.forEach((day) => {
    schedule['CS'] = schedule['CS'] || {}
    schedule['CS'][day] = { value: [], status: 'pending', request: null }

    schedule['CORO'] = schedule['CORO'] || {}
    schedule['CORO'][day] = { value: [], status: 'pending', request: null }

    schedule['RYTHMO'] = schedule['RYTHMO'] || {}
    schedule['RYTHMO'][day] = { value: [], status: 'pending', request: null }

    schedule['Garde Nuit'] = schedule['Garde Nuit'] || {}
    schedule['Garde Nuit'][day] = { value: [], status: 'pending', request: null }

    schedule['Astreinte Nuit'] = schedule['Astreinte Nuit'] || {}
    schedule['Astreinte Nuit'][day] = { value: [], status: 'pending', request: null }

    schedule['Astreinte Matin'] = schedule['Astreinte Matin'] || {}
    schedule['Astreinte Matin'][day] = { value: [], status: 'pending', request: null }

    schedule['Astreinte Midi'] = schedule['Astreinte Midi'] || {}
    schedule['Astreinte Midi'][day] = { value: [], status: 'pending', request: null }

    schedule['Astreinte Weekend'] = schedule['Astreinte Weekend'] || {}
    schedule['Astreinte Weekend'][day] = { value: [], status: 'pending', request: null }

    schedule['NCT'] = schedule['NCT'] || {}
    schedule['NCT'][day] = { value: [], status: 'pending', request: null }

    schedule['Coro Après-midi'] = schedule['Coro Après-midi'] || {}
    schedule['Coro Après-midi'][day] = { value: [], status: 'pending', request: null }

    schedule['Congés'] = schedule['Congés'] || {}
    schedule['Congés'][day] = { value: [], status: 'validated', request: null }

    schedule['Notes du jour'] = schedule['Notes du jour'] || {}
    schedule['Notes du jour'][day] = { value: [], status: 'validated', request: null }
  })

  // Remplir avec les assignations API
  apiResponse.assignments.forEach((assignment) => {
    const dayIndex = DAYS.findIndex(
      (d) => d.toUpperCase() === assignment.day_name.toUpperCase()
    )
    if (dayIndex === -1) return

    const dayName = DAYS[dayIndex]
    const activity = assignment.activity

    if (schedule[activity] && schedule[activity][dayName]) {
      if (!schedule[activity][dayName].value.includes(assignment.doctor)) {
        schedule[activity][dayName].value.push(assignment.doctor)
      }
    }
  })

  return schedule
}

/**
 * Vérifie si l'API est disponible
 */
export async function checkGuardAPIHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${GUARD_API_URL}/`, {
      method: 'GET',
      timeout: 5000,
    })
    return response.ok
  } catch {
    return false
  }
}
