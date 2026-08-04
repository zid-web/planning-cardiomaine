"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { saveScheduleToDb } from "@/app/actions/schedule-actions"
import { getWeekNumber } from "@/lib/schedule-utils"
import type { ScheduleData } from "@/lib/types"

export type GuardPickRow = {
  id: string
  doctor_code: string
  doctor_id: string | null
  semester: 1 | 2
  year: number
  date: string          // YYYY-MM-DD
  day_type: "samedi" | "dimanche" | "ferie"
  guard_type: "Garde Matin" | "Garde Nuit"
  is_wom_combo: boolean
  wom_role: "garde_sam" | "atl_sat" | "atl_sun" | null
  status: "pending" | "approved" | "rejected"
  reason: string | null
  admin_note: string | null
  validated_by: string | null
  validated_at: string | null
  created_at: string
  updated_at: string
}

export type SubmitGuardPickInput = {
  doctor_code: string
  semester: 1 | 2
  year: number
  date: string
  day_type: "samedi" | "dimanche" | "ferie"
  guard_type: "Garde Matin" | "Garde Nuit"
  is_wom_combo?: boolean
  wom_role?: "garde_sam" | "atl_sat" | "atl_sun" | null
  reason?: string
}

/**
 * Returns either service_role admin client or standard server user client as fallback
 */
async function getDbClient() {
  try {
    return createAdminClient()
  } catch (err) {
    console.warn("[guard-picks-actions] createAdminClient fallback to createClient:", err)
    return await createClient()
  }
}

const DAYS_FR = ["DIMANCHE", "LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI"]

/**
 * Injects an approved guard pick into the main schedule table (schedules)
 */
async function injectGuardPickIntoSchedule(
  pick: GuardPickRow,
  adminCode: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getDbClient()
    const d = new Date(pick.date + "T12:00:00")
    const { year, week } = getWeekNumber(d)
    const weekKey = `${year}-W${String(week).padStart(2, "0")}`
    const dayName = DAYS_FR[d.getDay()]
    const rowKey = pick.guard_type // e.g. "Garde Matin" or "Garde Nuit"

    const { data: currentRecord } = await db
      .from("schedules")
      .select("schedule_data")
      .eq("week_key", weekKey)
      .maybeSingle()

    const scheduleData = (currentRecord?.schedule_data || {}) as ScheduleData

    if (!scheduleData[rowKey]) {
      scheduleData[rowKey] = {}
    }
    if (!scheduleData[rowKey][dayName]) {
      scheduleData[rowKey][dayName] = { value: [], type: "doctor", status: "validated" }
    }

    const cell = scheduleData[rowKey][dayName]
    if (!cell.value.includes(pick.doctor_code)) {
      cell.value.push(pick.doctor_code)
      cell.type = "doctor"
      cell.status = "validated"
    }

    await saveScheduleToDb(weekKey, scheduleData, adminCode, { source: "ui" })
    return { success: true }
  } catch (err) {
    console.error("[injectGuardPickIntoSchedule] Error injecting guard pick into schedule:", err)
    return { success: false, error: err instanceof Error ? err.message : "Erreur d'injection" }
  }
}

/**
 * Removes a rejected guard pick from the main schedule table if present
 */
async function removeGuardPickFromSchedule(
  pick: GuardPickRow,
  adminCode: string,
): Promise<void> {
  try {
    const db = await getDbClient()
    const d = new Date(pick.date + "T12:00:00")
    const { year, week } = getWeekNumber(d)
    const weekKey = `${year}-W${String(week).padStart(2, "0")}`
    const dayName = DAYS_FR[d.getDay()]
    const rowKey = pick.guard_type

    const { data: currentRecord } = await db
      .from("schedules")
      .select("schedule_data")
      .eq("week_key", weekKey)
      .maybeSingle()

    if (!currentRecord?.schedule_data) return

    const scheduleData = currentRecord.schedule_data as ScheduleData
    const cell = scheduleData[rowKey]?.[dayName]
    if (cell && cell.value.includes(pick.doctor_code)) {
      cell.value = cell.value.filter(doc => doc !== pick.doctor_code)
      await saveScheduleToDb(weekKey, scheduleData, adminCode, { source: "ui" })
    }
  } catch (err) {
    console.error("[removeGuardPickFromSchedule] Error:", err)
  }
}

