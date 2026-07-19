"use client";

import { useState, useEffect, useMemo, useCallback, Fragment } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import VoiceAndUploadPanel from "@/components/VoiceAndUploadPanel";
import { DAYS, DOCTORS, DOCTOR_COLORS } from "@/lib/constants";
import { getWeekNumber, getWeekDates } from "@/lib/schedule-utils";
import {
  buildCurrentWeekRequest,
  convertSolverResponseToScheduleData,
} from "@/lib/voice-panel-utils";
import { createClient } from "@/lib/supabase/client";

// Types
type CellData = {
  value: string[];
  type: "empty" | "doctor" | "shift";
  status: "pending" | "validated";
};

type ScheduleData = {
  [rowKey: string]: {
    [day: string]: CellData;
  };
};

// Lignes du planning (ordre d'affichage)
const ROW_KEYS = [
  "Astreintes ATL Matin",
  "Astreintes ATL Midi",
  "Astreintes ATL Nuit",
  "Garde Matin",
  "Garde Midi",
  "Garde Nuit",
  "Hors site - NCT",
  "Hors site - CDL",
  "Hors site - IRM",
  "Hors site - Scinti",
  "Hors site - LFB",
  "Hors site - PSSL",
  "Matin - Cs PSS",
  "Matin - Cs Tessée",
  "Matin - Stress",
  "Matin - ETT salle 1",
  "Matin - ETT salle 2",
  "Matin - EE1",
  "Matin - EE2",
  "Matin - Rythmo",
  "Matin - Coro",
  "Apm - Cs PSS",
  "Apm - Cs Tessée",
  "Apm - Stress",
  "Apm - ETT salle 1",
  "Apm - ETT salle 2",
  "Apm - RÉEDUCATION",
  "Apm - EE1",
  "Apm - EE2",
  "Apm - Rythmo",
  "Apm - Coro",
  "Entrées PSS",
  "Pré-op",
  "1/2 journée off Matin",
  "1/2 journée off Après-midi",
  "Vacances",
  "Congrès",
  "Congés",
  "Notes du jour",
];

const ROW_GROUPS = [
  { label: "ASTREINTES & GARDES", rows: ["Astreintes ATL Matin", "Astreintes ATL Midi", "Astreintes ATL Nuit", "Garde Matin", "Garde Midi", "Garde Nuit"] },
  { label: "HORS SITE", rows: ["Hors site - NCT", "Hors site - CDL", "Hors site - IRM", "Hors site - Scinti", "Hors site - LFB", "Hors site - PSSL"] },
  { label: "VACATIONS MATIN", rows: ["Matin - Cs PSS", "Matin - Cs Tessée", "Matin - Stress", "Matin - ETT salle 1", "Matin - ETT salle 2", "Matin - EE1", "Matin - EE2", "Matin - Rythmo", "Matin - Coro"] },
  { label: "VACATIONS APRÈS-MIDI", rows: ["Apm - Cs PSS", "Apm - Cs Tessée", "Apm - Stress", "Apm - ETT salle 1", "Apm - ETT salle 2", "Apm - RÉEDUCATION", "Apm - EE1", "Apm - EE2", "Apm - Rythmo", "Apm - Coro"] },
  { label: "AUTRES", rows: ["Entrées PSS", "Pré-op", "1/2 journée off Matin", "1/2 journée off Après-midi", "Vacances", "Congrès", "Congés"] },
];

function createEmptyCell(): CellData {
  return { value: [], type: "empty", status: "validated" };
}

function createEmptySchedule(): ScheduleData {
  const schedule: ScheduleData = {};
  ROW_KEYS.forEach((row) => {
    schedule[row] = {};
    DAYS.forEach((day) => {
      schedule[row][day] = createEmptyCell();
    });
  });
  return schedule;
}

