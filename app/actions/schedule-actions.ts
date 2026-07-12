"use server"

import { getSupabaseServer } from "@/lib/supabase-server"
import type { ScheduleData } from "@/lib/types"
import { revalidatePath } from "next/cache"

export async function saveScheduleToDb(weekKey: string, scheduleData: ScheduleData, updatedBy: string) {
  const supabase = await getSupabaseServer()

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
  const supabase = await getSupabaseServer()

  const { data, error } = await supabase.from("schedules").select("*").eq("week_key", weekKey).single()

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows returned
    console.error("[v0] Error fetching schedule from Supabase:", error)
    return null
  }

  return data
}

export async function getAllSchedulesFromDb() {
  const supabase = await getSupabaseServer()

  const { data, error } = await supabase.from("schedules").select("*").order("week_key", { ascending: true })

  if (error) {
    console.error("[v0] Error fetching all schedules from Supabase:", error)
    return []
  }

  return data || []
}

export async function saveFullScheduleToDb(fullSchedule: Record<string, unknown>) {
  const supabase = await getSupabaseServer()

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
  const supabase = await getSupabaseServer()

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
