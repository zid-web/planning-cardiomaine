"use client"

import React, { useState, useMemo, useEffect } from "react"
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Edit3,
  X,
  Info,
  BarChart3,
  CalendarIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { LiveClock } from "@/components/live-clock"
import { LearnMoreModal } from "@/components/learn-more-modal"
import type { FullSchedule, ScheduleData } from "@/lib/types"
import { ACTIVITY_ICONS, DAYS, DOCTOR_COLORS, DOCTORS } from "@/lib/constants"
import { generateWeekSchedule, getWeekDates, getWeekNumber, getFrenchPublicHolidays } from "@/lib/schedule-utils"
import { generateNightGuardProposals, constraints2026, type GuardProposal } from "@/lib/guard-scheduler"
import { calculateWorkloadStats } from "@/lib/scheduler-algo"
import { canAssignDoctor, detectConflict } from "@/lib/assignment-validation"
import { populateCongesRowFromVacations } from "@/lib/vacation-congés-mapper"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { saveScheduleToDb, saveFullScheduleToDb } from "@/app/actions/schedule-actions"
import { generateGuardsWithVacations } from "@/app/actions/guard-generation-actions"
import { getAllVacations } from "@/app/actions/vacation-actions"
import { generateWeekWithSolver } from "@/app/actions/solver-api-actions"
import { VacationsModal } from "@/components/vacations-modal"
import { VacationsButton } from "@/components/vacations-button"
import { VacationsBadge } from "@/components/vacations-badge"
import { GuardGenerationButton } from "@/components/guard-generation-button"
import { VoiceAndUploadPanel } from "@/components/VoiceAndUploadPanel"
import { DoctorVacation } from "@/lib/types"
import { toast } from "sonner"

interface PlanningPageProps {
  initialFullSchedule?: FullSchedule
  currentUser?: string
  doctorCode?: string
  isAdmin?: boolean
}

