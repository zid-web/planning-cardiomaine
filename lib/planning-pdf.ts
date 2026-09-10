import {
  LineCapStyle,
  LineJoinStyle,
  PDFDocument,
  StandardFonts,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  setLineJoin,
  type PDFPage,
} from "pdf-lib"
import { DAYS } from "@/lib/constants"
import type { ScheduleData } from "@/lib/types"

/**
 * Marque Cardiomaine — « Le C battant », en vectoriel.
 *
 * Les tracés sont ceux de components/brand/cardiomaine-mark.tsx : on les
 * redessine ici en `drawSvgPath` plutôt que d'embarquer un PNG, pour que le
 * logo reste net à l'impression et à l'agrandissement.
 *
 * `MARK_*` reprend la boîte serrée du composant (MARK_VIEWBOX_TIGHT) : origine
 * en 6.7/5.8, côté de 52.4.
 */
const MARK_C = "M45.5 15.9A21 21 0 1 0 45.5 48.1"
const MARK_C_WIDTH = 8.5
const MARK_PULSE = "M16.5 32H32l5-11.5 6 23 4-11.5h9"
const MARK_PULSE_WIDTH = 4.2
const MARK_ORIGIN_X = 6.7
const MARK_ORIGIN_Y = 5.8
const MARK_EXTENT = 52.4

const BRAND_INK = rgb(15 / 255, 42 / 255, 71 / 255) // #0F2A47
const BRAND_PULSE = rgb(178 / 255, 58 / 255, 72 / 255) // #B23A48

/**
 * Dessine la marque sur `page`, calée à gauche sur `x` et centrée
 * verticalement sur `centerY`, à `size` points de côté.
 *
 * `drawSvgPath` place l'origine SVG (0,0) en (x,y) avec l'axe des ordonnées
 * inversé — un point SVG (sx, sy) atterrit donc en (x + sx·échelle,
 * y − sy·échelle). D'où le décalage par l'origine de la boîte serrée.
 */
function drawBrandMark(page: PDFPage, x: number, centerY: number, size: number) {
  const scale = size / MARK_EXTENT
  const originX = x - MARK_ORIGIN_X * scale
  const originY = centerY + size / 2 + MARK_ORIGIN_Y * scale

  // Le pic R forme un angle aigu : sans jointure ronde, le raccord en pointe
  // par défaut du PDF y produit une écharde. L'état graphique est empilé pour
  // ne pas imposer ce réglage au reste du document.
  page.pushOperators(pushGraphicsState(), setLineJoin(LineJoinStyle.Round))

  page.drawSvgPath(MARK_C, {
    x: originX,
    y: originY,
    scale,
    borderWidth: MARK_C_WIDTH * scale,
    borderColor: BRAND_INK,
    borderLineCap: LineCapStyle.Round,
  })
  page.drawSvgPath(MARK_PULSE, {
    x: originX,
    y: originY,
    scale,
    borderWidth: MARK_PULSE_WIDTH * scale,
    borderColor: BRAND_PULSE,
    borderLineCap: LineCapStyle.Round,
  })

  page.pushOperators(popGraphicsState())
}

/** Côté de la marque dans l'en-tête, et retrait du titre pour la dégager. */
const HEADER_MARK_SIZE = 19
const HEADER_TEXT_X = 36 + HEADER_MARK_SIZE + 9

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

  // Titre en haut de la page, précédé de la marque. La marque est centrée sur
  // la hauteur de capitale du titre (~0,72 × corps) et non sur sa ligne de base.
  const titleSize = 13
  drawBrandMark(page, 36, pageHeight - 28 + (titleSize * 0.72) / 2, HEADER_MARK_SIZE)
  page.drawText(`Planning Cardiomaine — Semaine ${weekKey}`, {
    x: HEADER_TEXT_X,
    y: pageHeight - 28,
    size: titleSize,
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
      
      const contSize = 11
      drawBrandMark(page, 36, pageHeight - 28 + (contSize * 0.72) / 2, HEADER_MARK_SIZE)
      page.drawText(`Planning Cardiomaine — Semaine ${weekKey} (suite)`, {
        x: HEADER_TEXT_X,
        y: pageHeight - 28,
        size: contSize,
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