export default function PlanningV2Page() {
  const supabase = createClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedule, setSchedule] = useState<ScheduleData>(createEmptySchedule());
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [doctorCode, setDoctorCode] = useState("");
  const [vacations, setVacations] = useState<any[]>([]);

  const weekInfo = useMemo(() => getWeekNumber(currentDate), [currentDate]);
  const weekKey = `${weekInfo.year}-W${String(weekInfo.week).padStart(2, "0")}`;
  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: user } = await supabase.auth.getUser();
        if (!user?.user) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("role, doctor_code")
          .eq("id", user.user.id)
          .single();

        if (profile) {
          setIsAdmin(profile.role === "admin");
          setDoctorCode(profile.doctor_code || "");
        }

        const { data: scheduleData } = await supabase
          .from("schedules")
          .select("schedule_data")
          .eq("week_key", weekKey)
          .single();

        if (scheduleData) {
          setSchedule(scheduleData.schedule_data);
        } else {
          setSchedule(createEmptySchedule());
        }

        const { data: vacationsData } = await supabase
          .from("doctor_vacations")
          .select("*");
        setVacations(vacationsData || []);

        setIsLoading(false);
      } catch (error) {
        console.error("[v0] Erreur de chargement:", error);
        setIsLoading(false);
      }
    };
    loadData();
  }, [weekKey, supabase]);

  const saveSchedule = useCallback(async (newSchedule: ScheduleData) => {
    try {
      const { error } = await supabase
        .from("schedules")
        .upsert({
          week_key: weekKey,
          schedule_data: newSchedule,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      setSchedule(newSchedule);
      console.log("[v0] Planning sauvegardé avec succès");
    } catch (error) {
      console.error("[v0] Erreur de sauvegarde:", error);
    }
  }, [weekKey, supabase]);

  const prevWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };
  const nextWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };
  const goToToday = () => setCurrentDate(new Date());

  const currentWeekRequest = useMemo(() => {
    const monday = new Date(currentDate);
    const day = monday.getDay();
    const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
    monday.setDate(diff);
    const weekStartDate = monday.toISOString().split("T")[0];
    return buildCurrentWeekRequest(weekStartDate, weekInfo.week, vacations, DOCTORS);
  }, [currentDate, weekInfo.week, vacations]);

  const handleScheduleUpdate = useCallback((newSchedule: any) => {
    try {
      const scheduleData = convertSolverResponseToScheduleData(newSchedule);
      const updated = { ...schedule };
      Object.keys(scheduleData).forEach(row => {
        if (updated[row]) {
          Object.keys(scheduleData[row]).forEach(day => {
            if (updated[row][day]) {
              updated[row][day].value = scheduleData[row][day].value;
              updated[row][day].type = scheduleData[row][day].type || "doctor";
              updated[row][day].status = "validated";
            }
          });
        }
      });
      saveSchedule(updated);
    } catch (error) {
      console.error("[v0] Erreur lors de la mise à jour du planning:", error);
    }
  }, [schedule, saveSchedule]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Chargement...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* En-tête */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={prevWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center">
              <h2 className="text-lg font-bold">Semaine {weekInfo.week}</h2>
              <p className="text-xs text-gray-500">{weekInfo.year}</p>
            </div>
            <Button variant="outline" size="icon" onClick={nextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={goToToday}>
              Aujourd&apos;hui
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 hidden md:inline">
              {weekDates[0]} → {weekDates[6]}
            </span>
          </div>
        </div>

        {/* Panneau vocal + upload PDF (admin uniquement) */}
        {isAdmin && (
          <div className="bg-white p-4 rounded-xl shadow-sm border">
            <VoiceAndUploadPanel
              apiBaseUrl={process.env.NEXT_PUBLIC_GUARD_API_BASE_URL || "https://guard-api-cardiomaine.onrender.com"}
              apiKey={process.env.NEXT_PUBLIC_GUARD_API_KEY || ""}
              currentWeekRequest={currentWeekRequest}
              knownDoctors={DOCTORS}
              onScheduleUpdated={handleScheduleUpdate}
              onPdfParsed={(data) => {
                console.log("[v0] Données PDF extraites:", data);
              }}
            />
          </div>
        )}

        {/* Grille du planning */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100 border-b">
                  <th className="sticky left-0 z-20 bg-slate-100 p-2 text-left font-bold text-slate-700 border-r min-w-[140px]">
                    Activité
                  </th>
                  {DAYS.map((day, i) => (
                    <th
                      key={day}
                      className={`p-2 text-center font-medium min-w-[80px] border-r last:border-r-0 ${
                        day === "SAMEDI" || day === "DIMANCHE" ? "bg-gray-100" : ""
                      }`}
                    >
                      <div className="text-[10px] uppercase tracking-wider">{day.slice(0, 3)}</div>
                      <div className="text-xs font-bold">{weekDates[i]}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROW_GROUPS.map((group, groupIdx) => (
                  <Fragment key={`group-${groupIdx}`}>
                    <tr className="bg-slate-50">
                      <td colSpan={8} className="sticky left-0 z-20 bg-slate-50 p-1.5 text-xs font-semibold text-slate-600 tracking-wider border-r">
                        {group.label}
                      </td>
                    </tr>
                    {group.rows.map((rowKey) => {
                      const rowData = schedule[rowKey] || {};
                      return (
                        <tr key={rowKey} className="border-b hover:bg-gray-50/50 transition-colors">
                          <td className="sticky left-0 z-10 bg-white p-2 text-xs font-medium text-slate-700 border-r min-w-[140px]">
                            {rowKey}
                          </td>
                          {DAYS.map((day) => {
                            const cell = rowData[day] || { value: [], type: "empty", status: "validated" };
                            const doctors = cell.value || [];
                            return (
                              <td key={day} className="p-1 text-center border-r last:border-r-0 min-w-[80px] max-w-[100px]">
                                {doctors.length > 0 ? (
                                  <div className="flex flex-wrap gap-1 justify-center">
                                    {doctors.map((doc: string, idx: number) => (
                                      <span
                                        key={idx}
                                        className={`inline-block px-1.5 py-0.5 rounded text-white text-[10px] font-medium ${
                                          DOCTOR_COLORS[doc] || "bg-gray-500"
                                        }`}
                                      >
                                        {doc}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-gray-300 text-xs">·</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pied de page */}
        <div className="text-xs text-gray-400 text-center py-2">
          Planning Cardiomaine – Semaine {weekInfo.week} • {weekInfo.year}
        </div>
      </div>
    </div>
  );
}
