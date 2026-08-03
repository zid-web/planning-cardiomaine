/**
 * Rotation équitable CORO Matin / Après-midi entre M, O, W (lundi-vendredi).
 *
 * Règles :
 * - Jeudi Apm → FV (règle fixe structurelle) — M/O/W non assignés ce créneau.
 * - Si un médecin est absent (congé) → on saute vers le suivant.
 * - Le même médecin ne fait pas Coro Matin ET Apm le même jour si tous les 3 sont dispo.
 * - L'équité est calculée séparément pour Matin et Apm sur 6 mois d'historique.
 * - Propositions injectées en statut `pending` (admin peut modifier).
 */

import type { DoctorVacation, ScheduleData } from "@/lib/types"
import { dateStrForWeekDay } from "@/lib/fixed-assignments"
import { parseISO, isBefore, isAfter } from "date-fns"
import { isListedDoctor } from "@/lib/doctor-code"

/** Pool Coro en rotation équitable (M/O/W uniquement — CH/FV hors pool général). */
export const CORO_WOM_POOL = ["M", "O", "W"] as const
export type CoroDoctor = (typeof CORO_WOM_POOL)[number]

const WEEKDAYS = ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI"] as const

/** Jeudi Apm = FV uniquement → M/O/W ne passent pas sur Apm - Coro jeudi. */
const THURSDAY_APM_FV_ONLY = true

/** Comptes Coro Matin et Apm séparés pour M/O/W (fenêtre historique). */
export type CoroMOWCounts = {
  matin: Record<CoroDoctor, number>
  apm: Record<CoroDoctor, number>
}

/** Calcule les comptes Coro Matin/Apm sur un tableau de plannings passés. */
export function computeCoroMOWCounts(schedules: ScheduleData[]): CoroMOWCounts {
  const matin: Record<CoroDoctor, number> = { M: 0, O: 0, W: 0 }
  const apm: Record<CoroDoctor, number> = { M: 0, O: 0, W: 0 }

  for (const schedule of schedules) {
    for (const day of Object.values(WEEKDAYS)) {
      const maCell = schedule["Matin - Coro"]?.[day]
      const apCell = schedule["Apm - Coro"]?.[day]

      for (const doc of (maCell?.value || []) as string[]) {
        if (isCOROWOM(doc)) matin[doc as CoroDoctor]++
      }
      for (const doc of (apCell?.value || []) as string[]) {
        if (isCOROWOM(doc)) apm[doc as CoroDoctor]++
      }
    }
  }

  return { matin, apm }
}

/** Retourne true si le médecin est dans le pool M/O/W. */
export function isCOROWOM(doc: string): doc is CoroDoctor {
  return (CORO_WOM_POOL as readonly string[]).includes(doc)
}

/**
 * Vérifie si un médecin M/O/W est absent ce jour (congés DB ou ligne Congés planning).
 */
function isDoctorAbsentForCoro(
  doc: CoroDoctor,
  dayName: string,
  weekKey: string,
  schedule: ScheduleData,
  vacations: DoctorVacation[],
): boolean {
  const dateStr = dateStrForWeekDay(weekKey, dayName)
  if (!dateStr) return false

  // Congés en base de données
  if (vacations.some((v) => {
    if (v.doctor_id !== doc) return false
    const start = parseISO(v.start_date)
    const end = parseISO(v.end_date)
    const check = parseISO(dateStr)
    return !isBefore(check, start) && !isAfter(check, end)
  })) return true

  // Ligne Congés dans le planning (signal UI)
  const congesRow = schedule["Congés"]?.[dayName]?.value || []
  return congesRow.includes(doc)
}

/**
 * Choisit le médecin M/O/W avec le moins de points pour ce créneau (matin ou apm).
 * En cas d'égalité → ordre M > O > W (stable).
 * Exclut `exclude` si non nul (évite même médecin Matin+Apm le même jour).
 * Exclut les absents.
 */
function pickDoctor(
  counts: Record<CoroDoctor, number>,
  available: CoroDoctor[],
  exclude?: CoroDoctor | null,
): CoroDoctor | null {
  const pool = exclude ? available.filter((d) => d !== exclude) : available
  if (pool.length === 0) return available[0] ?? null // repli si un seul dispo
  return pool.sort((a, b) => counts[a] - counts[b])[0] ?? null
}

