import { DAYS, DOCTOR_METADATA, DOCTORS } from "@/lib/constants";
import type { CellData, ScheduleData } from "@/lib/types";

/** Mapping activités solveur Render → lignes du planning UI */
export const ACTIVITY_TO_ROW: Record<string, Record<string, string>> = {
  matin: {
    ASTREINTE: "Astreintes ATL Matin",
    GARDE: "Garde Matin",
    CORO: "Matin - Coro",
    DEMI_JOURNEE_LIBRE: "1/2 journée off Matin",
  },
  am: {
    ASTREINTE: "Astreintes ATL Midi",
    GARDE: "Garde Midi",
    CORO: "Apm - Coro",
    REEDUC: "Apm - RÉEDUCATION",
    DEMI_JOURNEE_LIBRE: "1/2 journée off Après-midi",
  },
  nuit: {
    ASTREINTE: "Astreintes ATL Nuit",
    GARDE: "Garde Nuit",
    NCT: "Hors site - NCT",
  },
  weekend: {
    ASTREINTE: "Garde Matin",
    GARDE: "Garde Matin",
  },
};

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
  doctor_in: string;
  confidence?: string;
};

export type GuardMedecin = {
  id: string;
  statut: string;
  points_astreinte?: number;
  points_garde?: number;
  points_nct?: number;
  points_weekend?: number;
};

export type GenerateWeekRequestPayload = {
  week_start_date: string;
  week_type: number;
  medecins: GuardMedecin[];
  vacations?: Array<{ doctor_id: string; start_date: string; end_date: string }>;
  congres?: Array<{ doctor_id: string; start_date: string; end_date: string }>;
  weekend_mode?: "CH" | "ROTATION";
  last_nct_doctor?: string | null;
  existing_schedule?: Record<string, string[]> | null;
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

function resolveRowKey(slot: string, activity: string, dayKey: string): string | null {
  if (slot === "weekend") {
    if (dayKey === "SAMEDI" || dayKey === "DIMANCHE") return "Garde Matin";
  }
  const mapping = ACTIVITY_TO_ROW[slot];
  if (mapping && mapping[activity]) return mapping[activity];
  return null;
}

function setCellDoctors(
  schedule: ScheduleData,
  rowKey: string,
  dayKey: string,
  doctors: string[],
): ScheduleData {
  if (!schedule[rowKey]?.[dayKey]) return schedule;
  const cell = schedule[rowKey][dayKey];
  const unique = Array.from(new Set(doctors.filter(Boolean)));
  return {
    ...schedule,
    [rowKey]: {
      ...schedule[rowKey],
      [dayKey]: {
        ...cell,
        value: unique,
        type: unique.length ? "doctor" : "empty",
        status: cell.status || "pending",
      } as CellData,
    },
  };
}

/**
 * Applique une commande vocale parsée (remplacement chirurgical) sur le planning UI.
 */
export function applyParsedCommandToSchedule(
  schedule: ScheduleData,
  parsed: ParsedVoiceCommand,
): ScheduleData {
  const dayKey = dayNameFromIsoDate(parsed.date).toUpperCase();
  if (!DAYS.includes(dayKey)) return schedule;

  const rowKey = resolveRowKey(parsed.slot, parsed.activity, dayKey);
  if (!rowKey || !schedule[rowKey]?.[dayKey]) return schedule;

  const cell = schedule[rowKey][dayKey];
  let value = [...(cell.value || [])];
  if (parsed.doctor_out) {
    value = value.filter((d) => d !== parsed.doctor_out);
  }
  if (parsed.doctor_in && !value.includes(parsed.doctor_in)) {
    value = [...value, parsed.doctor_in];
  }
  return setCellDoctors(schedule, rowKey, dayKey, value);
}

/**
 * Fusionne les assignments Render dans le planning (ne touche que les cellules mappées).
 */
export function mergeAssignmentsIntoSchedule(
  schedule: ScheduleData,
  assignments: GuardAssignment[],
): ScheduleData {
  let next = schedule;
  const grouped = new Map<string, string[]>();

  for (const assign of assignments || []) {
    const dayKey = (assign.day_name || "").toUpperCase();
    if (!DAYS.includes(dayKey)) continue;
    const rowKey = resolveRowKey(assign.slot, assign.activity, dayKey);
    if (!rowKey) continue;
    const key = `${rowKey}||${dayKey}`;
    const list = grouped.get(key) || [];
    if (assign.doctor && !list.includes(assign.doctor)) list.push(assign.doctor);
    grouped.set(key, list);
  }

  for (const [key, doctors] of grouped) {
    const [rowKey, dayKey] = key.split("||");
    next = setCellDoctors(next, rowKey, dayKey, doctors);
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
export function applyPdfExtractionToSchedule(
  schedule: ScheduleData,
  rows: PdfExtractedRow[] | undefined,
): ScheduleData {
  if (!rows?.length) return schedule;
  let next = schedule;
  for (const row of rows) {
    const rowKey = row.matched_row_key || row.row_label;
    if (!rowKey || !next[rowKey]) continue;
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
    if (!DAYS.includes(dayKey) || !next[rowKey]) continue;
    next = setCellDoctors(next, rowKey, dayKey, doctors || []);
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
}): GenerateWeekRequestPayload {
  return {
    week_start_date: opts.weekStartDate,
    week_type: opts.weekNumber % 2 === 0 ? 2 : 1,
    medecins: buildMedecinsPayload(),
    vacations: opts.vacations || [],
    weekend_mode: opts.weekendMode || "ROTATION",
    existing_schedule: opts.schedule ? scheduleToExistingSchedule(opts.schedule) : {},
  };
}
