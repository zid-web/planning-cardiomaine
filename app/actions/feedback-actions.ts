"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function submitFeedback(input: {
  message: string
  category?: string
  rating?: number | null
  pagePath?: string
}) {
  const message = input.message?.trim()
  if (!message || message.length < 3) {
    return { success: false as const, error: "Message trop court" }
  }
  if (message.length > 4000) {
    return { success: false as const, error: "Message trop long" }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false as const, error: "Non authentifié" }

  const { error } = await supabase.from("app_feedback").insert({
    user_id: user.id,
    user_email: user.email,
    category: input.category || "general",
    rating: input.rating ?? null,
    message,
    page_path: input.pagePath || null,
  })

  if (error) {
    console.error("[feedback] insert failed:", error.message)
    return { success: false as const, error: error.message }
  }

  revalidatePath("/protected/admin/feedback")
  return { success: true as const }
}

export async function listFeedback(limit = 50) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false as const, error: "Non authentifié", rows: [] }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  if (profile?.role !== "admin") {
    return { success: false as const, error: "Admin requis", rows: [] }
  }

  const { data, error } = await supabase
    .from("app_feedback")
    .select("id, user_email, category, rating, message, page_path, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) return { success: false as const, error: error.message, rows: [] }
  return { success: true as const, rows: data || [] }
}
