import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { buildPlanningPdf } from "@/lib/planning-pdf"
import type { ScheduleData } from "@/lib/types"

export async function GET(req: NextRequest) {
  const weekKey = req.nextUrl.searchParams.get("week_key")
  if (!weekKey) {
    return NextResponse.json({ error: "week_key requis" }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin requis" }, { status: 403 })
  }

  const { data: row, error } = await supabase
    .from("schedules")
    .select("schedule_data")
    .eq("week_key", weekKey)
    .single()

  if (error || !row?.schedule_data) {
    return NextResponse.json({ error: "Planning introuvable pour cette semaine" }, { status: 404 })
  }

  try {
    const bytes = await buildPlanningPdf(weekKey, row.schedule_data as ScheduleData)
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="planning-${weekKey}.pdf"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (err) {
    console.error("[export-planning-pdf]", err)
    return NextResponse.json({ error: "Échec de génération du PDF" }, { status: 500 })
  }
}
