import { NextRequest, NextResponse } from 'next/server'
import type { FoodCatalogItem } from '@/lib/food-search'
import { getRedisClient, getRedisJson, rateLimit, setRedisJson } from '@/lib/redis'

type OpenFoodFactsProduct = {
  code?: string
  product_name?: string
  product_name_en?: string
  brands?: string
  serving_size?: string
  nutriments?: {
    [key: string]: number | string | undefined
  }
}

type UsdaSearchFood = {
  fdcId?: number
  description?: string
  brandOwner?: string
  servingSize?: number
  servingSizeUnit?: string
  foodNutrients?: Array<{
    nutrientId?: number
    value?: number
  }>
}

type UsdaSearchResponse = {
  foods?: UsdaSearchFood[]
}

type FatSecretFood = {
  food_id?: string
  food_name?: string
  brand_name?: string
  food_type?: string
  food_description?: string
}

type FatSecretResponse = {
  foods?: {
    food?: FatSecretFood | FatSecretFood[]
  }
}

const UNIT_ALIASES: Record<string, string[]> = {
  serving: ['serving', 'servings', 'srv'],
  cup: ['cup', 'cups', 'c'],
  tbsp: ['tbsp', 'tablespoon', 'tablespoons'],
  tsp: ['tsp', 'teaspoon', 'teaspoons'],
  oz: ['oz', 'ounce', 'ounces'],
  g: ['g', 'gram', 'grams'],
  ml: ['ml', 'milliliter', 'milliliters'],
  slice: ['slice', 'slices'],
  piece: ['piece', 'pieces', 'pc'],
}

