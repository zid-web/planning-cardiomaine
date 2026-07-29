'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Settings2, Zap } from 'lucide-react'
import { generateGuardsViaAPI } from '@/app/actions/guard-api-actions'
import { DoctorVacation, ScheduleData } from '@/lib/types'
import { getWeekNumber } from '@/lib/schedule-utils'
import { parseISO } from 'date-fns'
import {
  defaultWeekGenerationParams,
  LFB_POOL,
  toSolverWeekGenerationOverrides,
  VISITE_POOL,
  type LfbDoctor,
  type VisiteDoctor,
  type WeekGenerationParams,
} from '@/lib/week-generation-params'
import { toast } from 'sonner'

interface GuardGenerationButtonProps {
  weekKey: string
  vacations: DoctorVacation[]
  onGenerationComplete: (schedule: ScheduleData, warnings: string[]) => void
  disabled?: boolean
  className?: string
}

export function GuardGenerationButton({
  weekKey,
  vacations,
  onGenerationComplete,
  disabled = false,
  className = '',
}: GuardGenerationButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [paramsOpen, setParamsOpen] = useState(false)

  const weekNum = useMemo(() => {
    try {
      return getWeekNumber(parseISO(weekKey)).week
    } catch {
      return 1
    }
  }, [weekKey])

  const [params, setParams] = useState<WeekGenerationParams>(() =>
    defaultWeekGenerationParams(weekNum),
  )

  // Pré-remplir à chaque changement de semaine (admin peut encore corriger)
  useEffect(() => {
    setParams(defaultWeekGenerationParams(weekNum))
  }, [weekNum])

  const handleGenerateGuards = async () => {
    setIsLoading(true)
    toast.loading("Génération en cours... Cela peut prendre jusqu'à une minute...", {
      id: 'guard-generation',
    })

    try {
      const overrides = toSolverWeekGenerationOverrides(params)
      const result = await generateGuardsViaAPI(
        weekKey,
        vacations,
        'ROTATION',
        undefined,
        overrides,
      )

      if (!result.success) {
        toast.error(`Erreur: ${result.error}`, { id: 'guard-generation' })
        return
      }

      if (result.schedule) {
        const meta = result.historicalPatternsMeta
        const patternNote =
          meta && meta.slotsSent > 0
            ? ` · ${meta.slotsSent} créneau(x) historiques envoyés au solveur (${meta.weeksScanned} sem.)`
            : ''

        if (result.warnings && result.warnings.length > 0) {
          const actionable = result.warnings.filter(
            (w) =>
              !/historical_patterns\s*:.*non reconnu/i.test(w) &&
              !/non disponible.*vacances\/congé/i.test(w) &&
              !/^FV\s*:.*non disponible/i.test(w),
          )
          const infeasible = actionable.some((w) =>
            /aucune solution trouvée/i.test(w),
          )
          if (infeasible) {
            toast.error(
              `Solveur sans solution${patternNote}:\n` + actionable.join('\n'),
              { id: 'guard-generation', duration: 12000 },
            )
          } else if (actionable.length > 0) {
            toast.warning(
              `Alertes de génération${patternNote}:\n` + actionable.join('\n'),
              {
                id: 'guard-generation',
                duration: 8000,
              },
            )
          } else {
            toast.success(`Propositions générées (à valider)${patternNote}`, {
              id: 'guard-generation',
            })
          }
        } else {
          toast.success(`Propositions générées (à valider)${patternNote}`, {
            id: 'guard-generation',
          })
        }

        onGenerationComplete(result.schedule, result.warnings || [])
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
      toast.error(`Erreur: ${errorMessage}`, { id: 'guard-generation' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={`inline-flex items-center gap-0.5 ${className}`}>
      <Popover open={paramsOpen} onOpenChange={setParamsOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 border-slate-300 bg-white px-1.5 text-[11px] !text-slate-900 hover:bg-slate-100"
            title="Paramètres de la semaine (VISITE / LFB / PSSL) avant Générer"
            disabled={disabled || isLoading}
          >
            <Settings2 className="h-3.5 w-3.5 !text-slate-900" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-80 space-y-3 bg-white p-3 text-slate-900"
        >
          <div>
            <p className="text-xs font-semibold text-slate-900">Paramètres Générer</p>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-600">
              Pré-remplis selon la rotation ; corrigez si vacances / ajustement.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-slate-700">Semaine de VISITE</Label>
            <Select
              value={params.visite_doctor || '__none__'}
              onValueChange={(v) =>
                setParams((p) => ({
                  ...p,
                  visite_doctor: v === '__none__' ? '' : (v as VisiteDoctor),
                }))
              }
            >
              <SelectTrigger size="sm" className="w-full bg-white text-slate-900">
                <SelectValue placeholder="Aucune" />
              </SelectTrigger>
              <SelectContent className="bg-white text-slate-900">
                <SelectItem value="__none__">Aucune</SelectItem>
                {VISITE_POOL.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-slate-700">LFB (jeudi)</Label>
            <Select
              value={params.lfb_doctor || '__none__'}
              onValueChange={(v) =>
                setParams((p) => ({
                  ...p,
                  lfb_doctor: v === '__none__' ? '' : (v as LfbDoctor),
                }))
              }
            >
              <SelectTrigger size="sm" className="w-full bg-white text-slate-900">
                <SelectValue placeholder="Aucune" />
              </SelectTrigger>
              <SelectContent className="bg-white text-slate-900">
                <SelectItem value="__none__">Aucune</SelectItem>
                {LFB_POOL.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-2">
            <p className="text-[11px] font-medium text-slate-800">PSSL</p>
            <label className="flex items-center gap-2 text-[11px] text-slate-800">
              <Checkbox
                checked={params.pssl_b_active}
                onCheckedChange={(c) =>
                  setParams((p) => ({ ...p, pssl_b_active: c === true }))
                }
              />
              B fait PSSL ce jeudi
            </label>
            <label className="flex items-center gap-2 text-[11px] text-slate-800">
              <Checkbox
                checked={params.pssl_z_active}
                onCheckedChange={(c) =>
                  setParams((p) => ({ ...p, pssl_z_active: c === true }))
                }
              />
              Z fait PSSL ce mardi
            </label>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-full text-[11px] text-slate-700"
            onClick={() => setParams(defaultWeekGenerationParams(weekNum))}
          >
            Réinitialiser les défauts (W{weekNum})
          </Button>
        </PopoverContent>
      </Popover>

      <Button
        onClick={handleGenerateGuards}
        disabled={disabled || isLoading}
        size="sm"
        className="h-7 gap-1 bg-gradient-to-r from-blue-600 to-blue-700 px-2 text-[11px] hover:from-blue-700 hover:to-blue-800"
        title="Une seule génération : gardes/astreintes/Coro + Cs/ETT/EE/hors site — pending à valider"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Génération…</span>
          </>
        ) : (
          <>
            <Zap className="h-3.5 w-3.5" />
            <span>Générer</span>
          </>
        )}
      </Button>
    </div>
  )
}
