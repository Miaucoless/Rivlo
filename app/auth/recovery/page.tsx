'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function RecoveryBridgeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (typeof window === 'undefined') return

    const nextUrl = new URL('/reset-password', window.location.origin)

    ;['code', 'token_hash', 'type'].forEach((key) => {
      const value = searchParams.get(key)
      if (value) nextUrl.searchParams.set(key, value)
    })

    if (window.location.hash) {
      nextUrl.hash = window.location.hash
    }

    router.replace(`${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`)
  }, [router, searchParams])

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#06100f] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_28%),radial-gradient(circle_at_80%_18%,_rgba(45,212,191,0.12),_transparent_25%),linear-gradient(140deg,_#06100f_0%,_#0b1715_55%,_#060908_100%)]" />
      <div className="relative flex min-h-[100dvh] items-center justify-center px-4">
        <div className="rounded-[2rem] border border-white/10 bg-[rgba(8,18,17,0.88)] px-6 py-5 text-sm text-zinc-400 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
          Preparing your reset link...
        </div>
      </div>
    </div>
  )
}

export default function RecoveryBridgePage() {
  return (
    <Suspense fallback={null}>
      <RecoveryBridgeContent />
    </Suspense>
  )
}
