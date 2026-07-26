import type { CellData, DoctorVacation, ScheduleData } from './types'
import { DAYS } from './constants'
import { dateStrForWeekDay } from './fixed-assignments'
import { isDoctorUnavailable } from './assignment-validation'
import { parseISO, isBefore, isAfter } from 'date-fns'

/** Ligne unique pour absences (vacances / congés). */
export const LEAVE_ROW_KEY = 'Congés'
/** Ancienne ligne — migrée automatiquement vers Congés. */
export const LEGACY_VACANCES_ROW_KEY = 'Vacances'

function emptyCell(): CellData {
  return { value: [], type: 'empty', status: 'validated' }
}

function mergeDoctorLists(...lists: Array<string[] | undefined>): string[] {
  const out: string[] = []
  for (const list of lists) {
    for (const doc of list || []) {
      if (doc && !out.includes(doc)) out.push(doc)
    }
  }
  return out
}

/**
 * Fusionne l’ancienne ligne « Vacances » dans « Congés » puis supprime « Vacances ».
 * Idempotent — safe sur plannings déjà migrés.
 */
export function mergeVacancesIntoConges(schedule: ScheduleData): ScheduleData {
  const vacancesRow = schedule[LEGACY_VACANCES_ROW_KEY]
  if (!vacancesRow && schedule[LEAVE_ROW_KEY]) {
    return schedule
  }

  const next: ScheduleData = { ...schedule }
  if (!next[LEAVE_ROW_KEY]) {
    next[LEAVE_ROW_KEY] = Object.fromEntries(DAYS.map((d) => [d, emptyCell()]))
  } else {
    next[LEAVE_ROW_KEY] = { ...next[LEAVE_ROW_KEY] }
  }

  for (const day of DAYS) {
    const congesCell = next[LEAVE_ROW_KEY][day] ?? emptyCell()
    const vacancesCell = vacancesRow?.[day]
    const merged = mergeDoctorLists(congesCell.value, vacancesCell?.value)
    next[LEAVE_ROW_KEY][day] = {
      ...congesCell,
      value: merged,
      type: merged.length ? 'doctor' : congesCell.type || 'empty',
      status: congesCell.status || 'validated',
    }
  }

  delete next[LEGACY_VACANCES_ROW_KEY]
  return next
}

/**
 * Remplir automatiquement la ligne "Congés" avec les initiales des médecins en vacances
 * RÈGLE ABSOLUE: Chaque médecin en vacances doit avoir son initiale dans la case "Congés"
 * correspondant à chaque jour de sa période de vacances
 *
 * Note: `schedule` is a **week** ScheduleData (not FullSchedule).
 * Retourne une nouvelle structure (immuable).
 */
export function populateCongesRowFromVacations(
  schedule: ScheduleData,
  vacations: DoctorVacation[],
  weekKey: string
): ScheduleData {
  let next = mergeVacancesIntoConges(schedule)
  if (!next[LEAVE_ROW_KEY]) {
    return next
  }
  if (!vacations.length) {
    return next
  }

  next = { ...next, [LEAVE_ROW_KEY]: { ...next[LEAVE_ROW_KEY] } }
  let changed = false

  for (const dayName of DAYS) {
    const dateStr = dateStrForWeekDay(weekKey, dayName)
    if (!dateStr) continue

    const doctorsOnVacationThisDay: string[] = []
    for (const vacation of vacations) {
      const startDate = parseISO(vacation.start_date)
      const endDate = parseISO(vacation.end_date)
      const checkDate = parseISO(dateStr)

      if (!isBefore(checkDate, startDate) && !isAfter(checkDate, endDate)) {
        if (!doctorsOnVacationThisDay.includes(vacation.doctor_id)) {
          doctorsOnVacationThisDay.push(vacation.doctor_id)
        }
      }
    }

    if (doctorsOnVacationThisDay.length === 0) continue

    const cell = next[LEAVE_ROW_KEY][dayName] ?? emptyCell()
    const currentValue = cell.value || []
    const newValue = mergeDoctorLists(currentValue, doctorsOnVacationThisDay)
    if (newValue.length === currentValue.length) continue

    changed = true
    next[LEAVE_ROW_KEY][dayName] = {
      ...cell,
      value: newValue,
      type: cell.type || 'doctor',
      status: cell.status || 'validated',
    }
  }

  return changed || next !== schedule ? next : schedule
}

