'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/store/useAppStore'
import type { LevelUpResult } from '@/types'

interface CrownCeremonyProps {
  result: Extract<LevelUpResult, { kind: 'crown' }>
}

export function CrownCeremony({ result: _result }: CrownCeremonyProps) {
  const claimCrown = useAppStore((s) => s.claimCrown)
  const user = useAppStore((s) => s.user)
  const initials = (user?.name ?? 'U').slice(0, 2).toUpperCase()

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at 50% 30%, #1f050566 0%, #0a0a0a 70%)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        />

        <motion.div
          className="pointer-events-none absolute"
          style={{
            top: '20%', left: '50%', transform: 'translate(-50%, -50%)',
            width: 200, height: 200, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(244,63,94,0.15) 0%, transparent 70%)',
          }}
          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 3, repeat: Infinity }}
        />

        <motion.div
          className="relative z-10 flex flex-col items-center text-center"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 240, damping: 20 }}
        >
          <div className="relative mb-5">
            <div
              className="flex items-center justify-center rounded-full text-2xl font-extrabold"
              style={{
                width: 80, height: 80,
                background: 'linear-gradient(135deg, #7f1d1d, #450a0a)',
                border: '2px solid #be123c',
                color: '#fda4af',
              }}
            >
              {initials}
            </div>
            <motion.div
              className="absolute"
              style={{ top: -28, right: -10 }}
              initial={{ y: -40, opacity: 0, rotate: -15 }}
              animate={{ y: 0, opacity: 1, rotate: -8 }}
              transition={{ delay: 0.4, type: 'spring', stiffness: 200, damping: 12 }}
            >
              <svg
                width="32" height="25" viewBox="0 0 28 22" fill="none"
                style={{ filter: 'drop-shadow(0 0 8px rgba(251,191,36,0.9))' }}
              >
                <path d="M2 18L4 8L9 13L14 2L19 13L24 8L26 18Z" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1" strokeLinejoin="round" />
                <rect x="2" y="18" width="24" height="4" rx="1" fill="#d97706" />
                <circle cx="14" cy="3" r="2" fill="#fef08a" />
                <circle cx="4.5" cy="8.5" r="1.5" fill="#fef08a" />
                <circle cx="23.5" cy="8.5" r="1.5" fill="#fef08a" />
              </svg>
            </motion.div>
          </div>

          <p className="mb-1 text-xs font-bold uppercase tracking-widest" style={{ color: '#f43f5e' }}>
            Maximum Achieved
          </p>
          <h2 className="mb-2 text-2xl font-extrabold text-white">You are Transcendent</h2>
          <p className="mb-4 max-w-xs text-sm leading-relaxed" style={{ color: '#9f1239' }}>
            Transcendent · 250. You&apos;ve earned the crown. It now appears on your profile — forever.
          </p>

          <div
            className="mb-5 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold"
            style={{
              background: '#150505', color: '#fda4af',
              border: '1px solid #f43f5e',
              boxShadow: '0 0 16px rgba(244,63,94,0.4)',
            }}
          >
            Transcendent · 250
          </div>

          <motion.button
            className="rounded-xl px-8 py-3 text-sm font-bold text-white"
            style={{
              background: 'linear-gradient(135deg, #be123c, #9f1239)',
              boxShadow: '0 4px 20px rgba(190,18,60,0.4)',
            }}
            whileTap={{ scale: 0.97 }}
            onClick={claimCrown}
          >
            Claim Your Crown
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
