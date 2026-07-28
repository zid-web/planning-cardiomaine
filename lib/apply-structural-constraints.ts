import { DAYS } from "@/lib/constants"
import { isListedDoctor } from "@/lib/doctor-code"
import {
  applyFixedClinicalAssignments,
  clearFixedAssigneesOnVacation,
  dateStrForWeekDay,
  mondayOfIsoWeekKey,
} from "@/lib/fixed-assignments"
import {
  isAtlEligibleDoctor,
  isCoroEligibleDoctor,
} from "@/lib/group-clinical-rules"
import {
  applyHabitualHalfDaysOff,
  applyNightGuardRecoveryOffs,
} from "@/lib/half-day-off"
import { NCT_DATES_2025_DEC, NCT_DATES_2026 } from "@/lib/guard-scheduler"
import type { DoctorVacation, ScheduleData } from "@/lib/types"
import { applySlotBlockingStrips } from "@/lib/slot-blocking"
import {
  mergeVacancesIntoConges,
  populateCongesRowFromVacations,
  stripDoctorsOnLeaveFromOtherRows,
} from "@/lib/vacation-congés-mapper"

/**
 * Lignes / règles structurelles — toujours injectées dans le planning
 * (sans passer par « Générer »).
 */
export const STRUCTURAL_CONSTRAINT_NOTES = [
  "IRM = S (Lundi + Vendredi)",
  "FV = Garde Nuit Lundi + Coro Jeudi apm",
  "DAAS = Apm EE2 Lundi",
  "Rythmo = P mardi, U mercredi apm, A lundi/jeudi apm (uniquement si le médecin n’est pas en congés)",
  "Visite = rotation U → A → B",
  "½ journée off habituelles",
  "½ journée off récupération après Garde Nuit",
  "Congés depuis doctor_vacations + retrait absents",
  "NCT calendrier (W/M)",
  "LFB Jeudi rotation B/Z/A",
  "CH = Astreinte ATL uniquement (nuit Lun–Ven selon roulement + ATL weekend semaines impaires) — jamais Garde Matin/Midi/Nuit",
  "ATL Matin/Midi Lun–Ven = même médecin que Coro matin / Coro apm",
  "ATL Matin/Midi/Soir = coronarographistes uniquement (M, O, W, FV, CH) — R/V/T/G exclus",
  "Nuits ATL W/O/M : pas de nuits consécutives Lun–Ven (weekend exempt ; CH exempt)",
  "Blocages créneau : congés, ½-off, 1 tâche/matin|apm (sauf ATL+Coro, ETT 1+2, EE1+EE2), LFB/CDL hors garde J/J+1 ; doublon Cs=2× case, ETT/EE=2 salles",
] as const

const WEEKDAYS = ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI"] as const
const WEEKEND = ["SAMEDI", "DIMANCHE"] as const
const ATL_ROWS = ["Astreintes ATL Matin", "Astreintes ATL Midi", "Astreintes ATL Nuit"] as const

/**
 * Roulement CH / WOM (aligné solveur week_type) :
 * - semaine impaire (week_type=1) : CH = nuits Lun/Mar/Ven + weekend ATL complet ;
 *   W/O/M = nuits Mer/Jeu
 * - semaine paire (week_type=2) : CH = nuits Mer/Jeu ;
 *   W/O/M = nuits Lun/Mar/Ven + weekend ATL complet
 */
export function isOddIsoWeek(weekKey: string): boolean {
  const weekNum = Number.parseInt(weekKey.split("-W")[1] || "1", 10)
  return weekNum % 2 === 1
}

export function chNightWeekdaysForWeek(weekKey: string): Set<string> {
  return isOddIsoWeek(weekKey)
    ? new Set(["LUNDI", "MARDI", "VENDREDI"])
    : new Set(["MERCREDI", "JEUDI"])
}

function ensureDoctorInCell(
  schedule: ScheduleData,
  rowKey: string,
  day: string,
  doctor: string,
): ScheduleData {
  if (!schedule[rowKey]?.[day]) return schedule
  const cell = schedule[rowKey][day]
  const values = cell.value || []
  // Déjà présent : ne pas toucher au status (sinon une proposition « Prop. »
  // pending sur ATL Nuit / week-end serait forcée en validated et perdrait le violet).
  if (values.includes(doctor)) return schedule
  return {
    ...schedule,
    [rowKey]: {
      ...schedule[rowKey],
      [day]: {
        ...cell,
        value: [...values, doctor],
        type: "doctor",
        // Injection structurelle : préserver pending (proposition Générer), sinon validated.
        status: cell.status === "pending" ? "pending" : "validated",
      },
    },
  }
}

