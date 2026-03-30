'use client'

import { useEffect } from 'react'
import { HeroSection } from './HeroSection'
import { FeaturesSection } from './FeaturesSection'
import { LandingNav } from './LandingNav'
import { LandingFooter } from './LandingFooter'

export default function LandingPage() {
  useEffect(() => {
    // Counteract any scroll locks applied by the dashboard layout
    document.documentElement.style.overflow = 'auto'
    document.documentElement.style.height = 'auto'
    document.body.style.overflow = 'auto'
    document.body.style.height = 'auto'

    return () => {
      document.documentElement.style.overflow = ''
      document.documentElement.style.height = ''
      document.body.style.overflow = ''
      document.body.style.height = ''
    }
  }, [])

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0a0a0a] text-white">
      <LandingNav />
      <main>
        <HeroSection />
        <FeaturesSection />
      </main>
      <LandingFooter />
    </div>
  )
}
