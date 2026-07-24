import { NextRequest, NextResponse } from 'next/server'
import { DOCTORS } from '@/lib/constants'

/**
 * Handler pour les commandes vocales
 * POST /api/voice-command
 *
 * Interprète des commandes en français et renvoie une liste d'opérations
 * structurées que le client peut appliquer au planning. Exemples :
 *  - "Ajouter P lundi garde matin"  -> { action: 'add', doctor: 'P', day: 'LUNDI', row: 'Garde Matin' }
 *  - "Retirer M mardi"              -> { action: 'remove', doctor: 'M', day: 'MARDI' }
 *  - "Afficher la charge"           -> { action: 'show', target: 'workload' }
 */

type Operation = {
  action: 'add' | 'remove' | 'show'
  doctor?: string
  day?: string
  row?: string
  target?: string
}

// Retire les accents et met en minuscules pour faciliter la détection
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

// Jours en français -> constante DAYS
const DAY_ALIASES: Record<string, string> = {
  lundi: 'LUNDI',
  mardi: 'MARDI',
  mercredi: 'MERCREDI',
  jeudi: 'JEUDI',
  vendredi: 'VENDREDI',
  samedi: 'SAMEDI',
  dimanche: 'DIMANCHE',
}

// Expressions d'activité -> clé de ligne du planning (les plus longues d'abord)
const ROW_ALIASES: Array<{ pattern: string; row: string }> = [
  { pattern: 'astreinte atl matin', row: 'Astreintes ATL Matin' },
  { pattern: 'astreinte atl midi', row: 'Astreintes ATL Midi' },
  { pattern: 'astreinte atl nuit', row: 'Astreintes ATL Nuit' },
  { pattern: 'garde matin', row: 'Garde Matin' },
  { pattern: 'garde midi', row: 'Garde Midi' },
  { pattern: 'garde nuit', row: 'Garde Nuit' },
  { pattern: 'nct', row: 'Hors site - NCT' },
  { pattern: 'cdl', row: 'Hors site - CDL' },
  { pattern: 'irm', row: 'Hors site - IRM' },
  { pattern: 'coro', row: 'Matin - Coro' },
  { pattern: 'rythmo', row: 'Matin - Rythmo' },
  { pattern: 'stress', row: 'Matin - Stress' },
  { pattern: 'conges', row: 'Congés' },
  { pattern: 'congres', row: 'Congrès' },
  { pattern: 'vacances', row: 'Vacances' },
]

function detectAction(text: string): Operation['action'] | null {
  if (/\b(ajout\w*|met\w*|affect\w*|place\w*)\b/.test(text)) return 'add'
  if (/\b(retir\w*|enlev\w*|supprim\w*|retire\w*)\b/.test(text)) return 'remove'
  if (/\b(affich\w*|montre\w*|voir|liste\w*)\b/.test(text)) return 'show'
  return null
}

function detectDay(text: string): string | undefined {
  for (const [alias, day] of Object.entries(DAY_ALIASES)) {
    if (new RegExp(`\\b${alias}\\b`).test(text)) return day
  }
  return undefined
}

function detectDoctor(rawText: string): string | undefined {
  // On cherche des codes médecins comme mots entiers (les plus longs d'abord)
  const sorted = [...DOCTORS].sort((a, b) => b.length - a.length)
  for (const code of sorted) {
    const re = new RegExp(`\\b${code.toLowerCase()}\\b`)
    if (re.test(rawText.toLowerCase())) return code
  }
  return undefined
}

function detectRow(text: string): string | undefined {
  for (const { pattern, row } of ROW_ALIASES) {
    if (text.includes(pattern)) return row
  }
  return undefined
}

function interpret(command: string): { operations: Operation[]; recognized: boolean } {
  const text = normalize(command)
  const action = detectAction(text)

  if (!action) return { operations: [], recognized: false }

  if (action === 'show') {
    const target = /charge|workload|statistique/.test(text) ? 'workload' : 'schedule'
    return { operations: [{ action: 'show', target }], recognized: true }
  }

  const doctor = detectDoctor(command)
  const day = detectDay(text)
  const row = detectRow(text)

  // add/remove nécessitent au minimum un médecin et un jour
  if (!doctor || !day) return { operations: [], recognized: false }

  const op: Operation = { action, doctor, day }
  if (row) op.row = row
  return { operations: [op], recognized: true }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { command, timestamp } = body

    if (!command || typeof command !== 'string') {
      return NextResponse.json({ error: 'Commande vide ou invalide' }, { status: 400 })
    }

    console.log('[v0] Voice command received:', command)

    const { operations, recognized } = interpret(command)

    if (!recognized) {
      return NextResponse.json(
        {
          message:
            "Commande non reconnue. Exemples : « ajouter P lundi garde matin », « retirer M mardi », « afficher la charge ».",
          command,
          timestamp,
          status: 'unrecognized',
          operations: [],
          updated: false,
        },
        { status: 200 },
      )
    }

    return NextResponse.json(
      {
        message: `Commande interprétée : ${operations.length} opération(s)`,
        command,
        timestamp,
        status: 'processed',
        operations,
        // Le serveur ne modifie pas la base directement : le client applique les opérations.
        updated: false,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('[v0] Voice command error:', error)
    return NextResponse.json(
      { error: 'Erreur lors du traitement de la commande vocale' },
      { status: 500 },
    )
  }
}
