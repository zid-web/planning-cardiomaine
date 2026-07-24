import { NextRequest, NextResponse } from 'next/server'
// Import du module interne pour éviter le code de debug de l'index de pdf-parse
// (qui tente de lire un fichier de test au chargement).
import pdfParse from 'pdf-parse/lib/pdf-parse.js'
import { DAYS, DOCTORS } from '@/lib/constants'

// pdf-parse a besoin du runtime Node (pas Edge).
export const runtime = 'nodejs'

const MAX_SIZE = 10 * 1024 * 1024 // 10MB

/**
 * Handler pour l'upload de fichiers PDF
 * POST /api/upload-pdf
 *
 * Extrait le texte du PDF et détecte les codes médecins et jours présents,
 * afin d'aider à pré-remplir le planning.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Le fichier doit être un PDF' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'Le fichier est trop volumineux (max 10MB)' },
        { status: 400 },
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    let parsed: { text: string; numpages: number }
    try {
      parsed = await pdfParse(buffer)
    } catch (parseError) {
      console.error('[v0] PDF parse error:', parseError)
      return NextResponse.json(
        { error: 'Impossible de lire le contenu du PDF (fichier corrompu ou protégé)' },
        { status: 422 },
      )
    }

    const text = parsed.text || ''
    const upper = text.toUpperCase()

    // Détection des codes médecins présents (mots entiers)
    const detectedDoctors = DOCTORS.filter((code) =>
      new RegExp(`\\b${code.toUpperCase()}\\b`).test(upper),
    )
    // Détection des jours présents
    const detectedDays = DAYS.filter((day) => upper.includes(day))

    console.log('[v0] PDF upload processed:', {
      name: file.name,
      size: file.size,
      numPages: parsed.numpages,
      textLength: text.length,
      detectedDoctors,
      detectedDays,
    })

    return NextResponse.json(
      {
        message: 'Fichier PDF traité avec succès',
        fileName: file.name,
        fileSize: file.size,
        numPages: parsed.numpages,
        textLength: text.length,
        textPreview: text.slice(0, 500),
        detectedDoctors,
        detectedDays,
        timestamp: new Date().toISOString(),
        status: 'processed',
        // L'écriture en base est laissée au client après validation.
        updated: false,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('[v0] PDF upload error:', error)
    return NextResponse.json(
      { error: 'Erreur lors du traitement du fichier PDF' },
      { status: 500 },
    )
  }
}
