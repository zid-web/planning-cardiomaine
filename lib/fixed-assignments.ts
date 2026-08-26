import { parseISO, isAfter, isBefore } from "date-fns"
import { DAYS } from "@/lib/constants"
import { DOC022_FIXED_CLINICAL_SLOTS } from "@/lib/group-clinical-rules"
import {
  valFixedSlotsForWeek,
  veroFixedSlotsForWeek,
  lauraFixedSlotsForWeek,
  NURSE_ABSENCE_FALLBACK,
} from "@/lib/nurse-rules"
import { isFirstThursdayOfMonth } from "@/lib/stress-rules"
import type { DoctorVacation, ScheduleData } from "@/lib/types"

/** Rotation Visite : uniquement U, A, B — une semaine chacun. */
export const VISITE_ROTATION = ["U", "A", "B"] as const

/** Semaine ISO impaire (week_type solveur = 1). */
export function isOddIsoWeek(weekKey: string): boolean {
  const weekNum = Number.parseInt(weekKey.split("-W")[1] || "1", 10)
  return weekNum % 2 === 1
}

/**
 * Créneaux Rythmo fixes selon parité de semaine.
 * Impaire : A Lun+Jeu apm ; P Mar matin+apm ; U Mer apm + Ven apm.
 * Paire : A Lun+Jeu apm ; P Mar matin+apm ; U Mer matin+apm ;
 *         Ven matin en alternance U/P (parmi les semaines paires).
 */
export function rythmoFixedSlotsForWeek(
  weekKey: string,
): Array<{ row: string; day: string; doctor: string }> {
  const weekNum = Number.parseInt(weekKey.split("-W")[1] || "1", 10)
  const odd = weekNum % 2 === 1
  const slots: Array<{ row: string; day: string; doctor: string }> = [
    { row: "Apm - Rythmo", day: "LUNDI", doctor: "A" },
    { row: "Apm - Rythmo", day: "JEUDI", doctor: "A" },
    { row: "Matin - Rythmo", day: "MARDI", doctor: "P" },
    { row: "Apm - Rythmo", day: "MARDI", doctor: "P" },
  ]
  if (odd) {
    slots.push({ row: "Apm - Rythmo", day: "MERCREDI", doctor: "U" })
    slots.push({ row: "Apm - Rythmo", day: "VENDREDI", doctor: "U" })
  } else {
    slots.push({ row: "Matin - Rythmo", day: "MERCREDI", doctor: "U" })
    slots.push({ row: "Apm - Rythmo", day: "MERCREDI", doctor: "U" })
    // Alternance U/P sur les semaines paires uniquement (W30→U, W32→P, …)
    const evenHalf = Math.floor(weekNum / 2)
    const venDoctor = evenHalf % 2 === 1 ? "U" : "P"
    slots.push({ row: "Matin - Rythmo", day: "VENDREDI", doctor: venDoctor })
  }
  return slots
}

/** Cases Rythmo où A/P/U peuvent apparaître (pour nettoyage hors calendrier). */
const RYTHMO_APU_DAYS = ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI"] as const
const RYTHMO_APU_ROWS = ["Matin - Rythmo", "Apm - Rythmo"] as const
const RYTHMO_FIXED_DOCTORS = new Set(["A", "P", "U"])

/**
 * Contraintes fixes métier (vacations cliniques / hors site / FV / DAAS).
 * Appliquées à la création de semaine et lors de « Générer ».
 */
export function mondayOfIsoWeekKey(weekKey: string): Date | null {
  const [yearStr, weekStr] = weekKey.split("-W")
  const year = Number.parseInt(yearStr, 10)
  const weekNum = Number.parseInt(weekStr, 10)
  if (!Number.isFinite(year) || !Number.isFinite(weekNum)) return null
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dayJan4 = jan4.getUTCDay() || 7
  const monday1 = new Date(jan4.getTime() - (dayJan4 - 1) * 86400000)
  return new Date(monday1.getTime() + (weekNum - 1) * 7 * 86400000)
}

export function dateStrForWeekDay(weekKey: string, dayName: string): string | null {
  const monday = mondayOfIsoWeekKey(weekKey)
  if (!monday) return null
  const idx = DAYS.indexOf(dayName)
  if (idx < 0) return null
  const d = new Date(monday)
  d.setUTCDate(monday.getUTCDate() + idx)
  return d.toISOString().split("T")[0]
}

