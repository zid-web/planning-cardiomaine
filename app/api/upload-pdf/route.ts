import { NextRequest, NextResponse } from 'next/server';

// Fallback uniquement : le client uploade de préférence en direct vers Render
// (multi-pages Claude Vision ≫ 60s → 504 si on passe par ce proxy).
export const maxDuration = 60;
export const runtime = 'nodejs';

// GUARD_API_BASE_URL is the preferred name; GUARD_API_URL is already used elsewhere in the repo.
const RENDER_API_URL = (
  process.env.GUARD_API_BASE_URL ||
  process.env.GUARD_API_URL ||
  'https://guard-api-cardiomaine.onrender.com'
).replace(/\/$/, '');
const API_KEY = process.env.GUARD_API_KEY || '';

const JSON_MALFORMED_HINT =
  'L’extraction PDF a renvoyé un JSON incomplet. Réessayez ; si l’échec persiste, le PDF est peut‑être trop dense (plusieurs pages / tableau saturé).';

function formatUpstreamError(data: unknown): string {
  if (!data || typeof data !== 'object') return 'Erreur du backend';
  const d = data as { detail?: unknown; error?: unknown; message?: unknown };
  const detail = d.detail ?? d.error ?? d.message;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'msg' in item) {
          return String((item as { msg: unknown }).msg);
        }
        return JSON.stringify(item);
      })
      .join('; ');
  }
  if (detail != null) return JSON.stringify(detail);
  return 'Erreur du backend';
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const week_start_date = formData.get('week_start_date') || '2026-07-13';

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: 'Fichier PDF requis' },
        { status: 400 }
      );
    }

    // Vérifier le type MIME (certains navigateurs envoient application/octet-stream)
    const fileName = (file as File).name || '';
    const isPdf =
      file.type === 'application/pdf' ||
      fileName.toLowerCase().endsWith('.pdf') ||
      file.type === 'application/octet-stream';
    if (!isPdf) {
      return NextResponse.json(
        { error: 'Le fichier doit être un PDF' },
        { status: 400 }
      );
    }

    const uploadFormData = new FormData();
    uploadFormData.append('file', file, fileName || 'planning.pdf');
    uploadFormData.append('week_start_date', week_start_date as string);

    const url = new URL(`${RENDER_API_URL}/upload-planning-pdf`);
    if (API_KEY) url.searchParams.set('x_api_key', API_KEY);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        ...(API_KEY && { 'x-api-key': API_KEY, 'X-API-Key': API_KEY }),
      },
      body: uploadFormData,
    });

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      data = { detail: await response.text() };
    }

    if (!response.ok) {
      const upstream = formatUpstreamError(data);
      const isMalformedJson =
        /JSON malformé|JSONDecodeError|Expecting value/i.test(upstream);
      return NextResponse.json(
        {
          error: isMalformedJson ? `${upstream}\n\n${JSON_MALFORMED_HINT}` : upstream,
          retryable: isMalformedJson,
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[upload-pdf] Error:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
