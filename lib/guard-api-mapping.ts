import { DAYS, DOCTOR_METADATA, DOCTORS } from "@/lib/constants";
import { isListedDoctor } from "@/lib/doctor-code";
import { isDoublonEligibleRow } from "@/lib/slot-blocking";
import type { CellData, ScheduleData } from "@/lib/types";
import { buildWeekendComboSolverFields } from "@/lib/weekend-combo-solver";
import { getWeekNumber } from "@/lib/schedule-utils";
import { parseISO } from "date-fns";

const GARDE_ROW_KEYS = new Set(["Garde Matin", "Garde Midi", "Garde Nuit"]);

function isWeekendDayKey(day: string): boolean {
  return day === "SAMEDI" || day === "DIMANCHE";
}

/**
 * Fusionne les médecins solveur avec les remplaçants déjà présents.
 * Week-end garde : toujours conserver le remplaçant + médecins listés.
 * CH n’est jamais écrit sur une ligne Garde.
 */
function mergeCellDoctorsPreservingRemplacants(
  existing: CellData | undefined,
  incoming: string[],
  rowKey: string,
  dayKey: string,
): { value: string[]; remplacant?: string } {
  const cleanedIncoming = incoming.filter((d) => Boolean(d) && !(GARDE_ROW_KEYS.has(rowKey) && d === "CH"));
  const existingVals = existing?.value || [];
  const remField = existing?.remplacant?.trim();
  const remFromExisting = existingVals.filter((v) => Boolean(v) && !isListedDoctor(v));
  const remFromIncoming = cleanedIncoming.filter((v) => Boolean(v) && !isListedDoctor(v));
  const remplacants = Array.from(
    new Set([...remFromExisting, ...remFromIncoming, ...(remField ? [remField] : [])]),
  );
  const listed = cleanedIncoming.filter(isListedDoctor);

  if (GARDE_ROW_KEYS.has(rowKey) && isWeekendDayKey(dayKey) && remplacants.length > 0) {
    return {
      value: Array.from(new Set([...remplacants, ...listed])),
      remplacant: remField || remplacants[0],
    };
  }

  if (remplacants.length > 0 && GARDE_ROW_KEYS.has(rowKey)) {
    // Autres gardes : préserver le champ remplacant même si le solveur ne le renvoie pas
    return {
      value: Array.from(new Set([...listed, ...remplacants])),
      remplacant: remField || remplacants[0],
    };
  }

  // Cs : le solveur peut émettre 2× le même médecin (Z² / H²) — ne pas dédupliquer
  const value = isDoublonEligibleRow(rowKey)
    ? cleanedIncoming
    : Array.from(new Set(cleanedIncoming));
  return { value, remplacant: remField };
}

/** Mapping activités solveur Render → lignes du planning UI */
export const ACTIVITY_TO_ROW: Record<string, Record<string, string>> = {
  matin: {
    ASTREINTE: "Astreintes ATL Matin",
    GARDE: "Garde Matin",
    CORO: "Matin - Coro",
    RYTHMO: "Matin - Rythmo",
    NCT: "Hors site - NCT",
    PRE_OP: "Pré-op",
    VACANCES: "Congés",
    CONGE: "Congés",
    CONGRES: "Congrès",
    DEMI_JOURNEE_LIBRE: "1/2 journée off Matin",
  },
  am: {
    ASTREINTE: "Astreintes ATL Midi",
    GARDE: "Garde Midi",
    CORO: "Apm - Coro",
    RYTHMO: "Apm - Rythmo",
    REEDUC: "Apm - RÉEDUCATION",
    NCT: "Hors site - NCT",
    PRE_OP: "Pré-op",
    VACANCES: "Congés",
    CONGE: "Congés",
    CONGRES: "Congrès",
    DEMI_JOURNEE_LIBRE: "1/2 journée off Après-midi",
  },
  nuit: {
    ASTREINTE: "Astreintes ATL Nuit",
    GARDE: "Garde Nuit",
    NCT: "Hors site - NCT",
    PRE_OP: "Pré-op",
    VACANCES: "Congés",
    CONGE: "Congés",
    CONGRES: "Congrès",
  },
  weekend: {
    // Astreinte week-end = lignes ATL (CH / WOM), jamais Garde*
    ASTREINTE: "Astreintes ATL Matin",
    GARDE: "Garde Matin",
    NCT: "Hors site - NCT",
    VACANCES: "Congés",
    CONGE: "Congés",
    CONGRES: "Congrès",
  },
};

