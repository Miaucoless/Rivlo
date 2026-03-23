'use client'

import { HeroSection } from './HeroSection'
import { FeaturesSection } from './FeaturesSection'
import { LandingNav } from './LandingNav'
import { LandingFooter } from './LandingFooter'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">
      <LandingNav />
      <main>
        <HeroSection />
        <FeaturesSection />
      </main>
      <LandingFooter />
    </div>
  )
}
