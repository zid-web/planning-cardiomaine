'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { User } from '@supabase/supabase-js'
import { updateProfile, changePassword } from '@/app/actions/profile-actions'

interface ProfileFormProps {
  user: User
  supabaseClient: any
}

export function ProfileForm({ user }: ProfileFormProps) {
  const router = useRouter()
  const [firstName, setFirstName] = useState(user.user_metadata?.first_name || '')
  const [lastName, setLastName] = useState(user.user_metadata?.last_name || '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingProfile(true)
    setProfileMessage(null)

    try {
      const res = await updateProfile(firstName.trim(), lastName.trim())
      if (res.error) {
        setProfileMessage({ type: 'error', text: res.error })
      } else {
        setProfileMessage({ type: 'success', text: 'Profil mis à jour avec succès.' })
      }
    } catch (error) {
      setProfileMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Une erreur est survenue',
      })
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsChangingPassword(true)
    setPasswordMessage(null)

    if (password.length < 8) {
      setPasswordMessage({ type: 'error', text: 'Le mot de passe doit contenir au moins 8 caractères.' })
      setIsChangingPassword(false)
      return
    }

    if (password !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Les mots de passe ne correspondent pas.' })
      setIsChangingPassword(false)
      return
    }

    try {
      const res = await changePassword(password)
      if (res.error) {
        setPasswordMessage({ type: 'error', text: res.error })
      } else {
        setPasswordMessage({ type: 'success', text: 'Mot de passe modifié avec succès.' })
        setPassword('')
        setConfirmPassword('')
      }
    } catch (error) {
      setPasswordMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Une erreur est survenue',
      })
    } finally {
      setIsChangingPassword(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Profil Informations */}
      <form onSubmit={handleUpdateProfile} className="space-y-4 border-b pb-6">
        <h3 className="text-lg font-bold text-slate-800">Informations personnelles</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="first-name">Prénom</Label>
            <Input
              id="first-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Votre prénom"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="last-name">Nom</Label>
            <Input
              id="last-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Votre nom"
              className="mt-1"
            />
          </div>
        </div>

        {profileMessage && (
          <div
            className={`p-3 rounded-lg text-sm ${
              profileMessage.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {profileMessage.text}
          </div>
        )}

        <Button
          type="submit"
          disabled={isSavingProfile}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isSavingProfile ? 'Enregistrement...' : 'Enregistrer les modifications'}
        </Button>
      </form>

      {/* Modifier Mot de passe */}
      <form onSubmit={handleChangePassword} className="space-y-4 pb-4">
        <h3 className="text-lg font-bold text-slate-800">Modifier le mot de passe</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="new-password">Nouveau mot de passe</Label>
            <Input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 caractères"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirmer le mot de passe"
              className="mt-1"
            />
          </div>
        </div>

        {passwordMessage && (
          <div
            className={`p-3 rounded-lg text-sm ${
              passwordMessage.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {passwordMessage.text}
          </div>
        )}

        <Button
          type="submit"
          disabled={isChangingPassword}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {isChangingPassword ? 'Modification...' : 'Modifier le mot de passe'}
        </Button>
      </form>

      <div className="pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/protected/planning')}
          className="w-full border-slate-300 text-slate-700 hover:bg-slate-100"
        >
          Retour au planning
        </Button>
      </div>
    </div>
  )
}