/**
 * Lignes que « Générer » peut proposer (équité / historique / hors site).
 * Structurel hors revue (Congés, ½-off, Rythmo fixe, NCT calendrier) :
 * injecté via `applyStructuralConstraints` en `validated`.
 */
export const GENERATOR_PROPOSAL_ROW_KEYS = new Set([
  "Astreintes ATL Matin",
  "Astreintes ATL Midi",
  "Astreintes ATL Nuit",
  "Garde Matin",
  "Garde Midi",
  "Garde Nuit",
  "Matin - Coro",
  "Apm - Coro",
  "Apm - RÉEDUCATION",
  "Pré-op",
  // Fidélité historique (HIST::{row_key} côté guard-api-cardiomaine)
  "Matin - Cs PSS",
  "Matin - Cs Tessée",
  "Matin - Stress",
  "Matin - ETT salle 1",
  "Matin - ETT salle 2",
  "Matin - EE1",
  "Matin - EE2",
  "Apm - Cs PSS",
  "Apm - Cs Tessée",
  "Apm - Stress",
  "Apm - ETT salle 1",
  "Apm - ETT salle 2",
  "Apm - EE1",
  "Apm - EE2",
  "Entrées PSS",
  // Hors site solveur (HORSSITE::{row_key}) — revue admin ; NCT reste calendrier
  "Hors site - CDL",
  "Hors site - IRM",
  "Hors site - Scinti",
  "Hors site - LFB",
  "Hors site - PSSL",
]);

/** @deprecated alias — préférer GENERATOR_PROPOSAL_ROW_KEYS */
export const GENERATOR_OWNED_ROW_KEYS = GENERATOR_PROPOSAL_ROW_KEYS;

/**
 * Proposition « Générer » (solveur) à valider — distincte d’une saisie manuelle
 * (`validated`) et d’une demande de changement (`pending` + `request`).
 */
export function isSolverProposalCell(
  rowKey: string,
  cell: { status?: string; request?: unknown; value?: string[] } | null | undefined,
): boolean {
  if (!cell || cell.status !== "pending") return false
  if (cell.request) return false
  if (!Array.isArray(cell.value) || cell.value.length === 0) return false
  return GENERATOR_PROPOSAL_ROW_KEYS.has(rowKey)
}

/** Nombre de cellules « Prop. » (pending solveur) dans une semaine. */
export function countSolverProposalCells(schedule: ScheduleData | null | undefined): number {
  if (!schedule) return 0
  let n = 0
  for (const [rowKey, row] of Object.entries(schedule)) {
    if (!GENERATOR_PROPOSAL_ROW_KEYS.has(rowKey) || !row) continue
    for (const day of DAYS) {
      if (isSolverProposalCell(rowKey, row[day])) n++
    }
  }
  return n
}

/** Suffixes émis par le solveur pour HIST:: / HORSSITE:: (après split ` - `). */
const HORS_SITE_ACTIVITY_TO_ROW: Record<string, string> = {
  IRM: "Hors site - IRM",
  CDL: "Hors site - CDL",
  SCINTI: "Hors site - Scinti",
  LFB: "Hors site - LFB",
  PSSL: "Hors site - PSSL",
  NCT: "Hors site - NCT",
}

export type GuardAssignment = {
  date: string;
  day_name: string;
  slot: string;
  activity: string;
  doctor: string;
  note?: string | null;
};

export type ParsedVoiceCommand = {
  date: string;
  slot: string;
  activity: string;
  doctor_out?: string | null;
  doctor_in?: string | null;
  confidence?: string;
};

export type GuardMedecin = {
  id: string;
  statut: string;
  points_astreinte?: number;
  points_garde?: number;
  points_nct?: number;
  points_weekend?: number;
  points_coro?: number;
  /** Groupe 1 — vacations Cs / ETT / Stress (6 mois). */
  points_cs?: number;
  points_ett?: number;
  points_stress?: number;
};

/** Slot historique pour le solveur (`historical_patterns`). */
export type HistoricalPatternSlotPayload = {
  eligible_doctors: string[];
  frequency: Record<string, number>;
};

export type HistoricalPatternsRequestPayload = Record<
  string,
  Record<string, HistoricalPatternSlotPayload>
>;

