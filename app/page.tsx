'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store/useAppStore'
import LandingPage from '@/components/landing/LandingPage'
import { useAuthInit } from '@/hooks/useAuthInit'

export default function HomePage() {
  const { isAuthenticated, isDemoMode } = useAppStore()
  const router = useRouter()
  const { loading } = useAuthInit()

  useEffect(() => {
    // If authenticated (either demo or real auth), redirect to dashboard
    if (isAuthenticated && !loading) {
      router.push('/dashboard')
    }
  }, [isAuthenticated, loading, router])

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
