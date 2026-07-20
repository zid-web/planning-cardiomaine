'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    // Unregister any existing Service Workers to clean up 502 errors
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((reg) => {
        reg.unregister().catch(() => {
          // Ignore errors during unregistration
        })
      })
    })
  }, [])

  return null
}