function removeDoctorFromCell(
  schedule: ScheduleData,
  rowKey: string,
  day: string,
  doctor: string,
): ScheduleData {
  if (!schedule[rowKey]?.[day]) return schedule
  const cell = schedule[rowKey][day]
  const values = cell.value || []
  if (!values.includes(doctor)) return schedule
  const filtered = values.filter((d) => d !== doctor)
  return {
    ...schedule,
    [rowKey]: {
      ...schedule[rowKey],
      [day]: {
        ...cell,
        value: filtered,
        type: filtered.length ? "doctor" : "empty",
      },
    },
  }
}

/**
 * CH : uniquement Astreinte ATL **Nuit** Lun–Ven (selon roulement),
 * et Astreinte ATL Matin+Midi+Nuit Sam/Dim les semaines impaires.
 * Retire CH des ATL Matin/Midi en semaine, des créneaux hors roulement,
 * et **de toutes les lignes Garde** (Matin/Midi/Nuit, y compris week-end).
 */
export function applyChAstreinteConstraints(
  schedule: ScheduleData,
  weekKey: string,
): ScheduleData {
  let next = schedule
  const chNights = chNightWeekdaysForWeek(weekKey)
  const chWeekend = isOddIsoWeek(weekKey)

  for (const day of WEEKDAYS) {
    // Jamais Matin/Midi en semaine pour CH
    next = removeDoctorFromCell(next, "Astreintes ATL Matin", day, "CH")
    next = removeDoctorFromCell(next, "Astreintes ATL Midi", day, "CH")
    if (chNights.has(day)) {
      next = ensureDoctorInCell(next, "Astreintes ATL Nuit", day, "CH")
    } else {
      next = removeDoctorFromCell(next, "Astreintes ATL Nuit", day, "CH")
    }
  }

  for (const day of WEEKEND) {
    if (chWeekend) {
      for (const row of ATL_ROWS) {
        next = ensureDoctorInCell(next, row, day, "CH")
      }
    } else {
      for (const row of ATL_ROWS) {
        next = removeDoctorFromCell(next, row, day, "CH")
      }
    }
  }

  // CH n’est jamais sur une ligne Garde (semaine + week-end)
  for (const day of DAYS) {
    for (const period of ["Matin", "Midi", "Nuit"] as const) {
      next = removeDoctorFromCell(next, `Garde ${period}`, day, "CH")
    }
  }

  return next
}

/**
 * ATL Matin/Midi/Soir = coronarographistes (M, O, W, FV, CH) uniquement.
 * Retire les propositions/saisies listées hors pool (ex. R, V, T, G).
 * Les remplaçants texte libre sont conservés.
 * Coro salle : même filtre hors CH (pool coro = M/O/W/FV).
 */
export function applyAtlCoronarographisteEligibility(schedule: ScheduleData): ScheduleData {
  let next = schedule
  for (const day of DAYS) {
    for (const row of ATL_ROWS) {
      const cell = next[row]?.[day]
      if (!cell) continue
      const values = Array.isArray(cell.value) ? cell.value : []
      if (!values.length) continue
      const filtered = values.filter((d) => !isListedDoctor(d) || isAtlEligibleDoctor(d))
      if (filtered.length !== values.length) {
        next = setCellDoctors(
          next,
          row,
          day,
          filtered,
          (cell.status || "validated") as "validated" | "pending",
        )
      }
    }
    for (const row of ["Matin - Coro", "Apm - Coro"] as const) {
      const cell = next[row]?.[day]
      if (!cell) continue
      const values = Array.isArray(cell.value) ? cell.value : []
      if (!values.length) continue
      const filtered = values.filter((d) => !isListedDoctor(d) || isCoroEligibleDoctor(d))
      if (filtered.length !== values.length) {
        next = setCellDoctors(
          next,
          row,
          day,
          filtered,
          (cell.status || "validated") as "validated" | "pending",
        )
      }
    }
  }
  return next
}

function setValidatedDoctors(
  schedule: ScheduleData,
  rowKey: string,
  day: string,
  doctors: string[],
): ScheduleData {
  return setCellDoctors(schedule, rowKey, day, doctors, "validated")
}

