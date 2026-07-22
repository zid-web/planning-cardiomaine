"use server";

import { createClient } from "@/lib/supabase/server";
import { DoctorVacation } from "@/lib/types";

// Configuration
const GUARD_API_URL = process.env.GUARD_API_URL || "https://guard-api-cardiomaine.onrender.com";
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
 * Calcule les points d'équité historiques pour chaque médecin
 */
async function calculateEquityPoints(): Promise<EquityPoints> {
  const supabase = await createClient();
  
  // Récupère les 13 dernières semaines de planning
  const { data: schedules, error } = await supabase
    .from("schedules")
    .select("schedule_data")
    .order("week_key", { ascending: false })
    .limit(13);

  if (error || !schedules || schedules.length === 0) {
    return { astreinte: {}, garde: {}, nct: {}, weekend: {} };
  }

  const points: EquityPoints = {
    astreinte: {},
    garde: {},
    nct: {},
    weekend: {},
  };

  // Parcours chaque semaine pour cumuler les points
  schedules.forEach((schedule) => {
    const data = schedule.schedule_data;
    if (!data) return;

    // Parcours chaque ligne du planning
    Object.values(data).forEach((row: any) => {
      Object.values(row).forEach((cell: any) => {
        if (!cell || !cell.doctor) return;

        const doctorId = cell.doctor;
        const activity = cell.activity || cell.type;

        // Compte les points selon l'activité
        if (activity === "ASTREINTE") {
          points.astreinte[doctorId] = (points.astreinte[doctorId] || 0) + 1;
        } else if (activity === "GARDE") {
          points.garde[doctorId] = (points.garde[doctorId] || 0) + 1;
        } else if (activity === "NCT") {
          points.nct[doctorId] = (points.nct[doctorId] || 0) + 1;
        } else if (activity === "ASTREINTE_WEEKEND" || activity === "GARDE_WEEKEND") {
          points.weekend[doctorId] = (points.weekend[doctorId] || 0) + 1;
        }
      });
    });
  });

  return points;
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

    // 3. Récupère les congés
    const congres = await getCongres();

    // 4. Construit le payload pour Render
    const payload = {
      week_start_date: weekStartDate,
      week_type: weekType,
      weekend_mode: weekendMode,
      last_nct_doctor: lastNctDoctor || doctors[0]?.id || "M",
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

    console.log("🚀 Envoi à Render :", JSON.stringify(payload, null, 2));

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

    // 6. Convertit la réponse en format ScheduleData pour l'affichage
    const scheduleData = convertAPIResponseToSchedule(data);

    return {
      success: true,
      data: scheduleData,
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
 * Convertit la réponse de l'API Render en format ScheduleData
 */
function convertAPIResponseToSchedule(response: any): any {
  if (!response || !response.assignments) {
    console.warn("Réponse Render sans assignments :", response);
    return {};
  }

  const scheduleData: any = {};

  // Parcours chaque assignment
  response.assignments.forEach((assignment: any) => {
    const date = assignment.date;
    const dayName = assignment.day_name; // LUNDI, MARDI, ...
    const slot = assignment.slot; // matin, am, nuit
    const activity = assignment.activity;
    const doctor = assignment.doctor;
    const note = assignment.note || null;

    // Construit la clé du jour (ex: "2026-07-27_LUNDI")
    const dayKey = `${date}_${dayName}`;

    if (!scheduleData[dayKey]) {
      scheduleData[dayKey] = {};
    }

    // Construit la clé du slot (ex: "matin", "am", "nuit")
    const slotKey = slot;

    scheduleData[dayKey][slotKey] = {
      activity,
      doctor,
      note,
      status: "confirmed",
      type: activity,
    };
  });

  return scheduleData;
}

// Export pour compatibilité avec l'ancien code
export { convertAPIResponseToSchedule };
