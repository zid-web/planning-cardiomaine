import { NextRequest, NextResponse } from 'next/server'

/**
 * Handler pour l'upload de fichiers PDF
 * POST /api/upload-pdf
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'Aucun fichier fourni' },
        { status: 400 }
      )
    }

    // Vérifier le type MIME
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Le fichier doit être un PDF' },
        { status: 400 }
      )
    }

    // Vérifier la taille (max 10MB)
    const MAX_SIZE = 10 * 1024 * 1024 // 10MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'Le fichier est trop volumineux (max 10MB)' },
        { status: 400 }
      )
    }

    console.log('[v0] PDF upload received:', {
      name: file.name,
      size: file.size,
      type: file.type,
    })

    // TODO: Implémenter la logique d'extraction du PDF
    // Exemples:
    // - Parser le contenu du PDF
    // - Extraire les données du planning
    // - Mettre à jour la base de données
    // - Utiliser une bibliothèque comme pdf-parse ou pdfjs

    const result = {
      message: 'Fichier PDF traité avec succès',
      fileName: file.name,
      fileSize: file.size,
      timestamp: new Date().toISOString(),
      status: 'processed',
      updated: false, // Indiquer si le planning a été modifié
    }

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error('[v0] PDF upload error:', error)
    return NextResponse.json(
      { error: 'Erreur lors du traitement du fichier PDF' },
      { status: 500 }
    )
  }
}
