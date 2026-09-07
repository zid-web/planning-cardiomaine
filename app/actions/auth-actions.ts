'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signUp(email: string, password: string, firstName: string, lastName: string) {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? 'http://localhost:3000'}/auth/callback`,
      data: {
        first_name: firstName,
        last_name: lastName,
      },
    },
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  return { data }
}

export async function signIn(email: string, password: string) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  // Get user profile to check if password setup is needed
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('must_change_password')
      .eq('id', user.id)
      .single()

    revalidatePath('/', 'layout')
    
    // If user needs to change password, redirect to setup page
    if (profile?.must_change_password) {
      redirect('/auth/setup-account')
    }
  }

  revalidatePath('/', 'layout')
  redirect('/protected')
}

export async function signOut() {
  const supabase = await createClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    console.error('[auth] Server signOut error:', error)
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function getCurrentUser() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user
}

export async function resetPassword(email: string, origin?: string) {
  const supabase = await createClient()

  const siteUrl =
    origin ||
    process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
    (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : null) ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    'http://localhost:3000'

  // Le lien envoyé par Supabase contient un `code` à usage unique (flux
  // PKCE) : il faut l'échanger contre une session AVANT de pouvoir changer
  // le mot de passe, sinon `updatePassword` échoue faute de session active.
  // On fait donc transiter le lien par `/auth/callback` (qui fait déjà cet
  // échange pour la confirmation d'inscription) avant d'arriver sur le
  // formulaire de saisie du nouveau mot de passe.
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/auth/reset-password-confirm`,
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

export async function updatePassword(password: string) {
  const supabase = await createClient()

  const { error } = await supabase.auth.updateUser({
    password,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}