/**
 * Fetch all guard picks for a given semester & year (all doctors, admin use)
 */
export async function getGuardPicksForSemester(
  semester: 1 | 2,
  year: number,
): Promise<{ data: GuardPickRow[]; error?: string }> {
  try {
    const db = await getDbClient()
    const { data, error } = await db
      .from("guard_picks")
      .select("*")
      .eq("semester", semester)
      .eq("year", year)
      .order("date", { ascending: true })

    if (error) {
      console.error("[getGuardPicksForSemester] error:", error)
      return { data: [], error: error.message }
    }
    return { data: (data || []) as GuardPickRow[] }
  } catch (err) {
    console.error("[getGuardPicksForSemester] exception:", err)
    return { data: [], error: err instanceof Error ? err.message : "Erreur serveur" }
  }
}

/**
 * Fetch guard picks for the current logged-in doctor
 */
export async function getMyGuardPicks(
  semester: 1 | 2,
  year: number,
): Promise<{ data: GuardPickRow[]; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: [], error: "Non authentifié" }

    const db = await getDbClient()
    const { data, error } = await db
      .from("guard_picks")
      .select("*")
      .or(`doctor_id.eq.${user.id}`)
      .eq("semester", semester)
      .eq("year", year)
      .order("date", { ascending: true })

    if (error) {
      console.error("[getMyGuardPicks] error:", error)
      return { data: [], error: error.message }
    }
    return { data: (data || []) as GuardPickRow[] }
  } catch (err) {
    console.error("[getMyGuardPicks] exception:", err)
    return { data: [], error: err instanceof Error ? err.message : "Erreur serveur" }
  }
}

/**
 * Submit a guard pick preference (any logged-in user)
 */
export async function submitGuardPick(
  input: SubmitGuardPickInput,
): Promise<{ data?: GuardPickRow; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Non authentifié" }

    const db = await getDbClient()
    const { data, error } = await db
      .from("guard_picks")
      .upsert({
        doctor_code: input.doctor_code,
        doctor_id: user.id,
        semester: input.semester,
        year: input.year,
        date: input.date,
        day_type: input.day_type,
        guard_type: input.guard_type,
        is_wom_combo: input.is_wom_combo ?? false,
        wom_role: input.wom_role ?? null,
        reason: input.reason ?? null,
        status: "pending",
        admin_note: null,
        validated_by: null,
        validated_at: null,
      }, {
        onConflict: "doctor_code,date,guard_type",
      })
      .select()
      .single()

    if (error) {
      console.error("[submitGuardPick] error:", error)
      return { error: error.message }
    }
    return { data: data as GuardPickRow }
  } catch (err) {
    console.error("[submitGuardPick] exception:", err)
    return { error: err instanceof Error ? err.message : "Erreur lors de l'enregistrement" }
  }
}

/**
 * Delete a guard pick (only pending ones, by the owner or admin)
 */
export async function deleteGuardPick(
  id: string,
): Promise<{ error?: string }> {
  try {
    const db = await getDbClient()
    const { error } = await db
      .from("guard_picks")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("[deleteGuardPick] error:", error)
      return { error: error.message }
    }
    return {}
  } catch (err) {
    console.error("[deleteGuardPick] exception:", err)
    return { error: err instanceof Error ? err.message : "Erreur lors de la suppression" }
  }
}

/**
 * Admin: approve a single guard pick and inject it into general planning
 */
export async function approveGuardPick(
  id: string,
  adminCode: string,
): Promise<{ error?: string }> {
  try {
    const db = await getDbClient()

    // 1. Fetch pick details
    const { data: pick, error: fetchErr } = await db
      .from("guard_picks")
      .select("*")
      .eq("id", id)
      .single()

    if (fetchErr || !pick) {
      return { error: "Demande introuvable" }
    }

    const pickRow = pick as GuardPickRow

    // 2. Update status in guard_picks
    const { error: updateErr } = await db
      .from("guard_picks")
      .update({
        status: "approved",
        validated_by: adminCode,
        validated_at: new Date().toISOString(),
      })
      .eq("id", id)

    if (updateErr) {
      console.error("[approveGuardPick] update error:", updateErr)
      return { error: updateErr.message }
    }

    // 3. Inject directly into general planning schedule
    await injectGuardPickIntoSchedule(pickRow, adminCode)

    return {}
  } catch (err) {
    console.error("[approveGuardPick] exception:", err)
    return { error: err instanceof Error ? err.message : "Erreur lors de l'approbation" }
  }
}

