"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { MessageSquarePlus, X } from "lucide-react"
import { toast } from "sonner"
import { submitFeedback } from "@/app/actions/feedback-actions"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const CATEGORIES = [
  { value: "general", label: "Général" },
  { value: "performance", label: "Performance / vitesse" },
  { value: "usability", label: "Facilité d’utilisation" },
  { value: "bug", label: "Bug" },
  { value: "feature", label: "Idée de fonctionnalité" },
] as const

export function FeedbackButton() {
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [category, setCategory] = useState("general")
  const [rating, setRating] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const send = async () => {
    setBusy(true)
    try {
      const res = await submitFeedback({
        message,
        category,
        rating: rating ? Number(rating) : null,
        pagePath: typeof window !== "undefined" ? window.location.pathname : undefined,
      })
      if (!res.success) {
        toast.error(res.error || "Envoi impossible")
        return
      }
      toast.success("Merci pour votre retour !")
      setMessage("")
      setRating("")
      setCategory("general")
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  if (!mounted) return null

  return createPortal(
    <>
      <button
        type="button"
        data-testid="feedback-fab"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 left-4 z-[90] flex items-center gap-2 rounded-full bg-teal-700 px-3 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-teal-800 md:bottom-4 md:right-4 md:left-auto md:px-4 md:py-3"
        aria-label="Envoyer un feedback"
        title="Feedback"
      >
        <MessageSquarePlus className="h-5 w-5" />
        Feedback
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-title"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 id="feedback-title" className="text-lg font-bold text-slate-900">
                Envoyer un feedback
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1 hover:bg-slate-100"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              Facilité d’usage, vitesse, bugs… vos retours aident à prioriser les améliorations.
            </p>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="feedback-category">Catégorie</Label>
                <select
                  id="feedback-category"
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="feedback-rating">Note (optionnel)</Label>
                <select
                  id="feedback-rating"
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={rating}
                  onChange={(e) => setRating(e.target.value)}
                >
                  <option value="">—</option>
                  <option value="1">1 / 5</option>
                  <option value="2">2 / 5</option>
                  <option value="3">3 / 5</option>
                  <option value="4">4 / 5</option>
                  <option value="5">5 / 5</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="feedback-message">Message</Label>
                <Textarea
                  id="feedback-message"
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Dites-nous ce que vous pensez de l'application…"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button className="flex-1" onClick={() => void send()} disabled={busy}>
                {busy ? "Envoi…" : "Envoyer"}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  )
}
