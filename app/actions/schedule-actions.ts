"use server"

import { createClient } from "@/lib/supabase/server"
import type { ScheduleData } from "@/lib/types"
import { revalidatePath } from "next/cache"
import { diffScheduleCells, type ScheduleSaveSource } from "@/lib/schedule-diff"

export type SaveScheduleOptions = {
  source?: ScheduleSaveSource
  /** When true (default), also merge this week into the full_schedule blob */
  syncFullBlob?: boolean
}

export async function saveScheduleToDb(
  weekKey: string,
  scheduleData: ScheduleData,
  updatedBy: string,
  options?: SaveScheduleOptions,
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const source = options?.source || "ui"
  const syncFullBlob = options?.syncFullBlob !== false

  // Load previous week row for diff + version (skip blob key)
  let prev: ScheduleData | null = null
  let prevVersion = 0
  if (weekKey !== "full_schedule") {
    const { data: existing } = await supabase
      .from("schedules")
      .select("schedule_data, version")
      .eq("week_key", weekKey)
      .maybeSingle()
    prev = (existing?.schedule_data as ScheduleData) || null
    prevVersion = typeof existing?.version === "number" ? existing.version : 0
  }

  const { data, error } = await supabase
    .from("schedules")
    .upsert(
      {
        week_key: weekKey,
        schedule_data: scheduleData,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
        ...(weekKey !== "full_schedule" ? { version: prevVersion + 1 } : {}),
      },
      {
        onConflict: "week_key",
      },
    )
    .select()
    .single()

  if (error) {
    console.error("[v0] Error saving schedule to Supabase:", error)
    throw new Error(`Failed to save schedule: ${error.message}`)
  }

  // G2: cell-level history (never for the mega-blob)
  if (weekKey !== "full_schedule") {
    const changes = diffScheduleCells(prev, scheduleData)
    if (changes.length > 0) {
      const rows = changes.map((c) => ({
        week_key: weekKey,
        row_key: c.row_key,
        day_name: c.day_name,
        old_value: c.old_value,
        new_value: c.new_value,
        changed_by: updatedBy,
        changed_by_user_id: user?.id ?? null,
        source,
      }))
      // Chunk large solver diffs
      const chunkSize = 200
      for (let i = 0; i < rows.length; i += chunkSize) {
        const { error: hErr } = await supabase
          .from("schedule_history")
          .insert(rows.slice(i, i + chunkSize))
        if (hErr) {
          console.error("[history] insert failed:", hErr)
        }
      }
    }

    if (syncFullBlob) {
      try {
        const full = ((await loadFullScheduleFromDb()) as Record<string, unknown>) || {}
        await saveFullScheduleToDb({ ...full, [weekKey]: scheduleData })
      } catch (blobErr) {
        console.error("[v0] full_schedule sync failed:", blobErr)
      }
    }
  }

  revalidatePath("/")
  revalidatePath("/protected/planning")
  return data
}

export async function getScheduleFromDb(weekKey: string) {
  const supabase = await createClient()

  const { data, error } = await supabase.from("schedules").select("*").eq("week_key", weekKey).single()

  if (error && error.code !== "PGRST116") {
    console.error("[v0] Error fetching schedule from Supabase:", error)
    return null
  }

  return data
}

export async function getAllSchedulesFromDb() {
  const supabase = await createClient()

  const { data, error } = await supabase.from("schedules").select("*").order("week_key", { ascending: true })

  if (error) {
    console.error("[v0] Error fetching all schedules from Supabase:", error)
    return []
  }

  return data || []
}

export async function saveFullScheduleToDb(fullSchedule: Record<string, unknown>) {
  const supabase = await createClient()

  const scheduleKey = "full_schedule"

  const { data, error } = await supabase
    .from("schedules")
    .upsert(
      {
        week_key: scheduleKey,
        schedule_data: fullSchedule,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "week_key",
      },
    )
    .select()
    .single()

  if (error) {
    console.error("[v0] Error saving full schedule to Supabase:", error)
    throw new Error(`Failed to save full schedule: ${error.message}`)
  }

  revalidatePath("/")
  return data
}

export async function loadFullScheduleFromDb() {
  const supabase = await createClient()

  const scheduleKey = "full_schedule"

  const { data, error } = await supabase
    .from("schedules")
    .select("schedule_data")
    .eq("week_key", scheduleKey)
    .single()

  if (error && error.code !== "PGRST116") {
    console.error("[v0] Load error:", error)
    return null
  }

  return data?.schedule_data || null
}

export type ScheduleHistoryRow = {
  id: string
  week_key: string
  row_key: string
  day_name: string
  old_value: string[]
  new_value: string[]
  changed_by: string | null
  source: string | null
  changed_at: string
}

/** Admin-only history for a week (RLS also enforces is_admin). */
export async function getScheduleHistory(weekKey: string, limit = 50) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false as const, error: "Non authentifié", rows: [] as ScheduleHistoryRow[] }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") {
    return { success: false as const, error: "Admin requis", rows: [] as ScheduleHistoryRow[] }
  }

  const { data, error } = await supabase
    .from("schedule_history")
    .select("id, week_key, row_key, day_name, old_value, new_value, changed_by, source, changed_at")
    .eq("week_key", weekKey)
    .order("changed_at", { ascending: false })
    .limit(limit)

  if (error) {
    return { success: false as const, error: error.message, rows: [] as ScheduleHistoryRow[] }
  }

  return { success: true as const, rows: (data || []) as ScheduleHistoryRow[] }
}
