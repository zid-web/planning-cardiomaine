import { buildPlanningPdf } from "@/lib/planning-pdf"
import type { ScheduleData } from "@/lib/types"

/**
 * Génère et télécharge le PDF côté navigateur (évite GET /api/export-planning-pdf
 * qui peut renvoyer 413 sur Vercel quand les cookies auth Supabase sont trop gros).
 */
export async function downloadPlanningPdf(weekKey: string, schedule: ScheduleData) {
  const bytes = await buildPlanningPdf(weekKey, schedule)
  // Copie explicite : évite l’incompatibilité TS Uint8Array<ArrayBufferLike> → BlobPart
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const blob = new Blob([copy], { type: "application/pdf" })
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement("a")
    a.href = url
    a.download = `planning-${weekKey}.pdf`
    a.rel = "noopener"
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
}
