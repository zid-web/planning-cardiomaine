/**
 * Étiquettes d’affichage pour variantes déterministes d’activités génériques
 * (jour + médecin + ligne fixes). Pas de nouvelle activité côté solveur —
 * le front déduit le libellé à l’affichage.
 *
 * Si un créneau change (autre médecin / jour), mettre à jour SPECIAL_ACTIVITY_RULES.
 */

export type SpecialActivityTag = "ped" | "PM"

export type SpecialActivityRule = {
  rowKey: string
  day: string
  doctorId: string
  /** Suffixe court à côté de l’initiale : `S (ped)`, `A (PM)`. */
  tag: SpecialActivityTag
  /** Libellé explicite pour vues Aujourd’hui / Semaine. */
  displayName: string
}

export const SPECIAL_ACTIVITY_RULES: readonly SpecialActivityRule[] = [
  {
    rowKey: "Apm - ETT salle 1",
    day: "MERCREDI",
    doctorId: "S",
    tag: "ped",
    displayName: "ETT pédiatrique",
  },
  {
    rowKey: "Apm - Cs PSS",
    day: "MARDI",
    doctorId: "A",
    tag: "PM",
    displayName: "Contrôle PM",
  },
  {
    rowKey: "Apm - Cs PSS",
    day: "LUNDI",
    doctorId: "P",
    tag: "PM",
    displayName: "Contrôle PM",
  },
] as const

export function getSpecialLabel(
  rowKey: string,
  day: string,
  doctorId: string,
): SpecialActivityTag | null {
  for (const rule of SPECIAL_ACTIVITY_RULES) {
    if (rule.rowKey === rowKey && rule.day === day && rule.doctorId === doctorId) {
      return rule.tag
    }
  }
  return null
}

export function getSpecialActivityDisplayName(
  rowKey: string,
  day: string,
  doctorId: string,
): string | null {
  for (const rule of SPECIAL_ACTIVITY_RULES) {
    if (rule.rowKey === rowKey && rule.day === day && rule.doctorId === doctorId) {
      return rule.displayName
    }
  }
  return null
}

/** Premier libellé spécial trouvé pour un des médecins de la case, sinon null. */
export function getSpecialActivityDisplayNameForDoctors(
  rowKey: string,
  day: string,
  doctorIds: readonly string[],
): string | null {
  for (const doctorId of doctorIds) {
    const name = getSpecialActivityDisplayName(rowKey, day, doctorId)
    if (name) return name
  }
  return null
}

/**
 * Suffixe d’initiale : `S` → `S (ped)`, `A` → `A (PM)`.
 * Compose avec un éventuel exposant doublon déjà présent (`S² (ped)`).
 */
export function appendSpecialDoctorLabel(
  doctorLabel: string,
  rowKey: string,
  day: string,
  doctorId: string,
): string {
  const tag = getSpecialLabel(rowKey, day, doctorId)
  if (!tag) return doctorLabel
  return `${doctorLabel} (${tag})`
}

/** S mercredi apm : ETT ped peut coexister avec Garde Midi / ATL Midi. */
export function isEttPedWithGardeOrAtlMidi(rowA: string, rowB: string): boolean {
  const ett = "Apm - ETT salle 1"
  const companions = new Set(["Garde Midi", "Astreintes ATL Midi"])
  return (rowA === ett && companions.has(rowB)) || (rowB === ett && companions.has(rowA))
}
