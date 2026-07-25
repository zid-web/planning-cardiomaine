import { NextRequest, NextResponse } from 'next/server';

// GUARD_API_BASE_URL is the preferred name; GUARD_API_URL is already used elsewhere in the repo.
const RENDER_API_URL = (
  process.env.GUARD_API_BASE_URL ||
  process.env.GUARD_API_URL ||
  'https://guard-api-cardiomaine.onrender.com'
).replace(/\/$/, '');
const API_KEY = process.env.GUARD_API_KEY || '';

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
    const body = await req.json();

    const url = new URL(`${RENDER_API_URL}/voice-command`);
    if (API_KEY) url.searchParams.set('x_api_key', API_KEY);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY && { 'x-api-key': API_KEY, 'X-API-Key': API_KEY }),
      },
      body: JSON.stringify(body),
    });

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      data = { detail: await response.text() };
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: formatUpstreamError(data) },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[voice-command] Error:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