/** Vacances pour règles fixes — CH exempt ; FV / S / A / P / U / DAAS respectent les congés. */
export function isDoctorOnVacationForFixed(
  doctorId: string,
  dateStr: string,
  vacations: DoctorVacation[],
): boolean {
  if (!doctorId || doctorId === "CH") return false
  if (!vacations?.length) return false
  const targetDate = parseISO(dateStr)
  return vacations.some((vacation) => {
    if (vacation.doctor_id !== doctorId) return false
    const startDate = parseISO(vacation.start_date)
    const endDate = parseISO(vacation.end_date)
    return !isBefore(targetDate, startDate) && !isAfter(targetDate, endDate)
  })
}

/** Absent = doctor_vacations **ou** déjà sur la ligne Congés (signal planning). */
export function isDoctorAbsentForFixed(
  schedule: ScheduleData,
  doctorId: string,
  day: string,
  dateStr: string,
  vacations: DoctorVacation[],
): boolean {
  if (!doctorId || doctorId === "CH") return false
  if (isDoctorOnVacationForFixed(doctorId, dateStr, vacations)) return true
  const conges = schedule["Congés"]?.[day]?.value || []
  if (conges.includes(doctorId)) return true
  const legacy = schedule["Vacances"]?.[day]?.value || []
  return legacy.includes(doctorId)
}

export function setDoctors(
  schedule: ScheduleData,
  rowKey: string,
  day: string,
  doctors: string[],
): void {
  if (!schedule[rowKey]?.[day]) return
  const cell = schedule[rowKey][day]
  schedule[rowKey][day] = {
    ...cell,
    value: [...doctors],
    type: doctors.length > 0 ? "doctor" : "empty",
    status: cell.status || "validated",
  }
}

/**
 * Assignation fixe uniquement si le médecin est présent (pas en congés).
 * Sinon : la contrainte saute — on retire l’initiale fixe et la case reste libre
 * (les éventuels remplaçants manuels, ex. P sur Rythmo mercredi, sont conservés).
 */
function assignIfAvailable(
  schedule: ScheduleData,
  rowKey: string,
  day: string,
  doctor: string,
  weekKey: string,
  vacations: DoctorVacation[],
  _opts?: { vacationsReady?: boolean },
): void {
  const dateStr = dateStrForWeekDay(weekKey, day)
  if (!dateStr) return
  if (isDoctorAbsentForFixed(schedule, doctor, day, dateStr, vacations)) {
    const current = schedule[rowKey]?.[day]?.value || []
    if (current.includes(doctor)) {
      setDoctors(
        schedule,
        rowKey,
        day,
        current.filter((d) => d !== doctor),
      )
    }
    // Case libre : ne rien réinjecter
    return
  }
  const current = schedule[rowKey]?.[day]?.value || []
  // Case explicitement vidée par l'admin : ne jamais la re-remplir, même si
  // elle est vide (confirmé utilisateur 31/07/2026 - toutes les cases
  // pré-remplies, fixes ou proposées, doivent rester librement modifiables/
  // supprimables, sauf la règle du lendemain de garde de nuit qui reste
  // appliquée séparément et n'est pas concernée par ce marqueur).
  if (schedule[rowKey]?.[day]?.manuallyCleared) return
  // Saisie manuelle / couverture différente du titulaire fixe : ne jamais écraser.
  // (Case vide ou uniquement le titulaire → injecter / idempotent.)
  // Inclut aussi vacationsReady=false (ex. P sur Rythmo avant chargement congés).
  const onlyFixedOrEmpty =
    current.length === 0 || current.every((d) => d === doctor)
  if (!onlyFixedOrEmpty) return
  setDoctors(schedule, rowKey, day, [doctor])
}

/**
 * Variante "ajout" (pas remplacement) de `assignIfAvailable`, pour les
 * cases où PLUSIEURS occupants sont attendus simultanément (ex: Véro +
 * D sur Stress/EE le jeudi, quand Véro suit exactement le roulement de D -
 * confirmé utilisateur 31/07/2026). Respecte les mêmes règles de non-
 * écrasement d'une saisie manuelle : si la case contient déjà quelqu'un
 * en-dehors de `expectedOccupants`, on ne touche à rien.
 */
