"use server"

import { unstable_noStore as noStore } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import {
  ATL_NIGHT_CALENDAR_SETTING_KEY,
  normalizeAtlNightCalendar,
  parseAtlNightCalendarSetting,
  serializeAtlNightCalendar,
  type AtlNightEntry,
} from "@/lib/atl-night-calendar"

/**
 * Calendrier des astreintes ATL Nuit (settings.atl_night_calendar), vide si
 * aucune saisie.
 */
export async function loadAtlNightCalendar(): Promise<AtlNightEntry[]> {
  noStore()
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("settings")
      .select("value")
      .eq("key", ATL_NIGHT_CALENDAR_SETTING_KEY)
      .maybeSingle()
    if (error) {
      console.warn("[loadAtlNightCalendar]", error.message)
      return []
    }
    return parseAtlNightCalendarSetting(data?.value) ?? []
  } catch (error) {
    console.warn("[loadAtlNightCalendar]", error)
    return []
  }
}

/** Enregistre le calendrier ATL Nuit (admin uniquement). `null` = calendrier vidé. */
export async function saveAtlNightCalendar(
  list: AtlNightEntry[] | null,
): Promise<{ success: boolean; calendar?: AtlNightEntry[]; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, error: "Non connecté" }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()
    if (profile?.role !== "admin") return { success: false, error: "Admin requis" }

    if (list === null) {
      const { error } = await supabase
        .from("settings")
        .delete()
        .eq("key", ATL_NIGHT_CALENDAR_SETTING_KEY)
      if (error) return { success: false, error: error.message }
      return { success: true, calendar: [] }
    }

    const calendar = normalizeAtlNightCalendar(list)
    const { error } = await supabase
      .from("settings")
      .upsert({ key: ATL_NIGHT_CALENDAR_SETTING_KEY, value: serializeAtlNightCalendar(calendar) }, { onConflict: "key" })
    if (error) return { success: false, error: error.message }
    return { success: true, calendar }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur inconnue" }
  }
}
