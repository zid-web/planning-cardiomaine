/**
 * Créneau (matin / après-midi / journée) des vacations **hors site**.
 *
 * Jusqu'ici la demi-journée était figée dans une table statique : IRM lundi =
 * matin, CDL mardi = matin, Scinti lundi·mardi·mercredi = matin, tout le reste
 * « journée entière ». Un médecin en LFB le jeudi bloquait donc sa journée
 * complète alors qu'il n'y est peut-être que le matin.
 *
 * Le créneau est désormais **porté par la case** (`CellData.offSiteSlot`), donc
 * modifiable au cas par cas depuis la grille. La table statique ne sert plus
 * que de valeur par défaut quand la case ne dit rien — les plannings déjà
 * enregistrés gardent donc exactement le comportement qu'ils avaient.
 *
 * Conséquence directe : un médecin hors site le matin reste assignable
 * l'après-midi, et inversement (consigne utilisateur 26/08/2026).
 */

import type { CellData, OffSiteSlot, ScheduleData } from "@/lib/types"

export const OFF_SITE_ROW_PREFIX = "Hors site - "

/** Toutes les lignes hors site partagent ce préfixe. */
export function isOffSiteRow(rowKey: string): boolean {
  return rowKey.startsWith(OFF_SITE_ROW_PREFIX)
}

/**
 * Créneaux **par défaut** quand la case ne porte pas de choix explicite.
 * Conformes aux notes DOC022 (« Dr Cloitre lundi matin », « Dr Rousseau mardi
 * matin », IRM lundi matin / vendredi après-midi, CDL mardi matin).
 */
export const DEFAULT_OFF_SITE_SLOTS: Record<string, Record<string, OffSiteSlot>> = {
  "Hors site - IRM": { LUNDI: "matin", VENDREDI: "apm" },
  "Hors site - CDL": { MARDI: "matin" },
  "Hors site - Scinti": { LUNDI: "matin", MARDI: "matin", MERCREDI: "matin" },
}

export const OFF_SITE_SLOT_ORDER: readonly OffSiteSlot[] = ["matin", "apm", "day"]

export const OFF_SITE_SLOT_LABELS: Record<OffSiteSlot, string> = {
  matin: "Matin",
  apm: "Après-midi",
  day: "Journée",
}

/** Marqueur court affiché dans la case (M / AM / J). */
export const OFF_SITE_SLOT_BADGES: Record<OffSiteSlot, string> = {
  matin: "M",
  apm: "AM",
  day: "J",
}

/** Créneau par défaut d'une ligne hors site un jour donné. */
export function defaultOffSiteSlot(rowKey: string, day: string): OffSiteSlot {
  return DEFAULT_OFF_SITE_SLOTS[rowKey]?.[day] ?? "day"
}

/**
 * Créneau effectif d'une case hors site : choix explicite de la case, sinon
 * valeur par défaut. Renvoie null si la ligne n'est pas une ligne hors site.
 */
export function offSiteSlotOfCell(
  rowKey: string,
  day: string,
  cell?: CellData | null,
): OffSiteSlot | null {
  if (!isOffSiteRow(rowKey)) return null
  return cell?.offSiteSlot ?? defaultOffSiteSlot(rowKey, day)
}

/** Idem, à partir du planning complet. */
export function offSiteSlotOf(
  schedule: ScheduleData | undefined,
  rowKey: string,
  day: string,
): OffSiteSlot | null {
  return offSiteSlotOfCell(rowKey, day, schedule?.[rowKey]?.[day])
}

/**
 * Fixe le créneau d'une case hors site. Ne modifie pas l'objet reçu.
 * Passer `null` efface le choix explicite et rétablit la valeur par défaut.
 */
export function setOffSiteSlot(
  schedule: ScheduleData,
  rowKey: string,
  day: string,
  slot: OffSiteSlot | null,
): ScheduleData {
  const cell = schedule[rowKey]?.[day]
  if (!cell || !isOffSiteRow(rowKey)) return schedule
  const nextCell: CellData = { ...cell }
  if (slot === null) delete nextCell.offSiteSlot
  else nextCell.offSiteSlot = slot
  return {
    ...schedule,
    [rowKey]: { ...schedule[rowKey], [day]: nextCell },
  }
}