function appendFixedOccupant(
  schedule: ScheduleData,
  rowKey: string,
  day: string,
  doctor: string,
  weekKey: string,
  vacations: DoctorVacation[],
  expectedOccupants: string[],
): void {
  const dateStr = dateStrForWeekDay(weekKey, day)
  if (!dateStr) return
  if (isDoctorAbsentForFixed(schedule, doctor, day, dateStr, vacations)) {
    const current = schedule[rowKey]?.[day]?.value || []
    if (current.includes(doctor)) {
      setDoctors(
        schedule,
        rowKey,
        day,
        current.filter((d) => d !== doctor),
      )
    }
    return
  }
  if (schedule[rowKey]?.[day]?.manuallyCleared) return
  const current = schedule[rowKey]?.[day]?.value || []
  if (current.includes(doctor)) return // déjà présent, idempotent
  const onlyExpectedOrEmpty = current.every((d) => expectedOccupants.includes(d))
  if (!onlyExpectedOrEmpty) return // saisie manuelle différente, ne pas toucher
  setDoctors(schedule, rowKey, day, [...current, doctor])
}

/**
 * Applique le planning fixe de Val et Véro (infirmières) - confirmé
 * utilisateur 31/07/2026. À appliquer APRÈS `applyStressAndDRules` (D) dans
 * le pipeline (voir apply-structural-constraints.ts) : le jeudi, Véro suit
 * exactement le roulement de D et doit s'AJOUTER à côté de lui, pas être
 * écrasée par l'assignation exclusive de D si l'ordre était inversé.
 */
export function applyNurseFixedAssignments(
  schedule: ScheduleData,
  weekKey: string,
  vacations: DoctorVacation[] = [],
): ScheduleData {
  const jeudiDateStr = dateStrForWeekDay(weekKey, "JEUDI")
  const firstThursday = jeudiDateStr ? isFirstThursdayOfMonth(jeudiDateStr) : false
  const expected = ["Val", "Véro", "D", "Laura"]
  // D est le partenaire automatique du jeudi (Val/Véro suivent/complètent
  // son roulement) - si D est en congé ce jeudi-là, le créneau devient
  // indisponible pour elles aussi (confirmé utilisateur 31/07/2026 :
  // "la vacation est indisponible si l'un du couple est absent").
  const dAvailableThursday = jeudiDateStr
    ? !isDoctorAbsentForFixed(schedule, "D", "JEUDI", jeudiDateStr, vacations)
    : true

  for (const slot of valFixedSlotsForWeek(weekKey, firstThursday)) {
    if (!schedule[slot.row]) continue
    if (slot.day === "JEUDI" && !dAvailableThursday) continue
    appendFixedOccupant(schedule, slot.row, slot.day, "Val", weekKey, vacations, expected)
  }
  for (const slot of veroFixedSlotsForWeek(weekKey, firstThursday)) {
    if (!schedule[slot.row]) continue
    if (slot.day === "JEUDI" && !dAvailableThursday) continue
    appendFixedOccupant(schedule, slot.row, slot.day, "Véro", weekKey, vacations, expected)
  }
  for (const slot of lauraFixedSlotsForWeek(weekKey)) {
    if (!schedule[slot.row]) continue
    const dateStr = dateStrForWeekDay(weekKey, slot.day)
    const lauraAbsent = dateStr
      ? isDoctorAbsentForFixed(schedule, "Laura", slot.day, dateStr, vacations)
      : false
    // Laura en congés : repli systématique sur Val (consigne 26/08/2026).
    // Val ne pouvant tenir deux vacations le même créneau, on libère ses
    // autres cases fixes de la même demi-journée avant de la poser ici.
    const occupant = lauraAbsent ? (NURSE_ABSENCE_FALLBACK["Laura"] as string) : "Laura"
    if (lauraAbsent) {
      appendFixedOccupant(schedule, slot.row, slot.day, "Laura", weekKey, vacations, expected)
      releaseNurseFromOtherSlots(schedule, occupant, slot.day, slot.slot, slot.row)
    }
    appendFixedOccupant(schedule, slot.row, slot.day, occupant, weekKey, vacations, expected)
  }
  return schedule
}