/**
 * Génère une rotation Coro Matin/Apm pour la semaine, en propositions (pending).
 * Ne remplace JAMAIS une case déjà remplie par un médecin listé et validée.
 *
 * @param schedule   Planning de la semaine (état courant avant Générer)
 * @param weekKey    Clé semaine ISO (ex. "2026-W44")
 * @param vacations  Liste des congés médecins pour calculer les absences
 * @param counts     Comptes Coro historiques Matin/Apm (calculés par computeCoroMOWCounts)
 * @param lastWednesdayApmCoroDoctor  Le dernier médecin ("M" ou "W") à avoir couvert le mercredi Apm Coro en l'absence de O.
 * @returns          Planning mis à jour avec les propositions Coro pending
 */
export function applyCoroWOMRotation(
  schedule: ScheduleData,
  weekKey: string,
  vacations: DoctorVacation[],
  counts: CoroMOWCounts,
  lastWednesdayApmCoroDoctor?: "M" | "W" | null,
): ScheduleData {
  // Clone profond pour éviter les mutations
  let next: ScheduleData = { ...schedule }
  // Compteurs locaux (incrémentés au fil de la semaine pour éviter de sur-assigner)
  const localMatin: Record<CoroDoctor, number> = { ...counts.matin }
  const localApm: Record<CoroDoctor, number> = { ...counts.apm }

  for (const day of WEEKDAYS) {
    const isThursday = day === "JEUDI"
    const isWednesday = day === "MERCREDI"

    // --- Coro Matin ---
    const maRow = "Matin - Coro"
    const maCell = next[maRow]?.[day]
    const maListed = (maCell?.value || []).filter(
      (d) => isListedDoctor(d) && !["FV", "DAAS"].includes(d),
    )
    const maAlreadyFilled = maCell?.status === "validated" && maListed.length > 0

    // --- Coro Apm ---
    const apRow = "Apm - Coro"
    const apCell = next[apRow]?.[day]
    const apListed = (apCell?.value || []).filter(
      (d) => isListedDoctor(d) && !["FV", "DAAS"].includes(d),
    )
    const apAlreadyFilled = apCell?.status === "validated" && apListed.length > 0

    // Jeudi Apm → FV (règle fixe, ne pas toucher)
    const apSkip = isThursday && THURSDAY_APM_FV_ONLY

    // Médecins disponibles ce jour
    const availForDay: CoroDoctor[] = CORO_WOM_POOL.filter(
      (d) => !isDoctorAbsentForCoro(d, day, weekKey, next, vacations),
    )

    let chosenMatin: CoroDoctor | null = null
    let chosenApm: CoroDoctor | null = null

    // Matin
    if (!maAlreadyFilled && availForDay.length > 0) {
      chosenMatin = pickDoctor(localMatin, availForDay, null)
      if (chosenMatin) {
        localMatin[chosenMatin]++
      }
    }

    // Apm (éviter même que Matin si possible)
    if (!apSkip && !apAlreadyFilled && availForDay.length > 0) {
      // Cas particulier : MERCREDI après-midi quand O est absent
      const oAbsent = isDoctorAbsentForCoro("O", "MERCREDI", weekKey, next, vacations)
      if (isWednesday && oAbsent) {
        // Détermine la cible selon l'alternance stricte
        let target: "M" | "W" = "M" // défaut
        if (lastWednesdayApmCoroDoctor === "M") {
          target = "W"
        } else if (lastWednesdayApmCoroDoctor === "W") {
          target = "M"
        }

        const isTargetAvail = availForDay.includes(target)
        const other: "M" | "W" = target === "M" ? "W" : "M"
        const isOtherAvail = availForDay.includes(other)

        if (isTargetAvail) {
          chosenApm = target
        } else if (isOtherAvail) {
          chosenApm = other
        }
      }

      // Si pas encore choisi (ou cas général)
      if (!chosenApm) {
        chosenApm = pickDoctor(localApm, availForDay, chosenMatin)
      }

      if (chosenApm) {
        localApm[chosenApm]++
      }
    }

    // Injection Matin
    if (chosenMatin && next[maRow]?.[day]) {
      next = {
        ...next,
        [maRow]: {
          ...next[maRow],
          [day]: {
            ...(next[maRow]![day] || {}),
            value: [chosenMatin],
            type: "doctor",
            status: "pending",
          },
        },
      }
    }

    // Injection Apm
    if (chosenApm && !apSkip && next[apRow]?.[day]) {
      next = {
        ...next,
        [apRow]: {
          ...next[apRow],
          [day]: {
            ...(next[apRow]![day] || {}),
            value: [chosenApm],
            type: "doctor",
            status: "pending",
          },
        },
      }
    }
  }

  return next
}
