import { NextRequest, NextResponse } from 'next/server'

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

  try {
    const res = await fetch(
      `https://api.api-ninjas.com/v1/nutrition?query=${encodeURIComponent(query)}`,
      { headers: { 'X-Api-Key': key }, next: { revalidate: 3600 } }
    )
    if (!res.ok) return NextResponse.json([])

    const data: NinjasNutritionItem[] = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json([])
  }
}
