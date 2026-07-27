"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2, UserCog, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import {
  createUserAccount,
  deleteUserAccount,
  listUsers,
  updateUserProfile,
  type AdminUserRow,
} from "@/app/actions/admin-user-actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export default function AdminUsersPage() {
  const router = useRouter()
  const supabase = createClient()

  const [ready, setReady] = useState(false)
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [loading, setLoading] = useState(true)

  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<AdminUserRow | null>(null)
  const [deleteUser, setDeleteUser] = useState<AdminUserRow | null>(null)
  const [busy, setBusy] = useState(false)

  const [form, setForm] = useState({
    email: "",
    password: "",
    role: "doctor" as "admin" | "doctor",
    doctor_code: "",
    first_name: "",
    last_name: "",
  })

  const refresh = useCallback(async () => {
    setLoading(true)
    const res = await listUsers()
    if (!res.success) {
      toast.error(res.error || "Impossible de charger les utilisateurs")
      setUsers([])
    } else {
      setUsers(res.users)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const gate = async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData?.user) {
        router.replace("/auth/login")
        return
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userData.user.id)
        .single()
      if (profile?.role !== "admin") {
        toast.error("Accès réservé aux administrateurs")
        router.replace("/protected/planning")
        return
      }
      setReady(true)
      await refresh()
    }
    void gate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const resetCreateForm = () =>
    setForm({
      email: "",
      password: "",
      role: "doctor",
      doctor_code: "",
      first_name: "",
      last_name: "",
    })

  const handleCreate = async () => {
    setBusy(true)
    try {
      const res = await createUserAccount(form)
      if (!res.success) {
        toast.error(res.error || "Création échouée")
        return
      }
      toast.success("Utilisateur créé")
      setCreateOpen(false)
      resetCreateForm()
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const handleUpdate = async () => {
    if (!editUser) return
    setBusy(true)
    try {
      const res = await updateUserProfile(editUser.id, {
        role: (editUser.role === "admin" ? "admin" : "doctor") as "admin" | "doctor",
        doctor_code: editUser.doctor_code,
        first_name: editUser.first_name,
        last_name: editUser.last_name,
      })
      if (!res.success) {
        toast.error(res.error || "Mise à jour échouée")
        return
      }
      toast.success("Profil mis à jour")
      setEditUser(null)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteUser) return
    setBusy(true)
    try {
      const res = await deleteUserAccount(deleteUser.id)
      if (!res.success) {
        toast.error(res.error || "Suppression échouée")
        return
      }
      toast.success("Utilisateur supprimé")
      setDeleteUser(null)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        Chargement…
      </div>
    )
  }

  return (
    // Root layout = overflow-hidden : cette page DOIT scroller ici (sinon liste tronquée).
    <div className="h-full overflow-y-auto overscroll-y-contain bg-slate-50">
      <div className="mx-auto w-full max-w-3xl space-y-4 p-4 pb-20 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => router.push("/protected/planning")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                <UserCog className="h-5 w-5 shrink-0" />
                Comptes utilisateurs
              </h1>
              <p className="text-xs text-slate-500">
                Admin hors planning (Lucie = <span className="font-semibold">L</span>) : rôle admin,
                pas dans les médecins assignables.
              </p>
            </div>
          </div>
          <Button
            onClick={() => {
              resetCreateForm()
              setCreateOpen(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nouvel utilisateur
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {loading ? "Chargement…" : `${users.length} utilisateur(s)`}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {users.map((u) => (
              <div
                key={u.id}
                className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
              >
                <p className="break-all text-sm font-semibold text-slate-900">{u.email || "—"}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>
                    {[u.first_name, u.last_name].filter(Boolean).join(" ") || "Sans nom"}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      u.role === "admin"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {u.role || "—"}
                  </span>
                  {u.doctor_code ? (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
                      {u.doctor_code}
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditUser({ ...u })}>
                    Modifier
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600"
                    onClick={() => setDeleteUser(u)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {!loading && users.length === 0 && (
              <p className="py-8 text-center text-slate-400">Aucun utilisateur</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un utilisateur</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                type="email"
              />
            </div>
            <div className="space-y-1">
              <Label>Mot de passe temporaire</Label>
              <Input
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                type="password"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Prénom</Label>
                <Input
                  value={form.first_name}
                  onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Nom</Label>
                <Input
                  value={form.last_name}
                  onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Rôle</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, role: v as "admin" | "doctor" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="doctor">doctor</SelectItem>
                    <SelectItem value="admin">admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Code (initiale)</Label>
                <Input
                  value={form.doctor_code}
                  onChange={(e) => setForm((f) => ({ ...f, doctor_code: e.target.value }))}
                  placeholder="ex: P ou L (admin hors planning)"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button onClick={() => void handleCreate()} disabled={busy}>
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="break-all">Modifier {editUser?.email}</DialogTitle>
          </DialogHeader>
          {editUser && (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Prénom</Label>
                  <Input
                    value={editUser.first_name || ""}
                    onChange={(e) =>
                      setEditUser({ ...editUser, first_name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Nom</Label>
                  <Input
                    value={editUser.last_name || ""}
                    onChange={(e) =>
                      setEditUser({ ...editUser, last_name: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Rôle</Label>
                  <Select
                    value={editUser.role === "admin" ? "admin" : "doctor"}
                    onValueChange={(v) => setEditUser({ ...editUser, role: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="doctor">doctor</SelectItem>
                      <SelectItem value="admin">admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Code médecin</Label>
                  <Input
                    value={editUser.doctor_code || ""}
                    onChange={(e) =>
                      setEditUser({ ...editUser, doctor_code: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>
              Annuler
            </Button>
            <Button onClick={() => void handleUpdate()} disabled={busy}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={!!deleteUser} onOpenChange={(o) => !o && setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet utilisateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteUser?.email} sera définitivement supprimé (Auth + profil).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => void handleDelete()}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
