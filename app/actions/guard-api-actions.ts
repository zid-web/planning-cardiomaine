"use server";

import { parseISO, subDays } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { DoctorVacation, ScheduleData } from "@/lib/types";
import { generateWeekSchedule, getWeekNumber } from "@/lib/schedule-utils";
import {
  accumulateEquityFromSchedules,
  getCumulativeEquityFromTable,
  type EquityCounts,
} from "@/lib/equity-tracking";
import { applyStructuralConstraints } from "@/lib/apply-structural-constraints";
import { mergeAssignmentsIntoSchedule, type GuardAssignment } from "@/lib/guard-api-mapping";
import { fillClinicalVacationsFromPatterns } from "@/lib/pattern-analysis";

// Configuration
const GUARD_API_URL =
  process.env.GUARD_API_BASE_URL ||
  process.env.GUARD_API_URL ||
  "https://guard-api-cardiomaine.onrender.com";
const GUARD_API_KEY = process.env.GUARD_API_KEY;

// Types pour les médecins
interface Doctor {
  id: string;
  nom: string;
  statut: "permanent" | "astreinte_coro" | "fv" | "daas" | "d" | "ch" | "admin";
  points_astreinte: number;
  points_garde: number;
  points_nct: number;
  points_weekend: number;
}

interface EquityPoints {
  astreinte: Record<string, number>;
  garde: Record<string, number>;
  nct: Record<string, number>;
  weekend: Record<string, number>;
}

function equityCountsToPoints(counts: Record<string, EquityCounts>): EquityPoints {
  const points: EquityPoints = { astreinte: {}, garde: {}, nct: {}, weekend: {} };
  for (const [doc, c] of Object.entries(counts)) {
    points.astreinte[doc] = c.astreinte_count;
    points.garde[doc] = c.garde_count;
    points.nct[doc] = c.nct_count;
    points.weekend[doc] = c.weekend_count;
  }
  return points;
}

/**
 * Récupère la liste des médecins depuis Supabase
 */
async function getDoctorsFromSupabase(): Promise<Doctor[]> {
  const supabase = await createClient();
  
  // Récupère tous les médecins actifs
  const { data: doctors, error } = await supabase
    .from("doctors")
    .select("id, nom, statut")
    .eq("actif", true);

  if (error) {
    console.error("Erreur lors de la récupération des médecins :", error);
    return [];
  }

  // Récupère les points d'équité historiques pour chaque médecin
  const equityPoints = await calculateEquityPoints();

  return doctors.map((doc) => ({
    id: doc.id,
    nom: doc.nom,
    statut: doc.statut || "permanent",
    points_astreinte: equityPoints.astreinte[doc.id] || 0,
    points_garde: equityPoints.garde[doc.id] || 0,
    points_nct: equityPoints.nct[doc.id] || 0,
    points_weekend: equityPoints.weekend[doc.id] || 0,
  }));
}

/**
 * Calcule les points d'équité historiques pour chaque médecin.
 *
 * IMPORTANT : le vrai CellData est `{ value: string[], status, type? }` —
 * l'activité est la **clé de ligne** (`Astreintes ATL Nuit`, `Garde Matin`, …),
 * pas `cell.doctor` / `cell.activity` (champs inexistants → équité toujours 0).
 */
async function calculateEquityPoints(): Promise<EquityPoints> {
  const fromTable = await getCumulativeEquityFromTable();
  if (fromTable && Object.keys(fromTable).length > 0) {
    return equityCountsToPoints(fromTable);
  }

  const supabase = await createClient();

  // Repli : scan de l'historique JSON (exclut le blob full_schedule)
  const { data: schedules, error } = await supabase
    .from("schedules")
    .select("week_key, schedule_data")
    .neq("week_key", "full_schedule")
    .order("week_key", { ascending: false })
    .limit(52);

  if (error || !schedules || schedules.length === 0) {
    if (error) {
      console.warn("[guard-api] Lecture schedules pour équité:", error.message);
    }
    return { astreinte: {}, garde: {}, nct: {}, weekend: {} };
  }

  const counts = accumulateEquityFromSchedules(
    schedules.map((s) => ({
      week_key: s.week_key as string,
      schedule_data: s.schedule_data as ScheduleData,
    })),
  );

  const nonZero = Object.values(counts).some(
    (c) => c.astreinte_count + c.garde_count + c.nct_count + c.weekend_count > 0,
  );
  if (!nonZero) {
    console.warn(
      "[guard-api] Équité historique à 0 après scan CellData.value — vérifier les plannings en base.",
    );
  }

  return equityCountsToPoints(counts);
}