function setCellDoctors(
  schedule: ScheduleData,
  rowKey: string,
  day: string,
  doctors: string[],
  status: "validated" | "pending",
): ScheduleData {
  if (!schedule[rowKey]?.[day]) return schedule
  const cell = schedule[rowKey][day]
  const unique = [...new Set(doctors.filter(Boolean))]
  const same =
    (cell.value || []).length === unique.length &&
    unique.every((d, i) => cell.value?.[i] === d) &&
    (cell.status || "validated") === status
  if (same) return schedule
  return {
    ...schedule,
    [rowKey]: {
      ...schedule[rowKey],
      [day]: {
        ...cell,
        value: unique,
        type: unique.length ? "doctor" : "empty",
        status,
      },
    },
  }
}

/**
 * Lun–Ven : Coro matin/apm et ATL Matin/Midi sont **la même affectation**
 * (même médecin, même statut). On unifie les deux lignes :
 * - priorité à Coro si rempli ;
 * - sinon reprise depuis ATL (ex. solveur ASTREINTE sans CORO) ;
 * - sinon les deux vides.
 */
export function applyAtlFollowsCoroConstraints(schedule: ScheduleData): ScheduleData {
  let next = schedule
  for (const day of WEEKDAYS) {
    next = syncAtlCoroPair(next, day, "Matin - Coro", "Astreintes ATL Matin")
    next = syncAtlCoroPair(next, day, "Apm - Coro", "Astreintes ATL Midi")
  }
  return next
}

/** Paires Coro ↔ ATL (Lun–Ven uniquement). */
export const CORO_ATL_TWINS: Record<string, string> = {
  "Matin - Coro": "Astreintes ATL Matin",
  "Astreintes ATL Matin": "Matin - Coro",
  "Apm - Coro": "Astreintes ATL Midi",
  "Astreintes ATL Midi": "Apm - Coro",
}

export function twinCoroAtlRow(rowKey: string, day: string): string | null {
  if (day === "SAMEDI" || day === "DIMANCHE") return null
  return CORO_ATL_TWINS[rowKey] || null
}

function syncAtlCoroPair(
  schedule: ScheduleData,
  day: string,
  coroRow: string,
  atlRow: string,
): ScheduleData {
  const coro = schedule[coroRow]?.[day]
  const atl = schedule[atlRow]?.[day]
  if (!coro && !atl) return schedule

  const coroVals = coro?.value || []
  const atlVals = atl?.value || []

  let values: string[]
  let status: "validated" | "pending"
  if (coroVals.length > 0) {
    values = [...coroVals]
    status = (coro?.status || "validated") as "validated" | "pending"
  } else if (atlVals.length > 0) {
    values = [...atlVals]
    status = (atl?.status || "validated") as "validated" | "pending"
  } else {
    values = []
    status = "validated"
  }

  let next = schedule
  if (schedule[coroRow]?.[day]) {
    next = setCellDoctors(next, coroRow, day, values, status)
  }
  if (schedule[atlRow]?.[day]) {
    next = setCellDoctors(next, atlRow, day, values, status)
  }
  return next
}

/** NCT calendrier pour la semaine courante. */
export function applyNctCalendarConstraints(
  schedule: ScheduleData,
  weekKey: string,
): ScheduleData {
  if (!schedule["Hors site - NCT"]) return schedule
  const monday = mondayOfIsoWeekKey(weekKey)
  if (!monday) return schedule

  const yearNum = Number.parseInt(weekKey.split("-")[0] || "0", 10)
  const nctList =
    yearNum === 2025
      ? NCT_DATES_2025_DEC
      : yearNum >= 2026
        ? NCT_DATES_2026
        : []

  const dayToDate: Record<string, string> = {}
  for (const day of DAYS) {
    const iso = dateStrForWeekDay(weekKey, day)
    if (iso) dayToDate[day] = iso
  }

  let next = schedule
  for (const nct of nctList) {
    const dayName = Object.keys(dayToDate).find((d) => dayToDate[d] === nct.date)
    if (!dayName) continue
    next = setValidatedDoctors(next, "Hors site - NCT", dayName, [nct.user])
  }
  return next
}

/**
 * LFB Jeudi : rotation B → Z → A en secours si la case est vide.
 * Ne pas écraser une proposition solveur / saisie déjà présente (pending ou non).
 */
export function applyLfbThursdayRotation(
  schedule: ScheduleData,
  weekKey: string,
): ScheduleData {
  if (!schedule["Hors site - LFB"]) return schedule
  const weekNum = Number.parseInt(weekKey.split("-W")[1] || "1", 10)
  const lfbUser = (["B", "Z", "A"] as const)[((weekNum % 3) + 3) % 3]
  const cell = schedule["Hors site - LFB"].JEUDI
  if ((cell?.value || []).length > 0) return schedule
  return setValidatedDoctors(schedule, "Hors site - LFB", "JEUDI", [lfbUser])
}

