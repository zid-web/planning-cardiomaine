'use server'

import { getAllVacations } from './vacation-actions'
import { DOCTOR_METADATA, DAYS } from '@/lib/constants'
import type { ScheduleData, CellData } from '@/lib/types'
import { getWeekNumber } from '@/lib/schedule-utils'

// Mapping des activités du solveur vers les lignes du planning
const ACTIVITY_TO_ROW: Record<string, Record<string, string>> = {
  'matin': {
    'ASTREINTE': 'Astreintes ATL Matin',
    'GARDE': 'Garde Matin',
    'CORO': 'Matin - Coro',
  },
  'am': {
    'ASTREINTE': 'Astreintes ATL Midi',
    'GARDE': 'Garde Midi',
    'CORO': 'Apm - Coro',
  },
  'nuit': {
    'ASTREINTE': 'Astreintes ATL Nuit',
    'GARDE': 'Garde Nuit',
    'NCT': 'Hors site - NCT',
  },
  'weekend': {
    'ASTREINTE': 'Garde Matin',
  },
}

// Statuts pour le solveur (mapping depuis DOCTOR_METADATA)
const getSolverStatus = (doctorId: string) => {
  const meta = DOCTOR_METADATA[doctorId]
  if (!meta) return 'permanent'
  if (doctorId === 'M' || doctorId === 'O' || doctorId === 'W') return 'astreinte_coro'
  if (doctorId === 'FV') return 'fv'
  if (doctorId === 'DAAS' || doctorId === 'D') return 'daas'
  if (doctorId === 'CH') return 'ch'
  return 'permanent'
}

export interface SolverResponse {
  schedule: ScheduleData | null
  warnings: string[]
  error?: string
}

export async function generateWeekWithSolver(
  weekStartDate: string,
  weekendMode: 'CH' | 'ROTATION' = 'ROTATION'
): Promise<SolverResponse> {
  try {
    console.log('[solver-api] Generating week for:', weekStartDate, 'Weekend mode:', weekendMode)

    // 1. Récupérer tous les médecins (depuis les constantes)
    const medecins = Object.keys(DOCTOR_METADATA).map((id) => ({
      id,
      statut: getSolverStatus(id),
      points_astreinte: 0,
      points_garde: 0,
      points_nct: 0,
      points_weekend: 0,
    }))

    // 2. Récupérer les vacances
    const vacations = await getAllVacations()
    const vacationPayload = vacations.map((v) => ({
      doctor_id: v.doctor_id,
      start_date: v.start_date,
      end_date: v.end_date,
    }))

    // 3. Déterminer la parité de la semaine (ISO)
    const dateObj = new Date(weekStartDate)
    const weekInfo = getWeekNumber(dateObj)
    const semaine_iso_impaire = weekInfo % 2 === 1

    // 4. Récupérer le dernier NCT (si stocké en DB)
    const lastNctDoctor = null

    // 5. Construire la requête pour l'API
    const payload = {
      week_start_date: weekStartDate,
      medecins,
      vacations: vacationPayload,
      weekend_mode: weekendMode,
      semaine_iso_impaire,
      last_nct_doctor: lastNctDoctor,
    }

    console.log('[solver-api] Payload:', JSON.stringify(payload, null, 2))

    // 6. Appeler l'API Render
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 65000)

    let response: Response
    try {
      response = await fetch('https://guard-api-cardiomaine.onrender.com/generate-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[solver-api] API error:', response.status, errorText)
      throw new Error(`API error (${response.status}): ${errorText}`)
    }

    const result = await response.json()
    console.log('[solver-api] API response:', result)

    // 7. Transformer les assignations en ScheduleData
    const schedule: ScheduleData = createEmptySchedule()

    result.assignments?.forEach((assign: any) => {
      const { date, day_name, slot, activity, doctor } = assign
      const dayKey = day_name.toUpperCase()

      if (!DAYS.includes(dayKey)) {
        console.warn('[solver-api] Unknown day:', dayKey)
        return
      }

      // Déterminer la ligne cible
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

      if (!rowKey) {
        console.warn('[solver-api] No mapping for slot:', slot, 'activity:', activity)
        return
      }

      // Ajouter le médecin dans la cellule
      if (!schedule[rowKey]) {
        console.warn('[solver-api] Row not found:', rowKey)
        return
      }

      const cell = schedule[rowKey][dayKey]
      if (!cell) {
        console.warn('[solver-api] Cell not found:', rowKey, dayKey)
        return
      }

      // Éviter les doublons
      if (!cell.value.includes(doctor)) {
        cell.value = [...cell.value, doctor]
        cell.type = 'doctor'
        cell.status = 'pending'
      }
    })

    console.log('[solver-api] Schedule generated successfully')
    return { schedule, warnings: result.warnings || [] }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('[solver-api] Error:', error)

    // Gérer l'erreur de timeout
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        schedule: null,
        warnings: [],
        error: 'Timeout: l\'API a pris trop de temps (65s). Le serveur Render redémarre peut-être. Veuillez réessayer.',
      }
    }

    return {
      schedule: null,
      warnings: [],
      error: errorMessage,
    }
  }
}

/**
 * Utilitaire pour créer un planning vide
 */
function createEmptySchedule(): ScheduleData {
  const createEmptyRow = () => {
    return DAYS.reduce(
      (acc, day) => ({
        ...acc,
        [day]: { value: [], type: 'empty' as const, status: 'validated' as const, request: null },
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

/**
 * Vérifie la santé de l'API
 */
export async function checkSolverAPIHealth(): Promise<boolean> {
  try {
    const response = await fetch('https://guard-api-cardiomaine.onrender.com/health', {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    })
    return response.ok
  } catch {
    return false
  }
}
