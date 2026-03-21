'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store/useAppStore'
import LandingPage from '@/components/landing/LandingPage'

export default function HomePage() {
  const { isAuthenticated } = useAppStore()
  const router = useRouter()

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard')
    }
  }, [isAuthenticated, router])

  return <LandingPage />
}
