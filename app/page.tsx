"use client"

import type React from "react"
import { useState, useEffect } from "react"
import {
  Activity,
  AlertCircle,
  Check,
  Construction,
  Lock,
  LogOut,
  Menu,
  Settings,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { FullSchedule, User } from "@/lib/types"
import { DOCTOR_COLORS, INITIAL_USERS } from "@/lib/constants"
import { validatePassword } from "@/lib/schedule-utils"
import { LandingPage } from "@/components/landing-page"
import { AdminPanel } from "@/components/admin-panel"
import { ScheduleApp } from "@/components/schedule-app"
import { getSupabase } from "@/lib/supabase-client"
import { getAllSchedulesFromDb } from "@/app/actions/schedule-actions"

export default function MedicalScheduleApp() {
  // --- State ---
  const [view, setView] = useState<"landing" | "login" | "app">("landing")
  const [showRegisterModal, setShowRegisterModal] = useState(false)

  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [currentDoctorCode, setCurrentDoctorCode] = useState<string>("")
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [maintenanceMode, setMaintenanceMode] = useState(false) // Ensure maintenance mode is off by default

  const [dataVersion, setDataVersion] = useState<number>(Date.now())

  const [fullSchedule, setFullSchedule] = useState<FullSchedule>({})
  const [isLoading, setIsLoading] = useState(true)

  const [users, setUsers] = useState<User[]>(INITIAL_USERS)

  const [loginId, setLoginId] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [loginError, setLoginError] = useState("")

  const [regId, setRegId] = useState("")
  const [regFirstName, setRegFirstName] = useState("")
  const [regLastName, setRegLastName] = useState("")
  const [regPassword, setRegPassword] = useState("")
  const [regEmail, setRegEmail] = useState("")
  const [regDoctorCode, setRegDoctorCode] = useState("")
  const [regError, setRegError] = useState("")

  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [forcePasswordChange, setForcePasswordChange] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [recoveryEmail, setRecoveryEmail] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [passwordSuccess, setPasswordSuccess] = useState("")

  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3>(1)
  const [resetId, setResetId] = useState("")
  const [resetEmail, setResetEmail] = useState("")

  // --- Handlers ---

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    const userIndex = users.findIndex((u) => u.id === loginId)
    const user = users[userIndex]

    if (!user) {
      setLoginError("Identifiant incorrect.")
      return
    }

    if (user.isLocked) {
      setLoginError("Compte bloqué. Contactez un administrateur.")
      return
    }

    if (user.password === loginPassword) {
      const newUsers = [...users]
      newUsers[userIndex] = { ...user, failedAttempts: 0 }
      setUsers(newUsers)

      setCurrentUser(user.id)
      setCurrentDoctorCode(user.doctorCode)
      setLoginError("")
      setLoginId("")
      setLoginPassword("")

      if (user.isFirstLogin) {
        setForcePasswordChange(true)
        setShowPasswordChange(true)
        setView("app")
      } else {
        setView("app")
      }
    } else {
      const newUsers = [...users]
      const newFailedAttempts = (user.failedAttempts || 0) + 1
      const willLock = newFailedAttempts >= 5

      newUsers[userIndex] = {
        ...user,
        failedAttempts: newFailedAttempts,
        isLocked: willLock,
      }
      setUsers(newUsers)

      if (willLock) {
        setLoginError("Compte bloqué : 5 tentatives échouées.")
      } else {
        setLoginError(`Mot de passe incorrect (${newFailedAttempts}/5 essais)`)
      }
    }
  }

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault()

    if (users.find((u) => u.id === regId)) {
      setRegError("Cet identifiant est déjà pris")
      return
    }

    const validation = validatePassword(regPassword)
    if (!validation.valid) {
      setRegError(validation.error)
      return
    }

    const newUser: User = {
      id: regId,
      firstName: regFirstName,
      lastName: regLastName,
      doctorCode: regDoctorCode,
      password: regPassword,
      email: regEmail,
      failedAttempts: 0,
      isLocked: false,
      role: regDoctorCode === "M" || regDoctorCode === "Z" ? "admin" : "user",
      isFirstLogin: true, // Set isFirstLogin to true for new users
    }

    setUsers([...users, newUser])
    setRegError("")
    setRegId("")
    setRegFirstName("")
    setRegLastName("")
    setRegPassword("")
    setRegEmail("")
    setRegDoctorCode("")
    setShowRegisterModal(false)

    alert("Compte créé avec succès ! Veuillez vous connecter.")
  }

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault()

    const validation = validatePassword(newPassword)
    if (!validation.valid) {
      setPasswordError(validation.error)
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Les mots de passe ne correspondent pas")
      return
    }

    if (forcePasswordChange && !recoveryEmail) {
      setPasswordError("Une adresse email de récupération est obligatoire")
      return
    }

    setUsers((prevUsers) =>
      prevUsers.map((u) => {
        if (u.id === (currentUser || resetId)) {
          return {
            ...u,
            password: newPassword,
            email: recoveryEmail || u.email,
            failedAttempts: 0,
            isLocked: false,
            isFirstLogin: false, // Set isFirstLogin to false after password change
          }
        }
        return u
      }),
    )

    setPasswordSuccess("Mot de passe modifié avec succès !")
    setPasswordError("")
    setNewPassword("")
    setConfirmPassword("")

    if (forcePasswordChange || showForgotPassword) {
      setTimeout(() => {
        setForcePasswordChange(false)
        setShowPasswordChange(false)
        setShowForgotPassword(false)
        setPasswordSuccess("")
        setResetId("")
        setResetEmail("")
        setForgotStep(1)
        if (showForgotPassword) {
          setCurrentUser(null)
          setView("login")
        } else {
          setView("app")
        }
      }, 1500)
    }
  }

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault()
    const user = users.find((u) => u.id === resetId)

    if (forgotStep === 1) {
      if (user) {
        setForgotStep(2)
        setLoginError("")
      } else {
        setLoginError("Identifiant introuvable")
      }
    } else if (forgotStep === 2) {
      if (user && user.email === resetEmail) {
        setForgotStep(3)
        setLoginError("")
      } else {
        setLoginError("Email ne correspond pas à ce compte")
      }
    }
  }

  const handleLogout = () => {
    setCurrentUser(null)
    setCurrentDoctorCode("")
    setShowPasswordChange(false)
    setForcePasswordChange(false)
    setShowForgotPassword(false)
    setForgotStep(1)
    setView("landing")
  }

  const handleResetUser = (userId: string, key: string) => {
    if (key !== "cardiomaine 2025") {
      alert("Clé incorrecte")
      return
    }
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          return {
            ...u,
            password: "1234",
            isLocked: false,
            failedAttempts: 0,
            isFirstLogin: true, // Reset to first login state
          }
        }
        return u
      }),
    )
    alert(`Compte de ${userId} débloqué et réinitialisé (Mdp: 1234)`)
  }

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await getAllSchedulesFromDb()
        const scheduleMap: FullSchedule = {}
        data.forEach((item: any) => {
          if (item.week_key && item.schedule_data) {
            scheduleMap[item.week_key] = item.schedule_data
          }
        })
        setFullSchedule(scheduleMap)
        setIsLoading(false)
      } catch (error) {
        console.error("[v0] Failed to load schedules:", error)
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  useEffect(() => {
    const supabase = getSupabase()
    const channel = supabase
      .channel("schedules_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "schedules",
        },
        (payload) => {
          console.log("[v0] Realtime update received:", payload)
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const newRecord = payload.new as any
            if (newRecord.week_key && newRecord.schedule_data) {
              setFullSchedule((prev) => ({
                ...prev,
                [newRecord.week_key]: newRecord.schedule_data,
              }))
              setDataVersion(Date.now())
            }
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    if (!currentUser || view !== "app") return

    const supabase = getSupabase()
    const channel = supabase.channel("admin_presence_tracking")

    channel
      .on("presence", { event: "sync" }, () => {
        console.log("[v0] Presence synced")
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: currentUser,
            online_at: new Date().toISOString(),
          })
        }
      })

    return () => {
      channel.untrack()
      supabase.removeChannel(channel)
    }
  }, [currentUser, view])

  // --- Render ---

  if (view === "landing") {
    return <LandingPage onLoginClick={() => setView("login")} />
  }

  if (view === "login") {
    if (showForgotPassword) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4">
          <div className="w-full max-w-md space-y-6">
            <div className="text-center">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                <ShieldAlert className="size-8" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Récupération</h1>
              <p className="mt-2 text-slate-600">
                {forgotStep === 1 && "Entrez votre identifiant"}
                {forgotStep === 2 && "Confirmez votre email"}
                {forgotStep === 3 && "Créez un nouveau mot de passe"}
              </p>
            </div>

            <Card className="p-6">
              {forgotStep < 3 ? (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  {forgotStep === 1 && (
                    <div className="space-y-2">
                      <Label htmlFor="reset-id">Identifiant</Label>
                      <Input
                        id="reset-id"
                        value={resetId}
                        onChange={(e) => setResetId(e.target.value)}
                        placeholder="Votre identifiant"
                      />
                    </div>
                  )}

                  {forgotStep === 2 && (
                    <div className="space-y-2">
                      <Label htmlFor="reset-email">Email de récupération</Label>
                      <Input
                        id="reset-email"
                        type="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="votre@email.com"
                      />
                    </div>
                  )}

                  {loginError && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="size-4" /> {loginError}
                    </p>
                  )}

                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                    Continuer
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-pass">Nouveau mot de passe</Label>
                    <Input
                      id="new-pass"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••••"
                    />
                    <p className="text-xs text-slate-500">
                      Minimum 10 caractères, 1 majuscule, 1 chiffre, 1 caractère spécial
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-pass">Confirmer le mot de passe</Label>
                    <Input
                      id="confirm-pass"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••"
                    />
                  </div>

                  {passwordError && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="size-4" /> {passwordError}
                    </p>
                  )}

                  {passwordSuccess && (
                    <p className="text-sm text-green-600 flex items-center gap-1">
                      <Check className="size-4" /> {passwordSuccess}
                    </p>
                  )}

                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                    Réinitialiser et Débloquer
                  </Button>
                </form>
              )}

              <Button
                variant="ghost"
                className="mt-4 w-full"
                onClick={() => {
                  setShowForgotPassword(false)
                  setForgotStep(1)
                  setResetId("")
                  setResetEmail("")
                  setLoginError("")
                }}
              >
                Annuler
              </Button>
            </Card>
          </div>
        </div>
      )
    }

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-blue-600 text-white">
              <Activity className="size-8" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Espace Pro</h1>
            <p className="mt-2 text-slate-600">Groupe Cardiomaine</p>
          </div>

          <Card className="p-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="id">Identifiant</Label>
                <Input
                  id="id"
                  placeholder="Votre identifiant personnel"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
              </div>

              {loginError && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="size-4" /> {loginError}
                </p>
              )}

              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                Se connecter
              </Button>

              <div className="text-center space-y-2">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-blue-600 hover:underline block w-full"
                >
                  Mot de passe oublié ?
                </button>
              </div>
            </form>
            <div className="mt-4 text-center">
              <Button variant="link" onClick={() => setView("landing")}>
                ← Retour au site
              </Button>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  // App View
  const userRole = currentUser ? users.find((u) => u.id === currentUser)?.role : "user"
  const isAdmin = userRole === "admin"

  // Maintenance Mode Check
  if (view === "app" && maintenanceMode && !isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 text-center">
        <div className="mb-6 rounded-full bg-orange-100 p-6">
          <Construction className="size-12 text-orange-600" />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-slate-900">Maintenance en cours</h1>
        <p className="mb-8 max-w-md text-slate-600">
          L'application est actuellement verrouillée pour une mise à jour du planning. Veuillez réessayer plus tard.
        </p>
        <Button variant="outline" onClick={handleLogout}>
          Retour à l'accueil
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row max-w-[100vw] overflow-hidden">
      {(showPasswordChange || forcePasswordChange) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 p-4 backdrop-blur-md animate-in fade-in duration-300">
          <Card className="w-full max-w-md relative shadow-2xl border-slate-200 bg-white/90">
            {!forcePasswordChange && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2 hover:bg-slate-100"
                onClick={() => setShowPasswordChange(false)}
              >
                <X className="h-4 w-4 text-slate-500" />
              </Button>
            )}
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-700">
                <Lock className="h-6 w-6 text-blue-600" />
                {forcePasswordChange ? "Première Connexion" : "Changer le mot de passe"}
              </CardTitle>
              <CardDescription className="text-slate-600">
                {forcePasswordChange
                  ? "Pour votre sécurité, veuillez définir votre mot de passe personnel et votre email de récupération."
                  : "Modifiez votre mot de passe actuel."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-pass-modal" className="text-slate-700">
                    Nouveau mot de passe
                  </Label>
                  <Input
                    id="new-pass-modal"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••••"
                    className="bg-white border-slate-300 focus:border-blue-500"
                  />
                  <p className="text-xs text-slate-500">
                    Min. 10 caractères, 1 majuscule, 1 chiffre, 1 caractère spécial
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-pass-modal" className="text-slate-700">
                    Confirmer le mot de passe
                  </Label>
                  <Input
                    id="confirm-pass-modal"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••"
                    className="bg-white border-slate-300 focus:border-blue-500"
                  />
                </div>

                {(forcePasswordChange || !users.find((u) => u.id === currentUser)?.email) && (
                  <div className="space-y-2">
                    <Label htmlFor="recovery-email" className="text-slate-700">
                      Email de récupération (Obligatoire)
                    </Label>
                    <Input
                      id="recovery-email"
                      type="email"
                      value={recoveryEmail}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                      placeholder="votre@email.com"
                      required
                      className="bg-white border-slate-300 focus:border-blue-500"
                    />
                    <p className="text-xs text-slate-500">Nécessaire pour récupérer votre compte en cas d'oubli.</p>
                  </div>
                )}
                {passwordError && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="size-4" /> {passwordError}
                  </p>
                )}
                {passwordSuccess && (
                  <p className="text-sm text-green-600 flex items-center gap-1">
                    <Check className="size-4" /> {passwordSuccess}
                  </p>
                )}
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                  Enregistrer
                </Button>
              </form>
              <div className="text-xs text-center text-slate-400 mt-2">
                v{new Date(dataVersion).toISOString().split("T")[0].replace(/-/g, "")}.
                {new Date(dataVersion).getHours()}
                {new Date(dataVersion).getMinutes()}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* App Header */}
        <header className="bg-white border-b h-16 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
            </Button>
            <span className="font-bold text-lg text-primary hidden md:inline">
              Cardiomaine Planning {new Date().getFullYear()}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button
                variant={showAdminPanel ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setShowAdminPanel(!showAdminPanel)}
                className="hidden md:flex"
              >
                <ShieldCheck className="h-4 w-4 mr-2" />
                Admin
              </Button>
            )}
            <div className="flex items-center gap-2 mr-2">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold",
                  DOCTOR_COLORS[currentDoctorCode || ""] || "bg-slate-500",
                )}
              >
                {currentDoctorCode}
              </div>
              <span className="text-sm font-medium hidden sm:inline">{currentUser}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setShowPasswordChange(true)}>
              <Settings className="h-5 w-5 text-slate-400" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5 text-slate-400" />
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden relative z-0">
          {showAdminPanel && isAdmin ? (
            <div className="absolute inset-0 bg-slate-50 z-10 overflow-auto">
              <AdminPanel
                users={users}
                onResetUser={handleResetUser}
                maintenanceMode={maintenanceMode}
                setMaintenanceMode={setMaintenanceMode}
              />
            </div>
          ) : (
            <ScheduleApp
              currentUser={currentUser || ""}
              doctorCode={currentDoctorCode}
              isAdmin={isAdmin}
              fullSchedule={fullSchedule}
              setFullSchedule={setFullSchedule}
              onLogout={handleLogout}
              onChangePassword={() => setShowPasswordChange(true)}
            />
          )}
          <div className="absolute bottom-1 right-1 text-[10px] text-slate-400 bg-white/50 px-1 rounded pointer-events-none">
            Dernière synchro: {new Date(dataVersion).toLocaleTimeString()}
          </div>
        </main>
      </div>
    </div>
  )
}
