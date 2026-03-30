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
    document.documentElement.style.overflowY = 'auto'
    document.documentElement.style.height = 'auto'
    document.documentElement.style.overscrollBehavior = 'auto'
    document.documentElement.style.overscrollBehaviorY = 'auto'
    document.body.style.overflow = 'auto'
    document.body.style.overflowY = 'auto'
    document.body.style.height = 'auto'
    document.body.style.overscrollBehavior = 'auto'
    document.body.style.overscrollBehaviorY = 'auto'
    document.body.style.pointerEvents = 'auto'
    document.body.style.position = 'static'

    return () => {
      document.documentElement.style.overflow = ''
      document.documentElement.style.overflowY = ''
      document.documentElement.style.height = ''
      document.documentElement.style.overscrollBehavior = ''
      document.documentElement.style.overscrollBehaviorY = ''
      document.body.style.overflow = ''
      document.body.style.overflowY = ''
      document.body.style.height = ''
      document.body.style.overscrollBehavior = ''
      document.body.style.overscrollBehaviorY = ''
      document.body.style.pointerEvents = ''
      document.body.style.position = ''
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
