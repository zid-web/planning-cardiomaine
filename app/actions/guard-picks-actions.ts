"use server"

import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

// Admin client (service role) to bypass RLS
function getAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createAdminClient(url, key)
}

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
 * Fetch all guard picks for a given semester & year (all doctors, admin use)
 */
export async function getGuardPicksForSemester(
  semester: 1 | 2,
  year: number,
): Promise<{ data: GuardPickRow[]; error?: string }> {
  const adminDb = getAdminDb()
  const { data, error } = await adminDb
    .from("guard_picks")
    .select("*")
    .eq("semester", semester)
    .eq("year", year)
    .order("date", { ascending: true })

  if (error) return { data: [], error: error.message }
  return { data: (data || []) as GuardPickRow[] }
}

/**
 * Fetch guard picks for the current logged-in doctor
 */
export async function getMyGuardPicks(
  semester: 1 | 2,
  year: number,
): Promise<{ data: GuardPickRow[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [], error: "Non authentifié" }

  const adminDb = getAdminDb()
  const { data, error } = await adminDb
    .from("guard_picks")
    .select("*")
    .eq("doctor_id", user.id)
    .eq("semester", semester)
    .eq("year", year)
    .order("date", { ascending: true })

  if (error) return { data: [], error: error.message }
  return { data: (data || []) as GuardPickRow[] }
}

/**
 * Submit a guard pick preference (any logged-in user)
 */
export async function submitGuardPick(
  input: SubmitGuardPickInput,
): Promise<{ data?: GuardPickRow; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const adminDb = getAdminDb()
  const { data, error } = await adminDb
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

  if (error) return { error: error.message }
  return { data: data as GuardPickRow }
}

/**
 * Delete a guard pick (only pending ones, by the owner or admin)
 */
export async function deleteGuardPick(
  id: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const adminDb = getAdminDb()
  const { error } = await adminDb
    .from("guard_picks")
    .delete()
    .eq("id", id)

  if (error) return { error: error.message }
  return {}
}

/**
 * Admin: approve a guard pick
 */
export async function approveGuardPick(
  id: string,
  adminCode: string,
): Promise<{ error?: string }> {
  const adminDb = getAdminDb()
  const { error } = await adminDb
    .from("guard_picks")
    .update({
      status: "approved",
      validated_by: adminCode,
      validated_at: new Date().toISOString(),
    })
    .eq("id", id)

  if (error) return { error: error.message }
  return {}
}

/**
 * Admin: reject a guard pick
 */
export async function rejectGuardPick(
  id: string,
  adminCode: string,
  adminNote?: string,
): Promise<{ error?: string }> {
  const adminDb = getAdminDb()
  const { error } = await adminDb
    .from("guard_picks")
    .update({
      status: "rejected",
      validated_by: adminCode,
      validated_at: new Date().toISOString(),
      admin_note: adminNote ?? null,
    })
    .eq("id", id)

  if (error) return { error: error.message }
  return {}
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
  const adminDb = getAdminDb()

  // Semester date range
  const startDate = semester === 1 ? `${year}-01-01` : `${year}-09-01`
  const endDate = semester === 1 ? `${year}-08-31` : `${year + 1}-01-01`

  const { data, error } = await adminDb
    .from("vacations")
    .select("start_date, end_date")
    .eq("doctor_id", doctorCode)
    .or(`start_date.lte.${endDate},end_date.gte.${startDate}`)

  if (error) {
    // Try alternate lookup via auth user id
    const { data: data2 } = await adminDb
      .from("vacations")
      .select("start_date, end_date")
      .gte("end_date", startDate)
      .lte("start_date", endDate)

    if (!data2) return { dates: [] }
    // Filter by matching doctor code or any vacation that overlaps
    return { dates: expandVacationDates(data2, startDate, endDate) }
  }

  return { dates: expandVacationDates(data || [], startDate, endDate) }
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
