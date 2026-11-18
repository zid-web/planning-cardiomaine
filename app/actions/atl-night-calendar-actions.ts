"use server"

import { unstable_noStore as noStore } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCaller } from "@/lib/server-auth"
import { diffScheduleCells } from "@/lib/schedule-diff"
import type { ScheduleData } from "@/lib/types"
import {
  ATL_NIGHT_CALENDAR_SETTING_KEY,
  ATL_NIGHT_ROW,
  applyAtlNightCalendarToWeek,
  dayNameOfDate,
  isoWeekKeyOfDate,
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

/** Comptes non-admin autorisés à modifier le calendrier des astreintes de nuit (consigne 18/11/2026). */
const ATL_NIGHT_EDITOR_CODES: readonly string[] = ["O"]

/**
 * Enregistre le calendrier des astreintes de nuit — admins et O (ATL_NIGHT_EDITOR_CODES).
 * `null` = calendrier vidé.
 *
 * Écrit avec la clé service_role, après contrôle de l'appelant, et répercute le changement
 * **uniquement** sur la ligne « Astreintes ATL Nuit » des semaines déjà enregistrées : O ne
 * reçoit aucun autre droit sur le planning.
 */
export async function saveAtlNightCalendar(
  list: AtlNightEntry[] | null,
): Promise<{ success: boolean; calendar?: AtlNightEntry[]; error?: string }> {
  try {
    const caller = await getCaller()
    if (!caller) return { success: false, error: "Non connecté" }
    if (!caller.isAdmin && !ATL_NIGHT_EDITOR_CODES.includes(caller.doctorCode)) {
      return { success: false, error: "Droits insuffisants pour modifier le calendrier des astreintes de nuit" }
    }
    const admin = createAdminClient()

    const { data: prevRow } = await admin
      .from("settings")
      .select("value")
      .eq("key", ATL_NIGHT_CALENDAR_SETTING_KEY)
      .maybeSingle()
    const prev = parseAtlNightCalendarSetting(prevRow?.value) ?? []

    const calendar = list === null ? [] : normalizeAtlNightCalendar(list)
    if (list === null) {
      const { error } = await admin.from("settings").delete().eq("key", ATL_NIGHT_CALENDAR_SETTING_KEY)
      if (error) return { success: false, error: error.message }
    } else {
      const { error } = await admin
        .from("settings")
        .upsert({ key: ATL_NIGHT_CALENDAR_SETTING_KEY, value: serializeAtlNightCalendar(calendar) }, { onConflict: "key" })
      if (error) return { success: false, error: error.message }
    }

    await syncAtlNightRowInPlanning(admin, prev, calendar, caller.doctorCode || caller.email, caller.userId)
    return { success: true, calendar }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur inconnue" }
  }
}

/**
 * Répercute les dates ajoutées / modifiées / retirées du calendrier sur la ligne
 * « Astreintes ATL Nuit » des semaines déjà enregistrées (et rien d'autre).
 */
async function syncAtlNightRowInPlanning(
  admin: ReturnType<typeof createAdminClient>,
  prev: AtlNightEntry[],
  next: AtlNightEntry[],
  changedBy: string,
  userId: string,
): Promise<void> {
  const key = (e: AtlNightEntry) => `${e.user}|${e.manual ? 1 : 0}`
  const prevByDate = new Map(prev.map((e) => [e.date, e]))
  const nextByDate = new Map(next.map((e) => [e.date, e]))
  const changedDates = new Set<string>()
  for (const d of new Set([...prevByDate.keys(), ...nextByDate.keys()])) {
    const a = prevByDate.get(d)
    const b = nextByDate.get(d)
    if (!a || !b || key(a) !== key(b)) changedDates.add(d)
  }
  if (changedDates.size === 0) return

  const byWeek = new Map<string, string[]>()
  for (const d of changedDates) {
    const wk = isoWeekKeyOfDate(d)
    byWeek.set(wk, [...(byWeek.get(wk) ?? []), d])
  }

  for (const [wk, dates] of byWeek) {
    const { data: row } = await admin
      .from("schedules")
      .select("schedule_data, version")
      .eq("week_key", wk)
      .maybeSingle()
    const before = row?.schedule_data as ScheduleData | undefined
    if (!before?.[ATL_NIGHT_ROW]) continue // semaine jamais enregistrée : le calendrier s'appliquera à l'affichage

    let after: ScheduleData = { ...before, [ATL_NIGHT_ROW]: { ...before[ATL_NIGHT_ROW] } }
    // Dates retirées : la case est vidée (elle pourra être reproposée)
    for (const d of dates) {
      if (nextByDate.has(d)) continue
      const day = dayNameOfDate(d)
      const cell = after[ATL_NIGHT_ROW][day]
      if (!cell || (cell.value || []).length === 0) continue
      after[ATL_NIGHT_ROW][day] = { ...cell, value: [], type: "empty", status: "validated", manualAssignment: false }
    }
    // Dates ajoutées / modifiées : mêmes règles que l'affichage (saisie manuelle prioritaire)
    after = applyAtlNightCalendarToWeek(
      after,
      wk,
      dates.map((d) => nextByDate.get(d)).filter((e): e is AtlNightEntry => Boolean(e)),
    )

    const changes = diffScheduleCells(before, after).filter((c) => c.row_key === ATL_NIGHT_ROW)
    if (changes.length === 0) continue
    await admin
      .from("schedules")
      .update({
        schedule_data: after,
        updated_by: changedBy,
        updated_at: new Date().toISOString(),
        version: (typeof row?.version === "number" ? row.version : 0) + 1,
      })
      .eq("week_key", wk)
    await admin.from("schedule_history").insert(
      changes.map((c) => ({
        week_key: wk,
        row_key: c.row_key,
        day_name: c.day_name,
        old_value: c.old_value,
        new_value: c.new_value,
        changed_by: changedBy,
        changed_by_user_id: userId,
        source: "ui",
      })),
    )
  }
}
