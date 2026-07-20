import { NextRequest, NextResponse } from 'next/server'

/**
 * Handler pour les commandes vocales
 * POST /api/voice-command
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { command, timestamp } = body

    if (!command || typeof command !== 'string') {
      return NextResponse.json(
        { error: 'Commande vide ou invalide' },
        { status: 400 }
      )
    }

    console.log('[v0] Voice command received:', command)

    // TODO: Implémenter la logique d'interprétation des commandes vocales
    // Exemples:
    // - "Ajouter P lundi" -> ajouter le médecin P au lundi
    // - "Retirer M mardi" -> retirer le médecin M du mardi
    // - "Afficher la charge" -> afficher les statistiques de charge

    // Pour l'instant, retourner un message de succès
    const result = {
      message: 'Commande reçue et interprétée',
      command,
      timestamp,
      status: 'processed',
      updated: false, // Indiquer si le planning a été modifié
    }

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error('[v0] Voice command error:', error)
    return NextResponse.json(
      { error: 'Erreur lors du traitement de la commande vocale' },
      { status: 500 }
    )
  }
}
