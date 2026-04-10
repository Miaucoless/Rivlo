'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAppStore } from '@/store/useAppStore'
import LandingPage from '@/components/landing/LandingPage'
import { useAuthInit } from '@/hooks/useAuthInit'

const CANONICAL_APP_ORIGIN = process.env.NEXT_PUBLIC_APP_URL || 'https://rivorafit.com'

function HomePageContent() {
  const { isAuthenticated } = useAppStore()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { loading } = useAuthInit()

  useEffect(() => {
    const hasRecoveryQuery =
      Boolean(searchParams.get('code')) ||
      Boolean(searchParams.get('token_hash')) ||
      searchParams.get('type') === 'recovery'

    if (typeof window !== 'undefined') {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const hasRecoveryHash =
        hashParams.get('type') === 'recovery' &&
        Boolean(hashParams.get('access_token')) &&
        Boolean(hashParams.get('refresh_token'))

      if (hasRecoveryQuery || hasRecoveryHash) {
        const canonicalOrigin = CANONICAL_APP_ORIGIN.replace(/\/$/, '')
        const currentOrigin = window.location.origin.replace(/\/$/, '')

        if (canonicalOrigin && canonicalOrigin !== currentOrigin) {
          const recoveryUrl = new URL(window.location.pathname + window.location.search + window.location.hash, canonicalOrigin)
          window.location.replace(recoveryUrl.toString())
          return
        }

        const nextUrl = new URL('/reset-password', window.location.origin)

        if (hasRecoveryQuery) {
          ;['code', 'token_hash', 'type'].forEach((key) => {
            const value = searchParams.get(key)
            if (value) nextUrl.searchParams.set(key, value)
          })
        }

        if (hasRecoveryHash) {
          nextUrl.hash = window.location.hash
        }

        router.replace(`${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`)
        return
      }
    }

    // If authenticated (either demo or real auth), redirect to dashboard
    if (isAuthenticated && !loading) {
      router.push('/dashboard')
    }
  }, [isAuthenticated, loading, router, searchParams])

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-white text-center">
          <div className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Loading...</p>
        </div>
      </div>
    )
  }

  // If not authenticated, show landing page
  return <LandingPage />
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
          <div className="text-white text-center">
            <div className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-zinc-400">Loading...</p>
          </div>
        </div>
      }
    >
      <HomePageContent />
    </Suspense>
  )
}
