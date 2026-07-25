import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import { DAYS } from "@/lib/constants"
import type { ScheduleData } from "@/lib/types"

function shortLabel(rowKey: string) {
  return rowKey
    .replace("Matin - ", "M · ")
    .replace("Apm - ", "A · ")
    .replace("Hors site - ", "HS · ")
    .replace("Astreintes ATL ", "ATL ")
    .slice(0, 28)
}

/** Génère un PDF paysage A4 de la grille hebdomadaire. */
export async function buildPlanningPdf(weekKey: string, schedule: ScheduleData) {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const pageWidth = 842
  const pageHeight = 595
  let page = doc.addPage([pageWidth, pageHeight])
  let y = pageHeight - 36

  const drawHeader = () => {
    page.drawText(`Planning Cardiomaine — ${weekKey}`, {
      x: 36,
      y,
      size: 14,
      font: fontBold,
      color: rgb(0.1, 0.2, 0.35),
    })
    y -= 22
    page.drawText("Activité", { x: 36, y, size: 8, font: fontBold })
    const colW = (pageWidth - 170) / DAYS.length
    DAYS.forEach((d, i) => {
      page.drawText(d.slice(0, 3), {
        x: 170 + i * colW,
        y,
        size: 8,
        font: fontBold,
      })
    })
    y -= 12
    page.drawLine({
      start: { x: 36, y },
      end: { x: pageWidth - 36, y },
      thickness: 0.5,
      color: rgb(0.7, 0.75, 0.8),
    })
    y -= 10
  }

  drawHeader()

  const rowKeys = Object.keys(schedule).filter((k) => k !== "Notes du jour")
  const colW = (pageWidth - 170) / DAYS.length

  for (const rowKey of rowKeys) {
    if (y < 50) {
      page = doc.addPage([pageWidth, pageHeight])
      y = pageHeight - 36
      drawHeader()
    }

    page.drawText(shortLabel(rowKey), { x: 36, y, size: 7, font })
    DAYS.forEach((day, i) => {
      const docs = (schedule[rowKey]?.[day]?.value || []).join(",")
      if (!docs) return
      page.drawText(docs.slice(0, 14), {
        x: 170 + i * colW,
        y,
        size: 7,
        font,
        color: rgb(0.15, 0.15, 0.2),
      })
    })
    y -= 10
  }

  // Notes
  if (y < 80) {
    page = doc.addPage([pageWidth, pageHeight])
    y = pageHeight - 36
  }
  y -= 8
  page.drawText("Notes du jour", { x: 36, y, size: 10, font: fontBold })
  y -= 14
  for (const day of DAYS) {
    const note = schedule["Notes du jour"]?.[day]?.value?.[0] || ""
    if (!note) continue
    if (y < 40) {
      page = doc.addPage([pageWidth, pageHeight])
      y = pageHeight - 36
    }
    const line = `${day}: ${note}`.slice(0, 110)
    page.drawText(line, { x: 36, y, size: 8, font })
    y -= 11
  }

  return doc.save()
}
