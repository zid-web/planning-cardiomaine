"use client"

import React, { useState, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, PieChart as PieChartIcon, BarChart2 } from "lucide-react"
import { DOCTOR_COLORS } from "@/lib/constants"
import { cn } from "@/lib/utils"
import {
  calculateMonthlyWorkloadStats,
  calculateSixMonthsWorkloadStats,
  sortedWorkloadEntries,
  sortedTaskEntries,
  type MonthlyWorkloadStats,
} from "@/lib/scheduler-algo"
import type { FullSchedule } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  fullSchedule: FullSchedule | null | undefined
}

export function StatsDialog({ open, onOpenChange, fullSchedule }: Props) {
  const [viewMode, setViewMode] = useState<"1mois" | "6mois">("1mois")
  const [statsMonth, setStatsMonth] = useState(() => new Date().getMonth() + 1)
  const [statsYear, setStatsYear] = useState(() => new Date().getFullYear())

  const shiftStatsMonth = (delta: number) => {
    setStatsMonth((prev) => {
      let next = prev + delta
      let y = statsYear
      if (next > 12) {
        next = 1
        y += 1
      } else if (next < 1) {
        next = 12
        y -= 1
      }
      setStatsYear(y)
      return next
    })
  }

  const stats = useMemo<MonthlyWorkloadStats>(() => {
    if (viewMode === "1mois") {
      return calculateMonthlyWorkloadStats(fullSchedule, statsYear, statsMonth)
    } else {
      return calculateSixMonthsWorkloadStats(fullSchedule, statsYear, statsMonth)
    }
  }, [fullSchedule, statsYear, statsMonth, viewMode])

  const workloadEntries = useMemo(() => sortedWorkloadEntries(stats), [stats])

  // Regroupements par domaine
  // Coro, Astreinte for (W,O,M)
  // Stress, ETT for (H,Z,G,S,B)
  // Rythmo for (A,U,P)
  // Gardes for everyone

  const groupW_O_M = ["W", "O", "M"]
  const groupH_Z_G_S_B = ["H", "Z", "G", "S", "B"]
  const groupA_U_P = ["A", "U", "P"]

  const sumTasks = (doctors: string[], matchFn: (taskKey: string) => boolean) => {
    return doctors.map((doc) => {
      const detail = stats.doctors[doc]
      if (!detail) return { name: doc, value: 0 }
      const value = Object.entries(detail.byTask).reduce((acc, [taskKey, count]) => {
        return matchFn(taskKey) ? acc + count : acc
      }, 0)
      return { name: doc, value }
    }).filter(d => d.value > 0)
  }

  const coroData = useMemo(() => sumTasks(groupW_O_M, k => k.toUpperCase().includes("CORO") || k.toUpperCase().includes("ASTREINTE")), [stats])
  const stressEttData = useMemo(() => sumTasks(groupH_Z_G_S_B, k => k.toUpperCase().includes("STRESS") || k.toUpperCase().includes("ETT") || k.toUpperCase().includes("EE")), [stats])
  const rythmoData = useMemo(() => sumTasks(groupA_U_P, k => k.toUpperCase().includes("RYTHMO") || k.toUpperCase().includes("PACE MAKER") || k.toUpperCase().includes("PM")), [stats])
  
  const gardesData = useMemo(() => {
    return Object.keys(stats.doctors).map((doc) => {
      const detail = stats.doctors[doc]
      const gardeTotal = Object.entries(detail.byTask).reduce((acc, [taskKey, count]) => {
        return taskKey.toUpperCase().includes("GARDE") ? acc + count : acc
      }, 0)
      return { name: doc, Gardes: gardeTotal }
    }).sort((a,b) => b.Gardes - a.Gardes).filter(d => d.Gardes > 0)
  }, [stats])

  const COLORS_MAP: Record<string, string> = {
    M: "#ef4444", W: "#f97316", O: "#eab308", // W,O,M
    H: "#22c55e", Z: "#10b981", G: "#14b8a6", S: "#06b6d4", B: "#3b82f6", // H,Z,G,S,B
    A: "#8b5cf6", U: "#d946ef", P: "#f43f5e" // A,U,P
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden bg-slate-50 text-slate-900 p-0 flex flex-col">
        <div className="flex-none p-5 border-b border-slate-200 bg-white">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <PieChartIcon className="w-5 h-5 text-blue-600" />
                Tableau de Bord des Statistiques
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500">
                {stats.weeksScanned > 0
                  ? `Analysé sur ${stats.weeksScanned} semaine${stats.weeksScanned > 1 ? "s" : ""} de données en mémoire.`
                  : "Aucune semaine en mémoire pour cette période."}
              </DialogDescription>
            </div>
            
            <div className="flex flex-col items-end gap-3">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md">
                <Button
                  variant={viewMode === "1mois" ? "default" : "ghost"}
                  size="sm"
                  className={cn("h-7 px-3 text-xs", viewMode === "1mois" && "bg-white text-slate-900 shadow-sm")}
                  onClick={() => setViewMode("1mois")}
                >
                  Mensuel
                </Button>
                <Button
                  variant={viewMode === "6mois" ? "default" : "ghost"}
                  size="sm"
                  className={cn("h-7 px-3 text-xs", viewMode === "6mois" && "bg-white text-slate-900 shadow-sm")}
                  onClick={() => setViewMode("6mois")}
                >
                  6 Mois (jusqu'à {stats.label})
                </Button>
              </div>
              
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftStatsMonth(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-[140px] text-center text-sm font-semibold capitalize bg-white border border-slate-200 py-1.5 px-3 rounded-md">
                  {stats.label}
                </span>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftStatsMonth(1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <Tabs defaultValue="graphs" className="w-full">
            <TabsList className="grid w-full grid-cols-2 max-w-sm mb-6 bg-slate-200/50">
              <TabsTrigger value="graphs">Graphiques (Par Domaines)</TabsTrigger>
              <TabsTrigger value="list">Détails (Par Médecin)</TabsTrigger>
            </TabsList>

            <TabsContent value="graphs" className="space-y-6 mt-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Coro/Astreinte W,O,M */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-800 text-center mb-2">Coro & Astreintes (W,O,M)</h3>
                  {coroData.length > 0 ? (
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={coroData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" nameKey="name" paddingAngle={2}>
                            {coroData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS_MAP[entry.name] || '#94a3b8'} />
                            ))}
                          </Pie>
                          <RechartsTooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-48 flex items-center justify-center text-sm text-slate-400">Aucune donnée</div>
                  )}
                </div>

                {/* Stress/ETT H,Z,G,S,B */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-800 text-center mb-2">Stress & ETT (H,Z,G,S,B)</h3>
                  {stressEttData.length > 0 ? (
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={stressEttData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" nameKey="name" paddingAngle={2}>
                            {stressEttData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS_MAP[entry.name] || '#94a3b8'} />
                            ))}
                          </Pie>
                          <RechartsTooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-48 flex items-center justify-center text-sm text-slate-400">Aucune donnée</div>
                  )}
                </div>

                {/* Rythmo A,U,P */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-800 text-center mb-2">Rythmo (A,U,P)</h3>
                  {rythmoData.length > 0 ? (
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={rythmoData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" nameKey="name" paddingAngle={2}>
                            {rythmoData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS_MAP[entry.name] || '#94a3b8'} />
                            ))}
                          </Pie>
                          <RechartsTooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-48 flex items-center justify-center text-sm text-slate-400">Aucune donnée</div>
                  )}
                </div>
              </div>

              {/* Gardes (Tout le monde) */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mt-6">
                <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4" />
                  Répartition des Gardes (Groupe Complet)
                </h3>
                {gardesData.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={gardesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                        <YAxis tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                        <RechartsTooltip cursor={{fill: '#f1f5f9'}} />
                        <Bar dataKey="Gardes" radius={[4,4,0,0]} maxBarSize={50}>
                          {gardesData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS_MAP[entry.name] || '#3b82f6'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-32 flex items-center justify-center text-sm text-slate-400">Aucune donnée de garde</div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="list" className="mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {workloadEntries.every((e) => e.detail.total === 0) ? (
                  <div className="col-span-full rounded-md bg-white p-8 text-center text-sm text-slate-500 border border-slate-200 shadow-sm">
                    Aucune tâche comptabilisée.
                  </div>
                ) : (
                  workloadEntries
                    .filter((e) => e.detail.total > 0)
                    .map(({ doctor, detail }) => {
                      const tasks = sortedTaskEntries(detail.byTask)
                      return (
                        <div key={doctor} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                          <div className="bg-slate-50 p-3 border-b border-slate-200 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <div
                                className={cn(
                                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white shadow-inner",
                                  DOCTOR_COLORS[doctor] || "bg-slate-500"
                                )}
                                style={COLORS_MAP[doctor] ? { backgroundColor: COLORS_MAP[doctor] } : {}}
                              >
                                {doctor}
                              </div>
                              <span className="font-bold text-slate-800 text-lg">{doctor}</span>
                            </div>
                            <Badge variant="secondary" className="text-sm px-2 py-0.5 bg-white border border-slate-200 shadow-sm">
                              {detail.total} tâches
                            </Badge>
                          </div>
                          <div className="p-3 flex-1 overflow-y-auto max-h-48">
                            <ul className="space-y-1.5">
                              {tasks.map(([rowKey, count]) => (
                                <li key={rowKey} className="flex items-center justify-between text-xs text-slate-600">
                                  <span className="truncate pr-2">{rowKey}</span>
                                  <span className="font-medium bg-slate-100 px-1.5 rounded">{count}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )
                    })
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
