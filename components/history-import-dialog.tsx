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
import {
  commitHistoryImport,
  previewHistoryImport,
} from "@/app/actions/import-history-actions"
import type { PdfWeekExtraction, WeekImportPreview } from "@/lib/history-import"
import { toast } from "sonner"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  weeks: PdfWeekExtraction[]
  currentUser: string
  onImported?: (weekKeys: string[]) => void
}

export function HistoryImportDialog({
  open,
  onOpenChange,
  weeks,
  currentUser,
  onImported,
}: Props) {
  const [previews, setPreviews] = useState<WeekImportPreview[]>([])
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    startTransition(async () => {
      const p = await previewHistoryImport(weeks)
      setPreviews(p)
    })
  }, [open, weeks])

  const selectedIndexes = useMemo(
    () => previews.filter((p) => p.selected && p.weekKey).map((p) => p.page_index),
    [previews],
  )

  const toggle = (pageIndex: number) => {
    setPreviews((prev) =>
      prev.map((p) =>
        p.page_index === pageIndex && p.weekKey ? { ...p, selected: !p.selected } : p,
      ),
    )
  }

  const selectAll = (value: boolean) => {
    setPreviews((prev) =>
      prev.map((p) => (p.weekKey && p.highConfidenceCells > 0 ? { ...p, selected: value } : p)),
    )
  }

  const confirm = () => {
    startTransition(async () => {
      const result = await commitHistoryImport(weeks, selectedIndexes, currentUser)
      if (!result.success) {
        toast.error(result.errors[0] || "Import historique échoué")
        return
      }
      toast.success(
        `${result.imported} semaine(s) importée(s)${result.skipped ? ` · ${result.skipped} ignorée(s)` : ""}`,
      )
      result.errors.slice(0, 3).forEach((e) => toast.warning(e))
      onImported?.(result.weekKeys)
      onOpenChange(false)
    })
  }

  const totalLow = previews.reduce((a, p) => a + p.lowConfidenceCells, 0)
  const totalHigh = previews.reduce((a, p) => a + (p.selected ? p.highConfidenceCells : 0), 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importer l’historique PDF</DialogTitle>
          <DialogDescription>
            {weeks.length} semaine(s) détectée(s). Vérifiez avant import — seules les cellules
            OCR « high » sont proposées ; les cellules déjà remplies ne seront pas écrasées.
          </DialogDescription>
        </DialogHeader>

        <div className="mb-2 flex items-center justify-between text-xs text-slate-600">
          <span>
            Sélection : {selectedIndexes.length}/{previews.length} · {totalHigh} cellule(s) high
            {totalLow > 0 ? ` · ${totalLow} low (ignorées)` : ""}
          </span>
          <div className="flex gap-2">
            <button type="button" className="underline" onClick={() => selectAll(true)}>
              Tout
            </button>
            <button type="button" className="underline" onClick={() => selectAll(false)}>
              Rien
            </button>
          </div>
        </div>

        <ul className="space-y-2">
          {previews.map((p) => {
            const dateSample = Object.entries(p.dates_by_day)
              .slice(0, 2)
              .map(([d, iso]) => `${d.slice(0, 3)} ${iso}`)
              .join(" · ")
            return (
              <li
                key={p.page_index}
                className={`rounded-lg border p-2 text-sm ${
                  p.error ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"
                }`}
              >
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={p.selected}
                    disabled={!p.weekKey || p.highConfidenceCells === 0 || pending}
                    onChange={() => toggle(p.page_index)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-900">
                      Page {p.page_index + 1}
                      {p.weekKey ? ` · ${p.weekKey}` : ""}
                      {p.week_label ? ` · ${p.week_label}` : ""}
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {dateSample || "Dates illisibles"}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-600">
                      {p.highConfidenceCells} high · {p.lowConfidenceCells} low
                      {p.warnings.length ? ` · ${p.warnings.length} alerte(s)` : ""}
                    </div>
                    {p.error && <div className="text-xs text-amber-700">{p.error}</div>}
                    {p.warnings.slice(0, 2).map((w, i) => (
                      <div key={i} className="text-[11px] text-amber-700">
                        ⚠ {w}
                      </div>
                    ))}
                  </div>
                </label>
              </li>
            )
          })}
        </ul>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Annuler
          </Button>
          <Button onClick={confirm} disabled={pending || selectedIndexes.length === 0}>
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Import…
              </>
            ) : (
              `Importer ${selectedIndexes.length} semaine(s)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
