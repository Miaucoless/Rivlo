'use client'

import { useEffect } from 'react'

function shouldRegisterPwa() {
  if (typeof window === 'undefined') return false
  if (!('serviceWorker' in navigator)) return false

  const hostname = window.location.hostname
  if (hostname === 'localhost' || hostname === '127.0.0.1') return false
  if (hostname.endsWith('.vercel.app')) return false

  return true
}

export function PwaRegistration() {
  useEffect(() => {
    if (!shouldRegisterPwa()) return

    let cancelled = false
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const existingRegistration = await navigator.serviceWorker.getRegistration('/sw.js')
          if (cancelled || existingRegistration) return
          await navigator.serviceWorker.register('/sw.js')
        } catch (error) {
          console.warn('Unable to register the Rivora service worker.', error)
        }
      })()
    }, 2500)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [])

  return null
}
