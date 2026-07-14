'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { User } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

interface ProfileFormProps {
  user: User
  supabaseClient: SupabaseClient
}

export function ProfileForm({ user }: ProfileFormProps) {
  const [firstName, setFirstName] = useState(
    user.user_metadata?.first_name || ''
  )
  const [lastName, setLastName] = useState(user.user_metadata?.last_name || '')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setMessage(null)

    try {
      // In a real app, you would call an API endpoint to update the user metadata
      // For now, we'll just show a success message
      setMessage({
        type: 'success',
        text: 'Les modifications seraient sauvegardées via une API route.',
      })
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error ? error.message : 'Une erreur est survenue',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleUpdateProfile} className="space-y-6">
      <div className="grid gap-4">
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

      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <Button
        type="submit"
        disabled={isSaving}
        className="w-full bg-blue-600 hover:bg-blue-700"
      >
        {isSaving ? 'Enregistrement...' : 'Enregistrer les modifications'}
      </Button>
    </form>
  )
}
