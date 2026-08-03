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

/** Génère un PDF paysage A4 de la grille hebdomadaire sous forme de tableau quadrillé. */
export async function buildPlanningPdf(weekKey: string, schedule: ScheduleData) {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const pageWidth = 842
  const pageHeight = 595
  let page = doc.addPage([pageWidth, pageHeight])

  const colW = (pageWidth - 212) / DAYS.length // Largeur de chaque jour (770 - 140 = 630 / 7 = 90)

  const drawVerticalLines = (topY: number, bottomY: number) => {
    // Ligne verticale gauche (début du tableau)
    page.drawLine({
      start: { x: 36, y: topY },
      end: { x: 36, y: bottomY },
      thickness: 0.8,
      color: rgb(0.08, 0.18, 0.3),
    })
    // Ligne verticale de séparation après "Activité"
    page.drawLine({
      start: { x: 176, y: topY },
      end: { x: 176, y: bottomY },
      thickness: 0.8,
      color: rgb(0.08, 0.18, 0.3),
    })
    // Lignes verticales de séparation pour chaque jour
    for (let i = 0; i < DAYS.length; i++) {
      const x = 176 + (i + 1) * colW
      page.drawLine({
        start: { x, y: topY },
        end: { x, y: bottomY },
        thickness: i === DAYS.length - 1 ? 0.8 : 0.5,
        color: i === DAYS.length - 1 ? rgb(0.08, 0.18, 0.3) : rgb(0.75, 0.78, 0.82),
      })
    }
  }

  const drawTableHeader = (startY: number) => {
    // Fond bleu marine pour l'en-tête du tableau
    page.drawRectangle({
      x: 36,
      y: startY - 18,
      width: pageWidth - 72,
      height: 18,
      color: rgb(0.08, 0.18, 0.3),
    })

    // Texte de la colonne Activité
    page.drawText("Activité", {
      x: 42,
      y: startY - 12,
      size: 8,
      font: fontBold,
      color: rgb(1, 1, 1),
    })

    // Texte des jours de la semaine
    DAYS.forEach((d, i) => {
      page.drawText(d, {
        x: 176 + i * colW + 6,
        y: startY - 12,
        size: 8,
        font: fontBold,
        color: rgb(1, 1, 1),
      })
    })

    return startY - 18
  }

  // Titre en haut de la page
  page.drawText(`Planning Cardiomaine — Semaine ${weekKey}`, {
    x: 36,
    y: pageHeight - 28,
    size: 13,
    font: fontBold,
    color: rgb(0.08, 0.18, 0.3),
  })

  let currentY = pageHeight - 48
  let tableTopY = currentY
  
  // Dessine l'en-tête du tableau
  currentY = drawTableHeader(currentY)

  // Lignes horizontales principales pour l'en-tête
  page.drawLine({
    start: { x: 36, y: tableTopY },
    end: { x: pageWidth - 36, y: tableTopY },
    thickness: 0.8,
    color: rgb(0.08, 0.18, 0.3),
  })
  page.drawLine({
    start: { x: 36, y: currentY },
    end: { x: pageWidth - 36, y: currentY },
    thickness: 0.8,
    color: rgb(0.08, 0.18, 0.3),
  })

  const rowKeys = Object.keys(schedule).filter((k) => k !== "Notes du jour")
  let rowIndex = 0

  for (const rowKey of rowKeys) {
    const rowHeight = 16

    // Saut de page si la ligne dépasse la marge inférieure de sécurité
    if (currentY - rowHeight < 40) {
      drawVerticalLines(tableTopY, currentY)
      page.drawLine({
        start: { x: 36, y: currentY },
        end: { x: pageWidth - 36, y: currentY },
        thickness: 0.8,
        color: rgb(0.08, 0.18, 0.3),
      })

      page = doc.addPage([pageWidth, pageHeight])
      
      page.drawText(`Planning Cardiomaine — Semaine ${weekKey} (suite)`, {
        x: 36,
        y: pageHeight - 28,
        size: 11,
        font: fontBold,
        color: rgb(0.08, 0.18, 0.3),
      })

      tableTopY = pageHeight - 48
      currentY = drawTableHeader(tableTopY)

      page.drawLine({
        start: { x: 36, y: tableTopY },
        end: { x: pageWidth - 36, y: tableTopY },
        thickness: 0.8,
        color: rgb(0.08, 0.18, 0.3),
      })
      page.drawLine({
        start: { x: 36, y: currentY },
        end: { x: pageWidth - 36, y: currentY },
        thickness: 0.8,
        color: rgb(0.08, 0.18, 0.3),
      })
      rowIndex = 0
    }

    // Alternance de couleur de fond pour les lignes (Zebra striping)
    if (rowIndex % 2 === 0) {
      page.drawRectangle({
        x: 36,
        y: currentY - rowHeight,
        width: pageWidth - 72,
        height: rowHeight,
        color: rgb(0.96, 0.97, 0.99),
      })
    }

    // Nom de l'activité (première colonne)
    page.drawText(shortLabel(rowKey), {
      x: 42,
      y: currentY - rowHeight + 5,
      size: 7,
      font: fontBold,
      color: rgb(0.1, 0.15, 0.25),
    })

    // Contenu des cellules pour chaque jour
    DAYS.forEach((day, i) => {
      const docs = (schedule[rowKey]?.[day]?.value || []).join(", ")
      if (!docs) return
      page.drawText(docs.slice(0, 20), {
        x: 176 + i * colW + 6,
        y: currentY - rowHeight + 5,
        size: 7,
        font,
        color: rgb(0.15, 0.15, 0.2),
      })
    })

    currentY -= rowHeight
    rowIndex++

    // Ligne horizontale de séparation entre chaque ligne
    page.drawLine({
      start: { x: 36, y: currentY },
      end: { x: pageWidth - 36, y: currentY },
      thickness: 0.5,
      color: rgb(0.8, 0.82, 0.85),
    })
  }

  // Dessin final des bordures verticales et horizontales du tableau
  drawVerticalLines(tableTopY, currentY)
  page.drawLine({
    start: { x: 36, y: currentY },
    end: { x: pageWidth - 36, y: currentY },
    thickness: 0.8,
    color: rgb(0.08, 0.18, 0.3),
  })

  // Affichage structuré et propre des Notes du jour à la fin du document
  const notesToShow = DAYS.map(day => ({
    day,
    note: schedule["Notes du jour"]?.[day]?.value?.[0] || ""
  })).filter(n => !!n.note)

  if (notesToShow.length > 0) {
    if (currentY - 30 - (notesToShow.length * 14) < 40) {
      page = doc.addPage([pageWidth, pageHeight])
      currentY = pageHeight - 36
    } else {
      currentY -= 15
    }

    page.drawText("Notes du jour :", {
      x: 36,
      y: currentY,
      size: 9,
      font: fontBold,
      color: rgb(0.08, 0.18, 0.3),
    })
    currentY -= 14

    notesToShow.forEach((n) => {
      page.drawText(`${n.day} :`, {
        x: 36,
        y: currentY,
        size: 7.5,
        font: fontBold,
        color: rgb(0.2, 0.3, 0.4),
      })
      page.drawText(n.note.slice(0, 150), {
        x: 85,
        y: currentY,
        size: 7.5,
        font,
        color: rgb(0.15, 0.15, 0.2),
      })
      currentY -= 12
    })
  }

  return doc.save()
}