/**
 * Retrouve le médecin ayant fait la garde OU l'astreinte de nuit dimanche dernier
 * (semaine précédant immédiatement weekStartISO), pour appliquer la règle
 * "garde de nuit dimanche -> 1/2 journée off lundi".
 * CH (structure externe) est exclu.
 */
async function getLastSundayGuardDoctor(weekStartISO: string): Promise<string | null> {
  const supabase = await createClient();

  const previousMonday = subDays(parseISO(weekStartISO), 7);
  const wn = getWeekNumber(previousMonday);
  const previousWeekKey = `${wn.year}-W${String(wn.week).padStart(2, "0")}`;

  const { data: row, error } = await supabase
    .from("schedules")
    .select("schedule_data")
    .eq("week_key", previousWeekKey)
    .single();

  if (error || !row) return null;

  const scheduleData = row.schedule_data as ScheduleData;
  const nightRows = ["Astreintes ATL Nuit", "Garde Nuit"];

  for (const rowKey of nightRows) {
    const cell = scheduleData?.[rowKey]?.["DIMANCHE"];
    const doctors = (cell as { value?: string[] } | undefined)?.value || [];
    const realDoctor = doctors.find((d) => d !== "CH");
    if (realDoctor) return realDoctor;
  }

  return null;
}

/**
 * Génère le planning via l'API Render
 */
