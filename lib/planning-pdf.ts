import fontkit from "@pdf-lib/fontkit"
import {
  LineCapStyle,
  LineJoinStyle,
  PDFDocument,
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

/**
 * Palette du document, alignée sur celle de la marque.
 *
 * Le document utilisait auparavant deux bleus foncés distincts et approchants,
 * l'un pour la structure du tableau, l'autre pour les libellés d'activité, qui
 * visaient tous deux l'ardoise sans l'atteindre. Les deux sont maintenant
 * `INK`, la valeur exacte de la marque.
 */
const INK = rgb(15 / 255, 42 / 255, 71 / 255) // #0F2A47, ardoise de la marque
const PULSE = rgb(178 / 255, 58 / 255, 72 / 255) // #B23A48, grenat de la marque
const PAPER = rgb(1, 1, 1)
/** Filets du quadrillage : séparation des jours à l'intérieur du tableau. */
const RULE_DAY = rgb(0.75, 0.78, 0.82)
/** Filets du quadrillage : séparation entre deux lignes d'activité. */
const RULE_ROW = rgb(0.8, 0.82, 0.85)
/** Fond des lignes paires du tableau. */
const ZEBRA = rgb(0.96, 0.97, 0.99)
/** Texte courant : noms de médecins, corps des notes. */
const TEXT = rgb(0.15, 0.15, 0.2)
/** Texte secondaire, un cran plus clair qu'`INK` : jour d'une note. */
const TEXT_MUTED = rgb(0.2, 0.3, 0.4)

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
    borderColor: INK,
    borderLineCap: LineCapStyle.Round,
  })
  page.drawSvgPath(MARK_PULSE, {
    x: originX,
    y: originY,
    scale,
    borderWidth: MARK_PULSE_WIDTH * scale,
    borderColor: PULSE,
    borderLineCap: LineCapStyle.Round,
  })

  page.pushOperators(popGraphicsState())
}

/**
 * Couverture de la police embarquée, à garder synchronisée avec la commande de
 * sous-ensemble documentée dans lib/fonts/README.md.
 *
 * Ce n'est pas une précaution cosmétique : `drawText` **lève une exception**
 * sur un caractère que la police ne peut pas encoder — l'export échouait donc
 * déjà, avant l'embarquement de Geist, sur une note contenant par exemple une
 * flèche, que le WinAnsi de l'Helvetica standard ne couvre pas non plus. Les
 * notes et les libellés d'activité étant du texte libre saisi par l'équipe, le
 * risque est réel.
 */
const PDF_TEXT_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x20, 0x7e], // latin de base
  [0xa0, 0xff], // supplément Latin-1 : accents français, °, ±, «, »
  [0x152, 0x153], // Œ œ
  [0x178, 0x178], // Ÿ
  [0x2013, 0x2014], // – —
  [0x2018, 0x201e], // guillemets et apostrophes courbes
  [0x2022, 0x2022], // •
  [0x2026, 0x2026], // …
  [0x2030, 0x2030], // ‰
  [0x2039, 0x203a], // ‹ ›
  [0x20ac, 0x20ac], // €
]

/**
 * Équivalents pour les caractères hors couverture les plus plausibles dans une
 * note de service, plutôt que de les perdre en silence.
 */
const PDF_TEXT_SUBSTITUTIONS: Record<string, string> = {
  "\u2192": "->",
  "\u2190": "<-",
  "\u2194": "<->",
  "\u21d2": "=>",
  "\u2011": "-", // trait d'union insécable
  "\u2212": "-", // signe moins
  "\u2265": ">=",
  "\u2264": "<=",
  "\u2260": "!=",
  "\u00a0": " ", // espace insécable : encodable, mais uniformisée
  "\u202f": " ", // espace fine insécable
  "\u2009": " ",
  "\u2044": "/",
}

const isEncodable = (cp: number) => PDF_TEXT_RANGES.some(([lo, hi]) => cp >= lo && cp <= hi)

/**
 * Rend une chaîne sûre à dessiner : normalisation en formes composées (pour que
 * « é » saisi en e + accent combinant devienne le glyphe unique que la police
 * possède), substitution des caractères courants hors couverture, puis retrait
 * du reste. Mieux vaut une note amputée d'un émoji qu'un export qui échoue.
 */