export type GenerateWeekRequestPayload = {
  week_start_date: string;
  week_type: number;
  medecins: GuardMedecin[];
  vacations?: Array<{ doctor_id: string; start_date: string; end_date: string }>;
  congres?: Array<{ doctor_id: string; start_date: string; end_date: string }>;
  weekend_mode?: "CH" | "ROTATION";
  last_nct_doctor?: string | null;
  previous_sunday_guard_doctor?: string | null;
  /** Semaine de VISITE (A/B/U) — optionnel, rétrocompatible. */
  visite_doctor?: string | null;
  /** LFB jeudi (H/S/G) — optionnel. */
  lfb_doctor?: string | null;
  /** B fait PSSL ce jeudi. */
  pssl_b_active?: boolean;
  /** Z fait PSSL ce mardi. */
  pssl_z_active?: boolean;
  /**
   * Week-end combo M/O/W — uniquement semaines calendrier (5 / semestre).
   * Absent / false = pas de garde week-end générée par le solveur.
   */
  weekend_astreinte_combo?: boolean;
  /** Préférence rôle ATL (Ven+Sat) — souple si absent. */
  weekend_combo_astreinte_anchor?: string;
  /** Préférence rôle Garde Sam — souple si absent. */
  weekend_combo_garde_anchor?: string;
  /** Qui a fait le rôle Garde au dernier combo (espacement 15 j.). */
  last_combo_garde_doctor?: string;
  /** Samedi ISO du dernier combo. */
  last_combo_garde_date?: string;
  existing_schedule?: Record<string, string[]> | null;
  /**
   * Fréquences / éligibilité déduites de l’historique (Cs/ETT/EE/hors site…).
   * Le solveur OR-Tools consomme ce champ ; le front ne remplit plus ces cases après coup.
   */
  historical_patterns?: HistoricalPatternsRequestPayload;
  /** Surcharge partielle de rules_config (DOC022 / consignes groupe). */
  rules_override?: Record<string, unknown>;
  /**
   * Suspensions d’activité (NCT / PSSL / LFB / CDL) sur une période —
   * bloque tout le monde (comme room_maintenance pour Coro).
   */
  activity_maintenance?: Array<{
    start_date: string;
    end_date: string;
    activities: string[];
    reason?: string;
  }>;
};

/** Monday (ISO YYYY-MM-DD) for the week containing `date`. */
export function getIsoWeekStartDate(date: Date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Local calendar date as YYYY-MM-DD (avoids UTC shift from toISOString). */
export function toIsoDateLocal(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function dayNameFromIsoDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  // JS: 0=Sunday … map to French planning days
  const map = ["DIMANCHE", "LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI"];
  return map[date.getDay()] || "LUNDI";
}

export function getSolverStatus(doctorId: string): string {
  const meta = DOCTOR_METADATA[doctorId];
  if (!meta) return "permanent";
  if (doctorId === "M" || doctorId === "O" || doctorId === "W") return "astreinte_coro";
  if (doctorId === "FV") return "fv";
  if (doctorId === "DAAS" || doctorId === "D") return "daas";
  if (doctorId === "CH") return "ch";
  if (meta.status === "admin") return "admin";
  return "permanent";
}

export function buildMedecinsPayload(doctorIds: string[] = DOCTORS): GuardMedecin[] {
  return doctorIds.map((id) => ({
    id,
    statut: getSolverStatus(id),
    points_astreinte: 0,
    points_garde: 0,
    points_nct: 0,
    points_weekend: 0,
    points_coro: 0,
    points_cs: 0,
    points_ett: 0,
    points_stress: 0,
  }));
}

/** Best-effort ScheduleData → existing_schedule for Render (`row||DAY` → doctors[]). */
export function scheduleToExistingSchedule(schedule: ScheduleData): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [rowKey, row] of Object.entries(schedule || {})) {
    for (const day of DAYS) {
      const cell = row?.[day];
      const value = cell?.value;
      if (Array.isArray(value) && value.length > 0) {
        // Render PDF mapper uses `row||DAY` (double pipe)
        out[`${rowKey}||${day}`] = [...value];
      }
    }
  }
  return out;
}