let fatSecretAccessToken: string | null = null
let fatSecretTokenExpiresAt = 0
const FOOD_SEARCH_CACHE_TTL_SECONDS = 60 * 60 * 24
const FOOD_SEARCH_CACHE_VERSION = 'v1'

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/['''`]/g, '') // strip apostrophes so "mcdonald's" → "mcdonalds"
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(text: string) {
  return normalize(text).split(' ').filter(Boolean)
}

function canonicalUnit(unit: string): string {
  const cleaned = normalize(unit)
  if (!cleaned) return 'serving'
  for (const [canonical, aliases] of Object.entries(UNIT_ALIASES)) {
    if (aliases.includes(cleaned)) return canonical
  }
  return cleaned
}

function toNumber(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function kcalFromKj(kj?: number) {
  if (kj === undefined) return undefined
  return kj / 4.184
}

function parseServingSizeText(servingSize?: string) {
  if (!servingSize) {
    return { amount: 1, unit: 'serving', label: '1 serving', gramsPerServing: undefined as number | undefined }
  }

  const cleaned = servingSize.trim()
  const baseMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*([a-zA-Z]+)/)
  const gramsMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*g/i)

  return {
    amount: baseMatch ? Number(baseMatch[1]) : 1,
    unit: baseMatch ? canonicalUnit(baseMatch[2]) : 'serving',
    label: cleaned,
    gramsPerServing: gramsMatch ? Number(gramsMatch[1]) : undefined,
  }
}

function normalizeOpenFoodFactsProduct(product: OpenFoodFactsProduct): FoodCatalogItem | null {
  const rawName = (product.product_name_en || product.product_name || '').trim()
  if (!rawName) return null

  const serving = parseServingSizeText(product.serving_size)
  const nutriments = product.nutriments || {}

  const byServing = {
    calories: toNumber(nutriments['energy-kcal_serving']) ?? toNumber(nutriments['energy-kcal']),
    protein_g: toNumber(nutriments.proteins_serving) ?? toNumber(nutriments.proteins),
    carbs_g: toNumber(nutriments.carbohydrates_serving) ?? toNumber(nutriments.carbohydrates),
    fat_g: toNumber(nutriments.fat_serving) ?? toNumber(nutriments.fat),
  }

  const by100g = {
    calories:
      toNumber(nutriments['energy-kcal_100g']) ??
      kcalFromKj(toNumber(nutriments.energy_100g)) ??
      toNumber(nutriments['energy-kcal']),
    protein_g: toNumber(nutriments.proteins_100g) ?? toNumber(nutriments.proteins),
    carbs_g: toNumber(nutriments.carbohydrates_100g) ?? toNumber(nutriments.carbohydrates),
    fat_g: toNumber(nutriments.fat_100g) ?? toNumber(nutriments.fat),
  }

  const hasServingMacros = typeof byServing.calories === 'number' && Number.isFinite(byServing.calories)
  const has100gMacros = typeof by100g.calories === 'number' && Number.isFinite(by100g.calories)
  if (!hasServingMacros && !has100gMacros) return null

  const macros = hasServingMacros
    ? {
        calories: byServing.calories as number,
        protein_g: byServing.protein_g ?? 0,
        carbs_g: byServing.carbs_g ?? 0,
        fat_g: byServing.fat_g ?? 0,
      }
    : {
        calories: by100g.calories as number,
        protein_g: by100g.protein_g ?? 0,
        carbs_g: by100g.carbs_g ?? 0,
        fat_g: by100g.fat_g ?? 0,
      }

  const nameWithBrand = product.brands ? `${rawName} (${product.brands})` : rawName

  return {
    id: `off-${product.code || normalize(nameWithBrand).replace(/\s+/g, '-')}`,
    name: nameWithBrand,
    aliases: [rawName],
    default_serving_amount: hasServingMacros ? serving.amount : 100,
    default_serving_unit: hasServingMacros ? serving.unit : 'g',
    default_serving_label: hasServingMacros ? serving.label : '100 g',
    grams_per_serving: serving.gramsPerServing,
    macros_per_serving: macros,
  }
}

function getUsdaNutrient(food: UsdaSearchFood, nutrientId: number) {
  const match = (food.foodNutrients || []).find((n) => n.nutrientId === nutrientId)
  return typeof match?.value === 'number' && Number.isFinite(match.value) ? match.value : undefined
}

function normalizeUsdaFood(food: UsdaSearchFood): FoodCatalogItem | null {
  const name = (food.description || '').trim()
  if (!name) return null

  const calories = getUsdaNutrient(food, 1008)
  const protein = getUsdaNutrient(food, 1003)
  const carbs = getUsdaNutrient(food, 1005)
  const fat = getUsdaNutrient(food, 1004)
  if (calories === undefined || protein === undefined || carbs === undefined || fat === undefined) {
    return null
  }

  const servingAmount =
    typeof food.servingSize === 'number' && Number.isFinite(food.servingSize) && food.servingSize > 0
      ? food.servingSize
      : 100

  const servingUnit = canonicalUnit(food.servingSizeUnit || 'g')
  const brandSuffix = food.brandOwner ? ` (${food.brandOwner})` : ''

  return {
    id: `usda-${food.fdcId || normalize(name).replace(/\s+/g, '-')}`,
    name: `${name}${brandSuffix}`,
    aliases: [name],
    default_serving_amount: servingAmount,
    default_serving_unit: servingUnit,
    default_serving_label: `${servingAmount} ${servingUnit}`,
    macros_per_serving: {
      calories,
      protein_g: protein,
      carbs_g: carbs,
      fat_g: fat,
    },
  }
}

function normalizeFatSecretFood(food: FatSecretFood): FoodCatalogItem | null {
  const rawName = (food.food_name || '').trim()
  if (!rawName) return null

  const description = (food.food_description || '').trim()
  const perMatch = description.match(/^Per\s+([^\-]+)\s+-/i)
  const caloriesMatch = description.match(/Calories:\s*([0-9.]+)kcal/i)
  const fatMatch = description.match(/Fat:\s*([0-9.]+)g/i)
  const carbsMatch = description.match(/Carbs:\s*([0-9.]+)g/i)
  const proteinMatch = description.match(/Protein:\s*([0-9.]+)g/i)

  const calories = caloriesMatch ? Number(caloriesMatch[1]) : undefined
  const fat = fatMatch ? Number(fatMatch[1]) : undefined
  const carbs = carbsMatch ? Number(carbsMatch[1]) : undefined
  const protein = proteinMatch ? Number(proteinMatch[1]) : undefined
  if (
    calories === undefined ||
    !Number.isFinite(calories) ||
    protein === undefined ||
    carbs === undefined ||
    fat === undefined
  ) {
    return null
  }

  const portionText = perMatch ? perMatch[1].trim() : '1 serving'
  const parsedServing = parseServingSizeText(portionText)
  const brandName = (food.brand_name || '').trim()
  const nameWithBrand = brandName ? `${rawName} (${brandName})` : rawName

  // Append size/portion to name so "Small", "Medium", "Large" variants are distinct
  const sizeMatch = portionText.match(/\b(small|medium|large|regular|king\s*size|mini|xl|extra\s*large|junior|grande|venti|tall)\b/i)
  const displayName = sizeMatch ? `${nameWithBrand} - ${sizeMatch[0].trim()}` : nameWithBrand

  return {
    id: `fatsecret-${food.food_id || normalize(nameWithBrand).replace(/\s+/g, '-')}`,
    name: displayName,
    aliases: [rawName, nameWithBrand],
    default_serving_amount: parsedServing.amount,
    default_serving_unit: parsedServing.unit,
    default_serving_label: portionText,
    grams_per_serving: parsedServing.gramsPerServing,
    macros_per_serving: {
      calories,
      protein_g: protein,
      carbs_g: carbs,
      fat_g: fat,
    },
  }
}

function createTimeoutPromise<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs))
  ])
}

async function fetchOpenFoodFacts(query: string) {
  try {
    const response = await createTimeoutPromise(
      fetch(
        `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=250`,
        { method: 'GET', next: { revalidate: 300 } }
      ),
      4000 // 4 second timeout
    )
    if (!response || !response.ok) return []
    const payload = await response.json() as { products?: OpenFoodFactsProduct[] }
    return (payload.products || []).map(normalizeOpenFoodFactsProduct).filter(Boolean) as FoodCatalogItem[]
  } catch {
    return []
  }
}

async function fetchUsdaFoods(query: string) {
  try {
    const apiKey = process.env.USDA_API_KEY || process.env.NEXT_PUBLIC_USDA_API_KEY
    if (!apiKey) return []

    const response = await createTimeoutPromise(
      fetch(
        `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=100&api_key=${encodeURIComponent(apiKey)}`,
        { method: 'GET', next: { revalidate: 300 } }
      ),
      4000 // 4 second timeout
    )
    if (!response || !response.ok) return []
    const payload = await response.json() as UsdaSearchResponse
    return (payload.foods || []).map(normalizeUsdaFood).filter(Boolean) as FoodCatalogItem[]
  } catch {
    return []
  }
}

async function getFatSecretToken() {
  if (fatSecretAccessToken && fatSecretTokenExpiresAt > Date.now() + 60_000) {
    return fatSecretAccessToken
  }

  try {
    const clientId = process.env.FATSECRET_CLIENT_ID
    const clientSecret = process.env.FATSECRET_CLIENT_SECRET
    if (!clientId || !clientSecret) return null

    const formData = new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'basic',
    })

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    const response = await createTimeoutPromise(
      fetch('https://oauth.fatsecret.com/connect/token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
        cache: 'no-store',
      }),
      2000 // 2 second timeout for token
    )
    if (!response || !response.ok) return null

    const payload = await response.json() as { access_token?: string; expires_in?: number }
    if (!payload.access_token) return null

    fatSecretAccessToken = payload.access_token
    fatSecretTokenExpiresAt = Date.now() + ((payload.expires_in || 3600) * 1000)
    return fatSecretAccessToken
  } catch {
    return null
  }
}

async function fetchFatSecretFoods(query: string) {
  try {
    const token = await getFatSecretToken()
    if (!token) return []

    const body = new URLSearchParams({
      method: 'foods.search',
      search_expression: query,
      format: 'json',
      max_results: '50',
      page_number: '0',
    })

    const response = await createTimeoutPromise(
      fetch('https://platform.fatsecret.com/rest/server.api', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
        cache: 'no-store',
      }),
      3000 // 3 second timeout
    )
    if (!response || !response.ok) return []

    const payload = await response.json() as FatSecretResponse
    const foods = payload.foods?.food
    const normalizedFoods = Array.isArray(foods) ? foods : foods ? [foods] : []
    return normalizedFoods.map(normalizeFatSecretFood).filter(Boolean) as FoodCatalogItem[]
  } catch {
    return []
  }
}

function dedupeItems(items: FoodCatalogItem[], query: string) {
  const seen = new Set<string>()
  const normalizedQuery = normalize(query)
  const queryMatchesBrand = items.some((item) => {
    const brand = (item.name.match(/\(([^)]+)\)/) || [])[1] || ''
    return brand && normalize(brand).includes(normalizedQuery)
  })
  return items.filter((item) => {
    const baseName = queryMatchesBrand
      ? normalize(item.name)
      : normalize(item.name.replace(/\s*\([^)]*\)\s*/g, ''))
    // Include calorie count in key so different-sized items (same name, different cals) are kept
    const key = `${baseName}|${Math.round(item.macros_per_serving.calories)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function isNoisyBrandedUsdaItem(item: FoodCatalogItem, query: string) {
  const normalizedName = normalize(item.name)
  const normalizedQuery = normalize(query)
  const isUsda = item.id.startsWith('usda-')
  const hasBrandSuffix = item.name.includes('(') && item.name.includes(')')
  const startsWithQuery = normalizedName.startsWith(normalizedQuery)
  return isUsda && hasBrandSuffix && startsWithQuery
}

function isDishCombination(itemName: string) {
  // Words that indicate a dish/combination rather than a single ingredient
  const combinationKeywords = [' and ', ' with ', ' & ', ' or ', ' plus ', ' mixed with ', ' blend ', ' combo ']
  const lowerName = itemName.toLowerCase()
  return combinationKeywords.some(keyword => lowerName.includes(keyword))
}

function isVariantFood(item: FoodCatalogItem, query: string) {
  const normalizedName = normalize(item.name)
  const normalizedQuery = normalize(query)
  
  // List of common variant words that indicate it's NOT the base food
  const variantKeywords = [
    'vinegar', 'extract', 'essence', 'sauce', 'paste', 'butter', 'spread',
    'noodles', 'pasta', 'flour', 'powder', 'drink', 'juice', 'beverage',
    'dressing', 'oil', 'cooked', 'roasted', 'fried', 'boiled', 'canned',
    'smoothie', 'shake', 'bar', 'chip', 'cracker', 'wrap', 'ready-made',
    'capsule', 'tablet', 'supplement', 'flavor', 'flavored', 'scent',
    'brand specific names ignored', 'nutrition info'
  ]
  
  // If query doesn't contain any variant keywords but the item name does, it might be a variant
  const queryHasVariant = variantKeywords.some(keyword => normalizedQuery.includes(keyword))
  const itemHasVariant = variantKeywords.some(keyword => normalizedName.includes(keyword))
  
  // If item has a variant keyword that query doesn't, it's likely an unwanted variant
  if (itemHasVariant && !queryHasVariant) {
    // Check if the base word (without variant) matches
    const itemBaseWords = normalizedName.split(' ').filter(w => !variantKeywords.includes(w))
    const queryWords = normalizedQuery.split(' ')
    const hasBaseMatch = queryWords.some(qw => itemBaseWords.some(bw => bw === qw || bw.includes(qw)))
    
    // Only mark as variant if there's a base match - else it's just unrelated
    if (hasBaseMatch) {
      return true
    }
  }
  
  return false
}

function scoreItemForQuery(item: FoodCatalogItem, query: string) {
  const normalizedQuery = normalize(query)
  const normalizedName = normalize(item.name)
  const aliases = item.aliases.map(normalize)
  const baseName = normalize(item.name.replace(/\s*\([^)]*\)\s*/g, ''))
  const queryTokens = tokenize(query)
  const nameTokens = tokenize(item.name)

  let score = 0

  if (baseName === normalizedQuery) score += 200
  if (normalizedName === normalizedQuery) score += 180
  if (aliases.includes(normalizedQuery)) score += 140
  if (baseName.startsWith(normalizedQuery)) score += 110
  if (normalizedName.startsWith(normalizedQuery)) score += 90
  if (baseName.includes(normalizedQuery)) score += 60
  if (normalizedName.includes(normalizedQuery)) score += 45

  const tokenOverlap = queryTokens.filter((token) => nameTokens.includes(token)).length
  score += tokenOverlap * 18

  const isGenericLike = !item.name.includes('(')
  if (isGenericLike) score += 30

  const isBuiltIn = item.id.startsWith('food-') || item.id.startsWith('ext-')
  if (isBuiltIn) score += 24

  const isFatSecret = item.id.startsWith('fatsecret-')
  if (isFatSecret) score += 20

  const isUsda = item.id.startsWith('usda-')
  if (isUsda && item.name.includes('(')) score -= 22

  const allCapsName = item.name === item.name.toUpperCase()
  if (allCapsName) score -= 18

  if (item.name.length > 40) score -= 8
  
  // Penalize variant foods
  if (isVariantFood(item, query)) score -= 40

  // Heavily penalize dish combinations when query is a simple ingredient
  const queryIsDishLike = isDishCombination(query)
  const itemIsDish = isDishCombination(item.name)
  if (itemIsDish && !queryIsDishLike) {
    score -= 100 // Strong penalty for dishes when searching for simple ingredients
  }

  return score
}

function filterAndRankItems(items: FoodCatalogItem[], query: string) {
  const normalizedQuery = normalize(query)
  const deduped = items // already deduped before calling this function
  const queryIsDishLike = isDishCombination(query)

  const queryTokens = normalizedQuery.split(' ').filter(Boolean)

  const broadlyFiltered = deduped.filter((item) => {
    if (!normalizedQuery) return true
    const normalizedName = normalize(item.name)
    // Every query token must appear somewhere in the name or an alias (order-independent)
    const nameMatches = queryTokens.every((token) => normalizedName.includes(token))
    const aliasMatches = item.aliases.some((alias) => {
      const normalizedAlias = normalize(alias)
      return queryTokens.every((token) => normalizedAlias.includes(token))
    })
    return nameMatches || aliasMatches
  })

  // First, filter out dishes if query is a simple ingredient
  let afterDishFilter = broadlyFiltered
  if (!queryIsDishLike) {
    afterDishFilter = broadlyFiltered.filter(item => !isDishCombination(item.name))
  }

  // Check if we have generic non-variant matches after dish filtering
  const hasGenericMatches = afterDishFilter.some((item) => 
    !isNoisyBrandedUsdaItem(item, query) && 
    !isVariantFood(item, query) && 
    !item.name.includes('(')
  )

  // If we have good generic matches, filter out variants and branded items
  const cleaned = afterDishFilter.filter((item) => {
    if (!hasGenericMatches) return true
    return !isNoisyBrandedUsdaItem(item, query) && !isVariantFood(item, query)
  })

  return cleaned
    .sort((left, right) => scoreItemForQuery(right, query) - scoreItemForQuery(left, query))
    .slice(0, 200)
}

export async function GET(request: NextRequest) {
  const limited = await rateLimit(request, { limit: 20, windowSec: 60, prefix: 'food-search' })
  if (limited) return limited

  const query = request.nextUrl.searchParams.get('q')?.trim() || ''
  if (query.length < 2) {
    return NextResponse.json({ items: [] })
  }

  const normalizedQuery = normalize(query)
  const cacheKey = `food-search:${FOOD_SEARCH_CACHE_VERSION}:${normalizedQuery}`
  const hasRedis = Boolean(getRedisClient())

  if (hasRedis) {
    const cachedItems = await getRedisJson<FoodCatalogItem[]>(cacheKey)
    if (cachedItems) {
      return NextResponse.json(
        { items: cachedItems, cached: true },
        { headers: { 'x-rivora-cache': 'hit' } }
      )
    }
  }

  const results = await Promise.allSettled([
    fetchFatSecretFoods(query),
    fetchUsdaFoods(query),
    fetchOpenFoodFacts(query),
  ])

  const allItems = results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
  const items = filterAndRankItems(dedupeItems(allItems, query), query)

  if (hasRedis) {
    await setRedisJson(cacheKey, items, FOOD_SEARCH_CACHE_TTL_SECONDS)
  }

  return NextResponse.json(
    { items, cached: false },
    { headers: { 'x-rivora-cache': hasRedis ? 'miss' : 'skip' } }
  )
}
