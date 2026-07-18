'use server'

import { getAllVacations } from './vacation-actions'
import { DOCTOR_METADATA, DAYS } from '@/lib/constants'
import type { ScheduleData, CellData } from '@/lib/types'
import { getWeekNumber } from '@/lib/schedule-utils'

// Mapping des activités du solveur vers les lignes du planning
const ACTIVITY_TO_ROW: Record<string, Record<string, string>> = {
  matin: {
    ASTREINTE: 'Astreintes ATL Matin',
    GARDE: 'Garde Matin',
    CORO: 'Matin - Coro',
  },
  am: {
    ASTREINTE: 'Astreintes ATL Midi',
    GARDE: 'Garde Midi',
    CORO: 'Apm - Coro',
  },
  nuit: {
    ASTREINTE: 'Astreintes ATL Nuit',
    GARDE: 'Garde Nuit',
    NCT: 'Hors site - NCT',
  },
  weekend: {
    ASTREINTE: 'Garde Matin',
  },
}

// Statuts pour le solveur
const getSolverStatus = (doctorId: string) => {
  const meta = DOCTOR_METADATA[doctorId]
  if (!meta) return 'permanent'

  if (doctorId === 'M' || doctorId === 'O' || doctorId === 'W') return 'astreinte_coro'
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
  console.log(`🔵 [SERVER] generateWeekWithSolver appelée pour ${weekStartDate}`)

  try {
    // 1. Médecins
    const medecins = Object.keys(DOCTOR_METADATA).map((id) => ({
      id,
      statut: getSolverStatus(id),
      points_astreinte: 0,
      points_garde: 0,
      points_nct: 0,
      points_weekend: 0,
    }))

    // 2. Vacances
    const vacations = await getAllVacations()
    const vacationPayload = vacations.map((v) => ({
      doctor_id: v.doctor_id,
      start_date: v.start_date,
      end_date: v.end_date,
    }))

    // 3. Parité et week_type
    const dateObj = new Date(weekStartDate)
    const weekInfo = getWeekNumber(dateObj)
    const semaine_iso_impaire = weekInfo % 2 === 1
    const week_type = semaine_iso_impaire ? 2 : 1
    const lastNctDoctor = null

    // 4. Payload
    const payload = {
      week_start_date: weekStartDate,
      week_type,
      medecins,
      vacations: vacationPayload,
      weekend_mode: weekendMode,
      semaine_iso_impaire,
      last_nct_doctor: lastNctDoctor,
    }

    console.log(`🔵 [SERVER] Payload envoyé :`, JSON.stringify(payload, null, 2))

    // 5. Appel API
    const response = await fetch('https://guard-api-cardiomaine.onrender.com/generate-week', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    })

    console.log(`🔵 [SERVER] Statut de la réponse Render : ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`🔴 [SERVER] Erreur API Render : ${response.status} - ${errorText}`)
      throw new Error(`API error (${response.status}): ${errorText}`)
    }

    const result = await response.json()
    console.log('🔵 [SERVER] Réponse brute complète :', JSON.stringify(result, null, 2))

    // 6. Extraction robuste des assignations
    let assignments = result.assignments
    let warnings = result.warnings || []

    // Si assignments n'est pas un tableau, on explore d'autres pistes
    if (!Array.isArray(assignments)) {
      // Cas où les données sont sous result.data
      if (result.data && Array.isArray(result.data.assignments)) {
        assignments = result.data.assignments
        warnings = result.data.warnings || warnings
      }
      // Cas où result est directement le tableau (peu probable)
      else if (Array.isArray(result)) {
        assignments = result
      }
      // Dernier recours : on renvoie une erreur avec les données brutes
      else {
        console.error('🔴 [SERVER] Aucune assignation trouvée dans la réponse :', result)
        return {
          schedule: null,
          warnings: ['Erreur de structure de la réponse du solveur.'],
          error: 'Aucune assignation trouvée',
          rawData: result,
        }
      }
    }

    console.log(`🔵 [SERVER] ${assignments.length} assignations extraites.`)

    // 7. Transformation en ScheduleData
    const schedule = createEmptySchedule()

    assignments.forEach((assign: any) => {
      const { date, day_name, slot, activity, doctor } = assign
      const dayKey = day_name?.toUpperCase()
      if (!dayKey || !DAYS.includes(dayKey)) return

      let rowKey = ''
      if (slot === 'weekend') {
        if (dayKey === 'SAMEDI' || dayKey === 'DIMANCHE') {
          rowKey = 'Garde Matin'
        }
      } else {
        const mapping = ACTIVITY_TO_ROW[slot]
        if (mapping && mapping[activity]) {
          rowKey = mapping[activity]
        }
      }

      if (!rowKey) return
      if (!schedule[rowKey]) return

      const cell = schedule[rowKey][dayKey]
      if (!cell) return

      if (!cell.value.includes(doctor)) {
        cell.value = [...cell.value, doctor]
        cell.type = 'doctor'
      }
    })

    return { schedule, warnings }
  } catch (error) {
    console.error('🔴 [SERVER] Erreur dans generateWeekWithSolver :', error)
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