export function resolveRowKey(slot: string, activity: string, dayKey: string): string | null {
  const rawAct = (activity || "").trim();
  const act = rawAct.toUpperCase();
  const sl = (slot || "").toLowerCase().trim();

  // Activités « journée entière » (indépendantes du créneau renvoyé par le solveur / Claude)
  if (act === "NCT") return "Hors site - NCT";
  // Vacances + Congé → une seule ligne UI « Congés »
  if (act === "VACANCES" || act === "CONGE" || act === "CONGES") return "Congés";
  if (act === "CONGRES") return "Congrès";
  if (act === "PRE_OP" || act === "PREOP") return "Pré-op";

  // Hors site : le solveur émet activity = suffixe ("IRM", "CDL"…) avec note hors site
  const horsSite = HORS_SITE_ACTIVITY_TO_ROW[act];
  if (horsSite) return horsSite;
  if (act === "ENTRÉES PSS" || act === "ENTREES PSS") return "Entrées PSS";

  // Historique clinique : activity = suffixe de row_key ("Cs PSS", "ETT salle 1", "EE1", "Stress")
  // reconstruite avec le slot matin/am → "Matin - …" / "Apm - …"
  if (sl === "matin" || sl === "am") {
    const prefix = sl === "matin" ? "Matin" : "Apm";
    // Défensif : activity déjà égale à une row_key complète
    if (GENERATOR_PROPOSAL_ROW_KEYS.has(rawAct)) return rawAct;
    const candidate = `${prefix} - ${rawAct}`;
    if (GENERATOR_PROPOSAL_ROW_KEYS.has(candidate)) return candidate;
  } else if (GENERATOR_PROPOSAL_ROW_KEYS.has(rawAct)) {
    return rawAct;
  }

  // Weekend : ASTREINTE → ATL Matin ; GARDE → Garde Matin
  if (sl === "weekend") {
    if (dayKey === "SAMEDI" || dayKey === "DIMANCHE") {
      if (act === "ASTREINTE") return "Astreintes ATL Matin"
      if (act === "GARDE") return "Garde Matin"
    }
  }
  const mapping = ACTIVITY_TO_ROW[sl];
  if (mapping && mapping[act]) return mapping[act];
  return null;
}

function setCellDoctors(
  schedule: ScheduleData,
  rowKey: string,
  dayKey: string,
  doctors: string[],
  opts?: { forceStatus?: "pending" | "validated" },
): ScheduleData {
  if (!schedule[rowKey]?.[dayKey]) return schedule;
  const cell = schedule[rowKey][dayKey];
  const merged = mergeCellDoctorsPreservingRemplacants(cell, doctors, rowKey, dayKey);
  return {
    ...schedule,
    [rowKey]: {
      ...schedule[rowKey],
      [dayKey]: {
        ...cell,
        value: merged.value,
        remplacant: merged.remplacant,
        type: merged.value.length ? "doctor" : "empty",
        status: opts?.forceStatus || cell.status || "pending",
      } as CellData,
    },
  };
}

/**
 * Applique une commande vocale parsée (remplacement chirurgical) sur le planning UI.
 * Crée la cellule si la ligne existe sans case pour ce jour (évite no-op silencieux).
 */
export function applyParsedCommandToSchedule(
  schedule: ScheduleData,
  parsed: ParsedVoiceCommand,
): ScheduleData {
  const dayKey = dayNameFromIsoDate(parsed.date).toUpperCase();
  if (!DAYS.includes(dayKey)) return schedule;

  const rowKey = resolveRowKey(parsed.slot, parsed.activity, dayKey);
  if (!rowKey) return schedule;

  const existingRow = schedule[rowKey] || {};
  const cell: CellData = existingRow[dayKey] || {
    value: [],
    type: "empty",
    status: "validated",
  };
  let value = [...(cell.value || [])];
  if (parsed.doctor_out) {
    value = value.filter((d) => d !== parsed.doctor_out);
  }
  if (parsed.doctor_in && !value.includes(parsed.doctor_in)) {
    value = [...value, parsed.doctor_in];
  }
  const unique = Array.from(new Set(value.filter(Boolean)));
  return {
    ...schedule,
    [rowKey]: {
      ...existingRow,
      [dayKey]: {
        ...cell,
        value: unique,
        type: unique.length ? "doctor" : "empty",
        status: "validated",
      },
    },
  };
}

/**
 * Fusionne les assignments Render dans le planning (ne touche que les cellules mappées).
 * Par défaut force `pending` (propositions Générer à valider par un admin).
 */
