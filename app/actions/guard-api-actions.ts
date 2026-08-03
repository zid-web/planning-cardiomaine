"use server";

import { parseISO, subDays } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { DoctorVacation, ScheduleData } from "@/lib/types";
import { DAYS } from "@/lib/constants";
import { generateWeekSchedule, getWeekNumber } from "@/lib/schedule-utils";
import {
  accumulateEquityFromSchedules,
  getCoroEquity,
  getCoroMOWEquity,
  getCumulativeEquityFromTable,
  getGroupe1Equity,
  type EquityCounts,
  type CoroMOWSplitCounts,
} from "@/lib/equity-tracking";
import { applyCoroWOMRotation } from "@/lib/coro-rotation";
import { applyStructuralConstraints } from "@/lib/apply-structural-constraints";
import { mergeAssignmentsIntoSchedule, type GuardAssignment } from "@/lib/guard-api-mapping";
import { buildHistoricalPatternsPayload } from "@/lib/pattern-analysis";
import { toSolverClinicalRulesPayload } from "@/lib/group-clinical-rules";
import { buildActivityMaintenancePayload } from "@/lib/activity-maintenance";
import { buildRoomMaintenancePayload } from "@/lib/room-maintenance";
import {
  buildWeekendComboSolverFields,
  LAST_COMBO_GARDE_DATE_KEY,
  LAST_COMBO_GARDE_DOCTOR_KEY,
  resolveLastComboGardeFromSchedule,
  type LastComboGardeState,
} from "@/lib/weekend-combo-solver";
import { isWomComboWeekend } from "@/lib/weekend-wom-rules";

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
  /** Fenêtre glissante 6 mois (même scope que les autres points). */
  points_coro: number;
  /** Groupe 1 (échographistes) — vacations Cs / ETT / Stress sur 6 mois. */
  points_cs: number;
  points_ett: number;
  points_stress: number;
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

  // Récupère les points d'équité historiques pour chaque médecin (fenêtre 6 mois)
  const [equityPoints, coroPoints, groupe1Points] = await Promise.all([
    calculateEquityPoints(),
    getCoroEquity(),
    getGroupe1Equity(),
  ]);

  return doctors.map((doc) => ({
    id: doc.id,
    nom: doc.nom,
    statut: doc.statut || "permanent",
    points_astreinte: equityPoints.astreinte[doc.id] || 0,
    points_garde: equityPoints.garde[doc.id] || 0,
    points_nct: equityPoints.nct[doc.id] || 0,
    points_weekend: equityPoints.weekend[doc.id] || 0,
    points_coro: coroPoints[doc.id] || 0,
    points_cs: groupe1Points[doc.id]?.cs || 0,
    points_ett: groupe1Points[doc.id]?.ett || 0,
    points_stress: groupe1Points[doc.id]?.stress || 0,
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

  // Repli : scan de l'historique JSON (fenêtre ~6 mois, filtre exact dans accumulate)
  const { data: schedules, error } = await supabase
    .from("schedules")
    .select("week_key, schedule_data")
    .neq("week_key", "full_schedule")
    .order("week_key", { ascending: false })
    .limit(40);

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
 * CH (structure externe) est exclu. Priorité Garde Nuit puis ATL Nuit.
 */
export async function getLastSundayGuardDoctor(weekStartISO: string): Promise<string | null> {
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
  const { extractSundayNightGuardDoctor } = await import("@/lib/half-day-off");
  return extractSundayNightGuardDoctor(scheduleData);
}

/**
 * Génère le planning via l'API Render
 */
export async function generateGuardsViaAPI(
  weekStartDate: string,
  vacations: DoctorVacation[],
  weekendMode: "ROTATION" | "CH" = "ROTATION",
  weekType?: 1 | 2,
  weekOverrides?: {
    visite_doctor?: string | null
    lfb_doctor?: string | null
    pssl_b_active?: boolean
    pssl_z_active?: boolean
  },
  /**
   * Planning actuellement affiché côté client (avant sauvegarde en base) -
   * confirmé bug utilisateur 31/07/2026 : sans ça, une semaine jamais
   * sauvegardée n'avait aucune position d'infirmière (Val/Véro/Laura sur
   * Stress/EE) à extraire pour proposer le médecin partenaire. Prioritaire
   * sur la lecture en base si fourni.
   */
  currentScheduleParam?: ScheduleData,
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

    // Semaine ISO → week_type (1 = impaire, 2 = paire). Ne pas laisser le défaut 1
    // sinon les semaines paires reçoivent la structure CH/WOM inversée.
    const wnEarly = getWeekNumber(parseISO(weekStartDate));
    const resolvedWeekType: 1 | 2 =
      weekType ?? (wnEarly.week % 2 === 0 ? 2 : 1);

    // 2. Récupère le dernier médecin NCT + dernier combo garde (espacement 15 j.)
    const [lastNctDoctor, lastComboGarde] = await Promise.all([
      getLastNctDoctor(),
      getLastComboGardeState(),
    ]);

    // 3. Récupère les congés + médecin de garde dimanche précédent + équité Coro M/O/W
    const [congres, previousSundayGuardDoctor, coroMOWCounts] = await Promise.all([
      getCongres(),
      getLastSundayGuardDoctor(weekStartDate),
      getCoroMOWEquity(),
    ]);

    // 4. Historique Cs/ETT/EE/hors site → `historical_patterns` pour le solveur
    // (même exclusions que pattern-analysis : SOLVER_MANAGED + Rythmo + meta).
    const lookbackWeeks = 12;
    const currentWeekKey = `${wnEarly.year}-W${String(wnEarly.week).padStart(2, "0")}`;
    let historicalPatterns = buildHistoricalPatternsPayload([]);
    let historicalWeeksScanned = 0;
    try {
      const supabaseHist = await createClient();
      const { data: histRows, error: histError } = await supabaseHist
        .from("schedules")
        .select("week_key, schedule_data")
        .neq("week_key", "full_schedule")
        .neq("week_key", currentWeekKey)
        .order("week_key", { ascending: false })
        .limit(lookbackWeeks);

      if (!histError && histRows?.length) {
        const historical = histRows
          .map((r) => r.schedule_data as ScheduleData)
          .filter((s) => s && typeof s === "object");
        historicalWeeksScanned = historical.length;
        historicalPatterns = buildHistoricalPatternsPayload(historical);
      } else if (histError) {
        console.warn(
          "[generateGuardsViaAPI] Lecture historique pour patterns:",
          histError.message,
        );
      }
    } catch (histErr) {
      console.warn(
        "[generateGuardsViaAPI] historical_patterns ignoré (historique indisponible):",
        histErr,
      );
    }

    // Équité weekend (M/O/W) pour ancres combo si pas de preset explicite
    let weekendEquity: Record<string, EquityCounts> | undefined
    try {
      weekendEquity = (await getCumulativeEquityFromTable()) ?? undefined
    } catch {
      weekendEquity = undefined
    }

    const weekendComboFields = buildWeekendComboSolverFields(
      currentWeekKey,
      lastComboGarde,
      weekendEquity,
    )

    // 5bis. Positions des infirmières (Val/Véro/Laura) sur Stress/EE pour
    // cette semaine - transmises au solveur via existing_schedule pour qu'il
    // propose le médecin partenaire (confirmé utilisateur 31/07/2026).
    const NURSE_STRESS_EE_ROWS = [
      "Matin - Stress", "Apm - Stress",
      "Matin - EE1", "Apm - EE1",
      "Matin - EE2", "Apm - EE2",
    ] as const
    const NURSES = new Set(["Val", "Véro", "Laura"])
    let nurseExistingSchedule: Record<string, string[]> = {}
    try {
      // Priorité au planning transmis directement par le front (toujours à
      // jour, y compris pour une semaine jamais encore sauvegardée) - repli
      // sur la base de données uniquement si non fourni (confirmé bug
      // utilisateur 31/07/2026).
      let currentSchedule: ScheduleData | undefined = currentScheduleParam
      if (!currentSchedule) {
        const supabaseCur = await createClient()
        const { data: curRow } = await supabaseCur
          .from("schedules")
          .select("schedule_data")
          .eq("week_key", currentWeekKey)
          .single()
        currentSchedule = curRow?.schedule_data as ScheduleData | undefined
      }
      if (currentSchedule) {
        for (const row of NURSE_STRESS_EE_ROWS) {
          for (const day of DAYS) {
            const cell = currentSchedule[row]?.[day]
            const cellValue = cell?.value || []
            const hasNurse = cellValue.some((d) => NURSES.has(d))
            if (hasNurse) {
              nurseExistingSchedule[`${row}||${day}`] = cellValue
            }
          }
        }
      }
    } catch (nurseErr) {
      console.warn("[generateGuardsViaAPI] positions infirmières ignorées:", nurseErr)
    }

    // 5. Construit le payload pour Render
    const payload = {
      week_start_date: weekStartDate,
      week_type: resolvedWeekType,
      weekend_mode: weekendMode,
      last_nct_doctor: lastNctDoctor || doctors[0]?.id || "M",
      previous_sunday_guard_doctor: previousSundayGuardDoctor,
      // Positions déjà connues (infirmières Val/Véro/Laura sur Stress/EE
      // pour l'instant) - permet au solveur de proposer le médecin
      // partenaire sans écraser ce qui est déjà positionné.
      existing_schedule: nurseExistingSchedule,
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
        points_coro: doc.points_coro,
        points_cs: doc.points_cs,
        points_ett: doc.points_ett,
        points_stress: doc.points_stress,
      })),
      historical_patterns: historicalPatterns,
      // Consignes DOC022 (éligibilités + créneaux) — merge côté solveur si supporté
      rules_override: toSolverClinicalRulesPayload(currentWeekKey, vacations),
      // Suspensions NCT / PSSL / LFB / CDL (périodes calendrier — optionnel)
      activity_maintenance: buildActivityMaintenancePayload(),
      // Salle de coro indisponible (périodes calendrier — optionnel, même
      // principe qu'activity_maintenance ci-dessus). Bug corrigé 31/07/2026 :
      // les consignes vocales portant sur plusieurs semaines n'étaient
      // jamais reprises par les générations normales ultérieures.
      room_maintenance: buildRoomMaintenancePayload(),
      // Week-end combo M/O/W (uniquement semaines calendrier — sinon absent)
      ...(weekendComboFields ?? {}),
      // Rotations désignées admin (VISITE / LFB / PSSL) — optionnels
      ...(weekOverrides?.visite_doctor
        ? { visite_doctor: weekOverrides.visite_doctor }
        : {}),
      ...(weekOverrides?.lfb_doctor
        ? { lfb_doctor: weekOverrides.lfb_doctor }
        : {}),
      ...(typeof weekOverrides?.pssl_b_active === "boolean" || typeof weekOverrides?.pssl_z_active === "boolean"
        ? {
            // Conversion au point de sortie uniquement (bug corrigé
            // 31/07/2026) : le solveur attend désormais `pssl_doctor`
            // ("B" | "Z"), pas les 2 anciens booléens séparés - on ne
            // touche pas à l'UI/la logique interne (week-generation-params,
            // guard-generation-button) qui continuent d'utiliser les 2
            // booléens, seule la conversion finale change.
            pssl_doctor: weekOverrides?.pssl_b_active
              ? "B"
              : weekOverrides?.pssl_z_active
                ? "Z"
                : undefined,
          }
        : {}),
    };

    // 6. Appel à l'API Render
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

    // 7. Convertit la réponse : assignments solveur + règles fixes (IRM/FV/DAAS/…)
    // Cs/ETT/EE/Stress + hors site (CDL/IRM/…) viennent des assignments Render
    // (HIST:: / HORSSITE:: → activity suffixe) → pending via GENERATOR_PROPOSAL_ROW_KEYS.
    const weekKey = currentWeekKey;
    let scheduleData = convertAPIResponseToSchedule(data, weekKey, vacations, {
      previousSundayGuardDoctor,
    });

    // 7bis. Rotation équitable Coro Matin/Apm entre M, O, W (lundi-vendredi).
    // Ne remplace JAMAIS une case déjà validée par un médecin listé.
    // Propositions en statut pending (admin peut modifier/valider).
    try {
      scheduleData = applyCoroWOMRotation(
        scheduleData,
        weekKey,
        vacations,
        coroMOWCounts,
      );
    } catch (coroErr) {
      console.warn("[generateGuardsViaAPI] rotation Coro M/O/W ignorée:", coroErr);
    }

    // Persiste qui a *réellement* le rôle Garde Sam (peut différer de l’ancre)
    if (isWomComboWeekend(weekKey)) {
      try {
        await persistLastComboGardeFromSchedule(weekKey, scheduleData)
      } catch (err) {
        console.warn("[generateGuardsViaAPI] last_combo_garde non persisté:", err)
      }
    }

    const patternSlots = Object.values(historicalPatterns).reduce(
      (n, days) => n + Object.keys(days).length,
      0,
    );

    return {
      success: true,
      data: scheduleData,
      // Alias attendu par GuardGenerationButton / ScheduleApp
      schedule: scheduleData,
      warnings: Array.isArray(data?.warnings) ? data.warnings : [],
      historicalPatternsMeta: {
        weeksScanned: historicalWeeksScanned,
        slotsSent: patternSlots,
      },
      weekendCombo: weekendComboFields
        ? {
            sent: true,
            astreinte_anchor: weekendComboFields.weekend_combo_astreinte_anchor,
            garde_anchor: weekendComboFields.weekend_combo_garde_anchor,
          }
        : { sent: false },
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

async function getLastComboGardeState(): Promise<LastComboGardeState> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", [LAST_COMBO_GARDE_DOCTOR_KEY, LAST_COMBO_GARDE_DATE_KEY])

  if (error || !data?.length) {
    return { doctor: null, date: null }
  }

  const map = Object.fromEntries(data.map((r) => [r.key, r.value]))
  return {
    doctor: map[LAST_COMBO_GARDE_DOCTOR_KEY] || null,
    date: map[LAST_COMBO_GARDE_DATE_KEY] || null,
  }
}

async function saveLastComboGardeState(state: LastComboGardeState): Promise<void> {
  if (!state.doctor || !state.date) return
  const supabase = await createClient()
  const { error } = await supabase.from("settings").upsert(
    [
      { key: LAST_COMBO_GARDE_DOCTOR_KEY, value: state.doctor },
      { key: LAST_COMBO_GARDE_DATE_KEY, value: state.date },
    ],
    { onConflict: "key" },
  )
  if (error) {
    console.warn("[saveLastComboGardeState]", error.message)
  }
}

async function persistLastComboGardeFromSchedule(
  weekKey: string,
  schedule: ScheduleData,
): Promise<LastComboGardeState | null> {
  const resolved = resolveLastComboGardeFromSchedule(weekKey, schedule)
  if (!resolved) return null
  await saveLastComboGardeState(resolved)
  return resolved
}

/**
 * Après validation admin d’une Garde Sam (ou re-save week combo) :
 * met à jour last_combo_garde_* depuis le planning réel.
 */
export async function recordLastComboGardeFromSchedule(
  weekKey: string,
  schedule: ScheduleData,
): Promise<{ ok: boolean; doctor?: string; date?: string }> {
  try {
    if (!isWomComboWeekend(weekKey)) return { ok: false }
    const saved = await persistLastComboGardeFromSchedule(weekKey, schedule)
    if (!saved?.doctor || !saved.date) return { ok: false }
    return { ok: true, doctor: saved.doctor, date: saved.date }
  } catch (err) {
    console.warn("[recordLastComboGardeFromSchedule]", err)
    return { ok: false }
  }
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
