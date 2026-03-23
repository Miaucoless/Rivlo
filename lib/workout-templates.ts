import { createClient } from '@/lib/supabase'
import type { Workout } from '@/types'

type WorkoutTemplateRow = {
  id: string
  user_id: string
  name: string
  description: string
  day_label: string
  muscle_groups: Workout['muscle_groups']
  exercises: Workout['exercises']
  estimated_duration_min: number
  difficulty: Workout['difficulty']
  split_type: Workout['split_type']
  source: Workout['source']
  updated_at: string
  created_at: string
}

export type WorkoutTemplateResponse = {
  success: boolean
  error?: string
  workouts?: Workout[]
  workout?: Workout
}

function rowToWorkout(row: WorkoutTemplateRow): Workout {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    day_label: row.day_label,
    muscle_groups: row.muscle_groups || [],
    exercises: row.exercises || [],
    estimated_duration_min: row.estimated_duration_min,
    difficulty: row.difficulty,
    split_type: row.split_type,
    source: row.source || 'custom',
    updated_at: row.updated_at,
  }
}

function workoutToRow(userId: string, workout: Workout) {
  return {
    id: workout.id,
    user_id: userId,
    name: workout.name,
    description: workout.description,
    day_label: workout.day_label,
    muscle_groups: workout.muscle_groups,
    exercises: workout.exercises,
    estimated_duration_min: workout.estimated_duration_min,
    difficulty: workout.difficulty,
    split_type: workout.split_type,
    source: workout.source || 'custom',
    updated_at: workout.updated_at || new Date().toISOString(),
  }
}

export async function fetchUserWorkoutTemplates(userId: string): Promise<WorkoutTemplateResponse> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('workout_templates')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (error) {
      return { success: false, error: error.message }
    }

    return {
      success: true,
      workouts: (data as WorkoutTemplateRow[]).map(rowToWorkout),
    }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function createUserWorkoutTemplate(userId: string, workout: Workout): Promise<WorkoutTemplateResponse> {
  try {
    const supabase = createClient()
    const payload = workoutToRow(userId, {
      ...workout,
      source: 'custom',
      updated_at: new Date().toISOString(),
    })

    const { data, error } = await supabase
      .from('workout_templates')
      .insert(payload)
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    return {
      success: true,
      workout: rowToWorkout(data as WorkoutTemplateRow),
    }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function updateUserWorkoutTemplate(userId: string, workoutId: string, workout: Workout): Promise<WorkoutTemplateResponse> {
  try {
    const supabase = createClient()
    const payload = workoutToRow(userId, {
      ...workout,
      id: workoutId,
      source: 'custom',
      updated_at: new Date().toISOString(),
    })

    const { data, error } = await supabase
      .from('workout_templates')
      .update(payload)
      .eq('id', workoutId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    return {
      success: true,
      workout: rowToWorkout(data as WorkoutTemplateRow),
    }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function deleteUserWorkoutTemplate(userId: string, workoutId: string): Promise<WorkoutTemplateResponse> {
  try {
    const supabase = createClient()
    const { error } = await supabase
      .from('workout_templates')
      .delete()
      .eq('id', workoutId)
      .eq('user_id', userId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}
