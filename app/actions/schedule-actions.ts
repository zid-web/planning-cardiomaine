"use server"

import { createClient } from "@/lib/supabase/server"
import type { ScheduleData } from "@/lib/types"
import { revalidatePath } from "next/cache"

// Helper function to check if Supabase is configured
function isSupabaseConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
}

export async function saveScheduleToDb(weekKey: string, scheduleData: ScheduleData, updatedBy: string) {
  if (!isSupabaseConfigured()) {
    console.warn("[v0] Supabase not configured - schedule will not be saved")
    return null
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from("schedules")
    .upsert(
      {
        week_key: weekKey,
        schedule_data: scheduleData,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
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

  revalidatePath("/")
  return data
}

export async function getScheduleFromDb(weekKey: string) {
  if (!isSupabaseConfigured()) {
    console.warn("[v0] Supabase not configured - returning null")
    return null
  }

  const supabase = await createClient()

  const { data, error } = await supabase.from("schedules").select("*").eq("week_key", weekKey).single()

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows returned
    console.error("[v0] Error fetching schedule from Supabase:", error)
    return null
  }

  return data
}

export async function getAllSchedulesFromDb() {
  if (!isSupabaseConfigured()) {
    console.warn("[v0] Supabase not configured - returning empty schedule")
    return []
  }

  const supabase = await createClient()

  const { data, error } = await supabase.from("schedules").select("*").order("week_key", { ascending: true })

  if (error) {
    console.error("[v0] Error fetching all schedules from Supabase:", error)
    return []
  }

  return data || []
}

export async function saveFullScheduleToDb(fullSchedule: Record<string, unknown>) {
  if (!isSupabaseConfigured()) {
    console.warn("[v0] Supabase not configured - full schedule will not be saved")
    return null
  }

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
  if (!isSupabaseConfigured()) {
    console.warn("[v0] Supabase not configured - returning empty")
    return null
  }

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