export type ApplyStructuralConstraintsOptions = {
  previousSundayGuardDoctor?: string | null
  /** Si false, ne touche pas aux ½-off habituelles (défaut true). */
  applyHabitualHalfDays?: boolean
  /** Si false, ne dérive pas la récupération garde nuit (défaut true). */
  applyNightRecovery?: boolean
  /**
   * Si false, ne reconstruit pas la ligne Congés depuis `doctor_vacations`
   * (préserve Congés existants — utile avant le chargement async des congés).
   * Défaut true.
   */
  vacationsReady?: boolean
}

/**
 * Injecte toutes les contraintes structurelles métier dans un planning semaine.
 * Idempotent. Les cellules structurelles sont en statut **validated**.
 *
 * Ne remplit PAS les propositions équité (gardes/astreintes/Coro libres) —
 * cela reste le rôle de « Générer » (pending).
 */
export function applyStructuralConstraints(
  schedule: ScheduleData,
  weekKey: string,
  vacations: DoctorVacation[] = [],
  opts: ApplyStructuralConstraintsOptions = {},
): ScheduleData {
  if (!schedule || !weekKey) return schedule

  // Clone profond : applyFixedClinicalAssignments mute les cellules en place
  let next: ScheduleData = structuredClone(schedule)
  const vacationsReady = opts.vacationsReady !== false

  // 0) Congés d’abord — les règles fixes (Rythmo P/U/A, IRM, …) sautent si absent
  next = mergeVacancesIntoConges(next)
  if (vacationsReady) {
    next = populateCongesRowFromVacations(next, vacations, weekKey)
  }

  // 1) Assignations cliniques fixes (IRM / FV / DAAS / Rythmo / Visite)
  next = applyFixedClinicalAssignments(next, weekKey, vacations, { vacationsReady })

  // 2) CH astreintes (nuit semaine + ATL weekend selon roulement)
  next = applyChAstreinteConstraints(next, weekKey)

  // 2bis) ATL/Coro : uniquement coronarographistes (filtre Prop. solveur hors pool)
  next = applyAtlCoronarographisteEligibility(next)

  // 3) ATL Matin/Midi Lun–Ven = miroir Coro (après strip CH Matin/Midi)
  next = applyAtlFollowsCoroConstraints(next)

  // 4) NCT calendrier + LFB
  next = applyNctCalendarConstraints(next, weekKey)
  next = applyLfbThursdayRotation(next, weekKey)

  // 5) Demi-journées libres habituelles
  if (opts.applyHabitualHalfDays !== false) {
    next = applyHabitualHalfDaysOff(next)
  }

  // 6) Récupération ½ off après Garde Nuit (y compris dimanche précédent → lundi)
  if (opts.applyNightRecovery !== false) {
    next = applyNightGuardRecoveryOffs(next, {
      previousSundayGuardDoctor: opts.previousSundayGuardDoctor,
    })
  }

  // 7) Retrait des absents des autres lignes (Congés déjà à jour)
  next = stripDoctorsOnLeaveFromOtherRows(next, vacations, weekKey)

  // 8) Sécurité : retirer initiales fixes si congés (idempotent avec 1)
  if (vacations.length > 0) {
    next = clearFixedAssigneesOnVacation(next, weekKey, vacations)
  }

  // 9) Strips bloquants (½-off, exclusion créneau, LFB/CDL vs garde)
  next = applySlotBlockingStrips(next)

  // 9bis) Re-filtre ATL/Coro après strips
  next = applyAtlCoronarographisteEligibility(next)

  // 10) Re-miroir Coro→ATL après strips (si Coro a perdu un médecin)
  next = applyAtlFollowsCoroConstraints(next)

  return next
}

/**
 * Compare deux plannings semaine (valeurs + status) pour savoir s’il faut persister.
 */
export function schedulesDiffer(a: ScheduleData | undefined, b: ScheduleData | undefined): boolean {
  if (a === b) return false
  if (!a || !b) return true
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const rowKey of keys) {
    for (const day of DAYS) {
      const ca = a[rowKey]?.[day]
      const cb = b[rowKey]?.[day]
      const va = (ca?.value || []).join("|")
      const vb = (cb?.value || []).join("|")
      if (va !== vb) return true
      if ((ca?.status || "validated") !== (cb?.status || "validated")) return true
    }
  }
  return false
}
