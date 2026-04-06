// components/workout/ProgressionSuggestion.tsx
'use client'

import type { JournalEntry, MuscleGroup, WorkoutLog } from '@/types'
import type { SuggestionType } from '@/lib/progression-suggestions'
import { useProgressionSuggestion } from '@/hooks/useProgressionSuggestion'

interface Props {
  exerciseId: string
  exerciseName: string
  muscleGroups: MuscleGroup[]
  workoutLogs: WorkoutLog[]
  journalEntries?: JournalEntry[]
  completedSetsThisSession?: Array<{ actual_reps: number; weight_kg: number }>
  onApply: (weight_kg: number) => void
}

const HAS_APPLY_BUTTON: ReadonlyArray<SuggestionType> = ['increase', 'streak', 'decrease', 'absence']

export function ProgressionSuggestion({
  exerciseId,
  exerciseName,
  muscleGroups,
  workoutLogs,
  journalEntries,
  completedSetsThisSession,
  onApply,
}: Props) {
  const { suggestion, shouldShow, dismiss, apply } = useProgressionSuggestion({
    exerciseId,
    exerciseName,
    muscleGroups,
    workoutLogs,
    journalEntries,
    completedSetsThisSession,
  })

  if (!shouldShow || !suggestion) return null

  const isStreak = suggestion.type === 'streak'
  const showApply = HAS_APPLY_BUTTON.includes(suggestion.type)

  function handleApply() {
    const kg = apply()
    if (kg !== null) {
      onApply(kg)
      dismiss()
    }
  }

  return (
    <div className="mt-2.5 flex items-center gap-2 border-t border-border/60 pt-2.5">
      <span
        className={`flex-1 text-xs leading-snug ${
          isStreak ? 'text-emerald-400/85' : 'text-emerald-400/60'
        }`}
      >
        {suggestion.text}
      </span>
      {showApply && (
        <button
          type="button"
          onClick={handleApply}
          className="whitespace-nowrap text-xs underline underline-offset-2 text-emerald-400/55 hover:text-emerald-400/90 transition-colors"
        >
          Apply
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        className="text-xs text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors px-0.5"
        aria-label="Dismiss suggestion"
      >
        ✕
      </button>
    </div>
  )
}
