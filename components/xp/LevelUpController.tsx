'use client'

import { useAppStore } from '@/store/useAppStore'
import { LevelUpSheet } from './LevelUpSheet'
import { TierUpModal } from './TierUpModal'
import { CrownCeremony } from './CrownCeremony'

export function LevelUpController() {
  const pendingLevelUpResult = useAppStore((s) => s.pendingLevelUpResult)
  const clearLevelUpResult = useAppStore((s) => s.clearLevelUpResult)
  const xpState = useAppStore((s) => s.xpState)

  if (!pendingLevelUpResult || pendingLevelUpResult.kind === 'none') return null

  if (pendingLevelUpResult.kind === 'crown') {
    return <CrownCeremony result={pendingLevelUpResult} />
  }

  if (pendingLevelUpResult.kind === 'tier-up') {
    return (
      <TierUpModal
        result={pendingLevelUpResult}
        totalXp={xpState.total}
        onDismiss={clearLevelUpResult}
      />
    )
  }

  if (pendingLevelUpResult.kind === 'level-up') {
    return (
      <LevelUpSheet
        result={pendingLevelUpResult}
        totalXp={xpState.total}
        onDismiss={clearLevelUpResult}
      />
    )
  }

  return null
}