/**
 * Admin: approve a bulk set of guard picks (e.g. for a month or semester)
 */
export async function approveBulkGuardPicks(
  ids: string[],
  adminCode: string,
): Promise<{ count: number; error?: string }> {
  try {
    if (!ids || ids.length === 0) return { count: 0 }

    const db = await getDbClient()

    // Fetch picks to be approved
    const { data: picks, error: fetchErr } = await db
      .from("guard_picks")
      .select("*")
      .in("id", ids)

    if (fetchErr || !picks) {
      return { count: 0, error: fetchErr?.message || "Erreur lors de la récupération" }
    }

    let count = 0
    for (const rawPick of picks) {
      const pick = rawPick as GuardPickRow
      const { error: updateErr } = await db
        .from("guard_picks")
        .update({
          status: "approved",
          validated_by: adminCode,
          validated_at: new Date().toISOString(),
        })
        .eq("id", pick.id)

      if (!updateErr) {
        await injectGuardPickIntoSchedule(pick, adminCode)
        count++
      }
    }

    return { count }
  } catch (err) {
    console.error("[approveBulkGuardPicks] exception:", err)
    return { count: 0, error: err instanceof Error ? err.message : "Erreur lors de la validation groupée" }
  }
}

/**
 * Admin: reject a guard pick
 */
export async function rejectGuardPick(
  id: string,
  adminCode: string,
  adminNote?: string,
): Promise<{ error?: string }> {
  try {
    const db = await getDbClient()

    const { data: pick } = await db
      .from("guard_picks")
      .select("*")
      .eq("id", id)
      .single()

    const { error } = await db
      .from("guard_picks")
      .update({
        status: "rejected",
        validated_by: adminCode,
        validated_at: new Date().toISOString(),
        admin_note: adminNote ?? null,
      })
      .eq("id", id)

    if (error) {
      console.error("[rejectGuardPick] error:", error)
      return { error: error.message }
    }

    if (pick) {
      await removeGuardPickFromSchedule(pick as GuardPickRow, adminCode)
    }

    return {}
  } catch (err) {
    console.error("[rejectGuardPick] exception:", err)
    return { error: err instanceof Error ? err.message : "Erreur lors du rejet" }
  }
}

/**
 * Get vacation date ranges for a doctor for a given semester
 * Returns array of blocked date strings (YYYY-MM-DD)
 */
export async function getVacationDatesForSemester(
  semester: 1 | 2,
  year: number,
  doctorCode: string,
): Promise<{ dates: string[]; error?: string }> {
  try {
    const db = await getDbClient()

    // Semester date range
    const startDate = semester === 1 ? `${year}-01-01` : `${year}-09-01`
    const endDate = semester === 1 ? `${year}-08-31` : `${year + 1}-01-01`

    const { data, error } = await db
      .from("vacations")
      .select("start_date, end_date")
      .eq("doctor_id", doctorCode)
      .or(`start_date.lte.${endDate},end_date.gte.${startDate}`)

    if (error) {
      // Try alternate lookup via auth user id
      const { data: data2 } = await db
        .from("vacations")
        .select("start_date, end_date")
        .gte("end_date", startDate)
        .lte("start_date", endDate)

      if (!data2) return { dates: [] }
      return { dates: expandVacationDates(data2, startDate, endDate) }
    }

    return { dates: expandVacationDates(data || [], startDate, endDate) }
  } catch (err) {
    console.error("[getVacationDatesForSemester] exception:", err)
    return { dates: [] }
  }
}

function expandVacationDates(
  vacations: Array<{ start_date: string; end_date: string }>,
  rangeStart: string,
  rangeEnd: string,
): string[] {
  const dates: string[] = []
  for (const v of vacations) {
    const start = new Date(v.start_date)
    const end = new Date(v.end_date)
    const rStart = new Date(rangeStart)
    const rEnd = new Date(rangeEnd)
    const from = start < rStart ? rStart : start
    const to = end > rEnd ? rEnd : end
    const cur = new Date(from)
    while (cur <= to) {
      dates.push(cur.toISOString().split("T")[0])
      cur.setDate(cur.getDate() + 1)
    }
  }
  return [...new Set(dates)]
}
