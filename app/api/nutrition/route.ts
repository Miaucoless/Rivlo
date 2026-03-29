import { NextRequest, NextResponse } from 'next/server'
import { getRedisJson, hasRedisClient, normalizeRedisKeyPart, setRedisJson, withRedisCacheHeader } from '@/lib/redis'

export type NinjasNutritionItem = {
  name: string
  calories: number
  serving_size_g: number
  fat_total_g: number
  fat_saturated_g: number
  protein_g: number
  sodium_mg: number
  potassium_mg: number
  cholesterol_mg: number
  carbohydrates_total_g: number
  fiber_g: number
  sugar_g: number
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('query')?.trim()
  if (!query) return NextResponse.json([])

  const key = process.env.API_NINJAS_KEY
  if (!key) return NextResponse.json([])

  const cacheEnabled = hasRedisClient()
  const cacheKey = `nutrition:v1:${normalizeRedisKeyPart(query)}`

  if (cacheEnabled) {
    const cached = await getRedisJson<NinjasNutritionItem[]>(cacheKey)
    if (cached !== null) {
      return withRedisCacheHeader(NextResponse.json(cached), 'hit')
    }
  }

  try {
    const res = await fetch(
      `https://api.api-ninjas.com/v1/nutrition?query=${encodeURIComponent(query)}`,
      { headers: { 'X-Api-Key': key }, next: { revalidate: 3600 } }
    )
    if (!res.ok) return withRedisCacheHeader(NextResponse.json([]), cacheEnabled ? 'miss' : 'skip')

    const data: NinjasNutritionItem[] = await res.json()
    if (cacheEnabled) {
      await setRedisJson(cacheKey, data, 60 * 60 * 24)
    }

    return withRedisCacheHeader(NextResponse.json(data), cacheEnabled ? 'miss' : 'skip')
  } catch {
    return withRedisCacheHeader(NextResponse.json([]), cacheEnabled ? 'miss' : 'skip')
  }
}