/**
 * Médecin en congé = absent : retiré de toutes les lignes sauf Congés
 * (y compris 1/2 journée off matin / après-midi).
 */
export function stripDoctorsOnLeaveFromOtherRows(
  schedule: ScheduleData,
  vacations: DoctorVacation[],
  weekKey: string
): ScheduleData {
  const patches: Array<{ rowKey: string; dayName: string; cell: CellData }> = []

  for (const dayName of DAYS) {
    const dateStr = dateStrForWeekDay(weekKey, dayName)
    if (!dateStr) continue

    const onLeave = new Set<string>()
    for (const doc of schedule[LEAVE_ROW_KEY]?.[dayName]?.value || []) {
      if (doc) onLeave.add(doc)
    }
    for (const vacation of vacations) {
      if (isDoctorUnavailable(vacation.doctor_id, dateStr, vacations)) {
        onLeave.add(vacation.doctor_id)
      }
    }

    if (onLeave.size === 0) continue

    for (const [rowKey, row] of Object.entries(schedule)) {
      if (!row || rowKey === LEAVE_ROW_KEY || rowKey === LEGACY_VACANCES_ROW_KEY) continue
      if (rowKey === 'Notes du jour') continue
      const cell = row[dayName]
      if (!cell?.value?.length) continue

      const filtered = cell.value.filter((doc) => !onLeave.has(doc))
      if (filtered.length === cell.value.length) continue

      patches.push({
        rowKey,
        dayName,
        cell: {
          ...cell,
          value: filtered,
          type: filtered.length > 0 ? 'doctor' : 'empty',
        },
      })
    }
  }

  if (patches.length === 0) return schedule

  const next: ScheduleData = { ...schedule }
  const touchedRows = new Set<string>()
  for (const { rowKey, dayName, cell } of patches) {
    if (!touchedRows.has(rowKey)) {
      next[rowKey] = { ...schedule[rowKey] }
      touchedRows.add(rowKey)
    }
    next[rowKey][dayName] = cell
  }
  return next
}

/**
 * Pipeline d’affichage / post-génération :
 * 1) fusion Vacances → Congés
 * 2) remplissage depuis doctor_vacations
 * 3) retrait des absents des autres lignes
 */
export function normalizeLeaveSchedule(
  schedule: ScheduleData,
  vacations: DoctorVacation[],
  weekKey: string
): ScheduleData {
  let next = mergeVacancesIntoConges(schedule)
  next = populateCongesRowFromVacations(next, vacations, weekKey)
  next = stripDoctorsOnLeaveFromOtherRows(next, vacations, weekKey)
  return next
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

  const normalized = mergeVacancesIntoConges(schedule)
  if (!normalized[LEAVE_ROW_KEY]) {
    return { isComplete: false, missingDoctors, issueDetails: ['Ligne Congés manquante'] }
  }

  DAYS.forEach((dayName) => {
    const dateStr = dateStrForWeekDay(weekKey, dayName)
    if (!dateStr) return

    const doctorsShouldBe = new Set<string>()
    vacations.forEach((vacation) => {
      const startDate = parseISO(vacation.start_date)
      const endDate = parseISO(vacation.end_date)
      const checkDate = parseISO(dateStr)

      if (!isBefore(checkDate, startDate) && !isAfter(checkDate, endDate)) {
        doctorsShouldBe.add(vacation.doctor_id)
      }
    })

    const congesCurrent = new Set(normalized[LEAVE_ROW_KEY][dayName]?.value || [])

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
