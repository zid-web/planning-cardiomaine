'use server'

import { generateNightGuardProposals } from '@/lib/guard-scheduler'
import { constraints2026 } from '@/lib/guard-scheduler'
import { mergeVacations } from '@/lib/vacation-converter'
import { getAllVacations } from './vacation-actions'
import { GuardProposal } from '@/lib/types'

/**
 * Génère les propositions de gardes de nuit en tenant compte des vacations de la DB
 */
export async function generateGuardsWithVacations(
  startDate: Date,
  endDate: Date
): Promise<{ proposals: GuardProposal[]; error?: string }> {
  try {
    // Récupérer toutes les vacations de la base de données
    const dbVacations = await getAllVacations()

    // Fusionner les vacations statiques avec celles de la DB
    const allVacations = mergeVacations(constraints2026.vacations2026, dbVacations)

    // Créer les contraintes mises à jour avec les vacations fusionnées
    const updatedConstraints = {
      ...constraints2026,
      vacations2026: allVacations,
    }

    // Générer les propositions de gardes
    const proposals = generateNightGuardProposals(startDate, endDate, updatedConstraints)

    return { proposals }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[v0] Error generating guards:', error)
    return { proposals: [], error: errorMessage }
  }
}
