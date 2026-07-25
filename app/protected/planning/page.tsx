"use client"

/**
 * IMPORTANT (23/07/2026) : cette page rendait auparavant sa PROPRE
 * implémentation complète du planning (édition de cellules, sauvegarde,
 * panneau vocal...), en parallèle et en doublon de components/schedule-app.tsx
 * (ScheduleApp) qui, lui, n'était rendu par AUCUNE route - donc jamais visible
 * en production.
 *
 * Cette page délègue maintenant entièrement l'affichage à <ScheduleApp />,
 * qui est le composant réellement complet et maintenu. Elle ne s'occupe plus
 * que du chargement initial des données et de l'authentification.
 *
 * Les fonctionnalités Cursor (change_requests, voice/PDF via proxies Render)
 * sont branchées dans ScheduleApp.
 */

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { ScheduleApp } from "@/components/schedule-app"
import { loadFullScheduleFromDb } from "@/app/actions/schedule-actions"
import { signOut } from "@/app/actions/auth-actions"
import type { FullSchedule } from "@/lib/types"

export default function PlanningPage() {
  const supabase = createClient()
  const router = useRouter()

  const [isLoading, setIsLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState("")
  const [doctorCode, setDoctorCode] = useState("")
  const [isAdmin, setIsAdmin] = useState(false)
  const [fullSchedule, setFullSchedule] = useState<FullSchedule>({})

  useEffect(() => {
    const loadData = async () => {
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

        const loaded = await loadFullScheduleFromDb()
        setFullSchedule((loaded as FullSchedule) || {})
      } catch (error) {
        console.error("[planning] Erreur de chargement:", error)
      } finally {
        setIsLoading(false)
      }
    }
    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLogout = async () => {
    await signOut()
    router.push("/auth/login")
  }

  const handleChangePassword = () => {
    router.push("/profile")
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500">
        Chargement du planning...
      </div>
    )
  }

  return (
    <ScheduleApp
      currentUser={currentUser}
      doctorCode={doctorCode}
      isAdmin={isAdmin}
      fullSchedule={fullSchedule}
      setFullSchedule={setFullSchedule}
      onLogout={handleLogout}
      onChangePassword={handleChangePassword}
    />
  )
}
