'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { TIER_STYLES, XP_TIERS } from '@/lib/xp-system'
import { XpBadge } from '@/components/ui/XpBadge'
import type { LevelUpResult } from '@/types'

function Particle({ style }: { style: React.CSSProperties }) {
  return (
    <motion.div
      className="pointer-events-none absolute rounded-full"
      style={{ width: 4, height: 4, ...style }}
      animate={{ y: [0, -24, 0], opacity: [0.7, 0.2, 0.7], rotate: [0, 180, 360] }}
      transition={{ duration: 2.5 + Math.random() * 1.5, repeat: Infinity, ease: 'easeInOut' }}
    />
  )
}

const PARTICLES = [
  { left: '15%', top: '20%', background: '#818cf8' },
  { left: '80%', top: '30%', background: '#34d399', width: 3, height: 3 },
  { left: '25%', top: '70%', background: '#f0abfc' },
  { left: '70%', top: '65%', background: '#818cf8', width: 3, height: 3 },
  { left: '50%', top: '15%', background: '#fbbf24', width: 3, height: 3 },
  { left: '40%', top: '80%', background: '#34d399' },
  { left: '88%', top: '55%', background: '#f43f5e', width: 3, height: 3 },
  { left: '10%', top: '50%', background: '#fbbf24' },
]

interface TierUpModalProps {
  result: Extract<LevelUpResult, { kind: 'tier-up' }>
  totalXp: number
  onDismiss: () => void
}

export function TierUpModal({ result, totalXp, onDismiss }: TierUpModalProps) {
  const style = TIER_STYLES[result.newTierName]
  const tierIndex = XP_TIERS.findIndex((t) => t.name === result.newTierName)
  const prevTierName = tierIndex > 0 ? XP_TIERS[tierIndex - 1].name : ''

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
          style={{ background: `radial-gradient(ellipse at center, ${style.bg}dd 0%, #0a0f1a 70%)` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        />

        <div className="absolute inset-0 overflow-hidden">
          {PARTICLES.map((pos, i) => (
            <Particle key={i} style={pos} />
          ))}
        </div>

        <motion.div
          className="relative z-10 flex flex-col items-center text-center"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 260, damping: 20 }}
        >
          <motion.div
            className="mb-5 flex items-center justify-center rounded-full"
            style={{ width: 100, height: 100, border: `2px solid ${style.border}44` }}
            animate={{ boxShadow: [`0 0 0 0 ${style.border}44`, `0 0 0 16px transparent`] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div
              className="flex items-center justify-center rounded-full"
              style={{ width: 80, height: 80, background: style.bg, border: `1px solid ${style.border}` }}
            >
              <XpBadge totalXp={totalXp} size="md" />
            </div>
          </motion.div>

          <p className="mb-1 text-xs font-bold uppercase tracking-widest" style={{ color: style.text }}>
            Tier Unlocked
          </p>
          <h2 className="mb-2 text-2xl font-extrabold text-white">You&apos;ve reached {result.newTierName}</h2>
          <p className="mb-5 max-w-xs text-sm leading-relaxed" style={{ color: '#6b7280' }}>
            Your aura is evolving. Keep pushing your limits.
          </p>

          <div className="mb-6 flex items-center gap-3">
            <span className="text-xs line-through" style={{ color: '#4b5563' }}>{prevTierName} · 50</span>
            <span style={{ color: style.border }}>→</span>
            <XpBadge totalXp={totalXp} size="sm" />
          </div>

          <motion.button
            className="rounded-xl px-8 py-3 text-sm font-bold text-white"
            style={{ background: style.border }}
            whileTap={{ scale: 0.97 }}
            onClick={onDismiss}
          >
            Let&apos;s Go
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