function safeText(input: string): string {
  let out = ""
  for (const ch of input.normalize("NFC")) {
    const sub = PDF_TEXT_SUBSTITUTIONS[ch]
    if (sub !== undefined) {
      out += sub
      continue
    }
    const cp = ch.codePointAt(0)
    if (cp !== undefined && isEncodable(cp)) out += ch
  }
  return out
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

  // Geist, la police de l'application, à la place de l'Helvetica standard des
  // PDF. Le module est importé dynamiquement pour que ses ~41 Ko forment un
  // segment à part, téléchargé au premier export seulement et non au chargement
  // de l'application.
  doc.registerFontkit(fontkit)
  const { GEIST_REGULAR_BASE64, GEIST_SEMIBOLD_BASE64 } = await import("@/lib/planning-pdf-fonts")
  // `subset: true` : seuls les glyphes réellement tracés partent dans le
  // fichier, ce qui garde le PDF léger malgré la police embarquée.
  const font = await doc.embedFont(GEIST_REGULAR_BASE64, { subset: true })
  const fontBold = await doc.embedFont(GEIST_SEMIBOLD_BASE64, { subset: true })

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
      color: INK,
    })
    // Ligne verticale de séparation après "Activité"
    page.drawLine({
      start: { x: 176, y: topY },
      end: { x: 176, y: bottomY },
      thickness: 0.8,
      color: INK,
    })
    // Lignes verticales de séparation pour chaque jour
    for (let i = 0; i < DAYS.length; i++) {
      const x = 176 + (i + 1) * colW
      page.drawLine({
        start: { x, y: topY },
        end: { x, y: bottomY },
        thickness: i === DAYS.length - 1 ? 0.8 : 0.5,
        color: i === DAYS.length - 1 ? INK : RULE_DAY,
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
      color: INK,
    })

    // Texte de la colonne Activité
    page.drawText("Activité", {
      x: 42,
      y: startY - 12,
      size: 8,
      font: fontBold,
      color: PAPER,
    })

    // Texte des jours de la semaine
    DAYS.forEach((d, i) => {
      page.drawText(safeText(d), {
        x: 176 + i * colW + 6,
        y: startY - 12,
        size: 8,
        font: fontBold,
        color: PAPER,
      })
    })

    return startY - 18
  }

  // Titre en haut de la page, précédé de la marque. La marque est centrée sur
  // la hauteur de capitale du titre (~0,72 × corps) et non sur sa ligne de base.
  const titleSize = 13
  drawBrandMark(page, 36, pageHeight - 28 + (titleSize * 0.72) / 2, HEADER_MARK_SIZE)
  page.drawText(safeText(`Planning Cardiomaine — Semaine ${weekKey}`), {
    x: HEADER_TEXT_X,
    y: pageHeight - 28,
    size: titleSize,
    font: fontBold,
    color: INK,
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
    color: INK,
  })
  page.drawLine({
    start: { x: 36, y: currentY },
    end: { x: pageWidth - 36, y: currentY },
    thickness: 0.8,
    color: INK,
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
        color: INK,
      })

      page = doc.addPage([pageWidth, pageHeight])
      
      const contSize = 11
      drawBrandMark(page, 36, pageHeight - 28 + (contSize * 0.72) / 2, HEADER_MARK_SIZE)
      page.drawText(safeText(`Planning Cardiomaine — Semaine ${weekKey} (suite)`), {
        x: HEADER_TEXT_X,
        y: pageHeight - 28,
        size: contSize,
        font: fontBold,
        color: INK,
      })

      tableTopY = pageHeight - 48
      currentY = drawTableHeader(tableTopY)

      page.drawLine({
        start: { x: 36, y: tableTopY },
        end: { x: pageWidth - 36, y: tableTopY },
        thickness: 0.8,
        color: INK,
      })
      page.drawLine({
        start: { x: 36, y: currentY },
        end: { x: pageWidth - 36, y: currentY },
        thickness: 0.8,
        color: INK,
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
        color: ZEBRA,
      })
    }

    // Nom de l'activité (première colonne)
    page.drawText(safeText(shortLabel(rowKey)), {
      x: 42,
      y: currentY - rowHeight + 5,
      size: 7,
      font: fontBold,
      color: INK,
    })

    // Contenu des cellules pour chaque jour
    DAYS.forEach((day, i) => {
      const docs = (schedule[rowKey]?.[day]?.value || []).join(", ")
      if (!docs) return
      page.drawText(safeText(docs).slice(0, 20), {
        x: 176 + i * colW + 6,
        y: currentY - rowHeight + 5,
        size: 7,
        font,
        color: TEXT,
      })
    })

    currentY -= rowHeight
    rowIndex++

    // Ligne horizontale de séparation entre chaque ligne
    page.drawLine({
      start: { x: 36, y: currentY },
      end: { x: pageWidth - 36, y: currentY },
      thickness: 0.5,
      color: RULE_ROW,
    })
  }

  // Dessin final des bordures verticales et horizontales du tableau
  drawVerticalLines(tableTopY, currentY)
  page.drawLine({
    start: { x: 36, y: currentY },
    end: { x: pageWidth - 36, y: currentY },
    thickness: 0.8,
    color: INK,
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
      color: INK,
    })
    currentY -= 14

    notesToShow.forEach((n) => {
      page.drawText(safeText(`${n.day} :`), {
        x: 36,
        y: currentY,
        size: 7.5,
        font: fontBold,
        color: TEXT_MUTED,
      })
      page.drawText(safeText(n.note).slice(0, 150), {
        x: 85,
        y: currentY,
        size: 7.5,
        font,
        color: TEXT,
      })
      currentY -= 12
    })
  }

  return doc.save()
}
