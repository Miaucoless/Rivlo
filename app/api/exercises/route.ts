import { NextRequest, NextResponse } from 'next/server'
import type { ExerciseLibraryItem, MuscleGroup } from '@/types'
import { getRedisJson, hasRedisClient, normalizeRedisKeyPart, setRedisJson, withRedisCacheHeader } from '@/lib/redis'

// ── ExerciseDB (RapidAPI) ─────────────────────────────────────────────────────

type ExerciseDbItem = {
  id: string
  name: string
  bodyPart: string
  equipment: string
  target: string
  secondaryMuscles: string[]
  instructions: string[]
  description?: string
  difficulty?: string
  category?: string
}

const BODY_PART_MAP: Record<string, MuscleGroup> = {
  back: 'back',
  cardio: 'full_body',
  chest: 'chest',
  'lower arms': 'forearms',
  'lower legs': 'calves',
  neck: 'shoulders',
  shoulders: 'shoulders',
  'upper arms': 'biceps',
  'upper legs': 'quads',
  waist: 'core',
}

const TARGET_MAP: Record<string, MuscleGroup> = {
  abs: 'core',
  adductors: 'glutes',
  abductors: 'glutes',
  biceps: 'biceps',
  calves: 'calves',
  'cardiovascular system': 'full_body',
  delts: 'shoulders',
  forearms: 'forearms',
  glutes: 'glutes',
  hamstrings: 'hamstrings',
  lats: 'back',
  'levator scapulae': 'back',
  obliques: 'core',
  pectorals: 'chest',
  quads: 'quads',
  'serratus anterior': 'chest',
  spine: 'back',
  'upper back': 'back',
  traps: 'shoulders',
  triceps: 'triceps',
}

function muscleForExerciseDb(item: ExerciseDbItem): MuscleGroup {
  return TARGET_MAP[item.target] ?? BODY_PART_MAP[item.bodyPart] ?? 'full_body'
}

function difficultyForExerciseDb(d?: string): 'beginner' | 'intermediate' | 'advanced' {
  if (d === 'beginner') return 'beginner'
  if (d === 'advanced' || d === 'expert') return 'advanced'
  return 'intermediate'
}

function primaryTypeForExerciseDb(item: ExerciseDbItem): ExerciseLibraryItem['primary_type'] {
  const cat = (item.category ?? '').toLowerCase()
  const bp = item.bodyPart.toLowerCase()
  if (cat === 'cardio' || bp === 'cardio') return 'mixed'
  if (item.equipment === 'body weight') return 'bodyweight'
  return 'strength'
}

function defaultsForExerciseDb(item: ExerciseDbItem): { sets: number; reps: number; rest: number; met: number } {
  const cat = (item.category ?? '').toLowerCase()
  if (cat === 'cardio') return { sets: 1, reps: 20, rest: 0, met: 7.0 }
  if (cat === 'stretching') return { sets: 3, reps: 30, rest: 30, met: 2.5 }
  if (cat === 'plyometrics') return { sets: 3, reps: 10, rest: 60, met: 6.5 }
  return { sets: 4, reps: 8, rest: 90, met: 5.5 }
}

function mapExerciseDb(item: ExerciseDbItem): ExerciseLibraryItem {
  const muscle = muscleForExerciseDb(item)
  const { sets, reps, rest, met } = defaultsForExerciseDb(item)
  return {
    id: `edb-${item.id}`,
    name: item.name.replace(/\b\w/g, (c) => c.toUpperCase()),
    muscle_groups: [muscle],
    equipment: item.equipment.replace(/\b\w/g, (c) => c.toUpperCase()),
    difficulty: difficultyForExerciseDb(item.difficulty),
    description: item.description ?? item.instructions.slice(0, 2).join(' '),
    instructions: item.instructions,
    default_sets: sets,
    default_reps: reps,
    default_rest_seconds: rest,
    met_base: met,
    primary_type: primaryTypeForExerciseDb(item),
  }
}

// ── API Ninjas fallback ───────────────────────────────────────────────────────

type ApiNinjasExercise = {
  name: string
  type: string
  muscle: string
  equipment: string
  equipments?: string[]
  difficulty: string
  instructions: string
}

