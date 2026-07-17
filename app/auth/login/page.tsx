'use client'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function Page() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      // Validate inputs
      if (!email || !password) {
        throw new Error('Email and password are required')
      }

      console.log('[v0] Login attempt with email:', email)

      let supabase
      try {
        supabase = createClient()
      } catch (clientError) {
        console.error('[v0] Failed to create Supabase client:', clientError)
        throw new Error('Authentication service is not properly configured. Please contact support.')
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      console.log('[v0] Auth response:', { hasData: !!data, hasError: !!error, errorMessage: error?.message })

      if (error) {
        console.error('[v0] Supabase auth error:', {
          message: error.message,
          status: error.status,
          name: error.name,
        })
        
        // Provide user-friendly error messages
        if (error.status === 400) {
          throw new Error('Invalid email or password. Please try again.')
        } else if (error.status === 422) {
          throw new Error('Email not found. Please check your email or sign up.')
        } else if (error.status === 401) {
          throw new Error('Invalid credentials. Please check your email and password.')
        } else {
          throw new Error(error.message || 'Authentication failed. Please try again.')
        }
      }

      if (!data.user) {
        throw new Error('Login failed: No user data returned')
      }

      console.log('[v0] Login successful for user:', data.user.id)
      router.push('/protected')
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred'
      console.error('[v0] Login failed:', errorMessage)
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Login</CardTitle>
              <CardDescription>
                Enter your email below to login to your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin}>
                <div className="flex flex-col gap-6">
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="m@example.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      <Link
                        href="/auth/forgot-password"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  {error && <p className="text-sm text-red-500">{error}</p>}
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Logging in...' : 'Login'}
                  </Button>
                </div>
                <div className="mt-4 text-center text-sm">
                  Don&apos;t have an account?{' '}
                  <Link
                    href="/auth/sign-up"
                    className="underline underline-offset-4"
                  >
                    Sign up
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
