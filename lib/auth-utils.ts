import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function requireAuthWithPasswordSetup() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect('/auth/login')
  }

  // Check if password setup is complete
  const { data: profile } = await supabase
    .from('profiles')
    .select('must_change_password')
    .eq('id', data.user.id)
    .single()

  if (profile?.must_change_password) {
    redirect('/auth/setup-account')
  }

  return data.user
}
