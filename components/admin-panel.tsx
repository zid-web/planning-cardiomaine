"use client"

import { useEffect, useState } from "react"
import { AlertCircle, Key, Lock, ShieldCheck, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import type { User } from "@/lib/types"
import { DOCTOR_COLORS } from "@/lib/constants"
import { createClient } from "@/lib/supabase-client"

export function AdminPanel({
  users,
  onResetUser,
  maintenanceMode,
  setMaintenanceMode,
}: {
  users: User[]
  onResetUser: (id: string, key: string) => void
  maintenanceMode: boolean
  setMaintenanceMode: (enabled: boolean) => void
}) {
  const [unlockModalOpen, setUnlockModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [secretKey, setSecretKey] = useState("")
  const [error, setError] = useState("")
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel("admin_presence_tracking")

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState()
        const online = new Set<string>()

        Object.values(state).forEach((presences: any) => {
          presences.forEach((presence: any) => {
            if (presence.user_id) {
              online.add(presence.user_id)
            }
          })
        })

        setOnlineUsers(online)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const handleUnlockClick = (userId: string) => {
    setSelectedUser(userId)
    setUnlockModalOpen(true)
    setSecretKey("")
    setError("")
  }

  const confirmUnlock = () => {
    if (secretKey !== "cardiomaine 2025") {
      setError("Clé de déblocage incorrecte")
      return
    }
    if (selectedUser) {
      onResetUser(selectedUser, secretKey)
      setUnlockModalOpen(false)
      setSelectedUser(null)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          Administration
        </h2>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Gestion des Utilisateurs</CardTitle>
            <CardDescription>Réinitialiser les accès et gérer les comptes bloqués</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {users.map((user) => {
                  const isOnline = onlineUsers.has(user.id)

                  return (
                    <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg bg-slate-50">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div
                            className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold",
                              DOCTOR_COLORS[user.doctorCode] || "bg-slate-500",
                            )}
                          >
                            {user.doctorCode}
                          </div>
                          <div
                            className={cn(
                              "absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white",
                              isOnline ? "bg-green-500" : "bg-gray-400",
                            )}
                            title={isOnline ? "En ligne" : "Hors ligne"}
                          />
                        </div>
                        <div>
                          <p className="font-medium">
                            {user.firstName} {user.lastName} ({user.id})
                          </p>
                          <div className="flex gap-2 mt-1">
                            <Badge
                              variant={isOnline ? "default" : "secondary"}
                              className={isOnline ? "bg-green-600" : ""}
                            >
                              {isOnline ? "En ligne" : "Hors ligne"}
                            </Badge>
                            {user.isLocked && <Badge variant="destructive">Bloqué</Badge>}
                            {user.role === "admin" && <Badge variant="secondary">Admin</Badge>}
                          </div>
                        </div>
                      </div>
                      {user.isLocked ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleUnlockClick(user.id)}
                          className="gap-1"
                        >
                          <Lock className="h-3 w-3" />
                          Débloquer
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => handleUnlockClick(user.id)}>
                          Réinitialiser
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Paramètres du Système</CardTitle>
            <CardDescription>Configuration globale de l'application</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label>Mode Maintenance</Label>
                <p className="text-sm text-muted-foreground">Bloquer l'accès pour les utilisateurs non-admin</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={maintenanceMode ? "text-orange-600 font-bold" : "text-slate-500"}>
                  {maintenanceMode ? "ACTIVÉ" : "DÉSACTIVÉ"}
                </span>
                <Switch checked={maintenanceMode} onCheckedChange={setMaintenanceMode} />
              </div>
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label>Export des Données</Label>
                <p className="text-sm text-muted-foreground">Télécharger le planning complet (CSV)</p>
              </div>
              <Button variant="outline">Exporter</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {unlockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2"
              onClick={() => setUnlockModalOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-600">
                <Key className="h-6 w-6" />
                Déblocage Sécurisé
              </CardTitle>
              <CardDescription>
                Entrez la clé de sécurité pour débloquer l'accès de <strong>{selectedUser}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Clé de déblocage</Label>
                <Input
                  type="password"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  placeholder="Entrez la clé secrète..."
                />
              </div>
              {error && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="size-4" /> {error}
                </p>
              )}
              <Button className="w-full bg-orange-600 hover:bg-orange-700" onClick={confirmUnlock}>
                Confirmer le déblocage
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
