/**
 * Classement visuel des lignes du planning pour les vues « Aujourd'hui » et « Semaine ».
 *
 * Code couleur (repris dans les deux vues) :
 * - moment de la journée : Journée (hors site, congés…), Matin, Après-midi, Nuit ;
 * - nature : garde / astreinte (rouge « cardio »), absence (gris), vacation (couleur du moment).
 */

export type PeriodKey = "jour" | "matin" | "apm" | "nuit"
export type TaskKind = "garde" | "astreinte" | "absence" | "vacation"

export const PERIODS: { key: PeriodKey; label: string; hours: string }[] = [
  { key: "jour", label: "Journée", hours: "Hors site, congés" },
  { key: "matin", label: "Matin", hours: "8 h – 13 h" },
  { key: "apm", label: "Après-midi", hours: "13 h – 18 h 30" },
  { key: "nuit", label: "Nuit", hours: "18 h 30 – 8 h" },
]

/** Teintes : `solid` pour les rails et pastilles, `soft` pour les fonds, `ink` pour le texte. */
export const PERIOD_COLORS: Record<PeriodKey, { solid: string; soft: string; ink: string }> = {
  jour: { solid: "#64748B", soft: "#F1F4F8", ink: "#334155" },
  matin: { solid: "#2F7FD8", soft: "#EAF3FD", ink: "#16457A" },
  apm: { solid: "#E09A1F", soft: "#FDF4E3", ink: "#7A4E05" },
  nuit: { solid: "#5B4BD6", soft: "#EFEDFC", ink: "#2F2380" },
}

export const PULSE = "#E23D4B"
export const INK = "#0F1E33"

export function periodOf(activity: string): PeriodKey {
  if (activity.includes("Nuit") || activity.includes("Soir")) return "nuit"
  if (activity.startsWith("Apm") || activity.includes("Midi") || activity.includes("Après-midi")) return "apm"
  if (activity.startsWith("Matin") || activity.includes("Matin")) return "matin"
  return "jour"
}

export function kindOf(activity: string): TaskKind {
  if (activity.startsWith("Garde")) return "garde"
  if (activity.startsWith("Astreinte")) return "astreinte"
  if (activity.startsWith("Congés") || activity.startsWith("Congrès") || activity.startsWith("1/2 journée off")) {
    return "absence"
  }
  return "vacation"
}

/** Libellé court : retire le préfixe de période, déjà porté par la couleur et la colonne. */
export function shortLabel(activity: string): string {
  return activity
    .replace(/^Matin - /, "")
    .replace(/^Apm - /, "")
    .replace(/^Hors site - /, "")
    .replace(/^Astreintes ATL /, "Astreinte ")
    .replace(/^1\/2 journée off .*/, "½ journée off")
}

/** Date du jour au format de `getWeekDates` (jj/mm/aa). */
export function todayKey(): string {
  return new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" })
}

/** Moment courant de la journée (pour le repère « maintenant »). */
export function currentPeriod(now = new Date()): PeriodKey {
  const m = now.getHours() * 60 + now.getMinutes()
  if (m >= 8 * 60 && m < 13 * 60) return "matin"
  if (m >= 13 * 60 && m < 18 * 60 + 30) return "apm"
  return "nuit"
}

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]

/** « 23/11/26 » → « 23 nov. » */
export function prettyDate(d: string): string {
  const [day, month] = d.split("/")
  const m = Number(month)
  return day && m ? `${Number(day)} ${MONTHS[m - 1]}` : d
}
