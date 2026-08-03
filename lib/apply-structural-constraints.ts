import { DAYS } from "@/lib/constants"
import { isListedDoctor } from "@/lib/doctor-code"
import {
  ACTIVITY_MAINTENANCE_ROW_KEYS,
  isActivitySuspendedInWeek,
  isActivitySuspendedOnDate,
  type ActivityMaintenanceActivity,
} from "@/lib/activity-maintenance"
import {
  applyFixedClinicalAssignments,
  applyNurseFixedAssignments,
  clearFixedAssigneesOnVacation,
  dateStrForWeekDay,
  isOddIsoWeek,
  mondayOfIsoWeekKey,
} from "@/lib/fixed-assignments"
import {
  isAtlEligibleForCell,
  isCoroEligibleDoctor,
} from "@/lib/group-clinical-rules"
import {
  applyHabitualHalfDaysOff,
  applyNightGuardRecoveryOffs,
} from "@/lib/half-day-off"
import { NCT_DATES_2025_DEC, NCT_DATES_2026 } from "@/lib/guard-scheduler"
import type { DoctorVacation, ScheduleData } from "@/lib/types"
import type { EquityCounts } from "@/lib/equity-tracking"
import { applySlotBlockingStrips } from "@/lib/slot-blocking"
import { applyStressAndDRules } from "@/lib/stress-rules"
import { applyWeekendWomRules } from "@/lib/weekend-wom-rules"
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
  "Rythmo = calendrier A/P/U selon semaine impaire/paire (voir rythmoFixedSlotsForWeek)",
  "Visite = rotation U → A → B",
  "½ journée off habituelles",
  "½ journée off récupération après Garde Nuit (pas Ven→Sam : Sam Matin = Ven Nuit)",
  "Congés depuis doctor_vacations + retrait absents",
  "NCT calendrier (W/M)",
  "LFB Jeudi rotation H/S/G (désignable avant Générer ; sautée si LFB suspendue)",
  "VISITE U/A/B + PSSL B(jeudi)/Z(mardi) désignables avant Générer",
  "Suspensions activity_maintenance : NCT S31–S36 ; PSSL/LFB/CDL S28–S36 (2026)",
  "CH = Astreinte ATL uniquement (nuit Lun–Ven selon roulement + ATL weekend semaines impaires) — jamais Garde Matin/Midi/Nuit",
  "ATL Matin/Midi Lun–Ven = même médecin que Coro matin / Coro apm",
  "ATL Matin/Midi/Soir = M/O/W/CH ; FV = ATL Midi jeudi seulement (= Coro)",
  "Weekend Garde : Sam Matin = Ven Nuit (+ associé Sam Midi/Nuit) ; Sam Midi=Nuit ; Dim Matin=Midi=Nuit",
  "Weekend ATL : Sam Matin=Midi=Nuit ; Dim Matin=Midi=Nuit (un médecin / jour)",
  "Nuits ATL W/O/M : pas de nuits consécutives Lun–Ven (weekend exempt ; CH exempt)",
  "Blocages créneau : congés, ½-off, 1 tâche/matin|apm (sauf ATL+Coro, ETT 1+2, EE1+EE2), LFB/CDL hors garde J/J+1 ; doublon Cs=2× case, ETT/EE=2 salles",
] as const

const WEEKDAYS = ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI"] as const
const WEEKEND = ["SAMEDI", "DIMANCHE"] as const
const ATL_ROWS = ["Astreintes ATL Matin", "Astreintes ATL Midi", "Astreintes ATL Nuit"] as const
const GARDE_PERIOD_ROWS = ["Garde Matin", "Garde Midi", "Garde Nuit"] as const

/**
 * Roulement CH / WOM (aligné solveur week_type) :
 * - semaine impaire (week_type=1) : CH = nuits Lun/Mar/Ven + weekend ATL complet ;
 *   W/O/M = nuits Mer/Jeu
 * - semaine paire (week_type=2) : CH = nuits Mer/Jeu ;
 *   W/O/M = nuits Lun/Mar/Ven + weekend ATL complet
 */
