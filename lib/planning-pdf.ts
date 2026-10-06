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
import { DAYS, DOCTOR_COLORS } from "@/lib/constants"
import { generateWeekSchedule, getFrenchPublicHolidays } from "@/lib/schedule-utils"
import { dateStrForWeekDay } from "@/lib/fixed-assignments"
import { schoolHolidayZoneB } from "@/lib/french-calendar"
import { getCellDisplayAssignees, isListedDoctor } from "@/lib/doctor-code"
import { formatDoctorWithDoublon } from "@/lib/slot-blocking"
import { isSolverProposalCell } from "@/lib/guard-api-mapping"
import { isOffSiteRow, offSiteSlotOf, OFF_SITE_SLOT_BADGES } from "@/lib/off-site-slots"
import { isSlotClosed } from "@/lib/closed-slots"
import { holidayNameForWeekDay, isHolidayClosedSlot } from "@/lib/holiday-closed"
import type { CellData, ScheduleData } from "@/lib/types"

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

/** Couleurs Tailwind utilisées par la grille globale, en RGB 0-255. */
const TW: Record<string, [number, number, number]> = {
  "blue-500": [59, 130, 246], "emerald-500": [16, 185, 129], "red-500": [239, 68, 68],
  "yellow-500": [234, 179, 8], "purple-500": [168, 85, 247], "pink-500": [236, 72, 153],
  "indigo-500": [99, 102, 241], "orange-500": [249, 115, 22], "teal-500": [20, 184, 166],
  "cyan-500": [6, 182, 212], "lime-600": [101, 163, 13], "fuchsia-500": [217, 70, 239],
  "rose-500": [244, 63, 94], "violet-500": [139, 92, 246], "sky-500": [14, 165, 233],
  "amber-500": [245, 158, 11], "stone-500": [120, 113, 108], "slate-500": [100, 116, 139],
  "fuchsia-700": [162, 28, 175], "rose-700": [190, 18, 60], "red-700": [185, 28, 28],
  "emerald-700": [4, 120, 87], "sky-700": [3, 105, 161], "teal-600": [13, 148, 136],
  "amber-600": [217, 119, 6],
}

function tw(rgbTriplet: [number, number, number], alpha = 1) {
  const [r, g, b] = rgbTriplet.map((c) => (255 + (c - 255) * alpha) / 255)
  return rgb(r, g, b)
}

function badgeColor(code: string) {
  const cls = DOCTOR_COLORS[code]?.replace("bg-", "") ?? "slate-500"
  return tw(TW[cls] ?? TW["slate-500"])
}

/** Fond de ligne : mêmes teintes (à 50 %) que `getRowColor` de la grille globale. */
function rowFill(rowKey: string) {
  if (rowKey.includes("Vacance")) return tw([255, 237, 213], 0.5)
  if (rowKey.includes("Rythmo")) return tw([254, 249, 195], 0.5)
  if (rowKey.includes("Coro")) return tw([224, 242, 254], 0.5)
  if (rowKey.includes("Matin")) return tw([239, 246, 255], 0.5)
  if (rowKey.includes("Apm")) return tw([255, 247, 237], 0.5)
  if (rowKey.includes("Garde") || rowKey.includes("Astreinte")) return tw([254, 242, 242], 0.5)
  if (rowKey.includes("Hors site")) return tw([248, 250, 252], 0.5)
  return PAPER
}

function sectionTitle(rowKey: string): string | null {
  if (rowKey.includes("Matin - Cs PSS")) return "VACATIONS MATIN"
  if (rowKey.includes("Apm - Cs PSS")) return "VACATIONS APRÈS-MIDI"
  if (rowKey.includes("Astreintes ATL Matin")) return "ASTREINTES & GARDES"
  if (rowKey.includes("Hors site - NCT")) return "HORS SITE"
  return null
}

function allowedOnHoliday(rowKey: string) {
  return rowKey.includes("Astreintes ATL") || rowKey.includes("Garde")
}

export type PlanningPdfOptions = {
  /** Case grisée dans la grille globale (même règle que l'écran). */
  isBlocked?: (rowKey: string, day: string) => boolean
}