const MUSCLE_MAP: Record<string, MuscleGroup> = {
  abdominals: 'core',
  abductors: 'glutes',
  adductors: 'glutes',
  biceps: 'biceps',
  calves: 'calves',
  chest: 'chest',
  forearms: 'forearms',
  glutes: 'glutes',
  hamstrings: 'hamstrings',
  lats: 'back',
  lower_back: 'back',
  middle_back: 'back',
  neck: 'shoulders',
  quadriceps: 'quads',
  traps: 'shoulders',
  triceps: 'triceps',
}

function defaultsForType(type: string): { sets: number; reps: number; rest: number; met: number } {
  switch (type) {
    case 'cardio':                return { sets: 1, reps: 20, rest: 0,   met: 7.0 }
    case 'plyometrics':           return { sets: 3, reps: 10, rest: 60,  met: 6.5 }
    case 'stretching':            return { sets: 3, reps: 30, rest: 30,  met: 2.5 }
    case 'olympic_weightlifting': return { sets: 4, reps: 5,  rest: 120, met: 6.0 }
    case 'strongman':             return { sets: 4, reps: 6,  rest: 120, met: 8.0 }
    default:                      return { sets: 4, reps: 8,  rest: 90,  met: 5.5 }
  }
}

function mapApiNinjas(ex: ApiNinjasExercise): ExerciseLibraryItem {
  const muscle = MUSCLE_MAP[ex.muscle] ?? 'full_body'
  const { sets, reps, rest, met } = defaultsForType(ex.type)
  const difficulty = ex.difficulty === 'expert' ? 'advanced' : (ex.difficulty as 'beginner' | 'intermediate') ?? 'intermediate'
  const primaryType = ex.type === 'cardio' ? 'mixed' : (ex.type === 'plyometrics' || ex.type === 'stretching' ? 'bodyweight' : 'strength')
  return {
    id: `api-${ex.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name: ex.name,
    muscle_groups: [muscle],
    equipment: (ex.equipments && ex.equipments[0]) || ex.equipment || 'Bodyweight',
    difficulty,
    description: ex.instructions.split('. ').slice(0, 2).join('. '),
    instructions: ex.instructions.split('. ').filter(Boolean),
    default_sets: sets,
    default_reps: reps,
    default_rest_seconds: rest,
    met_base: met,
    primary_type: primaryType as ExerciseLibraryItem['primary_type'],
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name') ?? ''
  if (!name.trim()) return NextResponse.json([])

  const cacheEnabled = hasRedisClient()
  const cacheKey = `exercises:v1:${normalizeRedisKeyPart(name)}`

  if (cacheEnabled) {
    const cached = await getRedisJson<ExerciseLibraryItem[]>(cacheKey)
    if (cached !== null) {
      return withRedisCacheHeader(NextResponse.json(cached), 'hit')
    }
  }

  const edbKey = process.env.EXERCISEDB_API_KEY

  // Try ExerciseDB first (1300+ exercises)
  if (edbKey) {
    try {
      const url = `https://exercisedb.p.rapidapi.com/exercises/name/${encodeURIComponent(name.toLowerCase())}?limit=15&offset=0`
      const res = await fetch(url, {
        headers: {
          'x-rapidapi-key': edbKey,
          'x-rapidapi-host': 'exercisedb.p.rapidapi.com',
        },
        next: { revalidate: 86400 },
      })
      if (res.ok) {
        const data: ExerciseDbItem[] = await res.json()
        const payload = data.map(mapExerciseDb)
        if (cacheEnabled) {
          await setRedisJson(cacheKey, payload, 60 * 60 * 24)
        }
        return withRedisCacheHeader(NextResponse.json(payload), cacheEnabled ? 'miss' : 'skip')
      }
    } catch {
      // fall through to API Ninjas
    }
  }

  // Fallback: API Ninjas
  const apiKey = process.env.API_NINJAS_KEY
  if (!apiKey) return NextResponse.json([])

  try {
    const url = `https://api.api-ninjas.com/v1/exercises?name=${encodeURIComponent(name)}`
    const res = await fetch(url, {
      headers: { 'X-Api-Key': apiKey },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return withRedisCacheHeader(NextResponse.json([]), cacheEnabled ? 'miss' : 'skip')
    const data: ApiNinjasExercise[] = await res.json()
    const payload = data.map(mapApiNinjas)
    if (cacheEnabled) {
      await setRedisJson(cacheKey, payload, 60 * 60 * 24)
    }
    return withRedisCacheHeader(NextResponse.json(payload), cacheEnabled ? 'miss' : 'skip')
  } catch {
    return withRedisCacheHeader(NextResponse.json([]), cacheEnabled ? 'miss' : 'skip')
  }
}
