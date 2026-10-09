"use client"

import React, { useState, useMemo, useCallback, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  TrendingUp,
  Loader2,
  Play,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Users,
  Shield,
  RefreshCw,
  Undo2,
  Square,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts"
import { cn } from "@/lib/utils"
import { DOCTOR_COLORS } from "@/lib/constants"
import { toast } from "sonner"
import { generateGuardsViaAPI } from "@/app/actions/guard-api-actions"
import { getSemesterGuardSlots, mondayOfWeekKey, monthLabelFromKey } from "@/lib/semester-guard-slots"
import { formatPersonLabel } from "@/lib/doctor-code"
import type { ScheduleData } from "@/lib/types"

type Semester = 1 | 2

const CURRENT_YEAR = new Date().getFullYear()

// WOM group definitions (for equity charts)
const GROUP_WOM = ["W", "O", "M"]
const GROUP_HZGSB = ["H", "Z", "G", "S", "B"]
const GROUP_AUP = ["A", "U", "P"]

const GROUP_COLORS: Record<string, string> = {
  W: "#f97316", O: "#eab308", M: "#ef4444",
  H: "#22c55e", Z: "#10b981", G: "#14b8a6", S: "#06b6d4", B: "#3b82f6",
  A: "#8b5cf6", U: "#d946ef", P: "#f43f5e",
}

type WeekProjectionResult = {
  weekKey: string
  status: "pending" | "done" | "error" | "skipped"
  guardCounts?: Record<string, number>
  error?: string
}

type ProjectionSummary = {
  doctorGuardCounts: Record<string, number>
  weekResults: WeekProjectionResult[]
  totalWeeks: number
  doneWeeks: number
  errorWeeks: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getWeekKeysForSemester(semester: 1 | 2, year: number): string[] {
  // Get all guard slots to find the unique week keys in the semester
  const slots = getSemesterGuardSlots(semester, year)
  const seen = new Set<string>()
  const weekKeys: string[] = []
  for (const slot of slots) {
    if (!seen.has(slot.weekKey)) {
      seen.add(slot.weekKey)
      weekKeys.push(slot.weekKey)
    }
  }
  // Sort chronologically
  return weekKeys.sort()
}

function getSemesterLabel(semester: 1 | 2, year: number): string {
  return semester === 1
    ? `Semestre 1 — Janv. ${year} → Août ${year}`
    : `Semestre 2 — Sept. ${year} → Janv. ${year + 1}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Equity Bar Chart
// ─────────────────────────────────────────────────────────────────────────────
function EquityBarChart({
  doctorGuardCounts,
  title,
  doctors,
}: {
  doctorGuardCounts: Record<string, number>
  title: string
  doctors: string[]
}) {
  const data = doctors
    .map(doc => ({ name: doc, Gardes: doctorGuardCounts[doc] || 0 }))
    .sort((a, b) => b.Gardes - a.Gardes)
    .filter(d => d.Gardes > 0 || doctors.length <= 5)

  if (data.length === 0) return (
    <div className="flex items-center justify-center h-32 text-sm text-slate-400">
      Aucune donnée
    </div>
  )

  const avg = data.reduce((s, d) => s + d.Gardes, 0) / (data.length || 1)

  return (
    <div>
      <p className="text-xs font-semibold text-slate-600 mb-2">{title}</p>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 0, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <RechartsTooltip
              formatter={(v: number) => [`${v} gardes`, ""]}
              contentStyle={{ fontSize: 12 }}
            />
            <Bar dataKey="Gardes" radius={[4, 4, 0, 0]}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={GROUP_COLORS[entry.name] || "#94a3b8"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10px] text-slate-400 mt-1 text-center">
        Moyenne : {avg.toFixed(1)} gardes/médecin
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Dialog
// ─────────────────────────────────────────────────────────────────────────────
type ApplyOutcome = {
  ok: boolean
  proposals?: number
  warnings?: string[]
  error?: string
  before?: ScheduleData
}

type ApplyWeekResult = { weekKey: string; outcome: ApplyOutcome }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUser: string
  /** Première semaine modifiable (semaine en cours) : l'historique n'est jamais touché. */
  minWeekKey?: string
  /** Génère et enregistre les propositions d'une semaine (même chaîne que « Générer »). */
  onGenerateWeek?: (weekKey: string) => Promise<ApplyOutcome>
  /** Restaure l'état d'avant la génération pour les semaines données. */
  onRestoreWeeks?: (
    snapshots: Record<string, ScheduleData | undefined>,
  ) => Promise<{ restored: number; failed: number }>
}

export function SixMonthProjectionDialog({ open, onOpenChange, currentUser, minWeekKey, onGenerateWeek, onRestoreWeeks }: Props) {
  const [semester, setSemester] = useState<Semester>(
    new Date().getMonth() < 8 ? 1 : 2,
  )
  const [year, setYear] = useState(CURRENT_YEAR)
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [summary, setSummary] = useState<ProjectionSummary | null>(null)
  const [currentWeekLabel, setCurrentWeekLabel] = useState<string>("")

  const weekKeys = useMemo(() => getWeekKeysForSemester(semester, year), [semester, year])

  // --- Génération réelle dans le planning (semaines en cours et à venir uniquement) ---
  const upcomingWeekKeys = useMemo(
    () => weekKeys.filter((wk) => !minWeekKey || wk >= minWeekKey),
    [weekKeys, minWeekKey],
  )
  const [applyConfirm, setApplyConfirm] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [applyProgress, setApplyProgress] = useState(0)
  const [applyLabel, setApplyLabel] = useState("")
  const [applyResults, setApplyResults] = useState<ApplyWeekResult[]>([])
  const snapshotsRef = useRef<Record<string, ScheduleData | undefined>>({})
  const cancelRef = useRef(false)
  const [isRestoring, setIsRestoring] = useState(false)

  const handleApply = useCallback(async () => {
    if (!onGenerateWeek) return
    setApplyConfirm(false)
    setIsApplying(true)
    setApplyProgress(0)
    setApplyResults([])
    snapshotsRef.current = {}
    cancelRef.current = false
    const results: ApplyWeekResult[] = []

    for (let i = 0; i < upcomingWeekKeys.length; i++) {
      if (cancelRef.current) break
      const wk = upcomingWeekKeys[i]
      setApplyLabel(`Semaine ${wk} (${i + 1}/${upcomingWeekKeys.length})`)
      setApplyProgress(Math.round((i / upcomingWeekKeys.length) * 100))
      const outcome = await onGenerateWeek(wk)
      // Instantané d'avant, pour « Tout annuler » (même quand la semaine n'existait pas)
      snapshotsRef.current[wk] = outcome.before
      results.push({ weekKey: wk, outcome })
      setApplyResults([...results])
    }

    setApplyProgress(100)
    setApplyLabel("")
    setIsApplying(false)
    const failed = results.filter((r) => !r.outcome.ok).length
    const total = results.reduce((n, r) => n + (r.outcome.proposals ?? 0), 0)
    if (cancelRef.current) {
      toast.warning(`Génération interrompue après ${results.length} semaine(s).`)
    } else if (failed === 0) {
      toast.success(`${results.length} semaines générées — ${total} propositions à valider sur la vue Globale.`)
    } else {
      toast.warning(`${results.length - failed} semaines générées, ${failed} en erreur.`)
    }
  }, [onGenerateWeek, upcomingWeekKeys])

  const handleRestore = useCallback(async () => {
    if (!onRestoreWeeks) return
    if (!confirm("Annuler la génération du semestre et restaurer les semaines concernées dans leur état d'avant ?")) return
    setIsRestoring(true)
    const { restored, failed } = await onRestoreWeeks(snapshotsRef.current)
    setIsRestoring(false)
    if (failed === 0) {
      toast.success(`${restored} semaine(s) restaurée(s).`)
      setApplyResults([])
      snapshotsRef.current = {}
    } else {
      toast.error(`${restored} restaurée(s), ${failed} en échec — réessayez.`)
    }
  }, [onRestoreWeeks])
  const semesterLabel = getSemesterLabel(semester, year)

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true)
    setProgress(0)
    setSummary(null)
    setCurrentWeekLabel("")

    const results: WeekProjectionResult[] = []
    const doctorGuardCounts: Record<string, number> = {}
    let doneWeeks = 0
    let errorWeeks = 0

    toast.message("Projection en cours…", {
      description: `Génération sur ${weekKeys.length} semaines — veuillez patienter.`,
      duration: 5000,
    })

    for (let i = 0; i < weekKeys.length; i++) {
      const wk = weekKeys[i]
      setCurrentWeekLabel(`Semaine ${wk} (${i + 1}/${weekKeys.length})`)
      setProgress(Math.round(((i) / weekKeys.length) * 100))

      try {
        const monday = mondayOfWeekKey(wk)
        // Call the solver API for this week
        const result = await generateGuardsViaAPI(
          monday,
          [], // vacations — projection uses no vacation constraints
          "ROTATION",
        )

        if (result.error || !result.schedule) {
          results.push({ weekKey: wk, status: "error", error: result.error || "No schedule returned" })
          errorWeeks++
        } else {
          // Count guard assignments from the generated schedule
          const weekGuards: Record<string, number> = {}
          const schedData = result.schedule

          for (const rowKey of Object.keys(schedData)) {
            const isGuardRow =
              rowKey.toLowerCase().includes("garde matin") ||
              rowKey.toLowerCase().includes("garde nuit")

            if (!isGuardRow) continue

            for (const dayKey of Object.keys(schedData[rowKey])) {
              const cell = schedData[rowKey][dayKey]
              if (!cell?.value?.length) continue
              for (const doc of cell.value) {
                if (!doc || doc.length > 4) continue // skip non-initials
                weekGuards[doc] = (weekGuards[doc] || 0) + 1
                doctorGuardCounts[doc] = (doctorGuardCounts[doc] || 0) + 1
              }
            }
          }

          results.push({ weekKey: wk, status: "done", guardCounts: weekGuards })
          doneWeeks++
        }
      } catch (err) {
        results.push({
          weekKey: wk,
          status: "error",
          error: err instanceof Error ? err.message : "Unknown error",
        })
        errorWeeks++
      }

      // Small delay to avoid overloading the API
      if (i < weekKeys.length - 1) {
        await new Promise(r => setTimeout(r, 300))
      }
    }

    setProgress(100)
    setCurrentWeekLabel("")
    setSummary({
      doctorGuardCounts,
      weekResults: results,
      totalWeeks: weekKeys.length,
      doneWeeks,
      errorWeeks,
    })

    if (errorWeeks === 0) {
      toast.success(`Projection terminée ! ${doneWeeks} semaines générées.`)
    } else {
      toast.warning(`Projection terminée avec ${errorWeeks} erreur(s) sur ${weekKeys.length} semaines.`)
    }

    setIsGenerating(false)
  }, [weekKeys])

  const allDoctors = summary
    ? Object.keys(summary.doctorGuardCounts).sort(
        (a, b) => (summary.doctorGuardCounts[b] || 0) - (summary.doctorGuardCounts[a] || 0),
      )
    : []

  const womDoctors = allDoctors.filter(d => GROUP_WOM.includes(d))
  const hzgsbDoctors = allDoctors.filter(d => GROUP_HZGSB.includes(d))
  const aupDoctors = allDoctors.filter(d => GROUP_AUP.includes(d))
  const otherDoctors = allDoctors.filter(
    d => !GROUP_WOM.includes(d) && !GROUP_HZGSB.includes(d) && !GROUP_AUP.includes(d),
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-hidden bg-slate-50 text-slate-900 p-0 flex flex-col">
        {/* Header */}
        <div className="flex-none p-5 border-b border-slate-200 bg-white">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
                Projection Planning — 6 Mois
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500">
                Génération automatique via le solveur pour visualiser la répartition équitable sur {weekKeys.length} semaines.
              </DialogDescription>
            </div>

            <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-[11px] px-2 py-0.5">
              <Shield className="h-3 w-3 mr-1" /> Admin uniquement
            </Badge>
          </div>

          {/* Semester selector */}
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              {([1, 2] as Semester[]).map(s => (
                <button
                  key={s}
                  onClick={() => { setSemester(s); setSummary(null) }}
                  disabled={isGenerating}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-bold transition-all disabled:opacity-50",
                    semester === s
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900",
                  )}
                >
                  {s === 1 ? "🌸 Semestre 1 (Jan–Août)" : "🍂 Semestre 2 (Sept–Déc+)"}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              {[CURRENT_YEAR, CURRENT_YEAR + 1].map(y => (
                <button
                  key={y}
                  onClick={() => { setYear(y); setSummary(null) }}
                  disabled={isGenerating}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-bold transition-all disabled:opacity-50",
                    year === y
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900",
                  )}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Génération réelle dans le planning */}
          {onGenerateWeek && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm font-bold text-emerald-900">Générer dans le planning</p>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    {upcomingWeekKeys.length} semaine(s) en cours et à venir • propositions « Prop. » en violet • l&apos;historique n&apos;est jamais modifié
                  </p>
                </div>
                {isApplying ? (
                  <Button
                    onClick={() => { cancelRef.current = true }}
                    variant="outline"
                    className="gap-2 border-emerald-300 bg-white text-emerald-900"
                  >
                    <Square className="h-4 w-4" /> Arrêter
                  </Button>
                ) : (
                  <Button
                    onClick={() => setApplyConfirm(true)}
                    disabled={isGenerating || isRestoring || upcomingWeekKeys.length === 0}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2"
                  >
                    <Play className="h-4 w-4" />
                    Générer le semestre
                  </Button>
                )}
              </div>

              {applyConfirm && !isApplying && (
                <div className="rounded-lg border border-emerald-300 bg-white p-3 text-xs text-slate-700 space-y-2">
                  <p className="font-bold text-slate-900">Confirmer la génération de {upcomingWeekKeys.length} semaines ?</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>Même solveur et mêmes règles que le bouton « Générer » d&apos;une semaine : congés, fériés, binômes, NCT, astreintes.</li>
                    <li>Seules les cases vides reçoivent des propositions : vos saisies manuelles et cases validées sont conservées.</li>
                    <li>Chaque semaine est enregistrée avant la suivante (dimanche précédent, repos de nuit, équité).</li>
                    <li>Rien n&apos;est validé : « Effacer propositions » ou « Tout annuler » ci-dessous les retire.</li>
                    <li>Durée : plusieurs minutes. Gardez cette fenêtre ouverte.</li>
                  </ul>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={() => void handleApply()} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                      Confirmer et générer
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setApplyConfirm(false)}>
                      Annuler
                    </Button>
                  </div>
                </div>
              )}

              {isApplying && (
                <div className="space-y-1.5">
                  <div className="h-2 w-full rounded-full bg-emerald-200 overflow-hidden">
                    <div className="h-full bg-emerald-600 rounded-full transition-all duration-500" style={{ width: `${applyProgress}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-emerald-800">
                    <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />{applyLabel}</span>
                    <span>{applyProgress}%</span>
                  </div>
                </div>
              )}

              {applyResults.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap text-xs font-semibold">
                    <span className="rounded-md bg-white border border-emerald-200 px-2 py-1 text-emerald-800">
                      {applyResults.filter((r) => r.outcome.ok).length} OK
                    </span>
                    {applyResults.some((r) => !r.outcome.ok) && (
                      <span className="rounded-md bg-red-50 border border-red-200 px-2 py-1 text-red-700">
                        {applyResults.filter((r) => !r.outcome.ok).length} en erreur
                      </span>
                    )}
                    <span className="rounded-md bg-violet-50 border border-violet-200 px-2 py-1 text-violet-800">
                      {applyResults.reduce((n, r) => n + (r.outcome.proposals ?? 0), 0)} propositions
                    </span>
                    {onRestoreWeeks && !isApplying && (
                      <Button size="sm" variant="outline" onClick={() => void handleRestore()} disabled={isRestoring} className="ml-auto gap-1">
                        {isRestoring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
                        Tout annuler
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {applyResults.map(({ weekKey: wk, outcome }) => (
                      <div
                        key={wk}
                        className={cn(
                          "rounded-lg border px-2.5 py-2 text-[11px]",
                          outcome.ok ? "border-emerald-200 bg-white" : "border-red-200 bg-red-50",
                        )}
                      >
                        <p className="font-bold text-slate-700">{wk}</p>
                        {outcome.ok ? (
                          <p className="text-slate-500 mt-0.5">
                            {outcome.proposals ?? 0} prop.
                            {outcome.warnings && outcome.warnings.length > 0 ? ` · ${outcome.warnings.length} alerte(s)` : ""}
                          </p>
                        ) : (
                          <p className="text-red-600 mt-0.5 truncate" title={outcome.error}>⚠ {outcome.error?.slice(0, 40)}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Launch area */}
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sm font-bold text-indigo-800">{semesterLabel}</p>
                <p className="text-xs text-indigo-600 mt-0.5">
                  {weekKeys.length} semaines à traiter • ~{Math.ceil(weekKeys.length * 0.5)} minutes estimées
                </p>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Génération en cours…
                  </>
                ) : summary ? (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Régénérer
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Lancer la Projection
                  </>
                )}
              </Button>
            </div>

            {/* Progress bar */}
            {isGenerating && (
              <div className="space-y-1.5">
                <div className="h-2 w-full rounded-full bg-indigo-200 overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-indigo-600">
                  <span>{currentWeekLabel}</span>
                  <span>{progress}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Results */}
          {summary && (
            <div className="space-y-5">
              {/* Summary badges */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs font-bold text-emerald-700">{summary.doneWeeks} semaines générées</span>
                </div>
                {summary.errorWeeks > 0 && (
                  <div className="flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span className="text-xs font-bold text-red-700">{summary.errorWeeks} erreurs</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                  <Users className="h-4 w-4 text-slate-500" />
                  <span className="text-xs font-bold text-slate-600">
                    {allDoctors.length} médecins dans la projection
                  </span>
                </div>
              </div>

              {/* Equity charts by sub-group */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {womDoctors.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <EquityBarChart
                      doctorGuardCounts={summary.doctorGuardCounts}
                      title="⚡ Groupe Coro (W, O, M)"
                      doctors={womDoctors}
                    />
                  </div>
                )}
                {hzgsbDoctors.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <EquityBarChart
                      doctorGuardCounts={summary.doctorGuardCounts}
                      title="📈 Groupe Stress/ETT (H, Z, G, S, B)"
                      doctors={hzgsbDoctors}
                    />
                  </div>
                )}
                {aupDoctors.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <EquityBarChart
                      doctorGuardCounts={summary.doctorGuardCounts}
                      title="🎵 Groupe Rythmo (A, U, P)"
                      doctors={aupDoctors}
                    />
                  </div>
                )}
              </div>

              {/* Global equity table */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-blue-600" />
                  Équité globale — Toutes gardes WE
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-2 px-2 font-bold text-slate-600">Médecin</th>
                        <th className="text-right py-2 px-2 font-bold text-slate-600">Gardes</th>
                        <th className="text-right py-2 px-2 font-bold text-slate-600">% total</th>
                        <th className="py-2 px-2 font-bold text-slate-600">Répartition</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allDoctors.map(doc => {
                        const count = summary.doctorGuardCounts[doc] || 0
                        const total = Object.values(summary.doctorGuardCounts).reduce((s, c) => s + c, 0)
                        const pct = total > 0 ? ((count / total) * 100) : 0
                        return (
                          <tr key={doc} className="border-b border-slate-50 hover:bg-slate-50">
                            <td className="py-1.5 px-2">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={cn(
                                    "inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black text-white",
                                    DOCTOR_COLORS[doc] || "bg-slate-400",
                                  )}
                                >
                                  {doc}
                                </span>
                                <span className="font-semibold text-slate-700">{formatPersonLabel(doc)}</span>
                              </div>
                            </td>
                            <td className="py-1.5 px-2 text-right font-bold text-slate-800">{count}</td>
                            <td className="py-1.5 px-2 text-right text-slate-500">{pct.toFixed(1)}%</td>
                            <td className="py-1.5 px-2">
                              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${pct}%`,
                                    backgroundColor: GROUP_COLORS[doc] || "#94a3b8",
                                  }}
                                />
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Week-by-week results (collapsible) */}
              <details className="rounded-xl border border-slate-200 bg-white">
                <summary className="px-4 py-3 cursor-pointer text-xs font-bold text-slate-600 select-none hover:text-slate-900 flex items-center gap-2">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Détail semaine par semaine ({summary.weekResults.length} semaines)
                </summary>
                <div className="px-4 pb-4 pt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {summary.weekResults.map(wr => (
                    <div
                      key={wr.weekKey}
                      className={cn(
                        "rounded-lg border px-2.5 py-2 text-[11px]",
                        wr.status === "done"
                          ? "border-emerald-200 bg-emerald-50"
                          : wr.status === "error"
                            ? "border-red-200 bg-red-50"
                            : "border-slate-200 bg-slate-50",
                      )}
                    >
                      <p className="font-bold text-slate-700">{wr.weekKey}</p>
                      {wr.status === "done" && wr.guardCounts && (
                        <p className="text-slate-500 mt-0.5">
                          {Object.entries(wr.guardCounts)
                            .map(([d, c]) => `${d}:${c}`)
                            .join(" · ")}
                        </p>
                      )}
                      {wr.status === "error" && (
                        <p className="text-red-500 mt-0.5 truncate" title={wr.error}>
                          ⚠ {wr.error?.slice(0, 40)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}

          {!summary && !isGenerating && (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-slate-400">
              <TrendingUp className="h-12 w-12 opacity-30" />
              <p className="text-sm font-semibold">Cliquez sur « Lancer la Projection » pour simuler (sans modifier le planning)</p>
              <p className="text-xs text-center max-w-md">
                Le solveur traitera chaque semaine du semestre sélectionné et calculera la répartition équitable des gardes par sous-groupe.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
