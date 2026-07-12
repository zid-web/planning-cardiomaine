import { createClient } from "@/lib/supabase-client"

export async function saveScheduleToSupabase(fullSchedule: Record<string, unknown>) {
  try {
    const supabase = createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error("[v0] Auth error:", authError)
      return { error: "Not authenticated" }
    }

    // Check if schedule exists for user
    const { data: existingSchedule, error: fetchError } = await supabase
      .from("schedules")
      .select("id")
      .eq("user_id", user.id)
      .single()

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("[v0] Fetch error:", fetchError)
      return { error: "Failed to fetch existing schedule" }
    }

    // Update or insert schedule
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
        return { error: "Failed to update schedule" }
      }

      return { success: true, action: "updated" }
    } else {
      const { error: insertError } = await supabase.from("schedules").insert({
        user_id: user.id,
        full_schedule: fullSchedule,
      })

      if (insertError) {
        console.error("[v0] Insert error:", insertError)
        return { error: "Failed to create schedule" }
      }

      return { success: true, action: "created" }
    }
  } catch (error) {
    console.error("[v0] Save error:", error)
    return { error: "An unexpected error occurred" }
  }
}

export async function loadScheduleFromSupabase() {
  try {
    const supabase = createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error("[v0] Auth error:", authError)
      return { error: "Not authenticated" }
    }

    const { data, error } = await supabase
      .from("schedules")
      .select("full_schedule")
      .eq("user_id", user.id)
      .single()

    if (error && error.code !== "PGRST116") {
      console.error("[v0] Load error:", error)
      return { error: "Failed to load schedule" }
    }

    if (data) {
      return { success: true, schedule: data.full_schedule }
    }

    return { success: true, schedule: null }
  } catch (error) {
    console.error("[v0] Load error:", error)
    return { error: "An unexpected error occurred" }
  }
}
