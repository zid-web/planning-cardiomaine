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
