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

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    console.error("[v0] Auth error:", authError)
    throw new Error("Not authenticated")
  }

  // Check if user schedule exists
  const { data: existingSchedule, error: fetchError } = await supabase
    .from("schedules")
    .select("id")
    .eq("user_id", user.id)
    .single()

  if (fetchError && fetchError.code !== "PGRST116") {
    console.error("[v0] Fetch error:", fetchError)
    throw new Error("Failed to fetch existing schedule")
  }

  // Update or insert full schedule
  if (existingSchedule) {
    const { error: updateError } = await supabase
      .from("schedules")
      .update({
        full_schedule: fullSchedule,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)

    if (updateError) {
      console.error("[v0] Update error:", updateError)
      throw new Error(`Failed to update schedule: ${updateError.message}`)
    }
  } else {
    const { error: insertError } = await supabase.from("schedules").insert({
      user_id: user.id,
      full_schedule: fullSchedule,
    })

    if (insertError) {
      console.error("[v0] Insert error:", insertError)
      throw new Error(`Failed to create schedule: ${insertError.message}`)
    }
  }

  revalidatePath("/")
}

export async function loadFullScheduleFromDb() {
  const supabase = await getSupabaseServer()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return null
  }

  const { data, error } = await supabase
    .from("schedules")
    .select("full_schedule")
    .eq("user_id", user.id)
    .single()

  if (error && error.code !== "PGRST116") {
    console.error("[v0] Load error:", error)
    return null
  }

  return data?.full_schedule || null
}
