"use client"

import React, { useState, useMemo, useCallback, useEffect, lazy, Suspense } from "react"
import { useRouter } from "next/navigation"
import {
  Bell,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  FileDown,
  History,
  Home,
  List,
  Loader2,
  MessageSquare,
  Mic,
  UserCog,
  Wand2,
  Wifi,
  WifiOff,
  X,
  Info,
  BarChart3,
  CheckCircle2,
  CalendarIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { LiveClock } from "@/components/live-clock"
import { LearnMoreModal } from "@/components/learn-more-modal"
import type { CellData, FullSchedule, ScheduleData } from "@/lib/types"
import { ACTIVITY_ICONS, DAYS, DOCTOR_COLORS, DOCTORS } from "@/lib/constants"
import { generateWeekSchedule, getWeekDates, getWeekNumber, getFrenchPublicHolidays } from "@/lib/schedule-utils"
import { generateNightGuardProposals, constraints2026, type GuardProposal } from "@/lib/guard-scheduler"
import { calculateWorkloadStats } from "@/lib/scheduler-algo"
import { canAssignDoctor, detectConflict, isDoctorUnavailable } from "@/lib/assignment-validation"
import {
  getCellDisplayAssignees,
  isListedDoctor,
  normalizeRemplacantLabel,
} from "@/lib/doctor-code"
import {
  countDoctorInCell,
  formatDoctorWithDoublon,
  isDoublonEligibleRow,
} from "@/lib/slot-blocking"
import {
  applyStructuralConstraints,
  schedulesDiffer,
} from "@/lib/apply-structural-constraints"
import {
  extractSundayNightGuardDoctor,
  nextIsoWeekKey,
  placeMondayRecoveryFromSundayNight,
  placeNightGuardRecoveryOff,
  previousIsoWeekKey,
} from "@/lib/half-day-off"
import { dateStrForWeekDay } from "@/lib/fixed-assignments"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import {
  getScheduleHistory,
  saveScheduleToDb,
  type ScheduleHistoryRow,
} from "@/app/actions/schedule-actions"
import type { ScheduleSaveSource } from "@/lib/schedule-diff"
import { generateGuardsWithVacations } from "@/app/actions/guard-generation-actions"
import { getLastSundayGuardDoctor } from "@/app/actions/guard-api-actions"
import { getAllVacations } from "@/app/actions/vacation-actions"
import { applyChangeRequest, rejectChangeRequest } from "@/app/actions/change-request-actions"
import { VacationsButton } from "@/components/vacations-button"
import { VacationsBadge } from "@/components/vacations-badge"
import { TodayView } from "@/components/today-view"
import { WeekView } from "@/components/week-view"
import { DoctorVacation } from "@/lib/types"

const VoiceAndUploadPanel = lazy(() =>
  import("@/components/VoiceAndUploadPanel").then((m) => ({ default: m.VoiceAndUploadPanel })),
)
const VacationsModal = lazy(() =>
  import("@/components/vacations-modal").then((m) => ({ default: m.VacationsModal })),
)
const GuardGenerationButton = lazy(() =>
  import("@/components/guard-generation-button").then((m) => ({ default: m.GuardGenerationButton })),
)
const HistoryImportDialog = lazy(() =>
  import("@/components/history-import-dialog").then((m) => ({ default: m.HistoryImportDialog })),
)
const PatternFillDialog = lazy(() =>
  import("@/components/pattern-fill-dialog").then((m) => ({ default: m.PatternFillDialog })),
)
import { createClient } from "@/lib/supabase/client"
import type { PdfWeekExtraction } from "@/lib/history-import"
import { loadFullScheduleFromDb } from "@/app/actions/schedule-actions"
import {
  applyMappedExistingSchedule,
  applyParsedCommandToSchedule,
  applyPdfExtractionToSchedule,
  buildCurrentWeekRequestPayload,
  getIsoWeekStartDate,
  mergeAssignmentsIntoSchedule,
  mergeSolverWeekIntoExisting,
} from "@/lib/guard-api-mapping"
import { toast } from "sonner"
import { downloadPlanningPdf } from "@/lib/download-planning-pdf"
import { applyNctAssignmentsToFullSchedule, type NctAssignment, weekKeyFromIsoDate } from "@/lib/nct-command"

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
  /** false tant que getAllVacations n’a pas répondu — évite d’écraser Congés/Rythmo avec []. */
  const [vacationsReady, setVacationsReady] = useState(false)
  /** Garde nuit dimanche semaine précédente → ½ off lundi (apm / matin si habituel). */
  const [previousSundayGuardDoctor, setPreviousSundayGuardDoctor] = useState<string | null>(null)
  const [vacationsModalOpen, setVacationsModalOpen] = useState(false)
  const [selectedDoctorForVacations, setSelectedDoctorForVacations] = useState<string>("")
  const [generatedScheduleWarnings, setGeneratedScheduleWarnings] = useState<string[]>([])
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
  /** In Global view the admin toolbar starts collapsed to free vertical space for the grid */
  const [toolbarExpanded, setToolbarExpanded] = useState(false)
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [historyWeeks, setHistoryWeeks] = useState<PdfWeekExtraction[]>([])
  const [historyImportOpen, setHistoryImportOpen] = useState(false)
  const [patternFillOpen, setPatternFillOpen] = useState(false)
  const [remplacantInput, setRemplacantInput] = useState("")

  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const isGlobalView = activeTab === "all"
  const compactHeader = isGlobalView && !toolbarExpanded

  const currentWeekInfo = useMemo(() => getWeekNumber(currentDate), [currentDate])
  const weekKey = useMemo(() => formatWeekKey(currentDate), [currentDate])
  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate])
  const isoWeekStart = useMemo(() => getIsoWeekStartDate(currentDate), [currentDate])

  // Garde nuit dimanche de la semaine précédente (mémoire d’abord, sinon DB)
  useEffect(() => {
    const prevKey = previousIsoWeekKey(weekKey)
    const fromMemory = prevKey ? extractSundayNightGuardDoctor(fullSchedule[prevKey]) : null
    if (fromMemory) {
      setPreviousSundayGuardDoctor(fromMemory)
      return
    }
    let cancelled = false
    void getLastSundayGuardDoctor(isoWeekStart).then((doc) => {
      if (!cancelled) setPreviousSundayGuardDoctor(doc)
    })
    return () => {
      cancelled = true
    }
  }, [weekKey, isoWeekStart, fullSchedule])

  // Load vacations on mount
  useEffect(() => {
    void loadVacations()
  }, [])

  const loadVacations = async (): Promise<DoctorVacation[]> => {
    try {
      const data = await getAllVacations()
      setVacations(data)
      setVacationsReady(true)
      return data
    } catch (error) {
      console.error("[app] Error loading vacations:", error)
      // Ne pas marquer ready : évite de reconstruire Congés=[] et de réinjecter Rythmo
      return []
    }
  }

  /** Refresh congés → planning immédiat (liste optimiste si fournie par la modale). */
  const handleVacationsUpdated = useCallback(async (next?: DoctorVacation[]) => {
    if (next) {
      setVacations(next)
      setVacationsReady(true)
      return
    }
    await loadVacations()
  }, [])

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
        (payload: { new: unknown }) => {
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
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") setRealtimeStatus("live")
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setRealtimeStatus("error")
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [supabase, isAdmin, currentUser, setFullSchedule])

  // Gère le résultat de « Générer » : propositions pending + contraintes structurelles validées
  const handleGenerationComplete = async (schedule: ScheduleData, warnings: string[]) => {
    const currentWeekKey = formatWeekKey(currentDate)

    let mergedWeekSchedule = mergeSolverWeekIntoExisting(
      fullSchedule[currentWeekKey],
      schedule,
    )
    mergedWeekSchedule = applyStructuralConstraints(
      mergedWeekSchedule,
      currentWeekKey,
      vacations,
      {
        vacationsReady,
        previousSundayGuardDoctor,
      },
    )

    const updatedFullSchedule = { ...fullSchedule, [currentWeekKey]: mergedWeekSchedule }
    setFullSchedule(updatedFullSchedule)

    try {
      await saveScheduleToDb(currentWeekKey, mergedWeekSchedule, currentUser || "unknown", {
        source: "solver",
      })
    } catch (error) {
      toast.error("Les propositions ont été générées mais la sauvegarde a échoué. Réessayez.")
      console.error("[schedule-app] Échec de sauvegarde après génération:", error)
      return
    }

    setGeneratedScheduleWarnings(warnings)
    toast.success(
      "Propositions générées (en attente de validation admin). Les contraintes fixes sont déjà appliquées.",
    )
  }

  // Planning affiché = données + contraintes structurelles (sans passer par Générer)
  const schedule = useMemo(() => {
    let scheduleToUse: ScheduleData

    if (!fullSchedule[weekKey]) {
      const generated = generateWeekSchedule(weekKey, vacations)
      DAYS.forEach((day) => {
        if (!generated["Notes du jour"][day]) {
          generated["Notes du jour"][day] = { value: [], type: "empty", status: "validated" }
        }
      })
      scheduleToUse = generated
    } else {
      scheduleToUse = fullSchedule[weekKey]
    }

    return applyStructuralConstraints(scheduleToUse, weekKey, vacations, {
      vacationsReady,
      previousSundayGuardDoctor,
    })
  }, [fullSchedule, weekKey, vacations, vacationsReady, previousSundayGuardDoctor])

  // Persiste les contraintes quand la semaine ou les congés changent (debounce court)
  // → toutes les semaines déjà en mémoire + la semaine affichée (répercussion immédiate CRUD)
  const constraintsPersistGenRef = React.useRef(0)
  const weekLoaded = Boolean(fullSchedule[weekKey])
  const vacationsSig = useMemo(
    () =>
      vacations
        .map((v) => `${v.id}:${v.doctor_id}:${v.start_date}:${v.end_date}`)
        .sort()
        .join("|"),
    [vacations],
  )

  useEffect(() => {
    if (!vacationsReady) return
    const gen = ++constraintsPersistGenRef.current
    const timer = window.setTimeout(() => {
      void (async () => {
        if (gen !== constraintsPersistGenRef.current) return
        try {
          const weekKeys = new Set<string>(
            Object.keys(fullSchedule).filter((k) => /-W\d{2}$/.test(k)),
          )
          weekKeys.add(weekKey)

          let nextFull: FullSchedule | null = null

          for (const wk of weekKeys) {
            if (gen !== constraintsPersistGenRef.current) return
            const source = (nextFull || fullSchedule)[wk]
            const base = source
              ? structuredClone(source)
              : generateWeekSchedule(wk, vacations)
            DAYS.forEach((day) => {
              if (!base["Notes du jour"]?.[day]) {
                if (!base["Notes du jour"]) base["Notes du jour"] = {}
                base["Notes du jour"][day] = { value: [], type: "empty", status: "validated" }
              }
            })
            const prevKey = previousIsoWeekKey(wk)
            const sundayDoc =
              wk === weekKey
                ? previousSundayGuardDoctor
                : prevKey
                  ? extractSundayNightGuardDoctor((nextFull || fullSchedule)[prevKey])
                  : null
            const injected = applyStructuralConstraints(base, wk, vacations, {
              vacationsReady: true,
              previousSundayGuardDoctor: sundayDoc,
            })
            if (!schedulesDiffer(source, injected)) continue

            if (!nextFull) nextFull = { ...fullSchedule }
            nextFull[wk] = injected
            await saveScheduleToDb(wk, injected, currentUser || "system", {
              source: "constraints",
            })
          }

          if (nextFull && gen === constraintsPersistGenRef.current) {
            setFullSchedule(nextFull)
          }
        } catch (error) {
          console.warn("[schedule-app] Persistance contraintes structurelles ignorée:", error)
        }
      })()
    }, 150)

    return () => {
      window.clearTimeout(timer)
    }
    // Pas de dépendance à l’identité de fullSchedule (évite courses à l’ajout congés)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKey, vacationsSig, weekLoaded, currentUser, vacationsReady, previousSundayGuardDoctor])

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

  const exportWeekPdf = async () => {
    if (isExportingPdf) return
    setIsExportingPdf(true)
    try {
      // Génération navigateur : évite le 413 Vercel (cookies auth trop volumineux sur GET API).
      await downloadPlanningPdf(weekKey, schedule)
      toast.success("PDF exporté")
    } catch (err) {
      console.error("[exportWeekPdf]", err)
      toast.error("Échec de l'export PDF")
    } finally {
      setIsExportingPdf(false)
    }
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
    setRemplacantInput("")
    setSelectedCell({ row: rowKey, day })
  }

  /** Mise à jour immuable d’une cellule (évite les mutations partagées avec fullSchedule). */
  const patchSelectedCell = (
    patch: (cell: CellData) => CellData,
    opts?: { closeModal?: boolean },
  ) => {
    if (!isAdmin || !selectedCell || !schedule) return
    const { row, day } = selectedCell
    const prevCell: CellData = schedule[row]?.[day] || {
      value: [],
      type: "empty",
      status: "validated",
    }
    const nextCell = patch(prevCell)
    let newSchedule: ScheduleData = {
      ...schedule,
      [row]: {
        ...(schedule[row] || {}),
        [day]: nextCell,
      },
    }

    // Garde Nuit → 1/2 off apm lendemain (matin si off habituel apm) ; pas le samedi
    // Dimanche → ½ off lundi de la semaine suivante
    const addedListed = nextCell.value.filter(
      (d) => isListedDoctor(d) && !(prevCell.value || []).includes(d),
    )
    if (row.includes("Garde Nuit") && addedListed.length > 0) {
      if (day === "DIMANCHE") {
        const nextWk = nextIsoWeekKey(weekKey)
        if (nextWk) {
          const nextWeekBase =
            fullSchedule[nextWk] || generateWeekSchedule(nextWk, vacations)
          let nextWeekSched = structuredClone(nextWeekBase)
          for (const doctor of addedListed) {
            nextWeekSched = placeMondayRecoveryFromSundayNight(nextWeekSched, doctor)
          }
          const updatedFull: FullSchedule = {
            ...fullSchedule,
            [weekKey]: newSchedule,
            [nextWk]: nextWeekSched,
          }
          setFullSchedule(updatedFull)
          void saveScheduleToDb(weekKey, newSchedule, currentUser || "unknown", {
            source: "ui",
          })
          void saveScheduleToDb(nextWk, nextWeekSched, currentUser || "unknown", {
            source: "constraints",
          })
          if (opts?.closeModal) {
            setSelectedCell(null)
            setRemplacantInput("")
          }
          return
        }
      } else {
        for (const doctor of addedListed) {
          newSchedule = placeNightGuardRecoveryOff(newSchedule, day, doctor)
        }
      }
    }

    void updateSchedule(newSchedule)
    if (opts?.closeModal) {
      setSelectedCell(null)
      setRemplacantInput("")
    }
  }

  const addDoctorToCell = (doctor: string) => {
    if (!isAdmin) return
    if (!selectedCell || !schedule) return

    const currentValues = schedule[selectedCell.row]?.[selectedCell.day]?.value || []
    const alreadyCount = currentValues.filter((d) => d === doctor).length
    const canDoublon = isDoublonEligibleRow(selectedCell.row) && isListedDoctor(doctor)

    // Déjà en doublon (2×) dans cette case
    if (alreadyCount >= 2) {
      toast.message(`${doctor} est déjà en doublon sur cette case`)
      return
    }

    // 2ᵉ clic sur Cs/ETT = doublon dans la même case (pas de re-validation créneau)
    if (alreadyCount === 1 && canDoublon) {
      const newStatus = currentUser === "M" || currentUser === "Z" ? "validated" : "pending"
      patchSelectedCell((cell) => ({
        ...cell,
        value: [...(cell.value || []), doctor],
        type: "doctor",
        status: newStatus,
      }))
      toast.success(`${doctor}² doublon sur ${selectedCell.row}`)
      return
    }

    if (alreadyCount >= 1) return

    // Vérifier congés / créneau / exclusions (date alignée sur contraintes structurelles)
    const dateStr =
      DAYS.includes(selectedCell.day as (typeof DAYS)[number]) && isListedDoctor(doctor)
        ? dateStrForWeekDay(weekKey, selectedCell.day)
        : null
    if (dateStr) {
      const validation = canAssignDoctor(doctor, dateStr, selectedCell.row, vacations, {
        schedule,
        day: selectedCell.day,
      })
      if (!validation.allowed) {
        toast.error(validation.reason || "Assignation impossible")
        return
      }
    }

    const newStatus = currentUser === "M" || currentUser === "Z" ? "validated" : "pending"
    patchSelectedCell((cell) => {
      const congesToday = schedule["Congés"]?.[selectedCell.day]?.value || []
      let base = [...(cell.value || [])].filter((d) => {
        if (congesToday.includes(d)) return false
        if (dateStr && isDoctorUnavailable(d, dateStr, vacations)) return false
        return true
      })
      if (!base.includes(doctor)) base = [...base, doctor]
      return {
        ...cell,
        value: base,
        type: base.length > 0 ? "doctor" : "empty",
        status: newStatus,
        remplacant: cell.remplacant,
        request:
          newStatus === "pending"
            ? {
                requester: currentUser,
                status: "pending",
                timestamp: Date.now(),
              }
            : undefined,
      }
    })
  }

  const addRemplacantToCell = () => {
    if (!isAdmin || !selectedCell || !schedule) return
    const label = normalizeRemplacantLabel(remplacantInput)
    if (!label) {
      toast.error(
        remplacantInput.trim() && isListedDoctor(remplacantInput.trim())
          ? "Ce code existe déjà dans la liste — utilisez le bouton correspondant"
          : "Nom de remplaçant invalide (1–40 caractères)",
      )
      return
    }
    const cell = schedule[selectedCell.row]?.[selectedCell.day]
    const currentValues = cell?.value || []
    if (cell?.remplacant === label || currentValues.includes(label)) {
      toast.message("Ce remplaçant est déjà dans la case")
      return
    }

    const newStatus = currentUser === "M" || currentUser === "Z" ? "validated" : "pending"
    patchSelectedCell(
      (prev) => {
        const values = [...(prev.value || [])]
        if (!values.includes(label)) values.push(label)
        return {
          ...prev,
          value: values,
          remplacant: label,
          type: "doctor",
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
      },
      { closeModal: true },
    )
    toast.success(`Remplaçant « ${label} » ajouté dans la case`)
  }

  const removeDoctorFromCell = (indexToRemove: number) => {
    if (!isAdmin || !selectedCell) return

    const currentCell = schedule[selectedCell.row]?.[selectedCell.day]
    const currentValues = currentCell?.value || []
    const removed = currentValues[indexToRemove]
    const newValues = currentValues.filter((_, index) => index !== indexToRemove)
    const newStatus = currentUser === "M" || currentUser === "Z" ? "validated" : "pending"

    patchSelectedCell(
      (cell) => ({
        ...cell,
        value: newValues,
        remplacant:
          cell.remplacant && removed === cell.remplacant ? undefined : cell.remplacant,
        type: newValues.length > 0 || (cell.remplacant && removed !== cell.remplacant) ? "doctor" : "empty",
        status: newStatus,
        request:
          newStatus === "pending"
            ? {
                requester: currentUser,
                status: "pending",
                timestamp: Date.now(),
              }
            : undefined,
      }),
      { closeModal: true },
    )
  }

  const validateCell = () => {
    // Tout admin peut valider une proposition « Générer » (pending)
    if (!selectedCell || !isAdmin) return

    const { row, day } = selectedCell
    const cell = schedule[row]?.[day]
    if (!cell) return
    const newSchedule: ScheduleData = {
      ...schedule,
      [row]: {
        ...schedule[row],
        [day]: {
          ...cell,
          status: "validated",
          request: undefined,
        },
      },
    }

    void updateSchedule(newSchedule)
    setSelectedCell(null)
    toast.success("Proposition validée")
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
      nct_assignments?: NctAssignment[]
      updated_schedule?: { assignments?: Array<any>; warnings?: string[] }
      raw_extraction?: { rows?: Array<any> }
      mapped_existing_schedule?: Record<string, string[]>
      operations?: Array<{ action: string; doctor?: string; day?: string; row?: string }>
      warnings?: string[]
    }) => {
      // Calendrier NCT multi-semaines (saisie manuelle / dictée de liste)
      if (data?.nct_assignments?.length) {
        const { next, touchedWeekKeys, applied, skipped } = applyNctAssignmentsToFullSchedule(
          fullSchedule,
          data.nct_assignments,
        )
        if (applied === 0) {
          toast.error("Aucune NCT appliquée (dates ou médecins invalides)")
          return
        }
        setFullSchedule(next)
        void (async () => {
          try {
            for (const wk of touchedWeekKeys) {
              const weekData = next[wk]
              if (weekData) {
                await saveScheduleToDb(wk, weekData, currentUser || "unknown", { source: "voice" })
              }
            }
            toast.success(
              `${applied} NCT enregistrée(s) sur ${touchedWeekKeys.length} semaine(s)`,
            )
            if (skipped.length) {
              toast.warning(`Ignorées : ${skipped.slice(0, 3).join(", ")}`)
            }
          } catch (err) {
            console.error("[nct] save failed:", err)
            toast.error("NCT appliquées en mémoire mais sauvegarde partielle en échec")
          }
        })()
        return
      }

      let next = schedule
      let changed = false
      let targetWeekKey = weekKey
      let crossWeek = false

      if (data?.parsed_command?.doctor_in) {
        const cmd = {
          ...data.parsed_command,
          activity: String(data.parsed_command.activity || "").toUpperCase(),
          slot:
            String(data.parsed_command.activity || "").toUpperCase() === "NCT"
              ? "nuit"
              : data.parsed_command.slot,
        }
        targetWeekKey = weekKeyFromIsoDate(cmd.date)
        if (targetWeekKey !== weekKey) {
          crossWeek = true
          const base =
            fullSchedule[targetWeekKey] || generateWeekSchedule(targetWeekKey, vacations)
          const before = JSON.stringify(base)
          const updated = applyParsedCommandToSchedule(base, cmd)
          if (JSON.stringify(updated) !== before) {
            setFullSchedule((prev) => ({ ...prev, [targetWeekKey]: updated }))
            void (async () => {
              try {
                await saveScheduleToDb(targetWeekKey, updated, currentUser || "unknown", {
                  source: "voice",
                })
                toast.success(`Commande appliquée sur ${targetWeekKey} (semaine de la consigne)`)
              } catch (err) {
                console.error("[voice] cross-week save failed:", err)
                toast.error("Commande appliquée en mémoire mais sauvegarde en échec")
              }
            })()
            return
          }
        } else {
          const before = JSON.stringify(next)
          next = applyParsedCommandToSchedule(next, cmd)
          if (JSON.stringify(next) !== before) changed = true
        }
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

      // Fallback solveur : même si parsed_command est présent mais n'a rien changé
      // (ligne absente, mapping raté…). Voice = merge large, pas seulement propositions Générer.
      if (!changed && !crossWeek && data?.updated_schedule?.assignments?.length) {
        const before = JSON.stringify(next)
        next = mergeAssignmentsIntoSchedule(next, data.updated_schedule.assignments, {
          forcePending: false,
          proposalRowsOnly: false,
        })
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
      } else if (data?.parsed_command || data?.updated_schedule) {
        toast.warning(
          "Commande reçue mais aucune cellule modifiée sur la semaine affichée — vérifiez la date / le créneau.",
        )
      }
    },
    // updateSchedule / fullSchedule intentionally captured for apply-after-response
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schedule, fullSchedule, currentUser, setFullSchedule, weekKey, vacations],
  )

  const handleNoteClick = (day: string) => {
    // Global : admin seulement ; Aujourd'hui / Semaine : tout utilisateur authentifié
    if (activeTab === "all" && !isAdmin) return

    setNoteDay(day)
    setCurrentNote(schedule["Notes du jour"]?.[day]?.value?.[0] || "")
    setNoteModalOpen(true)
  }

  const saveNote = () => {
    const trimmed = currentNote.trim()
    const prevCell = schedule["Notes du jour"]?.[noteDay] || {
      value: [],
      type: "empty" as const,
      status: "validated" as const,
    }
    const newSchedule: ScheduleData = {
      ...schedule,
      "Notes du jour": {
        ...(schedule["Notes du jour"] || {}),
        [noteDay]: {
          ...prevCell,
          value: trimmed ? [trimmed] : [],
          type: trimmed ? "empty" : "empty",
          status: "validated",
        },
      },
    }

    void updateSchedule(newSchedule)
    setNoteModalOpen(false)
    toast.success(trimmed ? "Note enregistrée" : "Note effacée")
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

    // IRM: uniquement Lundi (matin) + Vendredi (après-midi) — autres jours bloqués
    if (
      row.includes("IRM") &&
      ["MARDI", "MERCREDI", "JEUDI", "SAMEDI", "DIMANCHE"].includes(day)
    ) {
      return true
    }

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
      toast.success(
        `${proposals.length} proposition(s) Garde Nuit (Mar–Dim ; Lun = FV sauf vacances)`,
      )
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
    <div className="flex h-dvh flex-col overflow-hidden bg-slate-50">
      {/* Main Content Area — native overflow so mobile pan-x/pan-y works in Global */}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          activeTab !== "all" && "overflow-y-auto overscroll-y-contain",
        )}
      >
          <div
            className={cn(
              isGlobalView ? "flex min-h-0 flex-1 flex-col p-2 pb-1 md:p-3 md:pb-2" : "p-3 pb-6 md:p-4",
            )}
          >
            <div
              className={cn(
                "sticky top-0 z-30 flex shrink-0 flex-wrap items-center justify-between gap-1.5 rounded-lg border bg-white/95 shadow-sm backdrop-blur-sm",
                compactHeader ? "mb-1.5 p-1.5" : "mb-2 p-2 md:mb-3 md:p-3",
              )}
            >
              <div className="flex flex-wrap items-center gap-1 md:gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={prevWeek}
                  className={cn("shrink-0", compactHeader ? "h-7 w-7" : "h-8 w-8")}
                >
                  <ChevronLeft className={compactHeader ? "h-3.5 w-3.5" : "h-4 w-4"} />
                </Button>
                <div className="min-w-0 px-0.5 text-center">
                  <h2
                    className={cn(
                      "font-bold leading-tight text-slate-900",
                      compactHeader ? "text-sm" : "text-sm md:text-base",
                    )}
                  >
                    {compactHeader ? `S${currentWeekInfo.week}` : `Semaine ${currentWeekInfo.week}`}
                  </h2>
                  {!compactHeader && (
                    <p className="text-[10px] leading-none text-slate-500">{currentWeekInfo.year}</p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={nextWeek}
                  className={cn("shrink-0", compactHeader ? "h-7 w-7" : "h-8 w-8")}
                >
                  <ChevronRight className={compactHeader ? "h-3.5 w-3.5" : "h-4 w-4"} />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={goToToday}
                  title="Semaine actuelle"
                  className={cn("shrink-0", compactHeader ? "h-7 w-7" : "h-8 w-8")}
                >
                  <CalendarIcon className={compactHeader ? "h-3.5 w-3.5" : "h-4 w-4"} />
                </Button>
                {!compactHeader && (
                  <Button variant="ghost" size="sm" onClick={goToToday} className="hidden h-8 px-2 text-xs sm:inline-flex">
                    Aujourd&apos;hui
                  </Button>
                )}
              </div>
              {generatedScheduleWarnings.length > 0 && !compactHeader && (
                <div className="mb-1 w-full rounded-md border border-yellow-200 bg-yellow-50 p-2">
                  <p className="mb-1 text-xs font-semibold text-yellow-900">Alertes de génération:</p>
                  <ul className="list-inside list-disc text-[11px] text-yellow-800">
                    {generatedScheduleWarnings.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex max-w-full flex-wrap items-center justify-end gap-1">
                {!compactHeader && (
                  <div className="hidden sm:block">
                    <LiveClock />
                  </div>
                )}
                {isAdmin && (
                  <>
                    {isGlobalView && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => setToolbarExpanded((v) => !v)}
                        title={toolbarExpanded ? "Réduire la barre d’outils" : "Afficher tous les outils"}
                      >
                        {toolbarExpanded ? "Réduire" : "Outils"}
                        {pendingRequests.length > 0 && !toolbarExpanded && (
                          <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
                            {pendingRequests.length}
                          </span>
                        )}
                      </Button>
                    )}
                    {(!isGlobalView || toolbarExpanded) && (
                      <div className="flex max-w-full flex-wrap items-center gap-1">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
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
                          <span className="hidden lg:inline">
                            {realtimeStatus === "live"
                              ? "Temps réel"
                              : realtimeStatus === "error"
                                ? "Hors ligne"
                                : "Connexion…"}
                          </span>
                        </span>

                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[11px]"
                          onClick={handleGenerateGuards}
                          title="Générer Gardes Nuit"
                        >
                          <Calendar className="mr-1 h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Gardes Nuit</span>
                        </Button>

                        <VacationsButton
                          className="!gap-1 !rounded-md !px-2 !py-1 !text-xs"
                          onClick={() => {
                            setSelectedDoctorForVacations("")
                            setVacationsModalOpen(true)
                          }}
                        />

                        <Suspense fallback={null}>
                          <GuardGenerationButton
                            weekKey={isoWeekStart}
                            vacations={vacations}
                            onGenerationComplete={(sched, warnings) => {
                              void handleGenerationComplete(sched, warnings)
                            }}
                          />
                        </Suspense>

                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 border-slate-300 bg-white px-2 text-[11px] font-semibold !text-slate-900 hover:bg-slate-100 hover:!text-slate-900"
                          onClick={() => setPatternFillOpen(true)}
                          title="Pré-remplir Cs/ETT/EE/hors site selon les semaines passées (revue avant écriture)"
                        >
                          <Wand2 className="mr-1 h-3.5 w-3.5 shrink-0 !text-slate-900" strokeWidth={2.25} />
                          <span className="hidden sm:inline">Pré-remplir</span>
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 border-slate-300 bg-white px-2 text-[11px] font-semibold !text-slate-900 hover:bg-slate-100 hover:!text-slate-900"
                          onClick={() => void exportWeekPdf()}
                          disabled={isExportingPdf}
                          title="Exporter la semaine en PDF"
                        >
                          <FileDown className="mr-1 h-3.5 w-3.5 shrink-0 !text-slate-900" strokeWidth={2.25} />
                          <span className="hidden md:inline">{isExportingPdf ? "…" : "PDF"}</span>
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 border-slate-300 bg-white px-2.5 text-[11px] font-semibold !text-slate-900 shadow-sm hover:bg-slate-100 hover:!text-slate-900"
                          onClick={() => void openHistoryPanel()}
                          title="Journal des modifications de la semaine (qui a changé quoi)"
                          disabled={historyLoading}
                        >
                          {historyLoading ? (
                            <Loader2 className="mr-1 h-3.5 w-3.5 shrink-0 animate-spin !text-slate-900" strokeWidth={2.25} />
                          ) : (
                            <History className="mr-1 h-3.5 w-3.5 shrink-0 !text-slate-900" strokeWidth={2.25} />
                          )}
                          <span className="inline">Journal</span>
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 border-slate-300 bg-white px-2 text-[11px] font-semibold !text-slate-900 hover:bg-slate-100 hover:!text-slate-900"
                          onClick={() => router.push("/protected/admin/requests")}
                          title="Tableau de bord des demandes"
                        >
                          <Bell className="mr-1 h-3.5 w-3.5 shrink-0 !text-slate-900" strokeWidth={2.25} />
                          <span className="hidden lg:inline">Demandes</span>
                          {pendingRequests.length > 0 && (
                            <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
                              {pendingRequests.length}
                            </span>
                          )}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 border-slate-300 bg-white px-2 text-[11px] font-semibold !text-slate-900 hover:bg-slate-100 hover:!text-slate-900"
                          onClick={() => router.push("/protected/admin/users")}
                          title="Gestion des comptes"
                        >
                          <UserCog className="mr-1 h-3.5 w-3.5 shrink-0 !text-slate-900" strokeWidth={2.25} />
                          <span className="hidden xl:inline">Comptes</span>
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 border-slate-300 bg-white px-2 text-[11px] font-semibold !text-slate-900 hover:bg-slate-100 hover:!text-slate-900"
                          onClick={() => router.push("/protected/admin/feedback")}
                          title="Feedback utilisateurs"
                        >
                          <MessageSquare className="mr-1 h-3.5 w-3.5 shrink-0 !text-slate-900" strokeWidth={2.25} />
                          <span className="hidden xl:inline">Feedback</span>
                        </Button>

                        {/* Bouton doublon "Générer avec Solveur" retiré : GuardGenerationButton = seule entrée. */}

                        {showProposals && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 border-slate-300 bg-white px-2 text-[11px] font-semibold !text-slate-900 hover:bg-slate-100 hover:!text-slate-900"
                            onClick={() => setShowProposals(!showProposals)}
                          >
                            {showProposals ? "Masquer" : "Afficher"} Prop.
                          </Button>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 border-slate-300 bg-white px-2 text-[11px] font-semibold !text-slate-900 hover:bg-slate-100 hover:!text-slate-900"
                          onClick={() => setShowWorkloadStats(!showWorkloadStats)}
                          title="Statistiques de charge"
                        >
                          <BarChart3 className="mr-1 h-3.5 w-3.5 shrink-0 !text-slate-900" strokeWidth={2.25} />
                          <span className="hidden lg:inline">
                            {showWorkloadStats ? "Masquer" : "Stats"}
                          </span>
                        </Button>
                      </div>
                    )}
                  </>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setLearnMoreOpen(true)}
                  className={cn("text-blue-600", compactHeader ? "h-7 w-7" : "h-8 w-8")}
                >
                  <Info className={compactHeader ? "h-4 w-4" : "h-4 w-4"} />
                </Button>
              </div>
            </div>

            {/* TODAY VIEW */}
            {activeTab === "today" && (
              <TodayView
                days={DAYS}
                weekDates={weekDates}
                currentDayIndex={currentDayIndex}
                doctorCode={doctorCode}
                dayNote={schedule["Notes du jour"]?.[DAYS[currentDayIndex]]?.value?.[0] || ""}
                tasks={getAllTasksForDay(DAYS[currentDayIndex])}
                onSelectDay={goToDay}
                onEditNote={() => handleNoteClick(DAYS[currentDayIndex])}
              />
            )}

            {/* WEEK VIEW */}
            {activeTab === "week" && (
              <WeekView
                days={DAYS}
                weekDates={weekDates}
                weekNumber={currentWeekInfo.week}
                currentDayIndex={currentDayIndex}
                doctorCode={doctorCode}
                getUserTasks={getUserTasks}
                onSelectDay={(idx) => {
                  goToDay(idx)
                  setActiveTab("today")
                }}
              />
            )}

            {/* GLOBAL VIEW */}
            {activeTab === "all" && (
              <div className="flex min-h-0 flex-1 flex-col gap-1">
                <div className="flex shrink-0 items-center justify-between gap-2 px-0.5">
                  <h3 className="text-xs font-semibold text-slate-600 md:text-sm">
                    Planning global · S{currentWeekInfo.week}
                  </h3>
                </div>

                <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-white shadow-sm">
                  <div
                    className="pointer-events-none absolute right-0 top-0 z-20 h-full w-6 bg-gradient-to-l from-white to-transparent md:hidden"
                    aria-hidden
                  />
                  <div
                    className="planning-scroll planning-table min-h-0 flex-1 overflow-auto overscroll-contain"
                    style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x pan-y" }}
                  >
                    <table className="w-max min-w-[700px] border-collapse text-xs table-layout-fixed md:w-full">
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
                                    <button
                                      type="button"
                                      onClick={() => handleNoteClick(day)}
                                      className="flex h-full w-full cursor-pointer items-center justify-center truncate rounded-md bg-yellow-100/80 px-1 text-[10px] font-medium text-slate-800 ring-1 ring-yellow-200 hover:bg-yellow-200"
                                    >
                                      {rowData[day]?.value[0] || "+ Note"}
                                    </button>
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
                                  const cellData: CellData = rowData?.[day] ?? {
                                    value: [],
                                    type: "empty",
                                    status: "validated",
                                  }
                                  const displayAssignees = getCellDisplayAssignees(cellData)
                                  const isSelected = selectedCell?.row === rowKey && selectedCell?.day === day
                                  const isWeekend = day === "SAMEDI" || day === "DIMANCHE"
                                  const isPending =
                                    cellData.status === "pending" || cellData.request?.status === "pending"

                                  const holidayName = isDateHoliday(weekDates[dayIndex])
                                  const isHoliday = !!holidayName
                                  const isRestrictedHoliday = isHoliday && !isAllowedOnHoliday(rowKey)
                                  const cellBlocked = isCellBlocked(rowKey, day)
                                  const proposal = getCellProposal(rowKey, day)

                                  return (
                                    <td
                                      key={`${rowKey}-${day}`}
                                      className={cn(
                                        "border border-gray-300 p-1 min-h-[60px] h-auto relative group min-w-[85px] text-[11px] align-middle",
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

                                      {/* Existing cell content (initiales + remplaçant) */}
                                      {!cellBlocked && (
                                        <div className="flex flex-wrap gap-0.5 justify-center items-center content-center h-full max-h-full overflow-visible">
                                          {[...new Set(displayAssignees)].map((doc: string) => {
                                            const dayDate = new Date(`${isoWeekStart}T12:00:00`)
                                            dayDate.setDate(dayDate.getDate() + dayIndex)
                                            const dateStr = dayDate.toISOString().split("T")[0]
                                            const listed = isListedDoctor(doc)
                                            const conflict = listed
                                              ? detectConflict(doc, dateStr, rowKey, vacations)
                                              : { hasConflict: false as const }
                                            const label = listed
                                              ? formatDoctorWithDoublon(schedule, day, doc, rowKey)
                                              : doc

                                            return (
                                              <Badge
                                                key={doc}
                                                className={`
                                                  ${
                                                    conflict.hasConflict
                                                      ? "bg-red-500 ring-2 ring-red-300"
                                                      : listed
                                                        ? DOCTOR_COLORS[doc] || "bg-slate-500"
                                                        : "bg-amber-600"
                                                  } text-white border-none px-1 py-0 text-[9px] h-5 max-w-[80px] truncate justify-center
                                                  ${isPending && cellData.request?.requester === doc ? "ring-2 ring-orange-400" : ""}
                                                `}
                                                title={
                                                  conflict.message ||
                                                  (listed
                                                    ? label.includes("²")
                                                      ? `${doc} en doublon (même case)`
                                                      : doc
                                                    : `Remplaçant : ${doc}`)
                                                }
                                              >
                                                {label}
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
      </div>

      {/* Bottom Navigation — above FABs so Global stays tappable on mobile */}
      <nav className="safe-area-pb relative z-[95] shrink-0 border-t border-slate-200 bg-white/95 p-2 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur">
        <div className="mx-auto grid max-w-lg grid-cols-3 items-stretch gap-1">
          <Button
            variant={activeTab === "today" ? "default" : "ghost"}
            className={cn(
              "flex h-auto min-h-12 w-full flex-col items-center gap-1 px-2 py-2",
              activeTab === "today"
                ? "bg-slate-900 text-white hover:bg-slate-800"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            )}
            onClick={() => setActiveTab("today")}
          >
            <Home className="size-5" />
            <span className="text-[10px] font-semibold">Aujourd&apos;hui</span>
          </Button>
          <Button
            variant={activeTab === "week" ? "default" : "ghost"}
            className={cn(
              "flex h-auto min-h-12 w-full flex-col items-center gap-1 px-2 py-2",
              activeTab === "week"
                ? "bg-slate-900 text-white hover:bg-slate-800"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            )}
            onClick={() => setActiveTab("week")}
          >
            <Calendar className="size-5" />
            <span className="text-[10px] font-semibold">Semaine</span>
          </Button>
          <Button
            variant={activeTab === "all" ? "default" : "ghost"}
            className={cn(
              "flex h-auto min-h-12 w-full flex-col items-center gap-1 px-2 py-2",
              activeTab === "all"
                ? "bg-slate-900 text-white hover:bg-slate-800"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            )}
            data-testid="nav-global"
            onClick={() => setActiveTab("all")}
          >
            <List className="size-5" />
            <span className="text-[10px] font-semibold">Global</span>
          </Button>
        </div>
      </nav>

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
              {getCellDisplayAssignees(schedule[selectedCell.row]?.[selectedCell.day]).length === 0 && (
                <span className="text-slate-400 text-sm italic self-center">Aucun médecin sélectionné</span>
              )}
              {[...new Set(getCellDisplayAssignees(schedule[selectedCell.row]?.[selectedCell.day]))].map(
                (doc) => {
                  const listed = isListedDoctor(doc)
                  const values = schedule[selectedCell.row]?.[selectedCell.day]?.value || []
                  const firstIndex = values.indexOf(doc)
                  const occ = values.filter((d) => d === doc).length
                  const label =
                    listed && occ >= 2 && isDoublonEligibleRow(selectedCell.row) ? `${doc}²` : doc
                  return (
                    <div
                      key={doc}
                      title={
                        listed
                          ? occ >= 2
                            ? `${doc} en doublon (même case)`
                            : doc
                          : `Remplaçant : ${doc}`
                      }
                      className={`flex items-center gap-1 pl-2 pr-1 py-1 rounded-md text-white text-sm font-bold shadow-sm ${
                        listed ? DOCTOR_COLORS[doc] || "bg-gray-500" : "bg-amber-600"
                      }`}
                    >
                      {!listed && <span className="text-[10px] font-normal opacity-90">Rpl</span>}
                      <span className="max-w-[160px] truncate">{label}</span>
                      {isAdmin && firstIndex >= 0 && (
                        <button
                          onClick={() => {
                            // Retirer toutes les occurrences (doublon → une action)
                            if (!selectedCell) return
                            const cell = schedule[selectedCell.row]?.[selectedCell.day]
                            const current = cell?.value || []
                            const newValues = current.filter((d) => d !== doc)
                            const newStatus =
                              currentUser === "M" || currentUser === "Z" ? "validated" : "pending"
                            patchSelectedCell((c) => ({
                              ...c,
                              value: newValues,
                              remplacant:
                                c.remplacant && doc === c.remplacant ? undefined : c.remplacant,
                              type:
                                newValues.length > 0 ||
                                (c.remplacant && doc !== c.remplacant)
                                  ? "doctor"
                                  : "empty",
                              status: newStatus,
                            }))
                          }}
                          className="ml-1 hover:bg-black/20 rounded-full p-0.5"
                        >
                          <X className="size-3" />
                        </button>
                      )}
                    </div>
                  )
                },
              )}
            </div>

            {isAdmin ? (
              <>
                <div className="grid grid-cols-4 gap-2 mb-3 max-h-[220px] overflow-y-auto">
                  {DOCTORS.map((doc) => {
                    const occ =
                      schedule && selectedCell
                        ? countDoctorInCell(schedule, selectedCell.row, selectedCell.day, doc)
                        : 0
                    const canPromoteDoublon =
                      Boolean(selectedCell && isDoublonEligibleRow(selectedCell.row) && occ === 1)
                    const fullyInCell = occ >= 2 || (occ >= 1 && !canPromoteDoublon)

                    let blockReason: string | undefined
                    if (occ === 0 && selectedCell && schedule) {
                      const dateStr = dateStrForWeekDay(weekKey, selectedCell.day)
                      if (dateStr) {
                        const v = canAssignDoctor(doc, dateStr, selectedCell.row, vacations, {
                          schedule,
                          day: selectedCell.day,
                        })
                        if (!v.allowed) blockReason = v.reason
                      }
                    }
                    const blocked = Boolean(blockReason)

                    return (
                      <button
                        key={doc}
                        onClick={() => addDoctorToCell(doc)}
                        disabled={fullyInCell || blocked}
                        title={
                          blockReason ||
                          (occ >= 2
                            ? "Déjà en doublon"
                            : canPromoteDoublon
                              ? `Cliquer pour doublon ${doc}² (même case)`
                              : occ >= 1
                                ? "Déjà dans la case"
                                : undefined)
                        }
                        className={`
                      flex h-10 items-center justify-center rounded-lg font-bold transition-all
                      ${
                        fullyInCell || blocked
                          ? "opacity-30 cursor-not-allowed bg-slate-100 text-slate-400"
                          : canPromoteDoublon
                            ? "bg-sky-50 border border-sky-300 text-sky-900 hover:bg-sky-100 shadow-sm active:scale-95"
                            : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-sm active:scale-95"
                      }
                    `}
                      >
                        <div className={`mr-2 size-2 rounded-full ${DOCTOR_COLORS[doc]}`} />
                        {canPromoteDoublon ? `${doc}²` : doc}
                      </button>
                    )
                  })}
                </div>
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/80 p-2">
                  <Label htmlFor="remplacant-input" className="text-xs font-medium text-amber-900">
                    Remplaçant (texte libre)
                  </Label>
                  <div className="mt-1 flex gap-2">
                    <input
                      id="remplacant-input"
                      type="text"
                      value={remplacantInput}
                      onChange={(e) => setRemplacantInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          addRemplacantToCell()
                        }
                      }}
                      placeholder="Ex. Dr Martin"
                      maxLength={40}
                      className="h-9 flex-1 rounded-md border border-amber-200 bg-white px-2 text-sm text-slate-800 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-300"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9 border-amber-300 text-amber-900 hover:bg-amber-100"
                      onClick={addRemplacantToCell}
                    >
                      Ajouter
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="mb-4 text-center text-sm text-slate-500 py-2">
                Mode lecture. Utilisez le bouton ci-dessous pour demander un changement.
              </div>
            )}

            <div className="flex flex-col gap-2">
              {isAdmin && (
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
                <h3 className="font-bold text-slate-900">Journal des modifications</h3>
                <p className="text-xs text-slate-600">
                  {weekKey} · 50 derniers changements de cellules (audit)
                </p>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="rounded-full p-2 text-slate-700 hover:bg-gray-100"
                aria-label="Fermer"
              >
                <X className="size-5" />
              </button>
            </div>
            {historyLoading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-700">
                <Loader2 className="h-6 w-6 animate-spin text-slate-800" strokeWidth={2.25} />
                <p className="text-sm font-medium">Chargement du journal…</p>
              </div>
            ) : historyRows.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-600">
                Aucune modification enregistrée pour cette semaine.
              </p>
            ) : (
              <ul className="space-y-2">
                {historyRows.map((row) => (
                  <li
                    key={row.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-sm shadow-sm"
                  >
                    <div className="font-semibold text-slate-900">
                      {row.row_key} — {row.day_name}
                    </div>
                    <div className="mt-1 text-xs text-slate-700">
                      <span className="text-slate-500">{(row.old_value || []).join(", ") || "vide"}</span>
                      {" → "}
                      <span className="font-semibold text-teal-800">
                        {(row.new_value || []).join(", ") || "vide"}
                      </span>
                    </div>
                    <div className="mt-1.5 text-[11px] font-medium text-slate-500">
                      {row.changed_by || "?"} · {row.source || "ui"} ·{" "}
                      {new Date(row.changed_at).toLocaleString("fr-FR")}
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
        className="fixed bottom-24 right-20 z-40 bg-white border shadow-lg rounded-full p-3 text-slate-700 md:bottom-20"
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
            className="fixed bottom-24 right-4 z-40 bg-teal-600 hover:bg-teal-700 text-white rounded-full p-3 shadow-lg md:bottom-20"
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
              <Suspense fallback={<p className="text-sm text-slate-500">Chargement du panneau…</p>}>
                <VoiceAndUploadPanel
                  weekStartDate={isoWeekStart}
                  weekNumber={currentWeekInfo.week}
                  knownDoctors={DOCTORS}
                  currentWeekRequest={currentWeekRequest}
                  vacations={vacationPayload}
                  onCommandExecuted={(data) => applyVoiceOrUploadResult(data)}
                  onHistoryWeeksExtracted={(weeks) => {
                    setHistoryWeeks(weeks as PdfWeekExtraction[])
                    setHistoryImportOpen(true)
                  }}
                />
              </Suspense>
            </div>
          )}

          <Suspense fallback={null}>
            <HistoryImportDialog
              open={historyImportOpen}
              onOpenChange={setHistoryImportOpen}
              weeks={historyWeeks}
              currentUser={currentUser || "admin"}
              onImported={async () => {
                try {
                  const loaded = await loadFullScheduleFromDb()
                  if (loaded && typeof loaded === "object") {
                    setFullSchedule(loaded as FullSchedule)
                  }
                } catch (err) {
                  console.error("[history-import] reload failed:", err)
                }
              }}
            />
            <PatternFillDialog
              open={patternFillOpen}
              onOpenChange={setPatternFillOpen}
              currentSchedule={schedule}
              onApply={(next, meta) => {
                void updateSchedule(next, "ui")
                toast.success(
                  `${meta.applied} cellule(s) proposée(s) (pending)${
                    meta.skippedTies ? ` · ${meta.skippedTies} ex-æquo ignoré(s)` : ""
                  }`,
                )
              }}
            />
          </Suspense>
        </>
      )}

      {/* Note Modal — footer sticky pour garder Valider visible (clavier mobile) */}
      {noteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setNoteModalOpen(false)}
        >
          <Card
            className="relative flex max-h-[min(92dvh,640px)] w-full max-w-md flex-col gap-0 overflow-hidden rounded-t-3xl border border-slate-200 bg-white py-0 text-slate-900 shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 border-b border-slate-200 bg-gradient-to-r from-sky-50 to-white px-5 py-4 pr-12">
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2 !text-slate-700 hover:bg-slate-100 hover:!text-slate-900"
                onClick={() => setNoteModalOpen(false)}
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </Button>
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <span className="flex size-9 items-center justify-center rounded-xl bg-sky-100 text-sky-800 ring-1 ring-sky-200">
                  <MessageSquare className="h-4 w-4" />
                </span>
                Note — {noteDay}
              </CardTitle>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Visible par <span className="font-semibold text-slate-800">tous les utilisateurs</span> du
                planning de cette semaine (pas privée à votre session).
              </p>
            </div>
            <CardContent className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-white p-5 pb-3">
              <div className="space-y-2">
                <Label htmlFor="day-note-input" className="font-medium text-slate-800">
                  Contenu
                </Label>
                <Textarea
                  id="day-note-input"
                  value={currentNote}
                  onChange={(e) => setCurrentNote(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault()
                      saveNote()
                    }
                  }}
                  placeholder="Consigne, rappel, information pour l’équipe…"
                  className="min-h-[140px] resize-y border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400"
                  autoFocus
                />
                <p className="text-[11px] text-slate-500">
                  Ctrl/⌘ + Entrée pour valider · Fermer sans Valider annule les modifications
                </p>
              </div>
            </CardContent>
            <div className="flex shrink-0 gap-2 border-t border-slate-200 bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Button
                type="button"
                variant="outline"
                className="border-slate-300 bg-white !text-slate-900 hover:bg-slate-100"
                onClick={() => {
                  setCurrentNote("")
                }}
              >
                Effacer
              </Button>
              <Button
                type="button"
                className="h-11 flex-1 bg-sky-700 text-base font-semibold text-white hover:bg-sky-800"
                onClick={saveNote}
              >
                Valider
              </Button>
            </div>
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
      <Suspense fallback={null}>
        <VacationsModal
          doctorId={selectedDoctorForVacations || currentUser || ""}
          doctorCode={doctorCode}
          isOpen={vacationsModalOpen}
          onClose={() => setVacationsModalOpen(false)}
          onVacationsUpdated={handleVacationsUpdated}
        />
      </Suspense>
    </div>
  )
}
