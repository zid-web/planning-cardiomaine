'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    const registerSW = async () => {
      try {
        // Register Service Worker directly from /sw.js
        // Headers configured in next.config.js prevent redirects
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        })
        
        console.log('✅ Service Worker registered successfully')

        // Check for updates periodically
        setInterval(() => {
          registration.update()
        }, 60 * 1000)
      } catch (error) {
        console.error('❌ Service Worker registration failed:', error)
      }
    }

    registerSW()
  }, [])

  return null
}
