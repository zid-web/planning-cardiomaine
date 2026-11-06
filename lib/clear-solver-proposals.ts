import { DAYS, NURSES } from "@/lib/constants"
import { isListedDoctor } from "@/lib/doctor-code"
import { isSolverProposalCell } from "@/lib/guard-api-mapping"
import type { ScheduleData } from "@/lib/types"

export type ClearSolverProposalsResult = {
  schedule: ScheduleData
  /** Nombre de cases dont une proposition a été retirée. */
  cleared: number
}

/**
 * Efface toutes les propositions « Générer » (cases violettes `Prop.`) d'une
 * semaine pour repartir sur une nouvelle génération.
 *
 * Ne touche **jamais** :
 * - les cases validées (saisies manuelles, contraintes structurelles, propositions
 *   déjà validées par l'admin) ;
 * - les cases en demande de changement (`request`) ;
 * - les remplaçants texte libre et les infirmières présentes dans une case
 *   proposée (seul le médecin proposé est retiré).
 *
 * Une proposition retouchée par l'admin mais restée en attente (`manualAssignment` +
 * `pending`, case encore violette) est effacée elle aussi : tout ce que le bouton compte
 * comme proposition doit pouvoir être effacé (S45, 06/11/2026). Seules les cases validées
 * protègent une saisie.
 *
 * Les cases vidées ne sont **pas** marquées `manuallyCleared` : les contraintes
 * structurelles (rotation LFB, CH, couplages gardes/ATL…) peuvent les
 * repeupler comme sur une case jamais remplie.
 */
export function clearSolverProposals(schedule: ScheduleData): ClearSolverProposalsResult {
  const next: ScheduleData = { ...schedule }
  let cleared = 0

  for (const [rowKey, row] of Object.entries(schedule)) {
    if (!row) continue
    let nextRow: ScheduleData[string] | null = null

    for (const day of DAYS) {
      const cell = row[day]
      if (!isSolverProposalCell(rowKey, cell)) continue

      const kept = (cell.value || []).filter(
        (d) => d && (!isListedDoctor(d) || (NURSES as readonly string[]).includes(d)),
      )
      if (!nextRow) nextRow = { ...row }
      nextRow[day] = {
        ...cell,
        value: kept,
        type: kept.length ? "doctor" : "empty",
        // Une case qui ne garde que remplaçant / infirmière n'est plus une proposition.
        status: "validated",
        remplacant: kept.includes(cell.remplacant ?? "") ? cell.remplacant : undefined,
        // La proposition retirée ne protège plus la case contre les remplissages structurels.
        manualAssignment: kept.length > 0 ? cell.manualAssignment : false,
      }
      cleared++
    }

    if (nextRow) next[rowKey] = nextRow
  }

  return { schedule: next, cleared }
}
