'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getXpInfo, TIER_STYLES } from '@/lib/xp-system'
import type { LevelUpResult } from '@/types'

interface LevelUpSheetProps {
  result: Extract<LevelUpResult, { kind: 'level-up' }>
  totalXp: number
  onDismiss: () => void
}

export function LevelUpSheet({ result, totalXp, onDismiss }: LevelUpSheetProps) {
  const info = getXpInfo(totalXp)
  const style = TIER_STYLES[result.tierName]

  useEffect(() => {
    const t = setTimeout(onDismiss, 6000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onDismiss}
      >
        <div className="absolute inset-0 bg-black/40" />

        <motion.div
          className="relative z-10 w-full max-w-md rounded-t-2xl px-5 pb-8 pt-4"
          style={{ background: '#0f172a', borderTop: `1px solid ${style.border}` }}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto mb-4 h-1 w-9 rounded-full" style={{ background: '#374151' }} />

          <div className="flex items-start justify-between">
            <div>
              <p className="text-base font-bold text-white">Level Up!</p>
              <p className="text-xs" style={{ color: '#6b7280' }}>
                {result.tierName} · {result.level - 1} → {result.tierName} · {result.level}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold" style={{ color: '#34d399' }}>+{result.xpGained} XP</p>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs" style={{ color: '#6b7280' }}>
              <span>{result.tierName} · {result.level}</span>
              <span>{info.xpIntoLevel} / {info.xpForLevel} XP</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full" style={{ background: '#1e293b' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${style.border}, ${style.text})` }}
                initial={{ width: 0 }}
                animate={{ width: `${info.progressPct}%` }}
                transition={{ delay: 0.3, duration: 0.6, ease: 'easeOut' }}
              />
            </div>
          </div>

          <button
            className="mt-5 w-full rounded-lg py-2.5 text-sm font-semibold"
            style={{ background: '#1e293b', color: '#e5e7eb' }}
            onClick={onDismiss}
          >
            Continue
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