export function mergeAssignmentsIntoSchedule(
  schedule: ScheduleData,
  assignments: GuardAssignment[],
  opts?: { forcePending?: boolean; proposalRowsOnly?: boolean },
): ScheduleData {
  const forcePending = opts?.forcePending !== false;
  const proposalRowsOnly = opts?.proposalRowsOnly !== false;
  let next = schedule;
  const grouped = new Map<string, string[]>();

  for (const assign of assignments || []) {
    const dayKey = (assign.day_name || "").toUpperCase();
    if (!DAYS.includes(dayKey)) continue;
    const rowKey = resolveRowKey(assign.slot, assign.activity, dayKey);
    if (!rowKey) continue;
    // Congés / ½-off / NCT / Rythmo structurels : ignorés ici (injecteur structurel)
    if (proposalRowsOnly && !GENERATOR_PROPOSAL_ROW_KEYS.has(rowKey)) continue;
    // Notes dérivées solveur (récupération, etc.) hors propositions
    const note = (assign.note || "").toLowerCase();
    if (note.includes("demi-journée libre") || note.includes("règle fixe")) continue;
    if (note.includes("saisie vacances") || note.includes("congé")) continue;
    const key = `${rowKey}||${dayKey}`;
    const list = grouped.get(key) || [];
    if (assign.doctor) {
      // Même médecin 2× dans une case Cs (note « doublon ») : conserver les deux occurrences
      if (isDoublonEligibleRow(rowKey) || !list.includes(assign.doctor)) {
        list.push(assign.doctor);
      }
    }
    grouped.set(key, list);
  }

  for (const [key, doctors] of grouped) {
    const [rowKey, dayKey] = key.split("||");
    next = setCellDoctors(next, rowKey, dayKey, doctors, {
      forceStatus: forcePending ? "pending" : undefined,
    });
  }
  return next;
}

/**
 * Après « Générer » : fusionne les **propositions** (pending) sur les lignes
 * d’équité + historique clinique + hors site solveur.
 * Une case **validée** avec médecin listé (saisie manuelle / déjà validée)
 * n’est **jamais** écrasée. Remplaçant seul → le solveur peut encore proposer.
 * Préserve le reste (contraintes structurelles NCT/Rythmo, Notes, hors périmètre).
 */
export function mergeSolverWeekIntoExisting(
  existing: ScheduleData | undefined,
  generated: ScheduleData,
): ScheduleData {
  const base: ScheduleData = existing && Object.keys(existing).length > 0 ? { ...existing } : {};
  const next: ScheduleData = { ...base };

  for (const [rowKey, generatedRow] of Object.entries(generated || {})) {
    if (!generatedRow) continue;

    if (rowKey === "Notes du jour") {
      next[rowKey] = base[rowKey] || generatedRow;
      continue;
    }

    if (GENERATOR_PROPOSAL_ROW_KEYS.has(rowKey)) {
      const existingRow = base[rowKey] || {};
      const mergedRow: ScheduleData[string] = { ...existingRow };
      for (const day of DAYS) {
        const genCell = generatedRow[day];
        if (!genCell) continue;
        const genVals = Array.isArray(genCell.value) ? genCell.value : [];
        if (!genVals.length) continue;
        const existingCell = existingRow[day];
        const existingVals = Array.isArray(existingCell?.value) ? existingCell.value : [];
        const existingListed = existingVals.filter((d) => Boolean(d) && isListedDoctor(d));
        // Saisie manuelle / validée (médecin listé) prime sur les propositions Générer
        if (existingCell?.status === "validated" && existingListed.length > 0) {
          continue;
        }
        // Demande de changement en cours : ne pas écraser
        if (existingCell?.request && existingListed.length > 0) {
          continue;
        }
        const merged = mergeCellDoctorsPreservingRemplacants(
          existingCell,
          genVals,
          rowKey,
          day,
        );
        // Proposition solveur / pattern : pending (admin valide ensuite)
        mergedRow[day] = {
          ...(existingCell || {}),
          ...genCell,
          value: merged.value,
          remplacant: merged.remplacant,
          type: "doctor",
          status: genCell.status === "validated" ? "validated" : "pending",
        };
      }
      next[rowKey] = mergedRow;
      continue;
    }

    // Vacations cliniques / hors site structurels : ne remplir que cellules vides
    const existingRow = base[rowKey] || {};
    const mergedRow: ScheduleData[string] = { ...existingRow };
    for (const day of DAYS) {
      const existingCell = existingRow[day];
      const hasExisting =
        Array.isArray(existingCell?.value) && existingCell.value.length > 0;
      if (!hasExisting && generatedRow[day]) {
        const gen = generatedRow[day];
        mergedRow[day] = {
          ...gen,
          status: gen.status === "validated" ? "validated" : "pending",
        };
      }
    }
    next[rowKey] = mergedRow;
  }

  return next;
}

type PdfExtractedRow = {
  row_label?: string;
  matched_row_key?: string | null;
  cells?: Array<{ day_name: string; doctors: string[] }>;
};