export default function PlanningPage({
  initialFullSchedule = {},
  currentUser = "unknown",
  doctorCode = "",
  isAdmin = false,
}: PlanningPageProps) {
  const [fullSchedule, setFullSchedule] = useState<FullSchedule>(initialFullSchedule)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedCell, setSelectedCell] = useState<{ row: string; day: string } | null>(null)
  const [noteModalOpen, setNoteModalOpen] = useState(false)
  const [currentNote, setCurrentNote] = useState("")
  const [noteDay, setNoteDay] = useState("")
  const [learnMoreOpen, setLearnMoreOpen] = useState<boolean>(false)
  const [showWorkloadStats, setShowWorkloadStats] = useState(false)
  const [guardProposals, setGuardProposals] = useState<Map<string, GuardProposal[]>>(new Map())
  const [showProposals, setShowProposals] = useState(false)
  const [vacations, setVacations] = useState<DoctorVacation[]>([])
  const [vacationsModalOpen, setVacationsModalOpen] = useState(false)
  const [selectedDoctorForVacations, setSelectedDoctorForVacations] = useState<string>("")
  const [generatedScheduleWarnings, setGeneratedScheduleWarnings] = useState<string[]>([])
  const [isGenerating, setIsGenerating] = useState(false)

  // Load vacations on mount
  useEffect(() => {
    loadVacations()
  }, [])

  const loadVacations = async () => {
    try {
      const data = await getAllVacations()
      setVacations(data)
    } catch (error) {
      console.error("[v0] Error loading vacations:", error)
    }
  }

  const handleGenerationComplete = (schedule: ScheduleData, warnings: string[]) => {
    const currentWeekKey = `${currentDate.getFullYear()}-W${String(getWeekNumber(currentDate)).padStart(2, '0')}`
    
    setFullSchedule((prev) => ({
      ...prev,
      [currentWeekKey]: {
        ...schedule,
        Congés: prev[currentWeekKey]?.Congés || schedule.Congés,
        'Notes du jour': prev[currentWeekKey]?.['Notes du jour'] || schedule['Notes du jour'],
      },
    }))

    setGeneratedScheduleWarnings(warnings)
    toast.success(`Planning généré avec ${Object.values(schedule).flat().length} assignations`)
  }

  const currentWeekInfo = useMemo(() => getWeekNumber(currentDate), [currentDate])
  const weekKey = `${currentWeekInfo.year}-W${currentWeekInfo.week}`
  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate])

  const schedule = useMemo(() => {
    let scheduleToUse: ScheduleData
    
    if (!fullSchedule[weekKey]) {
      const generated = generateWeekSchedule(weekKey)
      DAYS.forEach((day) => {
        if (!generated["Notes du jour"][day]) {
          generated["Notes du jour"][day] = { value: [], type: "empty", status: "validated" }
        }
      })
      scheduleToUse = generated
    } else {
      scheduleToUse = fullSchedule[weekKey]
    }

    if (vacations.length > 0) {
      scheduleToUse = populateCongesRowFromVacations(scheduleToUse, vacations, weekKey)
    }

    return scheduleToUse
  }, [fullSchedule, weekKey, vacations])

  const workloadStats = useMemo(() => calculateWorkloadStats(schedule), [schedule])

  const updateSchedule = async (newSchedule: ScheduleData) => {
    const updatedFullSchedule = {
      ...fullSchedule,
      [weekKey]: newSchedule,
    }
    setFullSchedule(updatedFullSchedule)

    try {
      await saveScheduleToDb(weekKey, newSchedule, currentUser || "unknown")
      await saveFullScheduleToDb(updatedFullSchedule)
      console.log("[v0] Saved to Supabase")
      toast.success("Planning saved successfully")
    } catch (error) {
      console.error("[v0] Failed to save to Supabase:", error)
      toast.error("Failed to save planning")
    }
  }

  const currentDayIndex = (currentDate.getDay() + 6) % 7

  const handleCellClick = (rowKey: string, day: string) => {
    if (isCellBlocked(rowKey, day)) return
    if (rowKey === "Notes du jour" || rowKey === "Congés") return
    setSelectedCell({ row: rowKey, day })
  }

  const addDoctorToCell = (doctor: string) => {
    if (!selectedCell || !schedule) return

    const dateStr = weekDates[selectedCell.day]?.toISOString().split('T')[0]
    if (dateStr) {
      const validation = canAssignDoctor(doctor, dateStr, selectedCell.row, vacations)
      if (!validation.allowed) {
        toast.error(validation.reason || 'Assignation impossible')
        return
      }
    }

    const newSchedule = { ...schedule }
    const currentCell = newSchedule[selectedCell.row][selectedCell.day]
    const currentValues = currentCell.value

    const newValues = [...currentValues, doctor]
    const newStatus = currentUser === "M" || currentUser === "Z" ? "validated" : "pending"

    newSchedule[selectedCell.row][selectedCell.day] = {
      value: newValues,
      type: newValues.length > 0 ? "doctor" : "empty",
      status: newStatus,
      request:
        newStatus === "pending"
          ? {
              requester: currentUser,
              status: "pending",
              timestamp: Date.now(),
            }
          : undefined,
    }

    // Garde logic
    if (selectedCell.row.includes("Garde Nuit")) {
      const dayIndex = DAYS.indexOf(selectedCell.day)
      if (
        dayIndex >= 0 &&
        dayIndex < DAYS.length - 1 &&
        selectedCell.day !== "VENDREDI" &&
        selectedCell.day !== "SAMEDI"
      ) {
        const nextDay = DAYS[dayIndex + 1]
        const currentOffDoctors = newSchedule["1/2 journée off Matin"][nextDay].value

        if (!currentOffDoctors.includes(doctor)) {
          newSchedule["1/2 journée off Matin"][nextDay].value = [...currentOffDoctors, doctor]
        }
      }
    }

    updateSchedule(newSchedule)
  }

  const removeDoctorFromCell = (indexToRemove: number) => {
    if (!selectedCell) return

    const newSchedule = { ...schedule }
    const currentCell = newSchedule[selectedCell.row][selectedCell.day]
    const currentValues = currentCell.value

    const newValues = currentValues.filter((_, index) => index !== indexToRemove)
    const newStatus = currentUser === "M" || currentUser === "Z" ? "validated" : "pending"

    newSchedule[selectedCell.row][selectedCell.day] = {
      value: newValues,
      type: newValues.length > 0 ? "doctor" : "empty",
      status: newStatus,
      request:
        newStatus === "pending"
          ? {
              requester: currentUser,
              status: "pending",
              timestamp: Date.now(),
            }
          : undefined,
    }

    updateSchedule(newSchedule)
    setSelectedCell(null)
  }

  const handleNoteClick = (day: string) => {
    setNoteDay(day)
    setCurrentNote(schedule["Notes du jour"][day]?.value[0] || "")
    setNoteModalOpen(true)
  }

  const saveNote = () => {
    const newSchedule = { ...schedule }
    newSchedule["Notes du jour"][noteDay] = {
      value: [currentNote],
      type: "empty",
      status: "validated",
    }

    updateSchedule(newSchedule)
    setNoteModalOpen(false)
  }

  const nextWeek = () => {
    const next = new Date(currentDate)
    next.setDate(next.getDate() + 7)
    setCurrentDate(next)
  }

  const prevWeek = () => {
    const prev = new Date(currentDate)
    prev.setDate(prev.getDate() - 7)
    setCurrentDate(prev)
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const getRowColor = (rowKey: string) => {
    if (rowKey.includes("Vacance")) return "bg-orange-100/50 hover:bg-orange-100"
    if (rowKey.includes("Rythmo")) return "bg-yellow-100/50 hover:bg-yellow-100"
    if (rowKey.includes("Coro")) return "bg-sky-100/50 hover:bg-sky-100"
    if (rowKey.includes("Matin")) return "bg-blue-50/50 hover:bg-blue-50"
    if (rowKey.includes("Apm")) return "bg-orange-50/50 hover:bg-orange-50"
    if (rowKey.includes("Garde") || rowKey.includes("Astreinte")) return "bg-red-50/50 hover:bg-red-50"
    if (rowKey.includes("Hors site")) return "bg-slate-50/50 hover:bg-slate-100"
    return "hover:bg-slate-50"
  }

  const isDateHoliday = (dateStr: string) => {
    const [day, month, year] = dateStr.split("/")
    const fullYear = Number.parseInt(year) + 2000
    const holidays = getFrenchPublicHolidays(fullYear)
    const key = `${day}/${month}/${fullYear}`
    return holidays[key]
  }

  const isAllowedOnHoliday = (rowKey: string) => {
    return rowKey.includes("Astreintes ATL") || rowKey.includes("Garde")
  }

  const isCellBlocked = (row: string, day: string) => {
    if ((day === "SAMEDI" || day === "DIMANCHE") && !isAllowedOnHoliday(row)) {
      return true
    }

    if (row.includes("RÉEDUCATION") && (day === "MARDI" || day === "JEUDI")) return true
    if (row.includes("PSSL") && ["LUNDI", "MARDI", "MERCREDI", "VENDREDI"].includes(day)) return true
    if (row.includes("LFB") && ["LUNDI", "MERCREDI", "VENDREDI"].includes(day)) return true
    if (row.includes("Scinti") && ["JEUDI", "VENDREDI"].includes(day)) return true
    if (row.includes("IRM") && ["MARDI", "MERCREDI", "JEUDI"].includes(day)) return true
    if (row.includes("CDL") && ["LUNDI", "MERCREDI", "JEUDI", "VENDREDI"].includes(day)) return true
    if (row.includes("NCT") && ["LUNDI", "MARDI", "MERCREDI", "VENDREDI"].includes(day)) return true
    if (row.includes("Entrées PSS") && ["MERCREDI", "JEUDI", "VENDREDI"].includes(day)) return true

    return false
  }

  const scheduleMap = useMemo(() => {
    const map = new Map<string, ScheduleData>()
    Object.entries(fullSchedule).forEach(([key, value]) => {
      map.set(key, value)
    })
    return map
  }, [fullSchedule])

  const handleGenerateGuards = async () => {
    const startDate = new Date()
    const endDate = new Date("2026-12-31")

    try {
      const result = await generateGuardsWithVacations(startDate, endDate)

      if (result.error) {
        toast.error(`Erreur: ${result.error}`)
        return
      }

      const proposals = result.proposals

      const proposalsByWeek = new Map<string, GuardProposal[]>()
      proposals.forEach((p) => {
        if (!proposalsByWeek.has(p.weekKey)) proposalsByWeek.set(p.weekKey, [])
        proposalsByWeek.get(p.weekKey)!.push(p)
      })

      setGuardProposals(proposalsByWeek)
      setShowProposals(true)
      toast.success(`${proposals.length} propositions de gardes de nuit générées (vacations incluses)`)
    } catch (error) {
      console.error("[v0] Error generating guards:", error)
      toast.error("Erreur lors de la génération des gardes")
    }
  }

  return (
    <div className="flex flex-col h-full layout-main">
      <div className="flex-1">
        <ScrollArea className="h-full">
          <div className="p-4 pb-24">
            {/* Header */}
            <div className="header-sticky flex items-center justify-between mb-6 bg-white p-4 rounded-xl shadow-sm border">
              <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={prevWeek}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-center">
                  <h2 className="text-lg font-bold text-slate-900">Semaine {currentWeekInfo.week}</h2>
                  <p className="text-xs text-slate-500">{currentWeekInfo.year}</p>
                </div>
                <Button variant="outline" size="icon" onClick={nextWeek}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={goToToday} title="Semaine actuelle">
                  <CalendarIcon className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={goToToday} className="text-xs">
                  Aujourd&apos;hui
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <LiveClock />
                {isAdmin && (
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={handleGenerateGuards}>
                      <Calendar className="h-4 w-4 mr-2" />
                      Générer Gardes Nuit
                    </Button>

                    <VacationsButton
                      onClick={() => {
                        setSelectedDoctorForVacations("")
                        setVacationsModalOpen(true)
                      }}
                    />

                    <GuardGenerationButton
                      weekKey={`${currentDate.getFullYear()}-W${String(getWeekNumber(currentDate)).padStart(2, '0')}`}
                      vacations={vacations}
                      onGenerationComplete={handleGenerationComplete}
                    />

                    <Button variant="outline" size="sm" onClick={() => setShowWorkloadStats(!showWorkloadStats)}>
                      <BarChart3 className="h-4 w-4 mr-2" />
                      {showWorkloadStats ? "Masquer" : "Afficher"} Stats
                    </Button>
                  </div>
                )}
                <Button variant="ghost" size="icon" onClick={() => setLearnMoreOpen(true)} className="text-blue-600">
                  <Info className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Planning Table */}
            <div className="rounded-xl border bg-white shadow-sm">
              <div className="overflow-x-auto w-full max-w-[100vw] md:max-w-none -webkit-overflow-scrolling-touch max-h-[calc(100vh-200px)] md:max-h-[70vh] overflow-y-auto">
                <table className="text-xs border-collapse table-layout-fixed w-max md:w-full min-w-[700px]">
                  <thead className="sticky top-0 z-40 bg-slate-100 shadow-sm">
                    <tr>
                      <th className="sticky left-0 z-50 bg-slate-100 p-2 md:p-3 text-left font-bold text-slate-700 border-b border-r min-w-[120px] text-[10px] md:text-xs">
                        Activité
                      </th>
                      {DAYS.map((d, i) => (
                        <th
                          key={d}
                          className={`p-1.5 md:p-2 text-center font-medium min-w-[85px] border-r last:border-r-0 relative group whitespace-nowrap text-[11px]
                            ${d === "SAMEDI" || d === "DIMANCHE" ? "bg-slate-50/80" : "bg-white"}
                            ${isDateHoliday(weekDates[i]) ? "bg-red-100 text-red-700 border-l-4 border-r-4 border-red-400" : ""}
                          `}
                        >
                          <div className="text-[9px] md:text-[10px] uppercase tracking-wider">{d.slice(0, 3)}</div>
                          <div className="text-xs md:text-sm font-bold">{weekDates[i].slice(0, 5)}</div>

                          {isDateHoliday(weekDates[i]) && (
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full bg-red-600 text-white text-[10px] px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none mb-1">
                              🎉 {isDateHoliday(weekDates[i])}
                            </div>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(generateWeekSchedule(weekKey)).map((rowKey) => {
                      const rowData = schedule[rowKey] || generateWeekSchedule(weekKey)[rowKey]

                      if (rowKey === "Notes du jour") {
                        return (
                          <tr key={rowKey} className="border-b last:border-0 bg-yellow-50">
                            <td className="sticky left-0 z-20 bg-yellow-50 p-2 font-bold text-yellow-700 border-r text-[11px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[120px] text-[10px] md:text-xs">
                              📝 Notes
                            </td>
                            {DAYS.map((day) => (
                              <td
                                key={day}
                                className="table-cell-default p-1 text-center border-r last:border-r-0 h-10"
                              >
                                <div
                                  onClick={() => handleNoteClick(day)}
                                  className="flex h-full w-full cursor-pointer items-center justify-center rounded-md text-[10px] text-slate-600 hover:bg-yellow-100 px-1 truncate"
                                >
                                  {rowData[day]?.value[0] || "+ Note"}
                                </div>
                              </td>
                            ))}
                          </tr>
                        )
                      }

                      return (
                        <tr
                          key={rowKey}
                          className={`border-b last:border-0 transition-colors ${getRowColor(rowKey)}`}
                        >
                          <td className="sticky left-0 z-20 bg-white p-2 font-medium text-slate-700 border-r text-[11px] truncate max-w-[140px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[120px] text-[10px] md:text-xs">
                            {rowKey}
                          </td>
                          {DAYS.map((day) => {
                            const cellData = rowData[day]
                            const isSelected = selectedCell?.row === rowKey && selectedCell?.day === day
                            const isBlocked = isCellBlocked(rowKey, day)
                            const cellValue = cellData?.value || []

                            return (
                              <td
                                key={`${rowKey}-${day}`}
                                className={`p-1 text-center border-r last:border-r-0 h-16 ${
                                  isSelected ? "bg-blue-100" : ""
                                } ${isBlocked ? "bg-gray-100 cursor-not-allowed" : "cursor-pointer"}`}
                                onClick={() => !isBlocked && handleCellClick(rowKey, day)}
                              >
                                <div className="flex flex-wrap gap-1 justify-center h-full items-center">
                                  {cellValue.map((doctor, idx) => (
                                    <Badge
                                      key={idx}
                                      className={`${DOCTOR_COLORS[doctor] || "bg-slate-500"} text-white border-none px-1.5 py-0 text-[10px] cursor-pointer relative group`}
                                    >
                                      {doctor}
                                      {selectedCell?.row === rowKey && selectedCell?.day === day && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            removeDoctorFromCell(idx)
                                          }}
                                          className="ml-1 opacity-0 group-hover:opacity-100"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      )}
                                    </Badge>
                                  ))}
                                  {cellValue.length === 0 && isSelected && (
                                    <span className="text-[10px] text-slate-400">+</span>
                                  )}
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Voice and Upload Panel */}
            <VoiceAndUploadPanel
              onCommandExecuted={(result) => {
                // Rafraîchir le planning après exécution d'une commande vocale
                console.log("[v0] Voice command executed:", result)
                if (result?.updated) {
                  // Recharger les données si nécessaire
                }
              }}
              isOpen={true}
              weekStartDate={
                weekDates[0] instanceof Date 
                  ? weekDates[0].toISOString().split('T')[0]
                  : weekDates[0]
              }
            />
          </div>
        </ScrollArea>
      </div>

      {/* Doctor Selection Modal */}
      {selectedCell && (
        <Dialog open={!!selectedCell} onOpenChange={() => setSelectedCell(null)}>
          <DialogContent className="max-w-sm">
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold">{selectedCell.row}</h2>
                <p className="text-sm text-slate-500">{selectedCell.day}</p>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-slate-900">Ajouter un médecin</h3>
                <div className="grid grid-cols-3 gap-2">
                  {DOCTORS.map((doctor) => (
                    <Button
                      key={doctor}
                      onClick={() => addDoctorToCell(doctor)}
                      className={`${DOCTOR_COLORS[doctor] || "bg-slate-500"} text-white text-xs py-1`}
                    >
                      {doctor}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-slate-900">Médecins présents</h3>
                <div className="flex flex-wrap gap-2">
                  {schedule[selectedCell.row][selectedCell.day].value.map((doctor, idx) => (
                    <Badge
                      key={idx}
                      className={`${DOCTOR_COLORS[doctor] || "bg-slate-500"} text-white border-none`}
                    >
                      {doctor}
                      <button
                        onClick={() => removeDoctorFromCell(idx)}
                        className="ml-2 hover:opacity-75"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              <Button variant="outline" onClick={() => setSelectedCell(null)}>
                Fermer
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Note Modal */}
      <Dialog open={noteModalOpen} onOpenChange={setNoteModalOpen}>
        <DialogContent>
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold">Note du {noteDay}</h2>
            </div>
            <Textarea
              value={currentNote}
              onChange={(e) => setCurrentNote(e.target.value)}
              placeholder="Ajouter une note..."
              className="min-h-[100px]"
            />
            <div className="flex gap-2">
              <Button onClick={saveNote} className="flex-1">
                Sauvegarder
              </Button>
              <Button variant="outline" onClick={() => setNoteModalOpen(false)}>
                Annuler
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Vacations Modal */}
      {vacationsModalOpen && (
        <VacationsModal
          isOpen={vacationsModalOpen}
          onClose={() => setVacationsModalOpen(false)}
          selectedDoctor={selectedDoctorForVacations}
          onSelectDoctor={setSelectedDoctorForVacations}
          onVacationAdded={() => {
            loadVacations()
            setVacationsModalOpen(false)
          }}
        />
      )}

      {/* Learn More Modal */}
      {learnMoreOpen && <LearnMoreModal onClose={() => setLearnMoreOpen(false)} />}
    </div>
  )
}
