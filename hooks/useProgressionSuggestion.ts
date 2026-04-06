// hooks/useProgressionSuggestion.ts
import { useCallback, useMemo, useState } from 'react'
import {
  getProgressionSuggestion,
  getSuggestionSignature,
  type SuggestionInput,
  type ProgressionSuggestion,
} from '@/lib/progression-suggestions'

const STORAGE_KEY = 'rivora-progression-dismissed'

function readDismissed(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

function writeDismissed(record: Record<string, string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
  } catch {
    // localStorage unavailable (SSR, private mode) — silently ignore
  }
}

export function useProgressionSuggestion(input: SuggestionInput): {
  suggestion: ProgressionSuggestion | null
  shouldShow: boolean
  dismiss: () => void
  apply: () => number | null
} {
  const { exerciseId, workoutLogs } = input

  const suggestion = useMemo(
    () => getProgressionSuggestion(input),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [exerciseId, workoutLogs, input.completedSetsThisSession, input.journalEntries]
  )

  const currentSignature = useMemo(
    () => getSuggestionSignature(exerciseId, workoutLogs),
    [exerciseId, workoutLogs]
  )

  // Track dismissal in local state so shouldShow re-evaluates immediately on dismiss
  const [dismissed, setDismissed] = useState<string | null>(() => {
    return readDismissed()[exerciseId] ?? null
  })

  const shouldShow = suggestion !== null && currentSignature !== null && currentSignature !== dismissed

  const dismiss = useCallback(() => {
    if (!currentSignature) return
    setDismissed(currentSignature)
    const record = readDismissed()
    record[exerciseId] = currentSignature
    writeDismissed(record)
  }, [exerciseId, currentSignature])

  const apply = useCallback((): number | null => {
    return suggestion?.suggestedWeight_kg ?? null
  }, [suggestion])

  return { suggestion, shouldShow, dismiss, apply }
}
