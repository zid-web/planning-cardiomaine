"use client"

/**
 * Thin loader for ScheduleApp: auth + SWR-backed schedule fetch.
 */

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import useSWR, { useSWRConfig } from "swr"
import { createClient } from "@/lib/supabase/client"
import { ScheduleApp } from "@/components/schedule-app"
import { loadFullScheduleFromDb } from "@/app/actions/schedule-actions"
import { signOut } from "@/app/actions/auth-actions"
import type { FullSchedule } from "@/lib/types"

async function fetchFullSchedule(): Promise<FullSchedule> {
  const started = performance.now()
  const loaded = await loadFullScheduleFromDb()
  if (typeof window !== "undefined") {
    console.info(
      JSON.stringify({
        level: "info",
        scope: "planning",
        event: "load_full_schedule",
        ms: Math.round(performance.now() - started),
      }),
    )
  }
  return (loaded as FullSchedule) || {}
}

export default function PlanningPage() {
  const supabase = createClient()
  const router = useRouter()

  const [authReady, setAuthReady] = useState(false)
  const [currentUser, setCurrentUser] = useState("")
  const [doctorCode, setDoctorCode] = useState("")
  const [isAdmin, setIsAdmin] = useState(false)

  const {
    data: fullSchedule,
    isLoading: scheduleLoading,
    mutate,
  } = useSWR(authReady ? "full-schedule" : null, fetchFullSchedule, {
    revalidateOnFocus: true,
    dedupingInterval: 10_000,
  })
  // `mutate` ci-dessus est lié à cette clé (data, options) ; vider TOUT le cache
  // à la déconnexion demande le mutate global, qui accepte un filtre de clés.
  const { mutate: globalMutate } = useSWRConfig()

  const [localSchedule, setLocalSchedule] = useState<FullSchedule>({})

  useEffect(() => {
    if (fullSchedule) setLocalSchedule(fullSchedule)
  }, [fullSchedule])

  useEffect(() => {
    const loadAuth = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser()
        if (!userData?.user) {
          router.push("/auth/login")
          return
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("role, doctor_code")
          .eq("id", userData.user.id)
          .single()

        if (profile) {
          setIsAdmin(profile.role === "admin")
          setDoctorCode(profile.doctor_code || "")
          setCurrentUser(
            profile.doctor_code ||
              userData.user.email?.split("@")[0]?.toUpperCase() ||
              "",
          )
        }
        setAuthReady(true)
      } catch (error) {
        console.error("[planning] Erreur de chargement auth:", error)
      }
    }
    void loadAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLogout = async () => {
    try {
      // Bug corrigé : ce filtre de clés était passé au mutate **lié**, qui
      // l'interprétait comme une fonction de mise à jour — la déconnexion
      // écrivait donc `true` dans le cache au lieu de le vider.
      await globalMutate(() => true, undefined, { revalidate: false })
    } catch (err) {
      console.error("[planning] SWR mutate clear error:", err)
    }

    try {
      if (typeof window !== "undefined") {
        localStorage.clear()
        sessionStorage.clear()
        if ("caches" in window) {
          const cacheKeys = await caches.keys()
          await Promise.all(cacheKeys.map((key) => caches.delete(key)))
        }
      }
    } catch (err) {
      console.error("[planning] Storage clear error:", err)
    }

    try {
      await supabase.auth.signOut({ scope: "global" })
    } catch (err) {
      console.error("[planning] Client signOut error:", err)
    }
    try {
      await signOut()
    } catch (err) {
      console.error("[planning] Server signOut error:", err)
    }
    if (typeof window !== "undefined") {
      window.location.href = "/auth/login"
    }
  }

  const handleChangePassword = () => {
    router.push("/profile")
  }

  if (!authReady || scheduleLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500">
        Chargement du planning...
      </div>
    )
  }

  return (
    <>
      <ScheduleApp
        currentUser={currentUser}
        doctorCode={doctorCode}
        isAdmin={isAdmin}
        fullSchedule={localSchedule}
        setFullSchedule={(updater) => {
          setLocalSchedule((prev) => {
            const next = typeof updater === "function" ? updater(prev) : updater
            // Keep SWR cache in sync without forcing an immediate refetch
            void mutate(next, { revalidate: false })
            return next
          })
        }}
        onLogout={handleLogout}
        onChangePassword={handleChangePassword}
      />
    </>
  )
}
