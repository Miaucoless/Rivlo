import { NextRequest, NextResponse } from 'next/server'
import { getRedisJson, hasRedisClient, normalizeRedisKeyPart, rateLimit, setRedisJson, withRedisCacheHeader } from '@/lib/redis'

type NinjasCalorieResult = {
  name: string
  calories_per_hour: number
  duration_minutes: number
  total_calories: number
}

type CaloriesBurnedResponse = {
  name: string
  calories_per_hour: number
  total_calories: number
} | null

export async function GET(req: NextRequest) {
  const limited = await rateLimit(req, { limit: 30, windowSec: 60, prefix: 'calories-burned' })
  if (limited) return limited

  const activity = req.nextUrl.searchParams.get('activity')?.trim()
  const weightKg = req.nextUrl.searchParams.get('weight_kg')
  const durationMin = req.nextUrl.searchParams.get('duration_min')

  if (!activity) return NextResponse.json(null)

  const key = process.env.API_NINJAS_KEY
  if (!key) return NextResponse.json(null)

  const cacheEnabled = hasRedisClient()
  const cacheKey = `calories-burned:v1:${normalizeRedisKeyPart(activity)}:${weightKg ?? 'default'}:${durationMin ?? 'default'}`

  if (cacheEnabled) {
    const cached = await getRedisJson<{ data: CaloriesBurnedResponse }>(cacheKey)
    if (cached !== null) {
      return withRedisCacheHeader(NextResponse.json(cached.data), 'hit')
    }
  }

  try {
    const params = new URLSearchParams({ activity })
    if (weightKg) params.set('weight', weightKg)
    if (durationMin) params.set('duration', durationMin)

    const res = await fetch(
      `https://api.api-ninjas.com/v1/caloriesburned?${params}`,
      { headers: { 'X-Api-Key': key }, next: { revalidate: 3600 } }
    )
    if (!res.ok) return withRedisCacheHeader(NextResponse.json(null), cacheEnabled ? 'miss' : 'skip')

    const data: NinjasCalorieResult[] = await res.json()
    if (!Array.isArray(data) || data.length === 0) {
      return withRedisCacheHeader(NextResponse.json(null), cacheEnabled ? 'miss' : 'skip')
    }

    // Find the closest match by name similarity, else use first result
    const lower = activity.toLowerCase()
    const best = data.find((r) => r.name.toLowerCase().includes(lower)) ?? data[0]

    const payload = {
      name: best.name,
      calories_per_hour: best.calories_per_hour,
      total_calories: best.total_calories,
    }

    if (cacheEnabled) {
      await setRedisJson(cacheKey, { data: payload }, 60 * 60 * 24)
    }

    return withRedisCacheHeader(NextResponse.json(payload), cacheEnabled ? 'miss' : 'skip')
  } catch {
    return withRedisCacheHeader(NextResponse.json(null), cacheEnabled ? 'miss' : 'skip')
  }
}
