"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, MessageSquare } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { listFeedback } from "@/app/actions/feedback-actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Row = {
  id: string
  user_email: string | null
  category: string
  rating: number | null
  message: string
  page_path: string | null
  created_at: string
}

export default function AdminFeedbackPage() {
  const router = useRouter()
  const supabase = createClient()
  const [ready, setReady] = useState(false)
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    const boot = async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData?.user) {
        router.replace("/auth/login")
        return
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userData.user.id)
        .single()
      if (profile?.role !== "admin") {
        toast.error("Accès admin requis")
        router.replace("/protected/planning")
        return
      }
      const res = await listFeedback(100)
      if (!res.success) toast.error(res.error || "Erreur")
      else setRows(res.rows as Row[])
      setReady(true)
    }
    void boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        Chargement…
      </div>
    )
  }

  return (
    // Root layout = overflow-hidden : scroller ici sinon la liste est tronquée.
    <div className="h-full overflow-y-auto overscroll-y-contain bg-slate-50">
      <div className="mx-auto max-w-3xl space-y-4 p-4 pb-20 md:p-8">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.push("/protected/planning")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold">
              <MessageSquare className="h-5 w-5" />
              Feedback utilisateurs
            </h1>
            <p className="text-xs text-slate-500">{rows.length} retour(s)</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Derniers messages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {rows.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400">Aucun feedback pour l’instant.</p>
            )}
            {rows.map((r) => (
              <div key={r.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-slate-800">{r.user_email || "—"}</div>
                  <span className="text-[10px] text-slate-400">
                    {new Date(r.created_at).toLocaleString("fr-FR")}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {r.category}
                  {r.rating != null ? ` · ${r.rating}/5` : ""}
                  {r.page_path ? ` · ${r.page_path}` : ""}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-slate-700">{r.message}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
