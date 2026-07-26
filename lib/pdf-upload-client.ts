/**
 * Upload PDF planning vers le backend Render.
 *
 * Les PDF multi-pages (9× Claude Vision) dépassent souvent le timeout Vercel
 * du proxy `/api/upload-pdf` (504 Gateway Timeout). On appelle donc Render
 * directement depuis le navigateur (CORS `*` côté guard-api).
 */

export const GUARD_API_PUBLIC_URL = (
  process.env.NEXT_PUBLIC_GUARD_API_BASE_URL ||
  process.env.NEXT_PUBLIC_GUARD_API_URL ||
  "https://guard-api-cardiomaine.onrender.com"
).replace(/\/$/, "")

export type PdfUploadResult = Record<string, unknown>

function formatError(data: unknown, status: number): string {
  if (status === 504 || status === 502) {
    return `Timeout d’extraction PDF (HTTP ${status}). Réessayez ; un PDF multi-pages peut prendre 1–3 minutes.`
  }
  if (status === 413) {
    return "Fichier trop volumineux (413). Compressez le PDF (idéalement < 8 Mo)."
  }
  if (!data || typeof data !== "object") return `Erreur upload PDF (HTTP ${status})`
  const d = data as { detail?: unknown; error?: unknown; message?: unknown }
  const detail = d.detail ?? d.error ?? d.message
  if (typeof detail === "string") return detail
  if (detail != null) return JSON.stringify(detail)
  return `Erreur upload PDF (HTTP ${status})`
}

/**
 * POST direct Render `/upload-planning-pdf`.
 * Pas de clé API côté client (le service accepte les appels publics ou via
 * `x_api_key` query uniquement si `NEXT_PUBLIC_GUARD_API_KEY` est défini —
 * déconseillé ; préférer laisser Render ouvert ou proxy court).
 */
export async function uploadPlanningPdfDirect(
  file: File,
  weekStartDate: string,
  opts?: { signal?: AbortSignal },
): Promise<PdfUploadResult> {
  const formData = new FormData()
  formData.append("file", file, file.name || "planning.pdf")
  formData.append("week_start_date", weekStartDate)

  const url = new URL(`${GUARD_API_PUBLIC_URL}/upload-planning-pdf`)
  const publicKey = process.env.NEXT_PUBLIC_GUARD_API_KEY
  if (publicKey) url.searchParams.set("x_api_key", publicKey)

  const response = await fetch(url.toString(), {
    method: "POST",
    body: formData,
    signal: opts?.signal,
    headers: publicKey
      ? { "x-api-key": publicKey, "X-API-Key": publicKey }
      : undefined,
  })

  let payload: unknown = {}
  try {
    payload = await response.json()
  } catch {
    payload = { detail: await response.text() }
  }

  if (!response.ok) {
    const err = new Error(formatError(payload, response.status)) as Error & {
      status?: number
      retryable?: boolean
    }
    err.status = response.status
    err.retryable =
      response.status === 502 ||
      response.status === 503 ||
      response.status === 504 ||
      /JSON malformé|Expecting value/i.test(err.message)
    throw err
  }

  return payload as PdfUploadResult
}

/** Proxy Next (court) — utile si CORS Render bloqué un jour. */
export async function uploadPlanningPdfViaProxy(
  file: File,
  weekStartDate: string,
  opts?: { signal?: AbortSignal },
): Promise<PdfUploadResult> {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("week_start_date", weekStartDate)

  const response = await fetch("/api/upload-pdf", {
    method: "POST",
    body: formData,
    signal: opts?.signal,
  })

  let payload: unknown = {}
  try {
    payload = await response.json()
  } catch {
    payload = { detail: await response.text() }
  }

  if (!response.ok) {
    const err = new Error(formatError(payload, response.status)) as Error & {
      status?: number
      retryable?: boolean
    }
    err.status = response.status
    const detail =
      typeof payload === "object" && payload && "error" in payload
        ? String((payload as { error: unknown }).error)
        : err.message
    err.message = detail || err.message
    err.retryable =
      (typeof payload === "object" &&
        payload &&
        (payload as { retryable?: boolean }).retryable === true) ||
      response.status === 504 ||
      /JSON malformé|Expecting value/i.test(err.message)
    throw err
  }

  return payload as PdfUploadResult
}