/**
 * PDF paysage A4 de la semaine — reproduit la grille « Planning global » :
 * mêmes lignes dans le même ordre, mêmes sections, mêmes colonnes (jour + date),
 * mêmes couleurs (férié, vacances zone B, badges médecins, propositions).
 * Les pictogrammes emoji de la grille ne sont pas reproduits (absents de la police).
 */
export async function buildPlanningPdf(
  weekKey: string,
  schedule: ScheduleData,
  options: PlanningPdfOptions = {},
) {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const { GEIST_REGULAR_BASE64, GEIST_SEMIBOLD_BASE64 } = await import("@/lib/planning-pdf-fonts")
  const font = await doc.embedFont(GEIST_REGULAR_BASE64, { subset: true })
  const fontBold = await doc.embedFont(GEIST_SEMIBOLD_BASE64, { subset: true })

  const pageWidth = 842
  const pageHeight = 595
  const left = 24
  const labelW = 132
  const colW = (pageWidth - left * 2 - labelW) / DAYS.length
  const tableW = pageWidth - left * 2
  const headerH = 26
  const bandH = 10
  const bottomLimit = 24

  const generated = generateWeekSchedule(weekKey)
  const rowKeys = Object.keys(generated)
  // Une seule page si possible : la hauteur de ligne s'adapte (11 à 15,5 pt).
  const bandCount = rowKeys.filter((k) => sectionTitle(k)).length
  const available = pageHeight - 40 - headerH - bottomLimit - bandCount * bandH
  const rowH = Math.max(11, Math.min(15.5, available / rowKeys.length))
  const textBase = (size: number) => (rowH - size * 0.72) / 2
  const isBlocked =
    options.isBlocked ??
    ((row: string, day: string) =>
      ((day === "SAMEDI" || day === "DIMANCHE") && !allowedOnHoliday(row)) ||
      isHolidayClosedSlot(row, holidayNameForWeekDay(weekKey, day)) ||
      isSlotClosed(row, day))

  // Dates / fériés / vacances scolaires zone B par jour (mêmes sources que l'écran)
  const days = DAYS.map((day) => {
    const iso = dateStrForWeekDay(weekKey, day) ?? ""
    const [y, m, d] = iso.split("-")
    const holiday = iso ? getFrenchPublicHolidays(Number(y))[`${d}/${m}/${y}`] : undefined
    const school = iso && !holiday ? schoolHolidayZoneB(iso) : null
    return { day, iso, dm: iso ? `${d}/${m}` : "", holiday, school }
  })
  const weekNumber = Number.parseInt(weekKey.split("-W")[1] ?? "", 10)

  let page = doc.addPage([pageWidth, pageHeight])
  let y = 0

  const centered = (text: string, cx: number, baseY: number, size: number, f = font, color = TEXT) => {
    const t = safeText(text)
    page.drawText(t, { x: cx - f.widthOfTextAtSize(t, size) / 2, y: baseY, size, font: f, color })
  }

  const drawHeader = () => {
    const top = y
    page.drawRectangle({ x: left, y: top - headerH, width: tableW, height: headerH, color: tw([241, 245, 249]) })
    page.drawText("Activité", { x: left + 6, y: top - 16, size: 8, font: fontBold, color: tw([51, 65, 85]) })
    days.forEach((d, i) => {
      const x = left + labelW + i * colW
      const weekend = d.day === "SAMEDI" || d.day === "DIMANCHE"
      const fill = d.holiday
        ? tw([255, 228, 230])
        : d.school
          ? tw([254, 243, 199])
          : weekend
            ? tw([248, 250, 252])
            : PAPER
      const ink = d.holiday ? tw([159, 18, 57]) : d.school ? tw([120, 53, 15]) : tw([51, 65, 85])
      page.drawRectangle({ x, y: top - headerH, width: colW, height: headerH, color: fill })
      if (d.holiday) {
        page.drawRectangle({ x, y: top - headerH, width: 2.5, height: headerH, color: tw([253, 164, 175]) })
        page.drawRectangle({ x: x + colW - 2.5, y: top - headerH, width: 2.5, height: headerH, color: tw([253, 164, 175]) })
      }
      centered(d.day.slice(0, 3), x + colW / 2, top - 11, 6.5, font, ink)
      centered(d.dm, x + colW / 2, top - 21.5, 9, fontBold, ink)
    })
    page.drawLine({ start: { x: left, y: top }, end: { x: left + tableW, y: top }, thickness: 0.6, color: RULE_DAY })
    page.drawLine({ start: { x: left, y: top - headerH }, end: { x: left + tableW, y: top - headerH }, thickness: 0.8, color: RULE_DAY })
    y = top - headerH
  }

  const startPage = (suite: boolean) => {
    const titleSize = 12
    drawBrandMark(page, left, pageHeight - 26 + (titleSize * 0.72) / 2, HEADER_MARK_SIZE)
    page.drawText(
      safeText(`Planning global · S${Number.isFinite(weekNumber) ? weekNumber : weekKey} — ${weekKey}${suite ? " (suite)" : ""}`),
      { x: left + HEADER_MARK_SIZE + 9, y: pageHeight - 26, size: titleSize, font: fontBold, color: INK },
    )
    // Légende
    let lx = pageWidth - left - 190
    page.drawRectangle({ x: lx, y: pageHeight - 28, width: 8, height: 8, color: tw([255, 228, 230]), borderColor: tw([253, 164, 175]), borderWidth: 0.6 })
    page.drawText("Férié", { x: lx + 11, y: pageHeight - 26.5, size: 7, font, color: TEXT_MUTED })
    lx += 40
    page.drawRectangle({ x: lx, y: pageHeight - 28, width: 8, height: 8, color: tw([254, 243, 199]), borderColor: tw([253, 230, 138]), borderWidth: 0.6 })
    page.drawText("Vacances scolaires (zone B)", { x: lx + 11, y: pageHeight - 26.5, size: 7, font, color: TEXT_MUTED })
    y = pageHeight - 40
    drawHeader()
  }

  startPage(false)

  const ensureSpace = (needed: number) => {
    if (y - needed >= bottomLimit) return
    page = doc.addPage([pageWidth, pageHeight])
    startPage(true)
  }

  const drawBadge = (text: string, x: number, baseY: number, size: number, fill: ReturnType<typeof rgb>, w: number) => {
    const h = Math.min(size + 3.2, rowH - 1)
    page.drawRectangle({ x, y: baseY + size * 0.36 - h / 2, width: w, height: h, color: fill })
    page.drawText(safeText(text), { x: x + 3, y: baseY, size, font: fontBold, color: PAPER })
  }

  for (const rowKey of rowKeys) {
    const band = sectionTitle(rowKey)
    ensureSpace(rowH + (band ? bandH : 0))

    if (band) {
      page.drawRectangle({ x: left, y: y - bandH, width: tableW, height: bandH, color: tw([226, 232, 240]) })
      page.drawText(safeText(band), { x: left + 6, y: y - 7.2, size: 6, font: fontBold, color: tw([71, 85, 105]) })
      y -= bandH
    }

    const rowData = schedule[rowKey] || generated[rowKey]
    const top = y
    const isNotes = rowKey === "Notes du jour"

    // Fond de ligne + libellé
    page.drawRectangle({ x: left, y: top - rowH, width: tableW, height: rowH, color: isNotes ? tw([254, 252, 232]) : rowFill(rowKey) })
    page.drawRectangle({ x: left, y: top - rowH, width: labelW, height: rowH, color: isNotes ? tw([254, 252, 232]) : PAPER })
    const label = isNotes ? "Notes" : rowKey.replace("Matin - ", "").replace("Apm - ", "").replace("Hors site - ", "")
    page.drawText(safeText(label).slice(0, 30), {
      x: left + 6,
      y: top - rowH + textBase(Math.min(7.5, rowH - 3.5)),
      size: Math.min(7.5, rowH - 3.5),
      font: fontBold,
      color: isNotes ? tw([161, 98, 7]) : tw([51, 65, 85]),
    })

    days.forEach((d, i) => {
      const x = left + labelW + i * colW
      const cell: CellData = rowData?.[d.day] ?? { value: [], type: "empty", status: "validated" }

      if (isNotes) {
        const note = cell.value?.[0]
        page.drawRectangle({ x: x + 2, y: top - rowH + 2, width: colW - 4, height: rowH - 4, color: tw([254, 249, 195]) })
        const txt = safeText(note || "+ Note").slice(0, 22)
        centered(txt, x + colW / 2, top - rowH + textBase(6.5), 6.5, font, tw([30, 41, 59]))
        return
      }

      const blocked = isBlocked(rowKey, d.day)
      const assignees = [...new Set(getCellDisplayAssignees(cell))]
      const pending = cell.status === "pending" || cell.request?.status === "pending"
      const proposal = isSolverProposalCell(rowKey, cell)
      const changeRequest = Boolean(pending && cell.request && !proposal)

      if (blocked) {
        page.drawRectangle({ x, y: top - rowH, width: colW, height: rowH, color: tw([0, 0, 0], 0.4) })
        return
      }
      if (d.holiday) page.drawRectangle({ x, y: top - rowH, width: colW, height: rowH, color: tw([255, 241, 242]) })
      else if (d.school) page.drawRectangle({ x, y: top - rowH, width: colW, height: rowH, color: tw([255, 251, 235]) })
      if (proposal) {
        page.drawRectangle({
          x: x + 0.5, y: top - rowH + 0.5, width: colW - 1, height: rowH - 1,
          color: tw([245, 243, 255], 0.9), borderColor: tw([167, 139, 250]), borderWidth: 0.9,
        })
      } else if (changeRequest) {
        page.drawRectangle({ x, y: top - rowH, width: colW, height: rowH, color: tw([255, 247, 237], 0.6) })
      }
      if (d.holiday) {
        page.drawRectangle({ x, y: top - rowH, width: 2.5, height: rowH, color: tw([253, 164, 175]) })
        page.drawRectangle({ x: x + colW - 2.5, y: top - rowH, width: 2.5, height: rowH, color: tw([253, 164, 175]) })
      }

      // Badges médecins (couleurs et libellés identiques à la grille)
      if (assignees.length) {
        const labels = assignees.map((doc) => {
          const listed = isListedDoctor(doc)
          return {
            text: listed ? formatDoctorWithDoublon(schedule, d.day, doc, rowKey) : doc,
            fill: listed ? badgeColor(doc) : tw(TW["amber-600"]),
          }
        })
        const avail = colW - 6
        let size = Math.min(7, rowH - 5)
        const widthAt = (sz: number) =>
          labels.reduce((acc, l) => acc + fontBold.widthOfTextAtSize(safeText(l.text), sz) + 6, 0) + (labels.length - 1) * 2
        while (size > 4.5 && widthAt(size) > avail) size -= 0.25
        let bx = x + (colW - Math.min(widthAt(size), avail)) / 2
        for (const l of labels) {
          const w = fontBold.widthOfTextAtSize(safeText(l.text), size) + 6
          drawBadge(l.text, bx, top - rowH + textBase(size), size, l.fill, w)
          bx += w + 2
        }
      }

      // Pastilles : créneau hors site (haut-gauche) et « Prop. » (haut-droite)
      if (isOffSiteRow(rowKey) && assignees.length) {
        const t = OFF_SITE_SLOT_BADGES[offSiteSlotOf(schedule, rowKey, d.day) || "day"]
        const w = fontBold.widthOfTextAtSize(t, 4.5) + 3
        page.drawRectangle({ x: x + 1, y: top - 6.5, width: w, height: 5.5, color: tw([2, 132, 199]) })
        page.drawText(t, { x: x + 2.5, y: top - 5, size: 4.5, font: fontBold, color: PAPER })
      }
      if (proposal) {
        const w = fontBold.widthOfTextAtSize("PROP.", 4.5) + 3
        page.drawRectangle({ x: x + colW - w - 1, y: top - 6.5, width: w, height: 5.5, color: tw([124, 58, 237]) })
        page.drawText("PROP.", { x: x + colW - w + 0.5, y: top - 5, size: 4.5, font: fontBold, color: PAPER })
      }
    })

    y = top - rowH

    // Quadrillage : séparateurs de lignes et de colonnes
    page.drawLine({ start: { x: left, y }, end: { x: left + tableW, y }, thickness: 0.4, color: RULE_ROW })
    for (let i = 0; i <= DAYS.length; i++) {
      const lx = left + labelW + i * colW
      page.drawLine({ start: { x: lx, y: top }, end: { x: lx, y }, thickness: 0.4, color: RULE_DAY })
    }
    page.drawLine({ start: { x: left, y: top }, end: { x: left, y }, thickness: 0.4, color: RULE_DAY })
  }

  return doc.save()
}