export { isOddIsoWeek }

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

  // CH n'est jamais sur une ligne Garde (semaine + week-end)
  for (const day of DAYS) {
    for (const period of ["Matin", "Midi", "Nuit"] as const) {
      next = removeDoctorFromCell(next, `Garde ${period}`, day, "CH")
    }
  }

  return next
}

/**
 * Règle d'équité M/O/W : le médecin qui assure l'ATL Nuit Vendredi
 * **et/ou** l'ATL weekend (Samedi/Dimanche, toutes périodes) est exclu
 * des Astreintes ATL Nuit **Lundi** et **Mardi** de la même semaine.
 *
 * Principe : ce médecin a déjà 4–5 astreintes sur la semaine (Ven + Sam + Dim) ;
 * lui retirer Lun/Mar rééquilibre la charge au sein du trio.
 *
 * S'applique après `applyChAstreinteConstraints` et `applyWeekendWomRules`
 * pour pouvoir lire les cases Ven/Sam/Dim déjà remplies.
 *
 * Ne touche **jamais** une case Lun/Mar ATL Nuit déjà **validée** avec un
 * médecin listé différent (saisie admin prioritaire).
 */
export function applyMOWWeekendExcludesMonTueNights(
  schedule: ScheduleData,
): ScheduleData {
  const MOW = ["M", "O", "W"] as const

  // Détecte les médecins M/O/W présents dans l'ATL Ven Nuit ou ATL Sam/Dim (toutes lignes)
  const weekendDoctors = new Set<string>()

  // Ven Nuit ATL
  for (const doc of (schedule["Astreintes ATL Nuit"]?.["VENDREDI"]?.value || []) as string[]) {
    if ((MOW as readonly string[]).includes(doc)) weekendDoctors.add(doc)
  }

  // Sam + Dim : toutes lignes ATL (Matin, Midi, Nuit)
  for (const day of WEEKEND) {
    for (const row of ATL_ROWS) {
      for (const doc of (schedule[row]?.[day]?.value || []) as string[]) {
        if ((MOW as readonly string[]).includes(doc)) weekendDoctors.add(doc)
      }
    }
  }

  if (weekendDoctors.size === 0) return schedule

  let next = schedule
  for (const day of ["LUNDI", "MARDI"] as const) {
    const cell = next["Astreintes ATL Nuit"]?.[day]
    if (!cell) continue
    const values = cell.value || []
    const listedDocs = values.filter((d) => Boolean(d) && d.length > 0)

    // Ne pas toucher une case validée avec un médecin différent des candidats à retirer
    const hasOtherValidated =
      cell.status === "validated" &&
      listedDocs.some((d) => !weekendDoctors.has(d))
    if (hasOtherValidated) continue

    const filtered = values.filter((d) => !weekendDoctors.has(d))
    if (filtered.length !== values.length) {
      next = removeDoctorFromCell(next, "Astreintes ATL Nuit", day,
        // On retire chaque médecin impliqué un par un
        // (removeDoctorFromCell ne retire qu'un médecin à la fois)
        [...weekendDoctors][0]!,
      )
      // Plusieurs médecins à retirer : boucle
      for (const doc of [...weekendDoctors].slice(1)) {
        next = removeDoctorFromCell(next, "Astreintes ATL Nuit", day, doc)
      }
    }
  }

  return next
}

/**
 * ATL Matin/Midi/Soir = M, O, W, CH ; **FV uniquement ATL Midi jeudi**.
 * Retire les propositions/saisies listées hors pool (ex. R, V, T, G, FV hors jeudi Midi).
 * Les remplaçants texte libre sont conservés.
 * Coro salle : M/O/W/FV (pas CH).
 */
