import { NextRequest, NextResponse } from 'next/server'
import { getRedisJson, hasRedisClient, normalizeRedisKeyPart, setRedisJson, withRedisCacheHeader } from '@/lib/redis'

type NinjasRecipe = {
  title: string
  ingredients: string       // pipe-separated: "2 cups flour|1 egg|..."
  servings: string          // e.g. "4 servings"
  instructions: string
  calories: number
  protein_g: number
  carbohydrates_total_g: number
  fat_total_g: number
}

function inferMealType(title: string): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
  const t = title.toLowerCase()
  if (/pancake|waffle|oatmeal|omelette|omelet|scramble|french toast|muffin|breakfast|smoothie bowl|granola/.test(t)) return 'breakfast'
  if (/sandwich|wrap|salad|soup|bowl/.test(t)) return 'lunch'
  if (/cookie|brownie|bar|bite|ball|popcorn|chip|dip|hummus|trail/.test(t)) return 'snack'
  return 'dinner'
}

function parseServings(s: string): number {
  const m = s.match(/\d+/)
  return m ? Math.max(1, parseInt(m[0])) : 1
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('query')?.trim()
  if (!query) return NextResponse.json([])

  const key = process.env.API_NINJAS_KEY
  if (!key) return NextResponse.json({ error: 'API key not configured' }, { status: 500 })

  const cacheEnabled = hasRedisClient()
  const cacheKey = `recipes:v1:${normalizeRedisKeyPart(query)}`

  if (cacheEnabled) {
    const cached = await getRedisJson<unknown[]>(cacheKey)
    if (cached !== null) {
      return withRedisCacheHeader(NextResponse.json(cached), 'hit')
    }
  }

  try {
    const res = await fetch(
      `https://api.api-ninjas.com/v1/recipe?query=${encodeURIComponent(query)}`,
      { headers: { 'X-Api-Key': key }, next: { revalidate: 3600 } }
    )
    if (!res.ok) return withRedisCacheHeader(NextResponse.json([]), cacheEnabled ? 'miss' : 'skip')

    const raw: NinjasRecipe[] = await res.json()

    const recipes = raw.map((r, i) => {
      const servings = parseServings(r.servings)
      const meal_type = inferMealType(r.title)

      // Parse pipe-separated ingredients into ingredient objects
      const ingredients = r.ingredients
        .split('|')
        .map((ing, j) => ({
          id: `ninja-${i}-${j}`,
          name: ing.trim(),
          amount: 1,
          unit: 'serving',
          calories_per_unit: 0,
          macros: { protein_g: 0, carbs_g: 0, fat_g: 0 },
        }))
        .filter(ing => ing.name.length > 0)

      return {
        id: `ninja-${Date.now()}-${i}`,
        name: r.title,
        description: `${r.servings} · from API Ninjas`,
        meal_type,
        prep_time_min: 10,
        cook_time_min: 20,
        servings,
        ingredients,
        instructions: r.instructions
          .split(/\.\s+/)
          .map(s => s.trim())
          .filter(Boolean),
        macros: {
          calories: Math.round(r.calories / servings),
          protein_g: Math.round(r.protein_g / servings),
          carbs_g: Math.round(r.carbohydrates_total_g / servings),
          fat_g: Math.round(r.fat_total_g / servings),
          fiber_g: 0,
        },
        tags: [meal_type, 'live-search'],
        source: 'api-ninjas' as const,
      }
    })

    if (cacheEnabled) {
      await setRedisJson(cacheKey, recipes, 60 * 60 * 24)
    }

    return withRedisCacheHeader(NextResponse.json(recipes), cacheEnabled ? 'miss' : 'skip')
  } catch {
    return withRedisCacheHeader(NextResponse.json([]), cacheEnabled ? 'miss' : 'skip')
  }
}
