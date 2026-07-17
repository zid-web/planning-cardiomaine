'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { setupInitialPassword, getUserProfile } from '@/app/actions/profile-actions'
import { useEffect } from 'react'

export default function SetupAccountPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [doctorCode, setDoctorCode] = useState<string | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const fetchProfile = async () => {
      const { profile, error } = await getUserProfile()
      if (error) {
        setError(error)
        setLoadingProfile(false)
        return
      }
      if (profile) {
        setDoctorCode(profile.doctor_code || null)
      }
      setLoadingProfile(false)
    }

    fetchProfile()
  }, [])

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      // Validate inputs
      if (!password || !confirmPassword) {
        throw new Error('Please fill in all fields')
      }

      if (password.length < 8) {
        throw new Error('Password must be at least 8 characters')
      }

      if (password !== confirmPassword) {
        throw new Error('Passwords do not match')
      }

      // Setup initial password
      const result = await setupInitialPassword(password)
      if (result.error) {
        throw new Error(result.error)
      }

      // Redirect to protected page
      router.push('/protected')
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  if (loadingProfile) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">
          <Card>
            <CardHeader>
              <CardTitle>Setting up your account...</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">Please wait while we load your profile.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Set Up Your Account</CardTitle>
              <CardDescription>
                Please create a secure password to complete your account setup
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSetup}>
                <div className="flex flex-col gap-6">
                  {doctorCode && (
                    <div className="grid gap-2">
                      <Label htmlFor="doctor-code">Doctor Code</Label>
                      <Input
                        id="doctor-code"
                        type="text"
                        value={doctorCode}
                        disabled
                        className="bg-gray-100 text-gray-600 cursor-not-allowed"
                      />
                      <p className="text-xs text-gray-500">This is your assigned doctor code</p>
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Label htmlFor="password">New Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter a strong password (min. 8 characters)"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                    />
                    <p className="text-xs text-gray-500">
                      Must be at least 8 characters long
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="Re-enter your password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>

                  {error && (
                    <p className="text-sm text-red-500">{error}</p>
                  )}

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Setting up...' : 'Complete Setup'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
