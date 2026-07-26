"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { fetchHistoricalPatterns } from "@/app/actions/import-history-actions"
import {
  applyPatternProposals,
  type PatternProposal,
} from "@/lib/pattern-analysis"
import type { ScheduleData } from "@/lib/types"
import { toast } from "sonner"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentSchedule: ScheduleData
  onApply: (next: ScheduleData, meta: { applied: number; skippedTies: number }) => void
}

export function PatternFillDialog({ open, onOpenChange, currentSchedule, onApply }: Props) {
  const [patterns, setPatterns] = useState<PatternProposal[]>([])
  const [weeksScanned, setWeeksScanned] = useState(0)
  const [acceptTies, setAcceptTies] = useState(false)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    startTransition(async () => {
      const res = await fetchHistoricalPatterns(12)
      if (!res.success) {
        toast.error(res.error || "Impossible de charger l’historique")
        setPatterns([])
        return
      }
      // Ne proposer que les cellules encore vides de la semaine courante
      const forEmpty = res.patterns.filter((p) => {
        const val = currentSchedule[p.row_key]?.[p.day_name]?.value || []
        return val.length === 0
      })
      setPatterns(forEmpty)
      setWeeksScanned(res.weeksScanned)
    })
  }, [open, currentSchedule])

  const actionable = useMemo(
    () => (acceptTies ? patterns : patterns.filter((p) => !p.tie)),
    [patterns, acceptTies],
  )
  const ties = patterns.filter((p) => p.tie).length

  const confirm = () => {
    const { next, applied, skippedTies } = applyPatternProposals(currentSchedule, patterns, {
      acceptTies,
      status: "pending",
    })
    if (applied === 0) {
      toast.message("Aucune cellule à compléter (vides + patterns disponibles)")
      return
    }
    onApply(next, { applied, skippedTies })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compléter avec l’historique</DialogTitle>
          <DialogDescription>
            Propositions basées sur la fréquence observée ({weeksScanned} semaine(s)) pour les
            activités hors solveur (Cs, ETT, EE, hors site…). Les cellules déjà remplies et les
            lignes Astreinte/Garde/NCT/Coro/Rythmo sont exclues. Statut « pending » jusqu’à
            validation.
          </DialogDescription>
        </DialogHeader>

        {pending && patterns.length === 0 ? (
          <div className="flex items-center gap-2 py-6 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyse de l’historique…
          </div>
        ) : (
          <>
            <div className="mb-2 text-xs text-slate-600">
              {actionable.length} proposition(s) applicables
              {ties > 0 ? ` · ${ties} ex-æquo` : ""}
            </div>
            {ties > 0 && (
              <label className="mb-2 flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={acceptTies}
                  onChange={(e) => setAcceptTies(e.target.checked)}
                />
                Inclure les ex-æquo (plusieurs médecins dans la cellule)
              </label>
            )}
            <ul className="max-h-64 space-y-1 overflow-y-auto text-xs">
              {(acceptTies ? patterns : patterns.filter((p) => !p.tie)).slice(0, 80).map((p) => (
                <li
                  key={`${p.row_key}-${p.day_name}`}
                  className="flex justify-between gap-2 rounded border border-slate-100 px-2 py-1"
                >
                  <span className="truncate text-slate-700">
                    {p.row_key} · {p.day_name.slice(0, 3)}
                  </span>
                  <span className="shrink-0 font-medium text-slate-900">
                    {p.doctors.join("/")}
                    <span className="ml-1 font-normal text-slate-400">
                      ({p.count}/{p.observations})
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Annuler
          </Button>
          <Button onClick={confirm} disabled={pending || actionable.length === 0}>
            Appliquer {actionable.length} proposition(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