/**
 * Applique l'extraction PDF (raw_extraction.rows) sur le planning UI.
 */
function normalizeImportedRowKey(rowKey: string): string {
  if (rowKey === "Vacances" || rowKey === "Congé" || rowKey === "Conge") return "Congés";
  return rowKey;
}

export function applyPdfExtractionToSchedule(
  schedule: ScheduleData,
  rows: PdfExtractedRow[] | undefined,
): ScheduleData {
  if (!rows?.length) return schedule;
  let next = schedule;
  for (const row of rows) {
    const rawKey = row.matched_row_key || row.row_label;
    if (!rawKey) continue;
    const rowKey = normalizeImportedRowKey(rawKey);
    if (!next[rowKey]) continue;
    for (const cell of row.cells || []) {
      const dayKey = (cell.day_name || "").toUpperCase();
      if (!DAYS.includes(dayKey)) continue;
      next = setCellDoctors(next, rowKey, dayKey, cell.doctors || []);
    }
  }
  return next;
}

/**
 * Applique mapped_existing_schedule si les clés sont au format `row||DAY`
 * (fallback: `row|DAY`, `row::DAY`, `row__DAY`).
 */
export function applyMappedExistingSchedule(
  schedule: ScheduleData,
  mapped: Record<string, string[]> | undefined,
): ScheduleData {
  if (!mapped || typeof mapped !== "object") return schedule;
  let next = schedule;
  let applied = 0;
  for (const [key, doctors] of Object.entries(mapped)) {
    let rowKey = "";
    let dayKey = "";
    if (key.includes("||")) {
      const idx = key.lastIndexOf("||");
      rowKey = key.slice(0, idx);
      dayKey = key.slice(idx + 2).toUpperCase();
    } else {
      const sep = key.includes("|") ? "|" : key.includes("::") ? "::" : key.includes("__") ? "__" : null;
      if (!sep) continue;
      const idx = key.lastIndexOf(sep);
      rowKey = key.slice(0, idx);
      dayKey = key.slice(idx + sep.length).toUpperCase();
    }
    const normalizedRowKey = normalizeImportedRowKey(rowKey);
    if (!DAYS.includes(dayKey) || !next[normalizedRowKey]) continue;
    next = setCellDoctors(next, normalizedRowKey, dayKey, doctors || []);
    applied += 1;
  }
  return applied > 0 ? next : schedule;
}

export function buildCurrentWeekRequestPayload(opts: {
  weekStartDate: string;
  weekNumber: number;
  vacations?: Array<{ doctor_id: string; start_date: string; end_date: string }>;
  schedule?: ScheduleData;
  weekendMode?: "CH" | "ROTATION";
  visite_doctor?: string | null;
  lfb_doctor?: string | null;
  pssl_b_active?: boolean;
  pssl_z_active?: boolean;
  /** Week key ISO (YYYY-Www) — pour champs combo si fourni. */
  weekKey?: string;
  lastComboGardeDoctor?: string | null;
  lastComboGardeDate?: string | null;
}): GenerateWeekRequestPayload {
  const fromStart = getWeekNumber(parseISO(opts.weekStartDate));
  const weekKey =
    opts.weekKey ||
    `${fromStart.year}-W${String(fromStart.week).padStart(2, "0")}`;

  const combo = buildWeekendComboSolverFields(weekKey, {
    doctor: opts.lastComboGardeDoctor ?? null,
    date: opts.lastComboGardeDate ?? null,
  });

  return {
    week_start_date: opts.weekStartDate,
    week_type: opts.weekNumber % 2 === 0 ? 2 : 1,
    medecins: buildMedecinsPayload(),
    vacations: opts.vacations || [],
    weekend_mode: opts.weekendMode || "ROTATION",
    existing_schedule: opts.schedule ? scheduleToExistingSchedule(opts.schedule) : {},
    ...(combo ?? {}),
    ...(opts.visite_doctor != null && opts.visite_doctor !== ""
      ? { visite_doctor: opts.visite_doctor }
      : {}),
    ...(opts.lfb_doctor != null && opts.lfb_doctor !== ""
      ? { lfb_doctor: opts.lfb_doctor }
      : {}),
    ...(typeof opts.pssl_b_active === "boolean"
      ? { pssl_b_active: opts.pssl_b_active }
      : {}),
    ...(typeof opts.pssl_z_active === "boolean"
      ? { pssl_z_active: opts.pssl_z_active }
      : {}),
  };
}