/**
 * Libère une infirmière de ses autres vacations de la même demi-journée
 * (utilisé par le repli Laura → Val : une seule vacation par créneau).
 */
function releaseNurseFromOtherSlots(
  schedule: ScheduleData,
  nurse: string,
  day: string,
  slot: "matin" | "am",
  keepRow: string,
): void {
  const prefix = slot === "matin" ? "Matin - " : "Apm - "
  for (const rowKey of Object.keys(schedule)) {
    if (rowKey === keepRow) continue
    if (!rowKey.startsWith(prefix)) continue
    const current = schedule[rowKey]?.[day]?.value || []
    if (!current.includes(nurse)) continue
    setDoctors(
      schedule,
      rowKey,
      day,
      current.filter((d) => d !== nurse),
    )
  }
}

/**
 * Applique les assignations fixes (cases **vides** ou déjà au titulaire).
 * Une saisie manuelle différente n’est **jamais** écrasée (ETT ped S, Rythmo, IRM…).
 * - IRM : uniquement S — Lundi (matin) + Vendredi (après-midi), hors vacances
 * - FV : Garde Nuit chaque Lundi ; Coro chaque Jeudi après-midi ; hors vacances
 * - DAAS : uniquement Apm - EE2 chaque Lundi, hors vacances
 * - Rythmo : calendrier A/P/U selon semaine impaire/paire (voir `rythmoFixedSlotsForWeek`) —
 *   **uniquement si le médecin n’est pas en congés** (sinon contrainte sautée, case libre)
 * - Visite : uniquement U/A/B en rotation hebdomadaire, hors vacances
 * - DOC022 : ETT Poret lun matin, écho enfants S mer apm, EE2 V lun matin /
 *   O ven matin, Scinti T lun+mer / R mar
 */
export function applyFixedClinicalAssignments(
  schedule: ScheduleData,
  weekKey: string,
  vacations: DoctorVacation[] = [],
  opts?: { vacationsReady?: boolean; visiteDoctor?: string | null },
): ScheduleData {
  const weekNum = Number.parseInt(weekKey.split("-W")[1] || "1", 10)
  const assignOpts = { vacationsReady: opts?.vacationsReady }

  // --- IRM : seul S, Lundi + Vendredi (ligne jour = créneau ouvert) ---
  if (schedule["Hors site - IRM"]) {
    for (const day of DAYS) {
      if (day === "LUNDI" || day === "VENDREDI") continue
      const current = schedule["Hors site - IRM"][day]?.value || []
      // Retirer S hors Lun/Ven ; conserver une saisie manuelle d’un autre médecin
      const withoutS = current.filter((d) => d !== "S")
      if (withoutS.length !== current.length || withoutS.length === 0) {
        setDoctors(schedule, "Hors site - IRM", day, withoutS)
      }
    }
    assignIfAvailable(schedule, "Hors site - IRM", "LUNDI", "S", weekKey, vacations, assignOpts)
    assignIfAvailable(schedule, "Hors site - IRM", "VENDREDI", "S", weekKey, vacations, assignOpts)
  }

  // --- Rythmo (calendrier impair/pair ; saute si congés) ---
  const rythmoSlots = rythmoFixedSlotsForWeek(weekKey)
  const rythmoSlotKeys = new Set(rythmoSlots.map((s) => `${s.row}||${s.day}`))
  // Retirer A/P/U des cases hors calendrier de la semaine (couvertures manuelles
  // sur une case du calendrier — ex. P si U absent — sont conservées).
  for (const row of RYTHMO_APU_ROWS) {
    if (!schedule[row]) continue
    for (const day of RYTHMO_APU_DAYS) {
      if (rythmoSlotKeys.has(`${row}||${day}`)) continue
      const cell = schedule[row][day]
      if (!cell) continue
      const values = cell.value || []
      const filtered = values.filter((d) => !RYTHMO_FIXED_DOCTORS.has(d))
      if (filtered.length !== values.length) {
        setDoctors(schedule, row, day, filtered)
      }
    }
  }
  for (const slot of rythmoSlots) {
    assignIfAvailable(schedule, slot.row, slot.day, slot.doctor, weekKey, vacations, assignOpts)
  }

  // --- Visite : U → A → B (ou désignation admin) ---
  if (schedule["Matin - Visite"]) {
    const override =
      opts?.visiteDoctor === "U" ||
      opts?.visiteDoctor === "A" ||
      opts?.visiteDoctor === "B"
        ? opts.visiteDoctor
        : null
    const visiteUser = override || VISITE_ROTATION[((weekNum % 3) + 3) % 3]
    // VISITE est un concept de semaine uniquement (lundi-vendredi) - jamais
    // le weekend, sinon le médecin de visite se retrouve à tort "occupé"
    // samedi/dimanche et bloque toute autre affectation (ex: Garde) via la
    // règle d'exclusion mutuelle par créneau. Bug confirmé le 30/07/2026.
    const visiteDays = DAYS.filter((d) => d !== "SAMEDI" && d !== "DIMANCHE")
    for (const day of visiteDays) {
      assignIfAvailable(schedule, "Matin - Visite", day, visiteUser, weekKey, vacations, assignOpts)
    }
  }

  // --- FV ---
  assignIfAvailable(schedule, "Garde Nuit", "LUNDI", "FV", weekKey, vacations, assignOpts)
  assignIfAvailable(schedule, "Apm - Coro", "JEUDI", "FV", weekKey, vacations, assignOpts)

  // --- DAAS : EE lundi après-midi uniquement ---
  assignIfAvailable(schedule, "Apm - EE2", "LUNDI", "DAAS", weekKey, vacations, assignOpts)

  // --- DOC022 : créneaux cliniques / hors site additionnels ---
  for (const slot of DOC022_FIXED_CLINICAL_SLOTS) {
    if (!schedule[slot.row]) continue
    assignIfAvailable(schedule, slot.row, slot.day, slot.doctor, weekKey, vacations, assignOpts)
  }

  return schedule
}

