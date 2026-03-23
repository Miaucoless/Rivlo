import { NextRequest, NextResponse } from 'next/server'

type NinjasCalorieResult = {
  name: string
  calories_per_hour: number
  duration_minutes: number
  total_calories: number
}

export async function GET(req: NextRequest) {
  const activity = req.nextUrl.searchParams.get('activity')?.trim()
  const weightKg = req.nextUrl.searchParams.get('weight_kg')
  const durationMin = req.nextUrl.searchParams.get('duration_min')

  if (!activity) return NextResponse.json(null)

  const key = process.env.API_NINJAS_KEY
  if (!key) return NextResponse.json(null)

  try {
    const params = new URLSearchParams({ activity })
    if (weightKg) params.set('weight', weightKg)
    if (durationMin) params.set('duration', durationMin)

    const res = await fetch(
      `https://api.api-ninjas.com/v1/caloriesburned?${params}`,
      { headers: { 'X-Api-Key': key }, next: { revalidate: 3600 } }
    )
    if (!res.ok) return NextResponse.json(null)

    const data: NinjasCalorieResult[] = await res.json()
    if (!Array.isArray(data) || data.length === 0) return NextResponse.json(null)

    // Find the closest match by name similarity, else use first result
    const lower = activity.toLowerCase()
    const best = data.find((r) => r.name.toLowerCase().includes(lower)) ?? data[0]

    return NextResponse.json({
      name: best.name,
      calories_per_hour: best.calories_per_hour,
      total_calories: best.total_calories,
    })
  } catch {
    return NextResponse.json(null)
  }
}
