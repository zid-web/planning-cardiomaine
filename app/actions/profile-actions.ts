'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function setupInitialPassword(newPassword: string) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Not authenticated' }
    }

    // Validate password
    if (!newPassword || newPassword.length < 8) {
      return { error: 'Password must be at least 8 characters' }
    }

    // Update password
    const { error: passwordError } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (passwordError) {
      return { error: passwordError.message }
    }

    // Update must_change_password in profiles table
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ must_change_password: false })
      .eq('id', user.id)

    if (profileError) {
      return { error: profileError.message }
    }

    revalidatePath('/', 'layout')
    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An error occurred'
    return { error: errorMessage }
  }
}

export async function getUserProfile() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Not authenticated', profile: null }
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError) {
      return { error: profileError.message, profile: null }
    }

    return { error: null, profile }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An error occurred'
    return { error: errorMessage, profile: null }
  }
}

export async function updateProfile(firstName: string, lastName: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: 'Non authentifié' }
    }

    const { error } = await supabase.auth.updateUser({
      data: {
        first_name: firstName,
        last_name: lastName,
      }
    })

    if (error) {
      return { error: error.message }
    }

    revalidatePath('/profile')
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Une erreur est survenue' }
  }
}

export async function changePassword(password: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: 'Non authentifié' }
    }

    if (!password || password.length < 8) {
      return { error: 'Le mot de passe doit contenir au moins 8 caractères' }
    }

    const { error } = await supabase.auth.updateUser({
      password: password,
    })

    if (error) {
      return { error: error.message }
    }

    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Une erreur est survenue' }
  }
}
