'use server'

import { getAllVacations } from './vacation-actions'
import { DOCTOR_METADATA, DAYS } from '@/lib/constants'
import type { ScheduleData, CellData } from '@/lib/types'
import { getWeekNumber } from '@/lib/schedule-utils'

// Mapping EXACT des activités retournées par le solveur
// Basé sur la réponse brute : "slot": "nuit", "activity": "Astreinte Nuit", etc.
const ACTIVITY_TO_ROW: Record<string, Record<string, string>> = {
  matin: {
    'Astreinte Matin': 'Astreintes ATL Matin',
    'Garde Matin': 'Garde Matin',
    'Coro Matin': 'Matin - Coro',
  },
  'apres_midi': { // l'API utilise "apres_midi" avec underscore
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

const getSolverStatus = (doctorId: string) => {
  if (['M', 'O', 'W'].includes(doctorId)) return 'astreinte_coro'
  if (doctorId === 'FV') return 'fv'
  if (doctorId === 'DAAS') return 'daas'
  if (doctorId === 'D') return 'd'
  if (doctorId === 'CH') return 'ch'
  return 'permanent'
}

export async function generateWeekWithSolver(
  weekStartDate: string,
  weekendMode: 'CH' | 'ROTATION' = 'ROTATION'
) {
  try {
    // Médecins
    const medecins = Object.keys(DOCTOR_METADATA).map((id) => ({
      id,
      statut: getSolverStatus(id),
      points_astreinte: 0,
      points_garde: 0,
      points_nct: 0,
      points_weekend: 0,
    }))

    // Vacances
    const vacations = await getAllVacations()
    const vacationPayload = vacations.map((v) => ({
      doctor_id: v.doctor_id,
      start_date: v.start_date,
      end_date: v.end_date,
    }))

    // Parité et week_type
    const dateObj = new Date(weekStartDate)
    const weekInfo = getWeekNumber(dateObj)
    const semaine_iso_impaire = weekInfo.week % 2 === 1
    const week_type = semaine_iso_impaire ? 2 : 1
    const lastNctDoctor = null

    // Payload
    const payload = {
      week_start_date: weekStartDate,
      week_type,
      medecins,
      vacations: vacationPayload,
      weekend_mode: weekendMode,
      semaine_iso_impaire,
      last_nct_doctor: lastNctDoctor,
    }

    // Appel API
    const response = await fetch('https://guard-api-cardiomaine.onrender.com/generate-week', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[v0] Erreur API Render : ${response.status} - ${errorText}`)
      throw new Error(`API error (${response.status}): ${errorText}`)
    }

    const result = await response.json()

    // Extraction
    let assignments = result.assignments
    let warnings = result.warnings || []

    if (!Array.isArray(assignments)) {
      if (result.data && Array.isArray(result.data.assignments)) {
        assignments = result.data.assignments
        warnings = result.data.warnings || warnings
      } else if (Array.isArray(result)) {
        assignments = result
      } else {
        console.error('[v0] Aucune assignation trouvée dans la réponse:', result)
        return {
          schedule: null,
          warnings: ['Erreur de structure de la réponse du solveur.'],
          error: 'Aucune assignation trouvée',
          rawData: result,
        }
      }
    }

    // Transformation
    const schedule = createEmptySchedule()

    assignments.forEach((assign: any) => {
      const { date, day_name, slot, activity, doctor } = assign
      const dayKey = day_name?.toUpperCase()
      if (!dayKey || !DAYS.includes(dayKey)) {
        return
      }

      let rowKey = ''
      if (slot === 'weekend') {
        if (dayKey === 'SAMEDI' || dayKey === 'DIMANCHE') {
          rowKey = 'Garde Matin'
        } else {
          return
        }
      } else {
        const mapping = ACTIVITY_TO_ROW[slot]
        if (mapping && mapping[activity]) {
          rowKey = mapping[activity]
        } else {
          return
        }
      }

      if (!rowKey) {
        return
      }

      const cell = schedule[rowKey]?.[dayKey]
      if (!cell) {
        return
      }

      if (!cell.value.includes(doctor)) {
        cell.value = [...cell.value, doctor]
        cell.type = 'doctor'
      }
    })

    return { schedule, warnings }
  } catch (error) {
    console.error('[v0] Erreur dans generateWeekWithSolver:', error)
    return {
      schedule: null,
      warnings: [],
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    }
  }
}

function createEmptySchedule(): ScheduleData {
  const createEmptyRow = () => {
    return DAYS.reduce(
      (acc, day) => ({
        ...acc,
        [day]: { value: [], type: 'empty' as const, status: 'validated' as const },
      }),
      {} as { [key: string]: CellData }
    )
  }

  return {
    'Astreintes ATL Matin': createEmptyRow(),
    'Astreintes ATL Midi': createEmptyRow(),
    'Astreintes ATL Nuit': createEmptyRow(),
    'Garde Matin': createEmptyRow(),
    'Garde Midi': createEmptyRow(),
    'Garde Nuit': createEmptyRow(),
    'Matin - Visite': createEmptyRow(),
    'Hors site - NCT': createEmptyRow(),
    'Hors site - CDL': createEmptyRow(),
    'Hors site - IRM': createEmptyRow(),
    'Hors site - Scinti': createEmptyRow(),
    'Hors site - LFB': createEmptyRow(),
    'Hors site - PSSL': createEmptyRow(),
    'Matin - Cs PSS': createEmptyRow(),
    'Matin - Cs Tessée': createEmptyRow(),
    'Matin - Stress': createEmptyRow(),
    'Matin - ETT salle 1': createEmptyRow(),
    'Matin - ETT salle 2': createEmptyRow(),
    'Matin - EE1': createEmptyRow(),
    'Matin - EE2': createEmptyRow(),
    'Matin - Rythmo': createEmptyRow(),
    'Matin - Coro': createEmptyRow(),
    'Apm - Cs PSS': createEmptyRow(),
    'Apm - Cs Tessée': createEmptyRow(),
    'Apm - Stress': createEmptyRow(),
    'Apm - ETT salle 1': createEmptyRow(),
    'Apm - ETT salle 2': createEmptyRow(),
    'Apm - RÉEDUCATION': createEmptyRow(),
    'Apm - EE1': createEmptyRow(),
    'Apm - EE2': createEmptyRow(),
    'Apm - Rythmo': createEmptyRow(),
    'Apm - Coro': createEmptyRow(),
    'Entrées PSS': createEmptyRow(),
    'Pré-op': createEmptyRow(),
    '1/2 journée off Matin': createEmptyRow(),
    '1/2 journée off Après-midi': createEmptyRow(),
    Vacances: createEmptyRow(),
    Congrès: createEmptyRow(),
    Congés: createEmptyRow(),
    'Notes du jour': createEmptyRow(),
  }
}
