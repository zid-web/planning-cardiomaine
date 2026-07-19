'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      console.log('[v0] Service Worker not supported')
      return
    }

    const registerServiceWorker = async () => {
      try {
        // Unregister all existing service workers first
        const registrations = await navigator.serviceWorker.getRegistrations()
        for (const registration of registrations) {
          console.log('[v0] Unregistering old SW:', registration.scope)
          await registration.unregister()
        }

        // Register new service worker from API route (avoids Vercel redirect issues)
        const registration = await navigator.serviceWorker.register('/api/sw', {
          scope: '/',
          updateViaCache: 'none', // Always fetch fresh sw.js
        })

        console.log('[v0] Service Worker registered:', registration.scope)

        // Force update check immediately
        registration.update()

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          console.log('[v0] New SW version found')

          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[v0] New SW ready, notifying clients')
              newWorker.postMessage({ type: 'SKIP_WAITING' })
            }
          })
        })

        // Listen for SW messages
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data.type === 'SKIP_WAITING') {
            console.log('[v0] SW says skip waiting, reloading page')
            window.location.reload()
          }
        })
      } catch (error) {
        console.error('[v0] Service Worker registration failed:', error)
      }
    }

    // Register on load and after a delay to catch updates
    registerServiceWorker()
    const timer = setTimeout(registerServiceWorker, 5000)

    return () => clearTimeout(timer)
  }, [])

  return null
}
