'use client'

import { useEffect } from 'react'
import { HeroSection } from './HeroSection'
import { FeaturesSection } from './FeaturesSection'
import { LandingNav } from './LandingNav'
import { LandingFooter } from './LandingFooter'

export default function LandingPage() {
  useEffect(() => {
    document.documentElement.style.overflowY = 'auto'
    document.documentElement.style.height = 'auto'
    document.documentElement.style.pointerEvents = 'auto'
    document.body.style.overflowY = 'auto'
    document.body.style.height = 'auto'
    document.body.style.pointerEvents = 'auto'

    return () => {
      document.documentElement.style.overflowY = ''
      document.documentElement.style.height = ''
      document.documentElement.style.pointerEvents = ''
      document.body.style.overflowY = ''
      document.body.style.height = ''
      document.body.style.pointerEvents = ''
    }
  }, [])

  return (
    <div className="h-[100dvh] overflow-y-auto overflow-x-hidden bg-[#0a0a0a] text-white">
      <LandingNav />
      <main>
        <HeroSection />
        <FeaturesSection />
      </main>
      <LandingFooter />
    </div>
  )
}
