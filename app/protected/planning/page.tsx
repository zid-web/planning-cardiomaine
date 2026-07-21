"use client";

import React, { useState, useEffect, useMemo, useCallback, Fragment } from "react";
import { ChevronLeft, ChevronRight, X, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VoiceAndUploadPanel } from "@/components/VoiceAndUploadPanel";
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

// Lignes complètes du planning
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

export default function PlanningPage() {
  const supabase = createClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedule, setSchedule] = useState<ScheduleData>(createEmptySchedule());
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [doctorCode, setDoctorCode] = useState("");
  const [vacations, setVacations] = useState<any[]>([]);
  const [selectedCell, setSelectedCell] = useState<{ row: string; day: string } | null>(null);
  const [voicePanelOpen, setVoicePanelOpen] = useState(false);

  const weekInfo = useMemo(() => getWeekNumber(currentDate), [currentDate]);
  const weekKey = `${weekInfo.year}-W${String(weekInfo.week).padStart(2, "0")}`;
  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate]);

  // Charger les données
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
        console.error("Erreur de chargement:", error);
        setIsLoading(false);
      }
    };
    loadData();
  }, [weekKey, supabase]);

  // Sauvegarder
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
    } catch (error) {
      console.error("Erreur de sauvegarde:", error);
    }
  }, [weekKey, supabase]);

  // Navigation
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

  // Interactivité
  const handleCellClick = (rowKey: string, day: string) => {
    if (rowKey === "Notes du jour" || rowKey === "Congés") return;
    setSelectedCell({ row: rowKey, day });
  };

  const addDoctorToCell = (doctor: string) => {
    if (!selectedCell) return;
    const newSchedule = { ...schedule };
    const cell = newSchedule[selectedCell.row][selectedCell.day];
    if (!cell.value.includes(doctor)) {
      cell.value.push(doctor);
      cell.type = "doctor";
      saveSchedule(newSchedule);
    }
    setSelectedCell(null);
  };

  const removeDoctorFromCell = (index: number) => {
    if (!selectedCell) return;
    const newSchedule = { ...schedule };
    const cell = newSchedule[selectedCell.row][selectedCell.day];
    cell.value.splice(index, 1);
    if (cell.value.length === 0) cell.type = "empty";
    saveSchedule(newSchedule);
    setSelectedCell(null);
  };

  // Build request pour le solveur
  const currentWeekRequest = useMemo(() => {
    const monday = new Date(currentDate);
    const day = monday.getDay();
    const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
    monday.setDate(diff);
    const weekStartDate = monday.toISOString().split("T")[0];
    return buildCurrentWeekRequest(weekStartDate, weekInfo.week, vacations, DOCTORS);
  }, [currentDate, weekInfo.week, vacations]);

  const handleScheduleUpdate = useCallback((newSchedule: any) => {
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
  }, [schedule, saveSchedule]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Chargement...</div>;
  }

  return (
    <div className="h-screen bg-gray-50 p-1 md:p-4 lg:p-6 flex flex-col overflow-hidden">
      <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col gap-1 md:gap-4 overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-1 md:gap-4 bg-white p-2 md:p-4 rounded-lg md:rounded-xl shadow-sm border">
          <div className="flex items-center gap-1 md:gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8 md:h-10 md:w-10" onClick={prevWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center">
              <h2 className="text-sm md:text-lg font-bold">Semaine {weekInfo.week}</h2>
              <p className="text-[10px] md:text-xs text-gray-500">{weekInfo.year}</p>
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8 md:h-10 md:w-10" onClick={nextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-xs h-8 md:h-10" onClick={goToToday}>
              Aujourd'hui
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] md:text-sm text-gray-500 hidden sm:inline">
              {weekDates[0]} → {weekDates[6]}
            </span>
          </div>
        </div>

        {/* Grille pleine hauteur */}
        <div className="bg-white rounded-lg md:rounded-xl shadow-sm border overflow-hidden flex flex-col flex-1 min-h-0">
          <div className="w-full h-full overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-slate-100">
                <tr className="border-b">
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
                              <td
                                key={day}
                                onClick={() => handleCellClick(rowKey, day)}
                                className="p-1 text-center border-r last:border-r-0 min-w-[80px] max-w-[100px] cursor-pointer hover:bg-gray-50"
                              >
                                {doctors.length > 0 ? (
                                  <div className="flex flex-wrap gap-1 justify-center">
                                    {doctors.map((doc: string, idx: number) => (
                                      <span
                                        key={idx}
                                        className={`inline-block px-1.5 py-0.5 rounded-full text-white text-[10px] font-medium shadow-sm ${
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

      {/* Bouton flottant pour le panneau vocal (admin uniquement) */}
      {isAdmin && (
        <>
          <button
            onClick={() => setVoicePanelOpen(!voicePanelOpen)}
            className="fixed bottom-4 right-4 z-50 bg-teal-600 hover:bg-teal-700 text-white rounded-full p-3 shadow-lg transition-all hover:shadow-xl"
            aria-label="Ouvrir le panneau vocal"
          >
            <Mic className="w-6 h-6" />
          </button>

          {/* Panneau vocal popup */}
          {voicePanelOpen && (
            <div className="fixed bottom-20 right-4 z-50 w-80 max-w-[calc(100vw-32px)] bg-white rounded-xl shadow-2xl border p-4 max-h-[70vh] overflow-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">Panneau Vocal & Upload</h3>
                <button
                  onClick={() => setVoicePanelOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <VoiceAndUploadPanel
                apiBaseUrl={process.env.NEXT_PUBLIC_GUARD_API_BASE_URL || "https://guard-api-cardiomaine.onrender.com"}
                apiKey={process.env.NEXT_PUBLIC_GUARD_API_KEY || ""}
                currentWeekRequest={currentWeekRequest}
                knownDoctors={DOCTORS}
                onScheduleUpdated={handleScheduleUpdate}
                onPdfParsed={(data) => {
                  console.log("Données PDF extraites:", data);
                }}
              />
            </div>
          )}
        </>
      )}

      {/* Modal */}
      {selectedCell && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-2xl bg-white p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900">Modifier l'affectation</h3>
                <p className="text-xs text-slate-500">{selectedCell.day} - {selectedCell.row}</p>
              </div>
              <button onClick={() => setSelectedCell(null)} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="size-5" />
              </button>
            </div>

            <div className="mb-4 flex flex-wrap gap-2 min-h-[40px] p-2 bg-slate-50 rounded-lg border border-slate-100">
              {schedule[selectedCell.row][selectedCell.day].value.length === 0 && (
                <span className="text-slate-400 text-sm italic self-center">Aucun médecin sélectionné</span>
              )}
              {schedule[selectedCell.row][selectedCell.day].value.map((doc, index) => (
                <div key={index} className={`flex items-center gap-1 pl-2 pr-1 py-1 rounded-md text-white text-sm font-bold shadow-sm ${DOCTOR_COLORS[doc] || 'bg-gray-500'}`}>
                  {doc}
                  <button onClick={() => removeDoctorFromCell(index)} className="ml-1 hover:bg-black/20 rounded-full p-0.5">
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-4 gap-2 mb-4 max-h-[300px] overflow-y-auto">
              {DOCTORS.map((doc) => {
                const isSelected = schedule[selectedCell.row][selectedCell.day].value.includes(doc);
                return (
                  <button
                    key={doc}
                    onClick={() => addDoctorToCell(doc)}
                    disabled={isSelected}
                    className={`flex h-10 items-center justify-center rounded-lg font-bold transition-all
                      ${isSelected ? 'opacity-20 cursor-not-allowed bg-slate-100 text-slate-400' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-sm active:scale-95'}
                    `}
                  >
                    <div className={`mr-2 size-2 rounded-full ${DOCTOR_COLORS[doc]}`} />
                    {doc}
                  </button>
                );
              })}
            </div>

            <button className="w-full py-2 bg-gray-200 rounded-lg hover:bg-gray-300" onClick={() => setSelectedCell(null)}>
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
