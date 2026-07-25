"use client"

import React, { useState, useMemo, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Bell,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Edit3,
  FileDown,
  History,
  Home,
  List,
  MessageSquare,
  Mic,
  UserCircle,
  UserCog,
  Wifi,
  WifiOff,
  X,
  Info,
  BarChart3,
  CheckCircle2,
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
import {
  getScheduleHistory,
  saveScheduleToDb,
  type ScheduleHistoryRow,
} from "@/app/actions/schedule-actions"
import type { ScheduleSaveSource } from "@/lib/schedule-diff"
import { generateGuardsWithVacations } from "@/app/actions/guard-generation-actions"
import { getAllVacations } from "@/app/actions/vacation-actions"
import { generateWeekWithSolver } from "@/app/actions/solver-api-actions"
import { applyChangeRequest, rejectChangeRequest } from "@/app/actions/change-request-actions"
import { VacationsModal } from "@/components/vacations-modal"
import { VacationsButton } from "@/components/vacations-button"
import { VacationsBadge } from "@/components/vacations-badge"
import { GuardGenerationButton } from "@/components/guard-generation-button"
import { VoiceAndUploadPanel } from "@/components/VoiceAndUploadPanel"
import { DoctorVacation } from "@/lib/types"
import { createClient } from "@/lib/supabase/client"
import {
  applyMappedExistingSchedule,
  applyParsedCommandToSchedule,
  applyPdfExtractionToSchedule,
  buildCurrentWeekRequestPayload,
  getIsoWeekStartDate,
  mergeAssignmentsIntoSchedule,
} from "@/lib/guard-api-mapping"
import { toast } from "sonner"

type ChangeRequest = {
  id: string
  requester_id: string | null
  week_key: string
  day_name: string
  row_key: string
  slot: string | null
  current_doctor: string | null
  requested_doctor: string
  reason: string | null
  status: "pending" | "approved" | "rejected"
  admin_comment: string | null
  created_at: string
  updated_at: string
}

function formatWeekKey(date: Date) {
  const { year, week } = getWeekNumber(date)
  return `${year}-W${String(week).padStart(2, "0")}`
}

export function ScheduleApp({
  currentUser,
  doctorCode,
  isAdmin,
  fullSchedule,
  setFullSchedule,
  onLogout,
  onChangePassword,
}: {
  currentUser: string
  doctorCode: string
  isAdmin: boolean
  fullSchedule: FullSchedule
  setFullSchedule: React.Dispatch<React.SetStateAction<FullSchedule>>
  onLogout: () => void
  onChangePassword: () => void
}) {
  const [activeTab, setActiveTab] = useState<"today" | "week" | "all">("today")
  const [currentDate, setCurrentDate] = useState(new Date()) // Track current date
  const [selectedCell, setSelectedCell] = useState<{ row: string; day: string } | null>(null)
  const [noteModalOpen, setNoteModalOpen] = useState(false)
  const [currentNote, setCurrentNote] = useState("")
  const [noteDay, setNoteDay] = useState("")
  const [learnMoreOpen, setLearnMoreOpen] = useState(false)
  const [showWorkloadStats, setShowWorkloadStats] = useState(false)
  const [guardProposals, setGuardProposals] = useState<Map<string, GuardProposal[]>>(new Map())
  const [showProposals, setShowProposals] = useState(false)
  const [vacations, setVacations] = useState<DoctorVacation[]>([])
  const [vacationsModalOpen, setVacationsModalOpen] = useState(false)
  const [selectedDoctorForVacations, setSelectedDoctorForVacations] = useState<string>("")
  const [generatedScheduleWarnings, setGeneratedScheduleWarnings] = useState<string[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [voicePanelOpen, setVoicePanelOpen] = useState(false)
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([])
  const [showRequests, setShowRequests] = useState(false)
  const [requestModal, setRequestModal] = useState<{
    open: boolean
    row: string
    day: string
    slot?: string
    currentDoctor?: string
  }>({ open: false, row: "", day: "" })
  const [requestedDoctor, setRequestedDoctor] = useState("")
  const [reason, setReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [historyRows, setHistoryRows] = useState<ScheduleHistoryRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [realtimeStatus, setRealtimeStatus] = useState<"connecting" | "live" | "error">("connecting")

  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const currentWeekInfo = useMemo(() => getWeekNumber(currentDate), [currentDate])
  const weekKey = useMemo(() => formatWeekKey(currentDate), [currentDate])
  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate])
  const isoWeekStart = useMemo(() => getIsoWeekStartDate(currentDate), [currentDate])

  // Load vacations on mount
  useEffect(() => {
    void loadVacations()
  }, [])

  const loadVacations = async () => {
    try {
      const data = await getAllVacations()
      setVacations(data)
    } catch (error) {
      console.error("[app] Error loading vacations:", error)
    }
  }

  const refreshRequests = useCallback(async () => {
    const { data } = await supabase
      .from("change_requests")
      .select("*")
      .eq("week_key", weekKey)
      .order("created_at", { ascending: false })
    setChangeRequests((data as ChangeRequest[]) || [])
  }, [supabase, weekKey])

  useEffect(() => {
    void refreshRequests()
  }, [refreshRequests])

  // G3: sync planning between admins via Supabase Realtime
  useEffect(() => {
    if (!isAdmin) return

    setRealtimeStatus("connecting")
    const channel = supabase
      .channel("planning-schedules")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "schedules" },
        (payload) => {
          const row = payload.new as {
            week_key?: string
            schedule_data?: ScheduleData
            updated_by?: string
          } | null
          if (!row?.week_key || row.week_key === "full_schedule") return
          if (row.updated_by && row.updated_by === currentUser) return
          if (!row.schedule_data) return

          setFullSchedule((prev) => ({
            ...prev,
            [row.week_key!]: row.schedule_data!,
          }))
          toast.message(`Planning ${row.week_key} synchronisé`, {
            description: row.updated_by ? `par ${row.updated_by}` : undefined,
          })
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setRealtimeStatus("live")
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setRealtimeStatus("error")
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [supabase, isAdmin, currentUser, setFullSchedule])

  // Gère le résultat de la génération via API — persiste en base (patch Claude)
  const handleGenerationComplete = async (schedule: ScheduleData, warnings: string[]) => {
    const currentWeekKey = formatWeekKey(currentDate)

    const mergedWeekSchedule: ScheduleData = {
      ...schedule,
      Congés: fullSchedule[currentWeekKey]?.Congés || schedule.Congés,
      "Notes du jour":
        fullSchedule[currentWeekKey]?.["Notes du jour"] || schedule["Notes du jour"],
    }

    const updatedFullSchedule = { ...fullSchedule, [currentWeekKey]: mergedWeekSchedule }
    setFullSchedule(updatedFullSchedule)

    try {
      await saveScheduleToDb(currentWeekKey, mergedWeekSchedule, currentUser || "unknown", {
        source: "solver",
      })
    } catch (error) {
      toast.error("Le planning a été généré mais la sauvegarde a échoué. Réessayez.")
      console.error("[schedule-app] Échec de sauvegarde après génération:", error)
      return
    }

    setGeneratedScheduleWarnings(warnings)
    toast.success(
      `Planning généré et sauvegardé avec ${Object.values(schedule).flat().length} assignations`,
    )
  }

  // Ensure schedule exists for this week
  const schedule = useMemo(() => {
    let scheduleToUse: ScheduleData
    
    if (!fullSchedule[weekKey]) {
      const generated = generateWeekSchedule(weekKey)
      // Ensure all days in the generated schedule have empty notes for consistency
      DAYS.forEach((day) => {
        if (!generated["Notes du jour"][day]) {
          generated["Notes du jour"][day] = { value: [], type: "empty", status: "validated" }
        }
      })
      scheduleToUse = generated
    } else {
      scheduleToUse = fullSchedule[weekKey]
    }

    // RÈGLE ABSOLUE: Remplir automatiquement la ligne "Congés" avec les médecins en vacances
    if (vacations.length > 0) {
      scheduleToUse = populateCongesRowFromVacations(scheduleToUse, vacations, weekKey)
    }

    return scheduleToUse
  }, [fullSchedule, weekKey, vacations])

  const workloadStats = useMemo(() => calculateWorkloadStats(schedule), [schedule])

  // Update full schedule when local schedule changes
  const updateSchedule = async (
    newSchedule: ScheduleData,
    source: ScheduleSaveSource = "ui",
  ) => {
    const updatedFullSchedule = {
      ...fullSchedule,
      [weekKey]: newSchedule,
    }
    setFullSchedule(updatedFullSchedule)

    try {
      // saveScheduleToDb historise + synchronise le blob full_schedule
      await saveScheduleToDb(weekKey, newSchedule, currentUser || "unknown", { source })
      toast.success("Planning enregistré")
    } catch (error) {
      console.error("[app] Failed to save to Supabase:", error)
      toast.error("Échec de l'enregistrement du planning")
    }
  }

  const openHistoryPanel = async () => {
    setShowHistory(true)
    setHistoryLoading(true)
    try {
      const res = await getScheduleHistory(weekKey, 50)
      if (!res.success) {
        toast.error(res.error || "Impossible de charger l'historique")
        setHistoryRows([])
      } else {
        setHistoryRows(res.rows)
      }
    } finally {
      setHistoryLoading(false)
    }
  }

  const exportWeekPdf = () => {
    window.location.href = `/api/export-planning-pdf?week_key=${encodeURIComponent(weekKey)}`
  }

  const currentDayIndex = (currentDate.getDay() + 6) % 7 // 0 = Monday

  const getTaskSortOrder = (activity: string) => {
    if (activity.includes("Matin")) return 1
    if (activity.includes("Apm") || activity.includes("Après-midi")) return 2
    // Entrées and Pré-op treated as "Fin d'après midi" -> 3
    if (activity.includes("Entrées") || activity.includes("Pré-op")) return 3
    if (activity.includes("Soir") || activity.includes("Nuit")) return 4
    return 5 // Fallback
  }

  const getAllTasksForDay = (day: string) => {
    return Object.entries(schedule)
      .filter(([_, rowData]) => rowData[day]?.value.length > 0 && rowData[day]?.type !== "empty")
      .map(([rowKey, rowData]) => ({
        activity: rowKey,
        doctors: rowData[day].value,
        status: rowData[day].status,
      }))
      .sort((a, b) => getTaskSortOrder(a.activity) - getTaskSortOrder(b.activity)) // Added sorting
  }

  const getUserTasks = (day: string) => {
    if (!doctorCode) return []
    return Object.entries(schedule)
      .filter(([_, rowData]) => rowData[day]?.value.includes(doctorCode))
      .map(([rowKey, _]) => ({ rowKey })) // mapping to object to allow sorting
      .sort((a, b) => getTaskSortOrder(a.rowKey) - getTaskSortOrder(b.rowKey))
      .map((item) => item.rowKey)
  }

  const handleCellClick = (rowKey: string, day: string) => {
    if (isCellBlocked(rowKey, day)) return
    // Admin et médecin ouvrent la même modale (édition vs lecture + demande)
    setSelectedCell({ row: rowKey, day })
  }

  const addDoctorToCell = (doctor: string) => {
    if (!isAdmin) return
    if (!selectedCell || !schedule) return

    // Vérifier si le médecin est indisponible (en vacances)
    const dayIndex = DAYS.indexOf(selectedCell.day)
    if (dayIndex >= 0 && isoWeekStart) {
      const dayDate = new Date(`${isoWeekStart}T12:00:00`)
      dayDate.setDate(dayDate.getDate() + dayIndex)
      const dateStr = dayDate.toISOString().split("T")[0]
      const validation = canAssignDoctor(doctor, dateStr, selectedCell.row, vacations)
      if (!validation.allowed) {
        toast.error(validation.reason || "Assignation impossible")
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
      // dayIndex 4 = Friday, 5 = Saturday
      if (
        dayIndex >= 0 &&
        dayIndex < DAYS.length - 1 &&
        selectedCell.day !== "VENDREDI" &&
        selectedCell.day !== "SAMEDI"
      ) {
        const nextDay = DAYS[dayIndex + 1]
        const currentOffDoctors = newSchedule["1/2 journée off Matin"][nextDay].value

        // Only add to OFF if not already there (keep OFF logic unique for now unless requested otherwise)
        if (!currentOffDoctors.includes(doctor)) {
          newSchedule["1/2 journée off Matin"][nextDay].value = [...currentOffDoctors, doctor]
        }
      }
    }

    updateSchedule(newSchedule)
  }

  const removeDoctorFromCell = (indexToRemove: number) => {
    if (!isAdmin || !selectedCell) return

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

  const validateCell = () => {
    if (!selectedCell || (currentUser !== "M" && currentUser !== "Z")) return

    const newSchedule = { ...schedule }
    newSchedule[selectedCell.row][selectedCell.day].status = "validated"
    if (newSchedule[selectedCell.row][selectedCell.day].request) {
      newSchedule[selectedCell.row][selectedCell.day].request = undefined
    }

    updateSchedule(newSchedule)
    setSelectedCell(null)
  }

  const pendingRequests = useMemo(
    () => changeRequests.filter((r) => r.status === "pending"),
    [changeRequests],
  )

  const vacationPayload = useMemo(
    () =>
      (vacations || []).map((v) => ({
        doctor_id: v.doctor_id || "",
        start_date: v.start_date,
        end_date: v.end_date,
      })),
    [vacations],
  )

  const currentWeekRequest = useMemo(
    () =>
      buildCurrentWeekRequestPayload({
        weekStartDate: isoWeekStart,
        weekNumber: currentWeekInfo.week,
        vacations: vacationPayload,
        schedule,
      }),
    [isoWeekStart, currentWeekInfo.week, vacationPayload, schedule],
  )

  const submitRequest = async () => {
    if (!requestedDoctor.trim()) {
      toast.error("Veuillez indiquer le médecin souhaité")
      return
    }
    setIsSubmitting(true)
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
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erreur")
      toast.success("Demande envoyée !")
      setRequestModal({ open: false, row: "", day: "" })
      setRequestedDoctor("")
      setReason("")
      await refreshRequests()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'envoi")
    } finally {
      setIsSubmitting(false)
    }
  }

  const approveRequest = async (req: ChangeRequest) => {
    const result = await applyChangeRequest(req.id)
    if (!result.success) {
      toast.error(result.error || "Erreur lors de l'approbation")
      return
    }
    toast.success(result.message)
    // Recharger la semaine (saveScheduleToDb a déjà sync le blob)
    const { data } = await supabase
      .from("schedules")
      .select("schedule_data")
      .eq("week_key", weekKey)
      .single()
    if (data?.schedule_data) {
      setFullSchedule((prev) => ({
        ...prev,
        [weekKey]: data.schedule_data as ScheduleData,
      }))
    }
    await refreshRequests()
  }

  const rejectRequest = async (req: ChangeRequest) => {
    const result = await rejectChangeRequest(req.id)
    if (!result.success) {
      toast.error(result.error || "Erreur lors du rejet")
      return
    }
    toast.success(result.message)
    await refreshRequests()
  }

  const applyVoiceOrUploadResult = useCallback(
    (data: {
      parsed_command?: {
        date: string
        slot: string
        activity: string
        doctor_out?: string | null
        doctor_in: string
      }
      updated_schedule?: { assignments?: Array<any>; warnings?: string[] }
      raw_extraction?: { rows?: Array<any> }
      mapped_existing_schedule?: Record<string, string[]>
      operations?: Array<{ action: string; doctor?: string; day?: string; row?: string }>
      warnings?: string[]
    }) => {
      let next = schedule
      let changed = false

      if (data?.parsed_command?.doctor_in) {
        const before = JSON.stringify(next)
        next = applyParsedCommandToSchedule(next, data.parsed_command)
        if (JSON.stringify(next) !== before) changed = true
      }

      if (data?.raw_extraction?.rows?.length) {
        const before = JSON.stringify(next)
        next = applyPdfExtractionToSchedule(next, data.raw_extraction.rows)
        if (JSON.stringify(next) !== before) changed = true
      }

      if (data?.mapped_existing_schedule && !data?.parsed_command) {
        const before = JSON.stringify(next)
        next = applyMappedExistingSchedule(next, data.mapped_existing_schedule)
        if (JSON.stringify(next) !== before) changed = true
      }

      for (const op of data?.operations || []) {
        if ((op.action !== "add" && op.action !== "remove") || !op.day || !op.row || !op.doctor) continue
        const cell = next[op.row]?.[op.day]
        if (!cell) continue
        let value = cell.value
        if (op.action === "add" && !value.includes(op.doctor)) value = [...value, op.doctor]
        if (op.action === "remove") value = value.filter((d) => d !== op.doctor)
        next = {
          ...next,
          [op.row]: {
            ...next[op.row],
            [op.day]: { ...cell, value, type: value.length ? "doctor" : "empty" },
          },
        }
        changed = true
      }

      if (!changed && !data?.parsed_command && data?.updated_schedule?.assignments?.length) {
        const before = JSON.stringify(next)
        next = mergeAssignmentsIntoSchedule(next, data.updated_schedule.assignments)
        if (JSON.stringify(next) !== before) changed = true
      }

      const warnings = data?.warnings || data?.updated_schedule?.warnings || []
      if (warnings.length) toast.warning(warnings.slice(0, 3).join("\n"))

      if (changed) {
        const source: ScheduleSaveSource = data?.raw_extraction?.rows?.length
          ? "pdf"
          : data?.mapped_existing_schedule && !data?.parsed_command
            ? "csv"
            : "voice"
        void updateSchedule(next, source)
      }
    },
    // updateSchedule closes over schedule/fullSchedule; intentional for apply-after-response
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schedule],
  )

  const handleNoteClick = (day: string) => {
    if (activeTab === "all" && !isAdmin) return

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

  const goToDay = (dayIndex: number) => {
    const newDate = new Date(currentDate)
    const currentDay = newDate.getDay() // 0 = Sunday
    const diff = dayIndex - (currentDay === 0 ? 6 : currentDay - 1)
    newDate.setDate(newDate.getDate() + diff)
    setCurrentDate(newDate)
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
    // dateStr is dd/mm/yy
    const [day, month, year] = dateStr.split("/")
    const fullYear = Number.parseInt(year) + 2000
    const holidays = getFrenchPublicHolidays(fullYear)
    const key = `${day}/${month}/${fullYear}`
    return holidays[key] // returns Name of holiday or undefined
  }

  const isAllowedOnHoliday = (rowKey: string) => {
    return rowKey.includes("Astreintes ATL") || rowKey.includes("Garde")
  }

  const isCellBlocked = (row: string, day: string) => {
    // Weekend rule: Block everything except Astreintes and Gardes
    if ((day === "SAMEDI" || day === "DIMANCHE") && !isAllowedOnHoliday(row)) {
      return true
    }

    // Rééducation: Block Tuesday and Thursday
    if (row.includes("RÉEDUCATION") && (day === "MARDI" || day === "JEUDI")) return true

    // PSSL: Block Mon, Tue, Wed, Fri
    if (row.includes("PSSL") && ["LUNDI", "MARDI", "MERCREDI", "VENDREDI"].includes(day)) return true

    // LFB: Block Mon, Wed, Fri
    if (row.includes("LFB") && ["LUNDI", "MERCREDI", "VENDREDI"].includes(day)) return true

    // Scinti: Block Thu, Fri
    if (row.includes("Scinti") && ["JEUDI", "VENDREDI"].includes(day)) return true

    // IRM: Block Tue, Wed, Thu
    if (row.includes("IRM") && ["MARDI", "MERCREDI", "JEUDI"].includes(day)) return true

    // CDL: Block Mon, Wed, Thu, Fri
    if (row.includes("CDL") && ["LUNDI", "MERCREDI", "JEUDI", "VENDREDI"].includes(day)) return true

    // NCT: Block Mon, Tue, Wed, Fri
    if (row.includes("NCT") && ["LUNDI", "MARDI", "MERCREDI", "VENDREDI"].includes(day)) return true

    if (row.includes("Entrées PSS") && ["MERCREDI", "JEUDI", "VENDREDI"].includes(day)) return true

    return false
  }

  // Build a map of all schedules to pass to the generator
  const scheduleMap = useMemo(() => {
    const map = new Map<string, ScheduleData>()
    Object.entries(fullSchedule).forEach(([key, value]) => {
      map.set(key, value)
    })
    return map
  }, [fullSchedule])

  const handleGenerateGuards = async () => {
    // Generate for current year through end of 2026
    const startDate = new Date()
    const endDate = new Date("2026-12-31")

    try {
      // Use new function that includes DB vacations
      const result = await generateGuardsWithVacations(startDate, endDate)

      if (result.error) {
        toast.error(`Erreur: ${result.error}`)
        return
      }

      const proposals = result.proposals

      // Group proposals by week
      const proposalsByWeek = new Map<string, GuardProposal[]>()
      proposals.forEach((p) => {
        if (!proposalsByWeek.has(p.weekKey)) proposalsByWeek.set(p.weekKey, [])
        proposalsByWeek.get(p.weekKey)!.push(p)
      })

      setGuardProposals(proposalsByWeek)
      setShowProposals(true)
      toast.success(`${proposals.length} propositions de gardes de nuit générées (vacations incluses)`)
    } catch (error) {
      console.error("[app] Error generating guards:", error)
      toast.error("Erreur lors de la génération des gardes")
    }
  }

  const validateProposal = (proposal: GuardProposal) => {
    const weekSchedule = fullSchedule[proposal.weekKey]
    if (!weekSchedule) return

    const newSchedule = { ...weekSchedule }

    const dayIndex = DAYS.findIndex((d) => d === proposal.day)
    if (dayIndex === -1) return

    const day = DAYS[dayIndex]

    if (newSchedule[proposal.type] && newSchedule[proposal.type][day]) {
      const currentValues = newSchedule[proposal.type][day].value
      if (!currentValues.includes(proposal.user)) {
        newSchedule[proposal.type][day] = {
          value: [...currentValues, proposal.user],
          type: "doctor",
          status: "validated",
        }

        // Update the fullSchedule state and save to DB
        const updatedFullSchedule = {
          ...fullSchedule,
          [proposal.weekKey]: newSchedule,
        }
        setFullSchedule(updatedFullSchedule)
        saveScheduleToDb(proposal.weekKey, newSchedule, currentUser || "unknown")

        // Remove from proposals
        const weekProposals = guardProposals.get(proposal.weekKey) || []
        const filtered = weekProposals.filter(
          (p) => !(p.date === proposal.date && p.type === proposal.type && p.user === proposal.user),
        )
        guardProposals.set(proposal.weekKey, filtered)
        setGuardProposals(new Map(guardProposals))

        toast.success(`Garde validée pour ${proposal.user}`)
      }
    }
  }

  const getCellProposal = (row: string, day: string) => {
    const weekProposals = guardProposals.get(weekKey) || []
    return weekProposals.find((p) => p.type === row && p.day === day)
  }

  return (
    <div className="flex flex-col h-full layout-main">
      {/* Main Content Area */}
      <div className="flex-1">
        <ScrollArea className="h-full">
          <div className="p-4 pb-24">
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
                {/* Adding icon button to return to current week */}
                <Button variant="outline" size="icon" onClick={goToToday} title="Semaine actuelle">
                  <CalendarIcon className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={goToToday} className="text-xs">
                  Aujourd'hui
                </Button>
              </div>
              {generatedScheduleWarnings.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <p className="font-semibold text-yellow-900 mb-2">Alertes de génération:</p>
                  <ul className="text-sm text-yellow-800 list-disc list-inside">
                    {generatedScheduleWarnings.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex items-center gap-2">
                <LiveClock />
                {isAdmin && (
                  <div className="flex gap-2 flex-wrap items-center">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        realtimeStatus === "live"
                          ? "bg-emerald-50 text-emerald-700"
                          : realtimeStatus === "error"
                            ? "bg-red-50 text-red-700"
                            : "bg-slate-100 text-slate-500"
                      }`}
                      title="Synchronisation Realtime entre admins"
                    >
                      {realtimeStatus === "live" ? (
                        <Wifi className="h-3 w-3" />
                      ) : (
                        <WifiOff className="h-3 w-3" />
                      )}
                      {realtimeStatus === "live"
                        ? "Temps réel"
                        : realtimeStatus === "error"
                          ? "Hors ligne"
                          : "Connexion…"}
                    </span>

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
                      weekKey={isoWeekStart}
                      vacations={vacations}
                      onGenerationComplete={(sched, warnings) => {
                        void handleGenerationComplete(sched, warnings)
                      }}
                    />

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportWeekPdf}
                      title="Exporter la semaine en PDF"
                    >
                      <FileDown className="h-4 w-4 mr-2" />
                      Exporter en PDF
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void openHistoryPanel()}
                      title="Historique des modifications"
                    >
                      <History className="h-4 w-4 mr-2" />
                      Historique
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push("/protected/admin/requests")}
                      title="Tableau de bord des demandes"
                    >
                      <Bell className="h-4 w-4 mr-2" />
                      Demandes
                      {pendingRequests.length > 0 && (
                        <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
                          {pendingRequests.length}
                        </span>
                      )}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push("/protected/admin/users")}
                      title="Gestion des comptes"
                    >
                      <UserCog className="h-4 w-4 mr-2" />
                      Comptes
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        setIsGenerating(true)
                        try {
                          const result = await generateWeekWithSolver(isoWeekStart, "ROTATION")
                          if (result.error) {
                            toast.error(`Erreur: ${result.error}`)
                          } else if (result.schedule) {
                            await handleGenerationComplete(result.schedule, result.warnings || [])
                          }
                        } catch (error) {
                          toast.error("Erreur lors de la génération")
                        } finally {
                          setIsGenerating(false)
                        }
                      }}
                      disabled={isGenerating}
                    >
                      {isGenerating ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                          Génération...
                        </>
                      ) : (
                        <>
                          <Calendar className="h-4 w-4 mr-2" />
                          Générer avec Solveur
                        </>
                      )}
                    </Button>

                    {showProposals && (
                      <Button variant="outline" size="sm" onClick={() => setShowProposals(!showProposals)}>
                        {showProposals ? "Masquer" : "Afficher"} Propositions
                      </Button>
                    )}

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

            {/* TODAY VIEW */}
            {activeTab === "today" && (
              <div className="space-y-4 max-w-md mx-auto">
                <div className="flex tabs-scroll pb-2 gap-2 scrollbar-none">
                  {DAYS.map((day, idx) => {
                    const isSelected = idx === currentDayIndex
                    const date = weekDates[idx].split("/")[0]
                    return (
                      <button
                        key={day}
                        onClick={() => goToDay(idx)}
                        className={`
                          flex flex-col items-center justify-center min-w-[60px] p-2 rounded-xl border transition-all
                          ${isSelected ? "bg-blue-600 text-white border-blue-600 shadow-md" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"}
                        `}
                      >
                        <span className="text-[10px] font-medium uppercase opacity-80">{day.slice(0, 3)}</span>
                        <span className="text-lg font-bold">{date}</span>
                      </button>
                    )
                  })}
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-blue-600 p-6 text-white shadow-lg shadow-blue-200">
                  <div>
                    <p className="text-blue-100">Aujourd'hui</p>
                    <h3 className="text-2xl font-bold">{DAYS[currentDayIndex]}</h3>
                    <p className="text-sm text-blue-100">{weekDates[currentDayIndex]}</p>
                  </div>
                  <Calendar className="size-8 text-blue-200" />
                </div>

                <div className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                      <MessageSquare className="size-4 text-blue-500" />
                      Notes du jour
                    </h4>
                    <Button variant="ghost" size="sm" onClick={() => handleNoteClick(DAYS[currentDayIndex])}>
                      <Edit3 className="size-4 text-slate-400" />
                    </Button>
                  </div>
                  <div className="min-h-[60px] rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                    {schedule["Notes du jour"][DAYS[currentDayIndex]]?.value[0] || "Aucune note pour aujourd'hui..."}
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="px-1 font-semibold text-slate-900">Mon Planning</h4>
                  {getAllTasksForDay(DAYS[currentDayIndex]).filter((task) => task.doctors.includes(doctorCode)).length >
                  0 ? (
                    getAllTasksForDay(DAYS[currentDayIndex])
                      .filter((task) => task.doctors.includes(doctorCode))
                      .map((task, idx) => {
                        const isMorning = task.activity.includes("Matin")
                        const isAfternoonOrEvening =
                          task.activity.includes("Apm") ||
                          task.activity.includes("Après-midi") ||
                          task.activity.includes("Soir") ||
                          task.activity.includes("Nuit")

                        let colorClasses = "border-l-slate-300"
                        if (task.doctors.includes(doctorCode)) {
                          if (isMorning) {
                            colorClasses = "border-l-blue-500 bg-blue-50/30"
                          } else if (isAfternoonOrEvening) {
                            colorClasses = "border-l-yellow-500 bg-yellow-50/30"
                          } else {
                            // Fallback for tasks without explicit time
                            colorClasses = "border-l-blue-500 bg-blue-50/30"
                          }
                        }

                        return (
                          <Card
                            key={idx}
                            className={`flex items-center gap-4 border-l-4 p-4 transition-all hover:shadow-md ${colorClasses}`}
                          >
                            <div className="rounded-full bg-slate-100 p-2 text-xl">
                              {/* @ts-ignore */}
                              {ACTIVITY_ICONS[
                                Object.keys(ACTIVITY_ICONS).find((k) => task.activity.includes(k)) || ""
                              ] || "•"}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-slate-900">
                                {task.activity
                                  .replace("Matin - ", "")
                                  .replace("Apm - ", "")
                                  .replace("Hors site - ", "")}
                              </p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {task.doctors.map((doc, i) => (
                                  <Badge
                                    key={i}
                                    className={`${DOCTOR_COLORS[doc] || "bg-slate-500"} text-white border-none px-1.5 py-0 text-[10px]`}
                                  >
                                    {doc}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </Card>
                        )
                      })
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-12 text-center">
                      <div className="mb-2 rounded-full bg-slate-100 p-3">
                        <UserCircle className="size-6 text-slate-400" />
                      </div>
                      <p className="text-slate-500">Aucune activité prévue pour vous ce jour</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* WEEK VIEW */}
            {activeTab === "week" && (
              <div className="space-y-6 max-w-md mx-auto">
                <h3 className="text-xl font-bold text-slate-900">Ma Semaine {currentWeekInfo.week}</h3>
                {DAYS.map((day, idx) => {
                  const tasks = getUserTasks(day)
                  const isToday = idx === currentDayIndex

                  return (
                    <div key={day} className="relative pl-6">
                      {/* Timeline line */}
                      <div className="absolute bottom-0 left-2 top-0 w-0.5 bg-slate-200" />
                      <div
                        className={`absolute left-0 top-0 size-4 rounded-full border-2 border-white ${isToday ? "bg-blue-600" : "bg-slate-300"}`}
                      />

                      <div className="mb-6">
                        <div className="mb-2 flex items-baseline justify-between">
                          <h4 className={`font-bold ${isToday ? "text-blue-600" : "text-slate-700"}`}>{day}</h4>
                          <span className="text-xs text-slate-400">{weekDates[idx].split("/")[0]}</span>
                        </div>

                        {tasks.length > 0 ? (
                          <div className="space-y-2">
                            {tasks.map((task, tIdx) => (
                              <Card key={tIdx} className="p-3 text-sm shadow-sm">
                                {task}
                              </Card>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs italic text-slate-400">Repos / Pas d'affectation</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* GLOBAL VIEW */}
            {activeTab === "all" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between sticky top-0 bg-slate-50 z-10 py-2">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Planning Global</h3>
                    <p className="text-xs text-slate-500">
                      Semaine {currentWeekInfo.week} - {currentWeekInfo.year}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={prevWeek}>
                      Sem. Préc.
                    </Button>
                    <Button variant="outline" size="sm" onClick={nextWeek}>
                      Sem. Suiv.
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border bg-white shadow-sm">
                  <div className="relative">
                    {/* Scroll indicator gradient */}
                    <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white/50 to-transparent pointer-events-none z-10 md:hidden" />
                  </div>
                  <div className="overflow-x-auto w-full md:max-w-none -webkit-overflow-scrolling-touch">
                    <table className="text-xs border-collapse table-layout-fixed w-max md:w-full min-w-[700px]">
                      <thead className="sticky top-0 z-40 bg-slate-100 shadow-sm">
                        <tr>
                          <th className="sticky left-0 z-50 bg-slate-100 p-2 md:p-3 text-left font-bold text-slate-700 border-b border-r min-w-[120px] text-[10px] md:text-xs shadow-[4px_0_8px_-2px_rgba(0,0,0,0.15)]">
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

                          const isSectionStart =
                            rowKey.includes("Matin - Cs PSS") ||
                            rowKey.includes("Apm - Cs PSS") ||
                            rowKey.includes("Astreintes ATL Matin") ||
                            rowKey.includes("Hors site - NCT")
                          const sectionTitle = rowKey.includes("Matin - Cs PSS")
                            ? "VACATIONS MATIN"
                            : rowKey.includes("Apm - Cs PSS")
                              ? "VACATIONS APRÈS-MIDI"
                              : rowKey.includes("Astreintes ATL Matin")
                                ? "ASTREINTES & GARDES"
                                : rowKey.includes("Hors site - NCT")
                                  ? "HORS SITE"
                                  : null

                          if (rowKey === "Notes du jour") {
                            return (
                              <tr key={rowKey} className="border-b last:border-0 bg-yellow-50">
                                <td className="sticky left-0 z-20 bg-yellow-50 p-2 font-bold text-yellow-700 border-r-2 border-yellow-300 text-[11px] shadow-[4px_0_8px_-2px_rgba(0,0,0,0.15)] min-w-[120px] text-[10px] md:text-xs">
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
                            <>
                              {sectionTitle && (
                                <tr className="bg-slate-200">
                                  <td
                                    colSpan={8}
                                    className="sticky left-0 z-20 p-2 font-bold text-slate-600 text-[10px] tracking-wider bg-slate-200 min-w-[120px] text-[10px] md:text-xs border-r-2 border-slate-300 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)]"
                                  >
                                    {sectionTitle}
                                  </td>
                                </tr>
                              )}
                              <tr
                                key={rowKey}
                                className={`border-b last:border-0 transition-colors ${getRowColor(rowKey)}`}
                              >
                                <td className="sticky left-0 z-20 bg-white p-2 font-medium text-slate-700 border-r-2 border-slate-300 text-[11px] truncate max-w-[140px] shadow-[4px_0_8px_-2px_rgba(0,0,0,0.15)] min-w-[120px] text-[10px] md:text-xs">
                                  <span className="mr-1 inline-block w-4 text-center">
                                    {/* @ts-ignore */}
                                    {ACTIVITY_ICONS[
                                      Object.keys(ACTIVITY_ICONS).find((k) => rowKey.includes(k)) || ""
                                    ] || "•"}
                                  </span>
                                  {rowKey.replace("Matin - ", "").replace("Apm - ", "").replace("Hors site - ", "")}
                                </td>
                                {DAYS.map((day, dayIndex) => {
                                  // Ensure rowData exists before accessing day
                                  const cellData = rowData
                                    ? rowData[day]
                                    : { value: [], type: "empty", status: "validated" }
                                  const isSelected = selectedCell?.row === rowKey && selectedCell?.day === day
                                  const isWeekend = day === "SAMEDI" || day === "DIMANCHE"
                                  const isPending =
                                    cellData?.status === "pending" || cellData?.request?.status === "pending"

                                  const holidayName = isDateHoliday(weekDates[dayIndex])
                                  const isHoliday = !!holidayName
                                  const isRestrictedHoliday = isHoliday && !isAllowedOnHoliday(rowKey)
                                  const cellBlocked = isCellBlocked(rowKey, day)
                                  const proposal = getCellProposal(rowKey, day)

                                  return (
                                    <td
                                      key={`${rowKey}-${day}`}
                                      className={cn(
                                        "border border-gray-300 p-1 h-[60px] relative group min-w-[85px] text-[11px]",
                                        cellBlocked
                                          ? "bg-black cursor-not-allowed opacity-40"
                                          : "cursor-pointer hover:bg-gray-50",
                                        isHoliday && "bg-red-50 border-l-4 border-r-4 border-red-400",
                                      )}
                                      onClick={() => {
                                        if (!cellBlocked && !isRestrictedHoliday) {
                                          handleCellClick(rowKey, day)
                                        }
                                      }}
                                      title={holidayName || (cellBlocked ? "Case bloquée" : "")}
                                    >
                                      {showProposals &&
                                        (() => {
                                          const proposal = getCellProposal(rowKey, day)
                                          if (proposal) {
                                            return (
                                              <div className="absolute inset-0 border-2 border-amber-400 bg-amber-50/30 flex items-center justify-center">
                                                <div className="flex flex-col items-center gap-1">
                                                  <div className="flex items-center gap-1">
                                                    <span className="text-lg">⭐</span>
                                                    <span
                                                      className={cn(
                                                        "px-1 py-0.5 rounded text-white text-xs",
                                                        DOCTOR_COLORS[proposal.user],
                                                      )}
                                                    >
                                                      {proposal.user}
                                                    </span>
                                                  </div>
                                                  {isAdmin && (
                                                    <Button
                                                      size="sm"
                                                      variant="ghost"
                                                      className="h-5 text-xs px-1"
                                                      onClick={(e) => {
                                                        e.stopPropagation()
                                                        validateProposal(proposal)
                                                      }}
                                                    >
                                                      Valider
                                                    </Button>
                                                  )}
                                                </div>
                                              </div>
                                            )
                                          }
                                        })()}

                                      {/* Existing cell content */}
                                      {!cellBlocked && (
                                        <div className="flex flex-wrap gap-1 justify-center items-center h-full">
                                          {/* Check for vacation conflicts */}
                                          {cellData?.value.map((doc: string, i: number) => {
                                            const dateStr = weekDates[day]?.toISOString().split('T')[0]
                                            const conflict = dateStr ? detectConflict(doc, dateStr, rowKey, vacations) : { hasConflict: false }
                                            
                                            return (
                                              <Badge
                                                key={i}
                                                className={`
                                                  ${conflict.hasConflict ? "bg-red-500 ring-2 ring-red-300" : DOCTOR_COLORS[doc] || "bg-slate-500"} text-white border-none px-1 py-0 text-[9px] h-5 min-w-[20px] justify-center
                                                  ${isPending && cellData.request?.requester === doc ? "ring-2 ring-orange-400" : ""}
                                                `}
                                                title={conflict.message}
                                              >
                                                {doc}
                                              </Badge>
                                            )
                                          })}
                                        </div>
                                      )}
                                    </td>
                                  )
                                })}
                              </tr>
                            </>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Bottom Navigation */}
      <div className="border-t bg-white p-2">
        <div className="flex justify-around items-center">
          <Button
            variant={activeTab === "today" ? "default" : "ghost"}
            className="flex flex-col items-center gap-1 h-auto py-2 px-4"
            onClick={() => setActiveTab("today")}
          >
            <Home className="size-5" />
            <span className="text-[10px]">Aujourd'hui</span>
          </Button>
          <Button
            variant={activeTab === "week" ? "default" : "ghost"}
            className="flex flex-col items-center gap-1 h-auto py-2 px-4"
            onClick={() => setActiveTab("week")}
          >
            <Calendar className="size-5" />
            <span className="text-[10px]">Semaine</span>
          </Button>
          <Button
            variant={activeTab === "all" ? "default" : "ghost"}
            className="flex flex-col items-center gap-1 h-auto py-2 px-4"
            onClick={() => setActiveTab("all")}
          >
            <List className="size-5" />
            <span className="text-[10px]">Global</span>
          </Button>
        </div>
      </div>

      {/* Doctor Selection Modal (Bottom Sheet style) */}
      {selectedCell && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-t-2xl bg-white p-4 shadow-2xl animate-in slide-in-from-bottom">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900">
                  {isAdmin ? "Modifier l'affectation" : "Consulter l'affectation"}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedCell.day} - {selectedCell.row}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedCell(null)}>
                <X className="size-5" />
              </Button>
            </div>

            <div className="mb-4 flex flex-wrap gap-2 min-h-[40px] p-2 bg-slate-50 rounded-lg border border-slate-100">
              {schedule[selectedCell.row][selectedCell.day].value.length === 0 && (
                <span className="text-slate-400 text-sm italic self-center">Aucun médecin sélectionné</span>
              )}
              {schedule[selectedCell.row][selectedCell.day].value.map((doc, index) => (
                <div
                  key={`${doc}-${index}`}
                  className={`flex items-center gap-1 pl-2 pr-1 py-1 rounded-md text-white text-sm font-bold shadow-sm ${DOCTOR_COLORS[doc] || "bg-gray-500"}`}
                >
                  {doc}
                  {isAdmin && (
                    <button
                      onClick={() => removeDoctorFromCell(index)}
                      className="ml-1 hover:bg-black/20 rounded-full p-0.5"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {isAdmin ? (
              <div className="grid grid-cols-4 gap-2 mb-4 max-h-[300px] overflow-y-auto">
                {DOCTORS.map((doc) => {
                  const isSelected =
                    schedule && selectedCell && schedule[selectedCell.row][selectedCell.day].value.includes(doc)

                  return (
                    <button
                      key={doc}
                      onClick={() => addDoctorToCell(doc)}
                      disabled={isSelected}
                      className={`
                      flex h-10 items-center justify-center rounded-lg font-bold transition-all
                      ${isSelected ? "opacity-20 cursor-not-allowed bg-slate-100 text-slate-400" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-sm active:scale-95"}
                    `}
                    >
                      <div className={`mr-2 size-2 rounded-full ${DOCTOR_COLORS[doc]}`} />
                      {doc}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="mb-4 text-center text-sm text-slate-500 py-2">
                Mode lecture. Utilisez le bouton ci-dessous pour demander un changement.
              </div>
            )}

            <div className="flex flex-col gap-2">
              {isAdmin && (currentUser === "M" || currentUser === "Z") && (
                <Button
                  className={`w-full ${
                    schedule[selectedCell.row][selectedCell.day].status === "pending"
                      ? "bg-green-600 hover:bg-green-700 animate-pulse"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                  onClick={validateCell}
                >
                  {schedule[selectedCell.row][selectedCell.day].status === "pending" ? (
                    <>
                      <CheckCircle2 className="mr-2 size-4" />
                      Valider la demande
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 size-4" />
                      OK
                    </>
                  )}
                </Button>
              )}
              {!isAdmin && (
                <button
                  onClick={() => {
                    setRequestedDoctor("")
                    setReason("")
                    setRequestModal({
                      open: true,
                      row: selectedCell.row,
                      day: selectedCell.day,
                      currentDoctor: schedule[selectedCell.row][selectedCell.day].value[0],
                    })
                    setSelectedCell(null)
                  }}
                  className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-medium transition-colors"
                >
                  Demander un changement
                </button>
              )}
              <Button variant="outline" className="w-full bg-transparent" onClick={() => setSelectedCell(null)}>
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modale demande de changement (médecin) */}
      {requestModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white p-6 rounded-xl max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold mb-2">Demander un changement</h3>
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
                onClick={() => void submitRequest()}
                disabled={isSubmitting}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {isSubmitting ? "Envoi..." : "Envoyer"}
              </button>
              <button
                onClick={() => {
                  setRequestModal({ open: false, row: "", day: "" })
                  setRequestedDoctor("")
                  setReason("")
                }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 py-2 rounded-lg font-medium transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panneau historique (admin) */}
      {showHistory && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setShowHistory(false)}
        >
          <div
            className="w-full max-w-lg max-h-[80vh] overflow-auto rounded-2xl bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900">Historique des modifications</h3>
                <p className="text-xs text-slate-500">{weekKey} · 50 derniers changements</p>
              </div>
              <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="size-5" />
              </button>
            </div>
            {historyLoading ? (
              <p className="py-8 text-center text-sm text-slate-400">Chargement…</p>
            ) : historyRows.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">Aucun historique pour cette semaine.</p>
            ) : (
              <ul className="space-y-2">
                {historyRows.map((row) => (
                  <li key={row.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium text-slate-800">
                          {row.row_key} — {row.day_name}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {(row.old_value || []).join(",") || "vide"} →{" "}
                          <span className="font-semibold text-teal-700">
                            {(row.new_value || []).join(",") || "vide"}
                          </span>
                        </div>
                        <div className="mt-1 text-[10px] text-slate-400">
                          {row.changed_by || "?"} · {row.source || "ui"} ·{" "}
                          {new Date(row.changed_at).toLocaleString("fr-FR")}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Panneau des demandes (semaine courante) */}
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
                  {isAdmin ? "Vue administrateur" : "Mes demandes"} · {weekKey}
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
                        <div className="font-medium text-slate-800">
                          {req.row_key} — {req.day_name}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {req.current_doctor || "vide"} →{" "}
                          <span className="font-semibold text-teal-700">{req.requested_doctor}</span>
                        </div>
                        {req.reason && (
                          <div className="mt-1 text-xs italic text-slate-400">« {req.reason} »</div>
                        )}
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
                          onClick={() => void approveRequest(req)}
                          className="flex flex-1 items-center justify-center gap-1 rounded-md bg-green-600 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                        >
                          <Check className="size-3" /> Approuver
                        </button>
                        <button
                          onClick={() => void rejectRequest(req)}
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

      {/* Bouton demandes (tous rôles) + panneau vocal/PDF (admin) */}
      <button
        onClick={() => setShowRequests(true)}
        className="fixed bottom-20 right-20 z-40 bg-white border shadow-lg rounded-full p-3 text-slate-700"
        aria-label="Demandes"
      >
        <Bell className="w-5 h-5" />
        {pendingRequests.length > 0 && (
          <span className="absolute -top-1 -right-1 h-5 min-w-5 rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white flex items-center justify-center">
            {pendingRequests.length}
          </span>
        )}
      </button>
      {isAdmin && (
        <>
          <button
            onClick={() => setVoicePanelOpen((v) => !v)}
            className="fixed bottom-20 right-4 z-40 bg-teal-600 hover:bg-teal-700 text-white rounded-full p-3 shadow-lg"
            aria-label="Panneau vocal"
          >
            <Mic className="w-6 h-6" />
          </button>
          {voicePanelOpen && (
            <div className="fixed bottom-36 right-4 z-50 w-80 max-w-[calc(100vw-32px)] bg-white rounded-xl shadow-2xl border p-4 max-h-[70vh] overflow-auto">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold">Panneau Vocal & Upload</h3>
                <button onClick={() => setVoicePanelOpen(false)} className="text-gray-500">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <VoiceAndUploadPanel
                weekStartDate={isoWeekStart}
                weekNumber={currentWeekInfo.week}
                knownDoctors={DOCTORS}
                currentWeekRequest={currentWeekRequest}
                vacations={vacationPayload}
                onCommandExecuted={(data) => applyVoiceOrUploadResult(data)}
              />
            </div>
          )}
        </>
      )}

      {/* Note Modal */}
      {noteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2"
              onClick={() => setNoteModalOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Edit3 className="h-5 w-5 text-blue-600" />
                Note pour {noteDay}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Contenu de la note</Label>
                <Textarea
                  value={currentNote}
                  onChange={(e) => setCurrentNote(e.target.value)}
                  placeholder="Écrivez votre note ici..."
                  className="min-h-[100px]"
                />
              </div>
              <Button className="w-full" onClick={saveNote}>
                Enregistrer
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Learn More Modal */}
      {learnMoreOpen && <LearnMoreModal onClose={() => setLearnMoreOpen(false)} />}

      {showWorkloadStats && (
        <Dialog open={showWorkloadStats} onOpenChange={setShowWorkloadStats}>
          <DialogContent className="max-w-lg">
            <div className="flex items-center justify-between sticky top-0 bg-slate-50 z-10 py-2">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Statistiques de Charge de Travail</h3>
                <p className="text-xs text-slate-500">
                  Semaine {currentWeekInfo.week} - {currentWeekInfo.year}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowWorkloadStats(false)}>
                  Fermer
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {Object.entries(workloadStats)
                .sort(([, a], [, b]) => b - a)
                .map(([initials, count]) => (
                  <div key={initials} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-xs text-white font-bold",
                          DOCTOR_COLORS[initials],
                        )}
                      >
                        {initials}
                      </div>
                      <span className="font-medium">{initials}</span>
                    </div>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {showProposals && (
        <Dialog open={showProposals} onOpenChange={setShowProposals}>
          <DialogContent className="max-w-lg">
            <div className="flex items-center justify-between sticky top-0 bg-slate-50 z-10 py-2">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Propositions de Gardes</h3>
                <p className="text-xs text-slate-500">
                  Semaine {currentWeekInfo.week} - {currentWeekInfo.year}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowProposals(false)}>
                  Fermer
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {Array.from(guardProposals.get(weekKey) || []).map((proposal) => (
                <div
                  key={`${proposal.type}-${proposal.day}-${proposal.user}`}
                  className="flex items-center justify-between p-2 bg-slate-50 rounded"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-xs text-white font-bold",
                        DOCTOR_COLORS[proposal.user],
                      )}
                    >
                      {proposal.user}
                    </div>
                    <span className="font-medium">{proposal.type}</span>
                  </div>
                  <Button variant="outline" onClick={() => validateProposal(proposal)}>
                    Valider
                  </Button>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Vacations Modal */}
      <VacationsModal
        doctorId={selectedDoctorForVacations || currentUser || ""}
        doctorCode={doctorCode}
        isOpen={vacationsModalOpen}
        onClose={() => setVacationsModalOpen(false)}
        onVacationsUpdated={loadVacations}
      />
    </div>
  )
}