export function applyAtlCoronarographisteEligibility(schedule: ScheduleData): ScheduleData {
  let next = schedule
  for (const day of DAYS) {
    for (const row of ATL_ROWS) {
      const cell = next[row]?.[day]
      if (!cell) continue
      const values = Array.isArray(cell.value) ? cell.value : []
      if (!values.length) continue
      const filtered = values.filter(
        (d) => !isListedDoctor(d) || isAtlEligibleForCell(d, row, day),
      )
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
 * pour M/O/W. **FV** : uniquement jeudi Apm Coro ↔ ATL Midi (jamais Matin/Nuit
 * ni les autres AM). Hors ce créneau, FV en Coro n’écrit pas l’ATL.
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

  const keepFreeText = (v: string) => Boolean(v) && !isListedDoctor(v)
  const coroEligible = (v: string) => keepFreeText(v) || isCoroEligibleDoctor(v)
  const atlEligible = (v: string) => keepFreeText(v) || isAtlEligibleForCell(v, atlRow, day)

  // --- Coro ---
  let coroOut: string[]
  let coroStatus: "validated" | "pending"
  if (coroVals.length > 0) {
    coroOut = [...coroVals]
    coroStatus = (coro?.status || "validated") as "validated" | "pending"
  } else {
    const fromAtl = atlVals.filter(coroEligible)
    if (fromAtl.length > 0) {
      coroOut = fromAtl
      coroStatus = (atl?.status || "validated") as "validated" | "pending"
    } else {
      coroOut = []
      coroStatus = "validated"
    }
  }

  // --- ATL : pool M/O/W/CH + FV uniquement ATL Midi jeudi ---
  let atlOut: string[]
  let atlStatus: "validated" | "pending"
  const fromCoroForAtl = coroVals.filter(atlEligible)
  if (fromCoroForAtl.length > 0) {
    atlOut = fromCoroForAtl
    atlStatus = (coro?.status || "validated") as "validated" | "pending"
  } else if (coroVals.length > 0) {
    // Coro rempli uniquement par non-ATL pour ce créneau → ne pas écraser ATL
    atlOut = atlVals.filter(atlEligible)
    atlStatus = (atl?.status || "validated") as "validated" | "pending"
  } else if (atlVals.length > 0) {
    atlOut = atlVals.filter(atlEligible)
    atlStatus = (atl?.status || "validated") as "validated" | "pending"
  } else {
    atlOut = []
    atlStatus = "validated"
  }

  let next = schedule
  if (schedule[coroRow]?.[day]) {
    next = setCellDoctors(next, coroRow, day, coroOut, coroStatus)
  }
  if (schedule[atlRow]?.[day]) {
    next = setCellDoctors(next, atlRow, day, atlOut, atlStatus)
  }
  return next
}

function listedInCell(schedule: ScheduleData, row: string, day: string): string[] {
  return (schedule[row]?.[day]?.value || []).filter((d) => isListedDoctor(d))
}

function remplacantsInCell(schedule: ScheduleData, row: string, day: string): string[] {
  return (schedule[row]?.[day]?.value || []).filter((d) => d && !isListedDoctor(d))
}

function cellPendingStatus(
  schedule: ScheduleData,
  rows: readonly string[],
  day: string,
): "validated" | "pending" {
  for (const row of rows) {
    if (schedule[row]?.[day]?.status === "pending") return "pending"
  }
  return "validated"
}

/**
 * Propage le pool de médecins listés d’une case source vers les cases **vides**
 * du même jour. `priorityRows` : première ligne non vide gagne.
 * Ne **jamais** écraser une case qui a déjà un médecin listé (override admin).
 * Remplaçants texte libre conservés sur chaque case.
 */
function fillEmptyFromPriorityListedDoctors(
  schedule: ScheduleData,
  rows: readonly string[],
  day: string,
  priorityRows: readonly string[],
): ScheduleData {
  let chosen: string[] | null = null
  for (const row of priorityRows) {
    const listed = listedInCell(schedule, row, day)
    if (listed.length > 0) {
      chosen = listed
      break
    }
  }
  if (chosen === null) return schedule

  const status = cellPendingStatus(schedule, rows, day)
  let next = schedule
  for (const row of rows) {
    if (!next[row]?.[day]) continue
    if (listedInCell(next, row, day).length > 0) continue
    // Case explicitement vidée par l'admin : ne jamais la re-remplir
    // (confirmé utilisateur 31/07/2026).
    if (next[row]![day]!.manuallyCleared) continue
    const remplacants = remplacantsInCell(next, row, day)
    next = setCellDoctors(next, row, day, [...chosen, ...remplacants], status)
  }
  return next
}

/**
 * Weekend Garde + ATL (couplage **souple**) :
 * - Remplit les cases **vides** pour aligner Sam/Dim ATL Matin/Midi/Nuit,
 *   Sam Garde Midi↔Nuit, Dim Garde Matin/Midi/Nuit,
 *   Sam Matin dérivé de Ven Garde Nuit + Sam Midi.
 * - Si Sam Matin a **un seul** médecin listé, propage vers Midi/Nuit vides.
 * - Ne réécrit **jamais** une case déjà pourvue d’un médecin listé.
 */
export function applyWeekendGardeAtlCoupling(schedule: ScheduleData): ScheduleData {
  let next = schedule

  // ATL weekend : propager vers cases vides seulement
  for (const day of WEEKEND) {
    next = fillEmptyFromPriorityListedDoctors(next, ATL_ROWS, day, [
      "Astreintes ATL Nuit",
      "Astreintes ATL Midi",
      "Astreintes ATL Matin",
    ])
  }

  // Sam Garde Midi ↔ Nuit (cases vides seulement)
  next = fillEmptyFromPriorityListedDoctors(
    next,
    ["Garde Midi", "Garde Nuit"],
    "SAMEDI",
    ["Garde Midi", "Garde Nuit"],
  )

  // Dim Garde Matin / Midi / Nuit (cases vides seulement)
  next = fillEmptyFromPriorityListedDoctors(next, GARDE_PERIOD_ROWS, "DIMANCHE", [
    "Garde Nuit",
    "Garde Midi",
    "Garde Matin",
  ])

  // Sam Garde Matin = Ven Nuit + associé Sam Midi — uniquement si Matin est vide
  const friNight = listedInCell(next, "Garde Nuit", "VENDREDI")
  const satWeekendDoc = listedInCell(next, "Garde Midi", "SAMEDI")
  const samMatinListed = [...new Set([...friNight, ...satWeekendDoc])]
  const samMatinExisting = listedInCell(next, "Garde Matin", "SAMEDI")
  if (
    samMatinListed.length > 0 &&
    next["Garde Matin"]?.SAMEDI &&
    samMatinExisting.length === 0 &&
    !next["Garde Matin"]!.SAMEDI!.manuallyCleared
  ) {
    const remplacants = remplacantsInCell(next, "Garde Matin", "SAMEDI")
    const status =
      next["Garde Nuit"]?.VENDREDI?.status === "pending" ||
      next["Garde Midi"]?.SAMEDI?.status === "pending" ||
      next["Garde Matin"]?.SAMEDI?.status === "pending"
        ? "pending"
        : "validated"
    next = setCellDoctors(
      next,
      "Garde Matin",
      "SAMEDI",
      [...samMatinListed, ...remplacants],
      status,
    )
  }

  // Un seul médecin sur Sam Matin → propager vers Midi/Nuit vides (pas si Matin = Ven+associé)
  const matinOnly = listedInCell(next, "Garde Matin", "SAMEDI")
  if (matinOnly.length === 1) {
    next = fillEmptyFromPriorityListedDoctors(next, GARDE_PERIOD_ROWS, "SAMEDI", [
      "Garde Matin",
      "Garde Midi",
      "Garde Nuit",
    ])
  }

  return next
}

/** NCT calendrier pour la semaine courante (ignore les dates en suspension). */
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
  // Si NCT suspendue toute la semaine : vider la ligne
  if (isActivitySuspendedInWeek(weekKey, "NCT")) {
    for (const day of DAYS) {
      if (next["Hors site - NCT"]?.[day]) {
        next = setValidatedDoctors(next, "Hors site - NCT", day, [])
      }
    }
    return next
  }

  for (const nct of nctList) {
    if (isActivitySuspendedOnDate(nct.date, "NCT")) continue
    const dayName = Object.keys(dayToDate).find((d) => dayToDate[d] === nct.date)
    if (!dayName) continue
    next = setValidatedDoctors(next, "Hors site - NCT", dayName, [nct.user])
  }
  return next
}

/**
 * LFB Jeudi : rotation H → S → G (aligné solveur) en secours si la case est vide.
 * `lfbDoctorOverride` : désignation admin avant Générer (prioritaire).
 * Ne pas écraser une proposition solveur / saisie déjà présente (pending ou non).
 * Suspendue via `activity_maintenance` → case vide.
 */
export function applyLfbThursdayRotation(
  schedule: ScheduleData,
  weekKey: string,
  lfbDoctorOverride?: string | null,
): ScheduleData {
  if (!schedule["Hors site - LFB"]) return schedule
  if (isActivitySuspendedInWeek(weekKey, "LFB")) {
    return setValidatedDoctors(schedule, "Hors site - LFB", "JEUDI", [])
  }
  const weekNum = Number.parseInt(weekKey.split("-W")[1] || "1", 10)
  const fromOverride =
    lfbDoctorOverride === "H" || lfbDoctorOverride === "S" || lfbDoctorOverride === "G"
      ? lfbDoctorOverride
      : null
  const lfbUser =
    fromOverride || (["H", "S", "G"] as const)[((weekNum % 3) + 3) % 3]
  const cell = schedule["Hors site - LFB"].JEUDI
  if ((cell?.value || []).length > 0) return schedule
  return setValidatedDoctors(schedule, "Hors site - LFB", "JEUDI", [lfbUser])
}

/**
 * Vide les lignes hors site / NCT suspendues sur la semaine (PSSL, CDL, LFB, NCT).
 */
export function applyActivityMaintenanceClear(
  schedule: ScheduleData,
  weekKey: string,
): ScheduleData {
  let next = schedule
  const acts: ActivityMaintenanceActivity[] = ["PSSL", "LFB", "CDL", "NCT"]
  for (const act of acts) {
    if (!isActivitySuspendedInWeek(weekKey, act)) continue
    const row = ACTIVITY_MAINTENANCE_ROW_KEYS[act]
    if (!next[row]) continue
    for (const day of DAYS) {
      if (!next[row]?.[day]) continue
      const vals = next[row][day].value || []
      if (vals.length === 0) continue
      next = setValidatedDoctors(next, row, day, [])
    }
  }
  return next
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
  /** Désignation admin Visite (A/B/U) — sinon rotation weekNum % 3. */
  visiteDoctor?: string | null
  /** Désignation admin LFB jeudi (H/S/G) — sinon rotation weekNum % 3. */
  lfbDoctor?: string | null
  /**
   * Équité glissante 6 mois (M/O/W) pour choisir mono/combo week-end ATL.
   * Optionnel — rotation déterministe si absent.
   */
  weekendEquity?: Record<string, EquityCounts>
  /**
   * true = semaine jamais chargée avant (squelette tout juste créé par
   * `generateWeekSchedule`, aucune donnée sauvegardée) ; false = données
   * déjà sauvegardées/éditées par un admin. Défaut true (rétrocompatible).
   *
   * Quand false, les mécanismes de remplissage par défaut sur case VIDE
   * (créneaux fixes DOC022/IRM/FV/DAAS/Rythmo/Visite, couplage Garde/ATL
   * weekend, mono/combo weekend WOM) sont désactivés — une case vide reste
   * vide, elle n'est plus jamais réinterprétée comme "à remplir". Seule la
   * récupération après garde de nuit (`applyNightRecovery`, section 6)
   * continue de s'appliquer dans tous les cas (confirmé utilisateur
   * 31/07/2026 : règle absolue, seule exception à la libre modification).
   */
  isFreshWeek?: boolean
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
  const isFreshWeek = opts.isFreshWeek !== false

  // 0) Congés d’abord — les règles fixes (Rythmo P/U/A, IRM, …) sautent si absent
  next = mergeVacancesIntoConges(next)
  if (vacationsReady) {
    next = populateCongesRowFromVacations(next, vacations, weekKey)
  }

  // 1) Assignations cliniques fixes (IRM / FV / DAAS / Rythmo / Visite) -
  // uniquement sur une semaine jamais chargée (confirmé utilisateur
  // 31/07/2026 : une case vidée par un admin ne doit plus jamais être
  // réinjectée automatiquement).
  if (isFreshWeek) {
    next = applyFixedClinicalAssignments(next, weekKey, vacations, {
      vacationsReady,
      visiteDoctor: opts.visiteDoctor,
    })
  }

  // 1bis) Stress fermé Mer/Ven Apm + D jeudi (1er = Stress apm ; sinon EE1+EE2)
  next = applyStressAndDRules(next, weekKey, vacations, { vacationsReady })

  // 1ter) Planning fixe Val/Véro (infirmières) - APRÈS D pour pouvoir
  // s'ajouter à côté de lui le jeudi sans être écrasées (confirmé
  // utilisateur 31/07/2026) - uniquement sur une semaine fraîche, même
  // principe qu'en 1.
  if (isFreshWeek) {
    next = applyNurseFixedAssignments(next, weekKey, vacations)
  }

  // 2) CH astreintes (nuit semaine + ATL weekend selon roulement)
  next = applyChAstreinteConstraints(next, weekKey)

  // 2bis) ATL/Coro : uniquement coronarographistes (filtre Prop. solveur hors pool)
  next = applyAtlCoronarographisteEligibility(next)

  // 3) ATL Matin/Midi Lun–Ven = miroir Coro (après strip CH Matin/Midi)
  next = applyAtlFollowsCoroConstraints(next)

  // 3a) Week-end WOM (semaines paires) : mono / combo M-O-W + Ven↔Sam ATL nuit
  // - uniquement sur une semaine fraîche (même principe qu'en 1).
  if (isFreshWeek) {
    next = applyWeekendWomRules(next, weekKey, {
      equity: opts.weekendEquity,
      vacations,
    })
  }

  // 3bis) Weekend : couplage Garde + ATL (Sam/Dim) — soft fill, uniquement
  // sur une semaine fraîche (même principe).
  if (isFreshWeek) {
    next = applyWeekendGardeAtlCoupling(next)
  }

  // 3ter) Équité M/O/W : médecin en ATL Ven nuit ou weekend → exclu ATL Nuit Lun/Mar
  next = applyMOWWeekendExcludesMonTueNights(next)

  // 4) NCT calendrier + LFB
  next = applyNctCalendarConstraints(next, weekKey)
  next = applyLfbThursdayRotation(next, weekKey, opts.lfbDoctor)

  // 4bis) Suspensions activity_maintenance (PSSL/LFB/CDL/NCT) — vider les cases
  next = applyActivityMaintenanceClear(next, weekKey)

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

  // 9ter) Re-applique équité M/O/W weekend → Lun/Mar nuit (après strips qui peuvent avoir changé Ven/Sam/Dim)
  next = applyMOWWeekendExcludesMonTueNights(next)

  // 10) Re-miroir Coro→ATL après strips (si Coro a perdu un médecin)
  next = applyAtlFollowsCoroConstraints(next)

  // 10bis) Re-applique WOM (cases vides après strips ; ne replace pas les absents)
  next = applyWeekendWomRules(next, weekKey, {
    equity: opts.weekendEquity,
    vacations,
  })

  // 11) Re-couplage weekend après strips
  next = applyWeekendGardeAtlCoupling(next)

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
