// components/workout/ProgressionSuggestion.tsx
'use client'

import type { JournalEntry, MuscleGroup, WorkoutLog, ExercisePrimaryType, ExerciseModifier } from '@/types'
import type { SuggestionType } from '@/lib/progression-suggestions'
import { useProgressionSuggestion } from '@/hooks/useProgressionSuggestion'

interface Props {
  exerciseId: string
  exerciseName: string
  muscleGroups: MuscleGroup[]
  equipment?: string
  primaryType?: ExercisePrimaryType
  modifiers?: ExerciseModifier[]
  workoutLogs: WorkoutLog[]
  journalEntries?: JournalEntry[]
  completedSetsThisSession?: Array<{ actual_reps: number; weight_kg: number }>
  unitSystem?: 'imperial' | 'metric'
  onApply: (weight_kg: number) => void
}

/** Suggestion types that carry a specific weight the user can apply to all sets. */
const HAS_APPLY_BUTTON: ReadonlyArray<SuggestionType> = [
  'increase_load',
  'top_set_only_increase',
  'reduce_and_rebuild',
  'absence',
  'reduce_assistance',
]

/** Suggestion types rendered with brighter emphasis (most actionable). */
const HIGH_PRIORITY: ReadonlyArray<SuggestionType> = ['increase_load', 'reduce_and_rebuild']

export function ProgressionSuggestion({
  exerciseId,
  exerciseName,
  muscleGroups,
  equipment,
  primaryType,
  modifiers,
  workoutLogs,
  journalEntries,
  completedSetsThisSession,
  unitSystem,
  onApply,
}: Props) {
  const { suggestion, shouldShow, dismiss, apply } = useProgressionSuggestion({
    exerciseId,
    exerciseName,
    muscleGroups,
    equipment,
    primaryType,
    modifiers,
    workoutLogs,
    journalEntries,
    completedSetsThisSession,
    unitSystem,
  })

  if (!shouldShow || !suggestion) return null

  const isHighPriority = HIGH_PRIORITY.includes(suggestion.type)
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
          isHighPriority ? 'text-emerald-400/85' : 'text-emerald-400/60'
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
