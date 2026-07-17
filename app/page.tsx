'use server'

import { redirect } from 'next/navigation'

export default function HomePage() {
  // Redirect all homepage traffic to the Supabase auth login page
  redirect('/auth/login')
}
