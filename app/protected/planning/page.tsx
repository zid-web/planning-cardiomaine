"use client";

import React, { useState, useEffect, useMemo, useCallback, Fragment } from "react";
import { ChevronLeft, ChevronRight, X, Mic, Bell, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { VoiceAndUploadPanel } from "@/components/VoiceAndUploadPanel";
import { DAYS, DOCTORS, DOCTOR_COLORS } from "@/lib/constants";
import { getWeekNumber, getWeekDates } from "@/lib/schedule-utils";
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

type ChangeRequest = {
  id: string;
  requester_id: string | null;
  week_key: string;
  day_name: string;
  row_key: string;
  slot: string | null;
  current_doctor: string | null;
  requested_doctor: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  admin_comment: string | null;
  created_at: string;
  updated_at: string;
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
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [showRequests, setShowRequests] = useState(false);
  const [requestModal, setRequestModal] = useState<{
    open: boolean;
    row: string;
    day: string;
    slot?: string;
    currentDoctor?: string;
  }>({ open: false, row: "", day: "" });
  const [requestedDoctor, setRequestedDoctor] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

        // Demandes de modification (RLS: admin -> toutes ; médecin -> les siennes)
        const { data: crData } = await supabase
          .from("change_requests")
          .select("*")
          .eq("week_key", weekKey)
          .order("created_at", { ascending: false });
        setChangeRequests((crData as ChangeRequest[]) || []);

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

  // Persister en base (sans toucher à l'état local, qui est mis à jour de façon optimiste)
  const persistSchedule = useCallback(async (newSchedule: ScheduleData) => {
    try {
      const { error } = await supabase
        .from("schedules")
        .upsert(
          {
            week_key: weekKey,
            schedule_data: newSchedule,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "week_key" },
        );

      if (error) throw error;
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

  // Interactivité : les admins éditent directement, les médecins demandent une modification
  const handleCellClick = (rowKey: string, day: string) => {
    if (rowKey === "Notes du jour" || rowKey === "Congés") return;
    // Tout le monde ouvre la même modale : admin = édition, médecin = lecture + demande
    setSelectedCell({ row: rowKey, day });
  };

  // Mise à jour immuable + optimiste d'une cellule, puis persistance en arrière-plan
  const applyCellUpdate = (row: string, day: string, nextCell: CellData) => {
    const next: ScheduleData = {
      ...schedule,
      [row]: { ...schedule[row], [day]: nextCell },
    };
    setSchedule(next); // rendu immédiat, plus de re-render tardif
    void persistSchedule(next);
  };

  const addDoctorToCell = (doctor: string) => {
    if (!selectedCell) return;
    const { row, day } = selectedCell;
    const cell = schedule[row][day];
    if (cell.value.includes(doctor)) {
      setSelectedCell(null);
      return;
    }
    applyCellUpdate(row, day, {
      ...cell,
      value: [...cell.value, doctor],
      type: "doctor",
    });
    setSelectedCell(null);
  };

  const removeDoctorFromCell = (index: number) => {
    if (!selectedCell) return;
    const { row, day } = selectedCell;
    const cell = schedule[row][day];
    const value = cell.value.filter((_, i) => i !== index);
    // On garde la modale ouverte pour permettre plusieurs retraits d'affilée
    applyCellUpdate(row, day, {
      ...cell,
      value,
      type: value.length === 0 ? "empty" : cell.type,
    });
  };

  // --- Demandes de modification (change_requests) ---
  const refreshRequests = useCallback(async () => {
    const { data } = await supabase
      .from("change_requests")
      .select("*")
      .eq("week_key", weekKey)
      .order("created_at", { ascending: false });
    setChangeRequests((data as ChangeRequest[]) || []);
  }, [supabase, weekKey]);

  const pendingRequests = useMemo(
    () => changeRequests.filter((r) => r.status === "pending"),
    [changeRequests],
  );

  // Un médecin (non-admin) soumet une demande via l'API /api/change-request
  const submitRequest = async () => {
    if (!requestedDoctor.trim()) {
      toast.error("Veuillez indiquer le médecin souhaité");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/change-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week_key: weekKey,
          day_name: requestModal.day,
          row_key: requestModal.row,
          slot: requestModal.slot,
          current_doctor: requestModal.currentDoctor || "",
          requested_doctor: requestedDoctor.trim().toUpperCase(),
          reason: reason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");

      toast.success("✅ Demande envoyée !");
      setRequestModal({ open: false, row: "", day: "" });
      setRequestedDoctor("");
      setReason("");
      refreshRequests();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'envoi");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Un admin approuve : applique le médecin demandé à la cellule puis marque approuvé
  const approveRequest = async (req: ChangeRequest) => {
    const cell = schedule[req.row_key]?.[req.day_name];
    if (cell) {
      const value = cell.value.includes(req.requested_doctor)
        ? cell.value
        : [...cell.value, req.requested_doctor];
      const next: ScheduleData = {
        ...schedule,
        [req.row_key]: {
          ...schedule[req.row_key],
          [req.day_name]: { ...cell, value, type: "doctor" },
        },
      };
      setSchedule(next);
      await persistSchedule(next);
    }
    const { error } = await supabase
      .from("change_requests")
      .update({ status: "approved", updated_at: new Date().toISOString() })
      .eq("id", req.id);
    if (error) {
      console.error("Erreur approbation:", error);
      toast.error("Erreur lors de l'approbation");
      return;
    }
    toast.success(`Demande approuvée : ${req.requested_doctor} → ${req.row_key} (${req.day_name})`);
    refreshRequests();
  };

  const rejectRequest = async (req: ChangeRequest) => {
    const { error } = await supabase
      .from("change_requests")
      .update({ status: "rejected", updated_at: new Date().toISOString() })
      .eq("id", req.id);
    if (error) {
      console.error("Erreur rejet:", error);
      toast.error("Erreur lors du rejet");
      return;
    }
    toast.success("Demande rejetée");
    refreshRequests();
  };

  // Applique les opérations renvoyées par /api/voice-command
  const applyVoiceOperations = useCallback(
    (data: { operations?: Array<{ action: string; doctor?: string; day?: string; row?: string }> }) => {
      const ops = data?.operations || [];
      let next = schedule;
      let changed = false;
      for (const op of ops) {
        if ((op.action !== "add" && op.action !== "remove") || !op.day || !op.row || !op.doctor) continue;
        const cell = next[op.row]?.[op.day];
        if (!cell) continue;
        let value = cell.value;
        if (op.action === "add" && !value.includes(op.doctor)) value = [...value, op.doctor];
        if (op.action === "remove") value = value.filter((d) => d !== op.doctor);
        next = {
          ...next,
          [op.row]: { ...next[op.row], [op.day]: { ...cell, value, type: value.length ? "doctor" : "empty" } },
        };
        changed = true;
      }
      if (changed) {
        setSchedule(next);
        void persistSchedule(next);
      }
    },
    [schedule, persistSchedule],
  );

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
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="relative text-xs h-8 md:h-10"
              onClick={() => setShowRequests(true)}
            >
              <Bell className="h-4 w-4 md:mr-1" />
              <span className="hidden md:inline">Demandes</span>
              {(isAdmin ? pendingRequests.length : changeRequests.length) > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {isAdmin ? pendingRequests.length : changeRequests.length}
                </span>
              )}
            </Button>
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
                weekStartDate={weekDates[0]}
                onCommandExecuted={(data) => {
                  applyVoiceOperations(data);
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
                <h3 className="font-bold text-slate-900">
                  {isAdmin ? "Modifier l'affectation" : "Consulter l'affectation"}
                </h3>
                <p className="text-xs text-slate-500">{selectedCell.day} - {selectedCell.row}</p>
              </div>
              <button onClick={() => setSelectedCell(null)} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="size-5" />
              </button>
            </div>

            <div className="mb-4 flex flex-wrap gap-2 min-h-[40px] p-2 bg-slate-50 rounded-lg border border-slate-100">
              {schedule[selectedCell.row][selectedCell.day].value.length === 0 && (
                <span className="text-slate-400 text-sm italic self-center">Aucun médecin</span>
              )}
              {schedule[selectedCell.row][selectedCell.day].value.map((doc, index) => (
                <div key={index} className={`flex items-center gap-1 pl-2 pr-1 py-1 rounded-md text-white text-sm font-bold shadow-sm ${DOCTOR_COLORS[doc] || 'bg-gray-500'}`}>
                  {doc}
                  {isAdmin && (
                    <button onClick={() => removeDoctorFromCell(index)} className="ml-1 hover:bg-black/20 rounded-full p-0.5">
                      <X className="size-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {!isAdmin ? (
              <div className="text-center py-4 text-gray-500 text-sm">
                🔒 Vous êtes en mode lecture.<br />
                Utilisez le bouton ci-dessous pour demander un changement.
              </div>
            ) : (
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
            )}

            {isAdmin ? (
              <button className="w-full py-2 bg-gray-200 rounded-lg hover:bg-gray-300" onClick={() => setSelectedCell(null)}>
                Fermer
              </button>
            ) : (
              <div className="mt-2">
                <button
                  onClick={() => {
                    if (!selectedCell) return;
                    setRequestedDoctor("");
                    setReason("");
                    setRequestModal({
                      open: true,
                      row: selectedCell.row,
                      day: selectedCell.day,
                      currentDoctor: schedule[selectedCell.row][selectedCell.day].value[0],
                    });
                    setSelectedCell(null);
                  }}
                  className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <span>📩</span> Demander un changement
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modale de demande de changement */}
      {requestModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-xl max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold mb-2">📩 Demander un changement</h3>
            <p className="text-sm text-gray-600 mb-4">
              {requestModal.day} – {requestModal.row}
              {requestModal.currentDoctor && ` (actuellement: ${requestModal.currentDoctor})`}
            </p>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Médecin souhaité (ex: P)"
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={requestedDoctor}
                onChange={(e) => setRequestedDoctor(e.target.value)}
              />
              <textarea
                placeholder="Raison de la demande (optionnel)"
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={submitRequest}
                disabled={isSubmitting}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Envoi...' : 'Envoyer'}
              </button>
              <button
                onClick={() => {
                  setRequestModal({ open: false, row: '', day: '' });
                  setRequestedDoctor('');
                  setReason('');
                }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 py-2 rounded-lg font-medium transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panneau des demandes de modification */}
      {showRequests && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setShowRequests(false)}
        >
          <div
            className="w-full max-w-lg max-h-[80vh] overflow-auto rounded-2xl bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900">Demandes de modification</h3>
                <p className="text-xs text-slate-500">
                  {isAdmin ? "Vue administrateur" : "Mes demandes"} · Semaine {weekInfo.week} • {weekInfo.year}
                </p>
              </div>
              <button onClick={() => setShowRequests(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="size-5" />
              </button>
            </div>

            {changeRequests.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">Aucune demande pour cette semaine.</p>
            ) : (
              <ul className="space-y-2">
                {changeRequests.map((req) => (
                  <li key={req.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm">
                        <div className="font-medium text-slate-800">{req.row_key} — {req.day_name}</div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {req.current_doctor ? (
                            <>Actuel : <span className="font-semibold">{req.current_doctor}</span> → </>
                          ) : (
                            <>Demandé : </>
                          )}
                          <span className="font-semibold text-teal-700">{req.requested_doctor}</span>
                        </div>
                        {req.reason && <div className="mt-1 text-xs italic text-slate-400">« {req.reason} »</div>}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          req.status === "pending"
                            ? "bg-amber-100 text-amber-700"
                            : req.status === "approved"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {req.status === "pending"
                          ? "En attente"
                          : req.status === "approved"
                          ? "Approuvée"
                          : "Rejetée"}
                      </span>
                    </div>
                    {isAdmin && req.status === "pending" && (
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => approveRequest(req)}
                          className="flex flex-1 items-center justify-center gap-1 rounded-md bg-green-600 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                        >
                          <Check className="size-3" /> Approuver
                        </button>
                        <button
                          onClick={() => rejectRequest(req)}
                          className="flex-1 rounded-md bg-red-100 py-1.5 text-xs font-medium text-red-700 hover:bg-red-200"
                        >
                          Rejeter
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