/**
 * Retire les initiales des règles fixes si le médecin est en vacances ce jour
 * (sans réécrire le reste du planning sauvegardé).
 */
export function clearFixedAssigneesOnVacation(
  schedule: ScheduleData,
  weekKey: string,
  vacations: DoctorVacation[],
): ScheduleData {
  if (!vacations.length) return schedule

  const checks: Array<{ row: string; day: string; doctor: string }> = [
    { row: "Hors site - IRM", day: "LUNDI", doctor: "S" },
    { row: "Hors site - IRM", day: "VENDREDI", doctor: "S" },
    { row: "Garde Nuit", day: "LUNDI", doctor: "FV" },
    { row: "Apm - Coro", day: "JEUDI", doctor: "FV" },
    { row: "Apm - EE2", day: "LUNDI", doctor: "DAAS" },
    ...rythmoFixedSlotsForWeek(weekKey).map((s) => ({
      row: s.row,
      day: s.day,
      doctor: s.doctor,
    })),
    ...DOC022_FIXED_CLINICAL_SLOTS.map((s) => ({
      row: s.row,
      day: s.day,
      doctor: s.doctor,
    })),
  ]

  for (const day of DAYS) {
    checks.push({ row: "Matin - Visite", day, doctor: "*" })
  }

  let next = schedule
  for (const { row, day, doctor } of checks) {
    const dateStr = dateStrForWeekDay(weekKey, day)
    if (!dateStr || !next[row]?.[day]) continue
    const cell = next[row][day]
    const values = cell.value || []
    if (!values.length) continue

    let filtered: string[]
    if (doctor === "*") {
      // Visite : retirer U/A/B s’ils sont en vacances
      filtered = values.filter(
        (d) =>
          !VISITE_ROTATION.includes(d as (typeof VISITE_ROTATION)[number]) ||
          !isDoctorOnVacationForFixed(d, dateStr, vacations),
      )
    } else if (values.includes(doctor) && isDoctorOnVacationForFixed(doctor, dateStr, vacations)) {
      filtered = values.filter((d) => d !== doctor)
    } else {
      continue
    }

    if (filtered.length === values.length) continue
    if (next === schedule) next = { ...schedule }
    next[row] = { ...next[row] }
    next[row][day] = {
      ...cell,
      value: filtered,
      type: filtered.length > 0 ? "doctor" : "empty",
    }
  }

  return next
}
