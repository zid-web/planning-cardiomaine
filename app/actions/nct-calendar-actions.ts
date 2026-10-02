"use server"

import { unstable_noStore as noStore } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import {
  DEFAULT_NCT_CALENDAR,
  NCT_CALENDAR_SETTING_KEY,
  normalizeNctCalendar,
  parseNctCalendarSetting,
  serializeNctCalendar,
  type NctEntry,
} from "@/lib/nct-calendar"

/**
 * Calendrier NCT courant : version personnalisée (settings.nct_calendar) si
 * elle existe, sinon le calendrier par défaut.
 */
export async function loadNctCalendar(): Promise<NctEntry[]> {
  noStore()
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("settings")
      .select("value")
      .eq("key", NCT_CALENDAR_SETTING_KEY)
      .maybeSingle()
    if (error) {
      console.warn("[loadNctCalendar]", error.message)
      return normalizeNctCalendar(DEFAULT_NCT_CALENDAR)
    }
    return parseNctCalendarSetting(data?.value) ?? normalizeNctCalendar(DEFAULT_NCT_CALENDAR)
  } catch (error) {
    console.warn("[loadNctCalendar]", error)
    return normalizeNctCalendar(DEFAULT_NCT_CALENDAR)
  }
}

/** Enregistre le calendrier NCT (admin uniquement). `null` = retour au calendrier par défaut. */
export async function saveNctCalendar(
  list: NctEntry[] | null,
): Promise<{ success: boolean; calendar?: NctEntry[]; error?: string }> {
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
        .eq("key", NCT_CALENDAR_SETTING_KEY)
      if (error) return { success: false, error: error.message }
      return { success: true, calendar: normalizeNctCalendar(DEFAULT_NCT_CALENDAR) }
    }

    const calendar = normalizeNctCalendar(list)
    const { error } = await supabase
      .from("settings")
      .upsert({ key: NCT_CALENDAR_SETTING_KEY, value: serializeNctCalendar(calendar) }, { onConflict: "key" })
    if (error) return { success: false, error: error.message }
    return { success: true, calendar }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur inconnue" }
  }
}