export async function generateGuardsViaAPI(
  weekStartDate: string,
  vacations: DoctorVacation[],
  weekendMode: "ROTATION" | "CH" = "ROTATION",
  weekType: 1 | 2 = 1
) {
  try {
    // 1. Récupère la liste des médecins depuis Supabase
    const doctors = await getDoctorsFromSupabase();

    if (doctors.length === 0) {
      return {
        success: false,
        error: "Aucun médecin trouvé dans la base de données.",
      };
    }

    // 2. Récupère le dernier médecin NCT (depuis la base ou une variable)
    const lastNctDoctor = await getLastNctDoctor();

    // 3. Récupère les congés + médecin de garde dimanche précédent
    const [congres, previousSundayGuardDoctor] = await Promise.all([
      getCongres(),
      getLastSundayGuardDoctor(weekStartDate),
    ]);

    // 4. Construit le payload pour Render
    const payload = {
      week_start_date: weekStartDate,
      week_type: weekType,
      weekend_mode: weekendMode,
      last_nct_doctor: lastNctDoctor || doctors[0]?.id || "M",
      previous_sunday_guard_doctor: previousSundayGuardDoctor,
      vacations: vacations.map((v) => ({
        doctor_id: v.doctor_id,
        start_date: v.start_date,
        end_date: v.end_date,
        reason: v.reason || "congé",
      })),
      congres: congres.map((c) => ({
        doctor_id: c.doctor_id,
        start_date: c.start_date,
        end_date: c.end_date,
        type: c.type || "congrès",
      })),
      medecins: doctors.map((doc) => ({
        id: doc.id,
        statut: doc.statut,
        points_astreinte: doc.points_astreinte,
        points_garde: doc.points_garde,
        points_nct: doc.points_nct,
        points_weekend: doc.points_weekend,
      })),
    };


    // 5. Appel à l'API Render
    const response = await fetch(`${GUARD_API_URL}/generate-week`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(GUARD_API_KEY ? { "X-API-Key": GUARD_API_KEY } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Erreur Render :", response.status, errorText);
      return {
        success: false,
        error: `Erreur ${response.status}: ${errorText}`,
      };
    }

    const data = await response.json();

    // 6. Convertit la réponse : assignments solveur + règles fixes (IRM/FV/DAAS/…)
    // weekStartDate est le lundi ISO (yyyy-MM-dd) passé par GuardGenerationButton.
    const wn = getWeekNumber(parseISO(weekStartDate));
    const weekKey = `${wn.year}-W${String(wn.week).padStart(2, "0")}`;
    let scheduleData = convertAPIResponseToSchedule(data, weekKey, vacations, {
      previousSundayGuardDoctor,
    });

    // 7. Vacations cliniques Cs/ETT/EE : même analyse de fréquence qu’Historique+,
    // appliquée automatiquement sur les cellules encore vides (statut pending).
    let patternFill = { applied: 0, skippedTies: 0, weeksScanned: 0 };
    try {
      const supabase = await createClient();
      const { data: histRows, error: histError } = await supabase
        .from("schedules")
        .select("week_key, schedule_data")
        .neq("week_key", "full_schedule")
        .neq("week_key", weekKey)
        .order("week_key", { ascending: false })
        .limit(12);

      if (!histError && histRows?.length) {
        const historical = histRows
          .map((r) => r.schedule_data as ScheduleData)
          .filter((s) => s && typeof s === "object");
        const filled = fillClinicalVacationsFromPatterns(scheduleData, historical, {
          acceptTies: false,
          status: "pending",
        });
        scheduleData = applyStructuralConstraints(filled.next, weekKey, vacations, {
          previousSundayGuardDoctor,
        });
        patternFill = {
          applied: filled.applied,
          skippedTies: filled.skippedTies,
          weeksScanned: historical.length,
        };
      }
    } catch (patternError) {
      console.warn(
        "[generateGuardsViaAPI] Remplissage Cs/ETT/EE depuis l’historique ignoré:",
        patternError,
      );
    }

    return {
      success: true,
      data: scheduleData,
      // Alias attendu par GuardGenerationButton / ScheduleApp
      schedule: scheduleData,
      warnings: Array.isArray(data?.warnings) ? data.warnings : [],
      patternFill,
      raw: data,
    };
  } catch (error) {
    console.error("❌ Erreur dans generateGuardsViaAPI :", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur inconnue",
    };
  }
}

/**
 * Récupère le dernier médecin NCT
 */
async function getLastNctDoctor(): Promise<string | null> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "last_nct_doctor")
    .single();

  if (error || !data) {
    return null;
  }

  return data.value;
}

/**
 * Récupère les congés (congrès, formations, etc.)
 */
async function getCongres(): Promise<{ doctor_id: string; start_date: string; end_date: string; type?: string }[]> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("congres")
    .select("doctor_id, start_date, end_date, type")
    .gte("end_date", new Date().toISOString().split("T")[0]);

  if (error) {
    console.error("Erreur récupération congés :", error);
    return [];
  }

  return data || [];
}

/**
 * Convertit la réponse Render en ScheduleData UI.
 * - Propositions solveur (gardes/astreintes/Coro…) → **pending**
 * - Contraintes structurelles ré-injectées en **validated** (hors rôle de Générer)
 */
function convertAPIResponseToSchedule(
  response: {
    assignments?: GuardAssignment[];
  },
  weekKey = "generated",
  vacations: DoctorVacation[] = [],
  opts?: {
    previousSundayGuardDoctor?: string | null
    existingSchedule?: ScheduleData
  },
): ScheduleData {
  const base =
    opts?.existingSchedule && Object.keys(opts.existingSchedule).length > 0
      ? structuredClone(opts.existingSchedule)
      : generateWeekSchedule(weekKey, vacations);

  let next = base;
  if (response?.assignments?.length) {
    next = mergeAssignmentsIntoSchedule(base, response.assignments, {
      forcePending: true,
      proposalRowsOnly: true,
    });
  } else {
    console.warn("Réponse Render sans assignments :", response);
  }

  return applyStructuralConstraints(next, weekKey, vacations, {
    previousSundayGuardDoctor: opts?.previousSundayGuardDoctor,
  });
}

// Export pour compatibilité avec l'ancien code
export { convertAPIResponseToSchedule };
