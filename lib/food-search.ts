import type { Macros } from '@/types'

export interface FoodCatalogItem {
  id: string
  name: string
  aliases: string[]
  default_serving_amount: number
  default_serving_unit: string
  default_serving_label: string
  grams_per_serving?: number
  macros_per_serving: Macros
}

export interface ParsedFoodLine {
  raw: string
  query: string
  amount: number
  unit: string
}

export interface ResolvedFoodEntry {
  input: string
  item: FoodCatalogItem
  amount: number
  unit: string
  multiplier: number
  macros: Macros
}

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

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/['''`]/g, '') // strip apostrophes so "mcdonald's" → "mcdonalds"
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function canonicalUnit(unit: string): string {
  const cleaned = normalize(unit)
  if (!cleaned) return 'serving'
  const entries = Object.entries(UNIT_ALIASES)
  for (const [canonical, aliases] of entries) {
    if (aliases.includes(cleaned)) return canonical
  }
  return cleaned
}

function splitFoodParts(text: string) {
  return text
    .split(/,|\+|\band\b/gi)
    .map((part) => part.trim())
    .filter(Boolean)
}

function parseAmountAndUnit(text: string): ParsedFoodLine {
  const normalizedRaw = text.trim()
  const inParensMatch = normalizedRaw.match(/^(.*)\(([^)]+)\)\s*$/)

  let source = normalizedRaw
  let amount = 1
  let unit = 'serving'

  const parseChunk = (chunk: string) => {
    const numberUnit = chunk.trim().match(/(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?/)
    if (!numberUnit) return null
    return {
      amount: Number(numberUnit[1]),
      unit: canonicalUnit(numberUnit[2] || 'serving'),
    }
  }

  if (inParensMatch) {
    source = inParensMatch[1].trim()
    const parsed = parseChunk(inParensMatch[2])
    if (parsed && Number.isFinite(parsed.amount) && parsed.amount > 0) {
      amount = parsed.amount
      unit = parsed.unit
    }
  } else {
    const leading = normalizedRaw.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?\s+(.+)$/)
    if (leading) {
      amount = Number(leading[1])
      unit = canonicalUnit(leading[2] || 'serving')
      source = leading[3].trim()
    }
  }

  return {
    raw: normalizedRaw,
    query: source,
    amount: Number.isFinite(amount) && amount > 0 ? amount : 1,
    unit,
  }
}

function scoreQueryAgainstItem(query: string, item: FoodCatalogItem) {
  const q = normalize(query)
  if (!q) return 0

  const candidates = [item.name, ...item.aliases].map(normalize)

  let best = 0
  for (const candidate of candidates) {
    if (candidate === q) {
      best = Math.max(best, 1)
      continue
    }
    if (candidate.includes(q) || q.includes(candidate)) {
      best = Math.max(best, 0.9)
    }

    const qTokens = q.split(' ')
    const cTokens = candidate.split(' ')
    const overlap = qTokens.filter((token) => cTokens.includes(token)).length
    const tokenScore = overlap / Math.max(qTokens.length, cTokens.length)
    best = Math.max(best, tokenScore)
  }

  return best
}

const LIVE_CACHE = new Map<string, FoodCatalogItem>()
const LIVE_FETCHED_QUERIES = new Map<string, number>()
const FETCH_TTL_MS = 5 * 60 * 1000

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

function getMultiplier(item: FoodCatalogItem, amount: number, unit: string) {
  const canonical = canonicalUnit(unit)
  const itemUnit = canonicalUnit(item.default_serving_unit)

  if (canonical === itemUnit) {
    return amount / item.default_serving_amount
  }

  if (canonical === 'serving') {
    return amount
  }

  if (canonical === 'g' && item.grams_per_serving && item.grams_per_serving > 0) {
    return amount / item.grams_per_serving
  }

  return amount
}

function scaleMacros(macros: Macros, multiplier: number): Macros {
  return {
    calories: macros.calories * multiplier,
    protein_g: macros.protein_g * multiplier,
    carbs_g: macros.carbs_g * multiplier,
    fat_g: macros.fat_g * multiplier,
  }
}

export function findFoodMatch(query: string, threshold = 0.35) {
  const catalog = [...FOOD_CATALOG, ...EXTENDED_FOOD_CATALOG, ...Array.from(LIVE_CACHE.values())]
  const scored = catalog
    .map((item) => ({ item, score: scoreQueryAgainstItem(query, item) }))
    .sort((a, b) => b.score - a.score)

  const best = scored[0]
  if (!best || best.score < threshold) return null
  return best.item
}

export function resolveFoodLine(line: string): ResolvedFoodEntry | null {
  const parsed = parseAmountAndUnit(line)
  const match = findFoodMatch(parsed.query)
  if (!match) return null

  const multiplier = getMultiplier(match, parsed.amount, parsed.unit)
  return {
    input: line,
    item: match,
    amount: parsed.amount,
    unit: parsed.unit,
    multiplier,
    macros: scaleMacros(match.macros_per_serving, multiplier),
  }
}

export function resolveFoodsFromText(input: string) {
  const parts = splitFoodParts(input)
  const resolved: ResolvedFoodEntry[] = []
  const unresolved: string[] = []

  parts.forEach((part) => {
    const entry = resolveFoodLine(part)
    if (entry) {
      resolved.push(entry)
    } else {
      unresolved.push(part)
    }
  })

  return { resolved, unresolved }
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

function normalizeRemoteProduct(product: OpenFoodFactsProduct): FoodCatalogItem | null {
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

  if (
    calories === undefined ||
    protein === undefined ||
    carbs === undefined ||
    fat === undefined
  ) {
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

export function getKnownFoodCatalog() {
  return [...FOOD_CATALOG, ...EXTENDED_FOOD_CATALOG, ...EXTRA_FOOD_CATALOG, ...Array.from(LIVE_CACHE.values())]
}

export async function primeFoodSearchCache(query: string) {
  const normalizedQuery = normalize(query)
  if (!normalizedQuery || normalizedQuery.length < 2) return 0
  const lastFetchedAt = LIVE_FETCHED_QUERIES.get(normalizedQuery)
  if (lastFetchedAt && Date.now() - lastFetchedAt < FETCH_TTL_MS) return 0

  LIVE_FETCHED_QUERIES.set(normalizedQuery, Date.now())

  try {
    const response = await fetch(`/api/food-search?q=${encodeURIComponent(normalizedQuery)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) return 0

    const payload = await response.json() as { items?: FoodCatalogItem[] }
    const items = payload.items || []
    let inserted = 0

    items.forEach((item) => {
      if (!LIVE_CACHE.has(item.id)) {
        LIVE_CACHE.set(item.id, item)
        inserted += 1
      }
    })

    return inserted
  } catch {
    return 0
  }
}

export async function resolveFoodLineSmart(line: string) {
  const parsed = parseAmountAndUnit(line)
  await primeFoodSearchCache(parsed.query)
  return resolveFoodLine(line)
}

export async function resolveFoodsFromTextSmart(input: string) {
  const parts = splitFoodParts(input)
  const resolved: ResolvedFoodEntry[] = []
  const unresolved: string[] = []

  const outcomes = await Promise.all(parts.map((part) => resolveFoodLineSmart(part)))

  outcomes.forEach((entry, index) => {
    if (entry) {
      resolved.push(entry)
    } else {
      unresolved.push(parts[index])
    }
  })

  return { resolved, unresolved }
}

export function sumMacros(entries: Array<{ macros: Macros }>): Macros {
  return entries.reduce(
    (acc, entry) => ({
      calories: acc.calories + entry.macros.calories,
      protein_g: acc.protein_g + entry.macros.protein_g,
      carbs_g: acc.carbs_g + entry.macros.carbs_g,
      fat_g: acc.fat_g + entry.macros.fat_g,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  )
}

export const FOOD_CATALOG: FoodCatalogItem[] = [
  {
    id: 'food-iceberg-lettuce',
    name: 'Iceberg lettuce',
    aliases: ['lettuce', 'iceberg', 'iceberg lettuce'],
    default_serving_amount: 1,
    default_serving_unit: 'cup',
    default_serving_label: '1 cup shredded',
    grams_per_serving: 72,
    macros_per_serving: { calories: 10, protein_g: 0.6, carbs_g: 2.3, fat_g: 0.1 },
  },
  {
    id: 'food-babybel-cheese',
    name: 'Babybel cheese',
    aliases: ['babybel', 'mini babybel', 'baby bell cheese'],
    default_serving_amount: 1,
    default_serving_unit: 'serving',
    default_serving_label: '1 mini wheel',
    grams_per_serving: 20,
    macros_per_serving: { calories: 70, protein_g: 5, carbs_g: 0, fat_g: 6 },
  },
  {
    id: 'food-big-mac',
    name: 'Big Mac',
    aliases: ['big mac', 'mcdonalds big mac'],
    default_serving_amount: 1,
    default_serving_unit: 'serving',
    default_serving_label: '1 burger',
    macros_per_serving: { calories: 590, protein_g: 25, carbs_g: 46, fat_g: 34 },
  },
  {
    id: 'food-mcdonalds-fries-medium',
    name: 'McDonald’s fries (medium)',
    aliases: ['medium fries', 'mcdonalds fries', 'fries'],
    default_serving_amount: 1,
    default_serving_unit: 'serving',
    default_serving_label: '1 medium fries',
    macros_per_serving: { calories: 320, protein_g: 5, carbs_g: 43, fat_g: 15 },
  },
  {
    id: 'food-big-mac-meal-fries',
    name: 'Big Mac meal (with fries)',
    aliases: ['bigmac meal', 'big mac meal', 'bigmac meal including fries', 'big mac meal including fries'],
    default_serving_amount: 1,
    default_serving_unit: 'serving',
    default_serving_label: '1 meal',
    macros_per_serving: { calories: 910, protein_g: 30, carbs_g: 89, fat_g: 49 },
  },
  {
    id: 'food-chicken-breast',
    name: 'Chicken breast',
    aliases: ['chicken', 'grilled chicken breast'],
    default_serving_amount: 100,
    default_serving_unit: 'g',
    default_serving_label: '100 g',
    macros_per_serving: { calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 },
  },
  {
    id: 'food-salmon',
    name: 'Salmon fillet',
    aliases: ['salmon', 'salmon filet'],
    default_serving_amount: 100,
    default_serving_unit: 'g',
    default_serving_label: '100 g',
    macros_per_serving: { calories: 208, protein_g: 20, carbs_g: 0, fat_g: 13 },
  },
  {
    id: 'food-ground-turkey',
    name: 'Ground turkey (lean)',
    aliases: ['ground turkey', 'lean turkey'],
    default_serving_amount: 100,
    default_serving_unit: 'g',
    default_serving_label: '100 g',
    macros_per_serving: { calories: 149, protein_g: 29, carbs_g: 0, fat_g: 8 },
  },
  {
    id: 'food-egg',
    name: 'Egg',
    aliases: ['eggs', 'whole egg'],
    default_serving_amount: 1,
    default_serving_unit: 'piece',
    default_serving_label: '1 large egg',
    macros_per_serving: { calories: 72, protein_g: 6.3, carbs_g: 0.4, fat_g: 4.8 },
  },
  {
    id: 'food-greek-yogurt-plain',
    name: 'Greek yogurt (plain, nonfat)',
    aliases: ['greek yogurt', 'plain greek yogurt'],
    default_serving_amount: 170,
    default_serving_unit: 'g',
    default_serving_label: '170 g (about 3/4 cup)',
    macros_per_serving: { calories: 100, protein_g: 18, carbs_g: 6, fat_g: 0 },
  },
  {
    id: 'food-cheddar-cheese',
    name: 'Cheddar cheese',
    aliases: ['cheddar'],
    default_serving_amount: 1,
    default_serving_unit: 'oz',
    default_serving_label: '1 oz',
    macros_per_serving: { calories: 114, protein_g: 7, carbs_g: 0.4, fat_g: 9.4 },
  },
  {
    id: 'food-cottage-cheese',
    name: 'Cottage cheese (low-fat)',
    aliases: ['cottage cheese'],
    default_serving_amount: 0.5,
    default_serving_unit: 'cup',
    default_serving_label: '1/2 cup',
    macros_per_serving: { calories: 81, protein_g: 14, carbs_g: 3.4, fat_g: 1.2 },
  },
  {
    id: 'food-white-rice-uncooked',
    name: 'White rice (uncooked)',
    aliases: ['white rice', 'rice', 'plain rice'],
    default_serving_amount: 100,
    default_serving_unit: 'g',
    default_serving_label: '100 g',
    macros_per_serving: { calories: 364, protein_g: 6.3, carbs_g: 80, fat_g: 0.7 },
  },
  {
    id: 'food-jasmine-rice-cooked',
    name: 'Jasmine rice (cooked)',
    aliases: ['jasmine rice'],
    default_serving_amount: 100,
    default_serving_unit: 'g',
    default_serving_label: '100 g',
    macros_per_serving: { calories: 130, protein_g: 2.7, carbs_g: 28, fat_g: 0.3 },
  },
  {
    id: 'food-brown-rice-cooked',
    name: 'Brown rice (cooked)',
    aliases: ['brown rice'],
    default_serving_amount: 100,
    default_serving_unit: 'g',
    default_serving_label: '100 g',
    macros_per_serving: { calories: 111, protein_g: 2.6, carbs_g: 23, fat_g: 0.9 },
  },
  {
    id: 'food-oats',
    name: 'Rolled oats',
    aliases: ['oatmeal', 'oats'],
    default_serving_amount: 40,
    default_serving_unit: 'g',
    default_serving_label: '40 g',
    macros_per_serving: { calories: 156, protein_g: 6.8, carbs_g: 26.4, fat_g: 2.8 },
  },
  {
    id: 'food-whole-wheat-bread',
    name: 'Whole wheat bread',
    aliases: ['wheat bread', 'bread'],
    default_serving_amount: 1,
    default_serving_unit: 'slice',
    default_serving_label: '1 slice',
    macros_per_serving: { calories: 80, protein_g: 4, carbs_g: 14, fat_g: 1 },
  },
  {
    id: 'food-tortilla',
    name: 'Whole wheat tortilla',
    aliases: ['tortilla', 'wrap'],
    default_serving_amount: 1,
    default_serving_unit: 'serving',
    default_serving_label: '1 tortilla',
    macros_per_serving: { calories: 180, protein_g: 5, carbs_g: 30, fat_g: 4.5 },
  },
  {
    id: 'food-sweet-potato',
    name: 'Sweet potato',
    aliases: ['sweet potato'],
    default_serving_amount: 100,
    default_serving_unit: 'g',
    default_serving_label: '100 g',
    macros_per_serving: { calories: 86, protein_g: 1.6, carbs_g: 20, fat_g: 0.1 },
  },
  {
    id: 'food-potato',
    name: 'Potato',
    aliases: ['white potato', 'russet potato'],
    default_serving_amount: 100,
    default_serving_unit: 'g',
    default_serving_label: '100 g',
    macros_per_serving: { calories: 77, protein_g: 2, carbs_g: 17, fat_g: 0.1 },
  },
  {
    id: 'food-broccoli',
    name: 'Broccoli',
    aliases: ['broccoli'],
    default_serving_amount: 100,
    default_serving_unit: 'g',
    default_serving_label: '100 g',
    macros_per_serving: { calories: 34, protein_g: 2.8, carbs_g: 7, fat_g: 0.4 },
  },
  {
    id: 'food-spinach',
    name: 'Spinach',
    aliases: ['spinach', 'baby spinach'],
    default_serving_amount: 1,
    default_serving_unit: 'cup',
    default_serving_label: '1 cup raw',
    grams_per_serving: 30,
    macros_per_serving: { calories: 7, protein_g: 0.9, carbs_g: 1.1, fat_g: 0.1 },
  },
  {
    id: 'food-kale',
    name: 'Kale',
    aliases: ['kale'],
    default_serving_amount: 1,
    default_serving_unit: 'cup',
    default_serving_label: '1 cup raw',
    grams_per_serving: 67,
    macros_per_serving: { calories: 33, protein_g: 2.9, carbs_g: 6.7, fat_g: 0.6 },
  },
  {
    id: 'food-cucumber',
    name: 'Cucumber',
    aliases: ['cucumber'],
    default_serving_amount: 1,
    default_serving_unit: 'cup',
    default_serving_label: '1 cup sliced',
    grams_per_serving: 104,
    macros_per_serving: { calories: 16, protein_g: 0.7, carbs_g: 3.8, fat_g: 0.1 },
  },
  {
    id: 'food-tomato',
    name: 'Tomato',
    aliases: ['tomatoes', 'tomato'],
    default_serving_amount: 1,
    default_serving_unit: 'cup',
    default_serving_label: '1 cup chopped',
    grams_per_serving: 180,
    macros_per_serving: { calories: 32, protein_g: 1.6, carbs_g: 7, fat_g: 0.4 },
  },
  {
    id: 'food-avocado',
    name: 'Avocado',
    aliases: ['avocado'],
    default_serving_amount: 0.5,
    default_serving_unit: 'serving',
    default_serving_label: '1/2 avocado',
    macros_per_serving: { calories: 120, protein_g: 1.5, carbs_g: 6, fat_g: 11 },
  },
  {
    id: 'food-banana',
    name: 'Banana',
    aliases: ['banana'],
    default_serving_amount: 1,
    default_serving_unit: 'piece',
    default_serving_label: '1 medium banana',
    macros_per_serving: { calories: 105, protein_g: 1.3, carbs_g: 27, fat_g: 0.4 },
  },
  {
    id: 'food-apple',
    name: 'Apple',
    aliases: ['apple'],
    default_serving_amount: 1,
    default_serving_unit: 'piece',
    default_serving_label: '1 medium apple',
    macros_per_serving: { calories: 95, protein_g: 0.5, carbs_g: 25, fat_g: 0.3 },
  },
  {
    id: 'food-blueberries',
    name: 'Blueberries',
    aliases: ['blueberries', 'berries'],
    default_serving_amount: 1,
    default_serving_unit: 'cup',
    default_serving_label: '1 cup',
    macros_per_serving: { calories: 84, protein_g: 1.1, carbs_g: 21, fat_g: 0.5 },
  },
  {
    id: 'food-olive-oil',
    name: 'Olive oil',
    aliases: ['olive oil'],
    default_serving_amount: 1,
    default_serving_unit: 'tbsp',
    default_serving_label: '1 tbsp',
    macros_per_serving: { calories: 119, protein_g: 0, carbs_g: 0, fat_g: 13.5 },
  },
  {
    id: 'food-peanut-butter',
    name: 'Peanut butter',
    aliases: ['peanut butter'],
    default_serving_amount: 1,
    default_serving_unit: 'tbsp',
    default_serving_label: '1 tbsp',
    macros_per_serving: { calories: 95, protein_g: 4, carbs_g: 3.5, fat_g: 8 },
  },
  {
    id: 'food-almonds',
    name: 'Almonds',
    aliases: ['almonds'],
    default_serving_amount: 1,
    default_serving_unit: 'oz',
    default_serving_label: '1 oz (23 almonds)',
    macros_per_serving: { calories: 164, protein_g: 6, carbs_g: 6, fat_g: 14 },
  },
  {
    id: 'food-whey-protein',
    name: 'Whey protein powder',
    aliases: ['whey protein', 'protein powder', 'protein shake'],
    default_serving_amount: 1,
    default_serving_unit: 'serving',
    default_serving_label: '1 scoop',
    macros_per_serving: { calories: 120, protein_g: 24, carbs_g: 3, fat_g: 1.5 },
  },
  {
    id: 'food-milk-2pct',
    name: 'Milk (2%)',
    aliases: ['milk', '2 percent milk'],
    default_serving_amount: 1,
    default_serving_unit: 'cup',
    default_serving_label: '1 cup',
    macros_per_serving: { calories: 122, protein_g: 8, carbs_g: 12, fat_g: 5 },
  },
  {
    id: 'food-almond-milk',
    name: 'Almond milk (unsweetened)',
    aliases: ['almond milk'],
    default_serving_amount: 1,
    default_serving_unit: 'cup',
    default_serving_label: '1 cup',
    macros_per_serving: { calories: 30, protein_g: 1, carbs_g: 1, fat_g: 2.5 },
  },
  {
    id: 'food-coca-cola',
    name: 'Coca-Cola',
    aliases: ['coke', 'coca cola', 'cola'],
    default_serving_amount: 1,
    default_serving_unit: 'serving',
    default_serving_label: '12 fl oz can',
    macros_per_serving: { calories: 140, protein_g: 0, carbs_g: 39, fat_g: 0 },
  },
  {
    id: 'food-chipotle-chicken-bowl',
    name: 'Chipotle chicken bowl',
    aliases: ['chipotle bowl', 'chipotle chicken burrito bowl'],
    default_serving_amount: 1,
    default_serving_unit: 'serving',
    default_serving_label: '1 bowl',
    macros_per_serving: { calories: 710, protein_g: 49, carbs_g: 68, fat_g: 27 },
  },
  {
    id: 'food-whopper',
    name: 'Whopper',
    aliases: ['burger king whopper', 'whopper burger'],
    default_serving_amount: 1,
    default_serving_unit: 'serving',
    default_serving_label: '1 sandwich',
    macros_per_serving: { calories: 660, protein_g: 28, carbs_g: 49, fat_g: 40 },
  },
]

const EXTENDED_FOOD_CATALOG: FoodCatalogItem[] = [
  { id: 'ext-ground-beef-90', name: 'Ground beef (90% lean)', aliases: ['ground beef', 'beef mince'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', macros_per_serving: { calories: 217, protein_g: 26, carbs_g: 0, fat_g: 12 } },
  { id: 'ext-steak-sirloin', name: 'Sirloin steak', aliases: ['steak', 'sirloin'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', macros_per_serving: { calories: 206, protein_g: 27, carbs_g: 0, fat_g: 10 } },
  { id: 'ext-pork-loin', name: 'Pork loin', aliases: ['pork'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', macros_per_serving: { calories: 242, protein_g: 27, carbs_g: 0, fat_g: 14 } },
  { id: 'ext-bacon', name: 'Bacon', aliases: ['bacon strips'], default_serving_amount: 1, default_serving_unit: 'slice', default_serving_label: '1 slice', macros_per_serving: { calories: 43, protein_g: 3, carbs_g: 0.1, fat_g: 3.3 } },
  { id: 'ext-turkey-breast', name: 'Turkey breast', aliases: ['turkey slices', 'deli turkey'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', macros_per_serving: { calories: 135, protein_g: 29, carbs_g: 0, fat_g: 1 } },
  { id: 'ext-shrimp', name: 'Shrimp', aliases: ['prawns'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', macros_per_serving: { calories: 99, protein_g: 24, carbs_g: 0.2, fat_g: 0.3 } },
  { id: 'ext-cod', name: 'Cod', aliases: ['cod fish'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', macros_per_serving: { calories: 82, protein_g: 18, carbs_g: 0, fat_g: 0.7 } },
  { id: 'ext-tilapia', name: 'Tilapia', aliases: ['tilapia fish'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', macros_per_serving: { calories: 96, protein_g: 20, carbs_g: 0, fat_g: 1.7 } },
  { id: 'ext-tofu', name: 'Tofu', aliases: ['firm tofu'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', macros_per_serving: { calories: 76, protein_g: 8, carbs_g: 1.9, fat_g: 4.8 } },
  { id: 'ext-tempeh', name: 'Tempeh', aliases: ['tempeh soy'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', macros_per_serving: { calories: 193, protein_g: 20, carbs_g: 9, fat_g: 11 } },
  { id: 'ext-lentils-cooked', name: 'Lentils (cooked)', aliases: ['lentils'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', macros_per_serving: { calories: 116, protein_g: 9, carbs_g: 20, fat_g: 0.4 } },
  { id: 'ext-black-beans-cooked', name: 'Black beans (cooked)', aliases: ['black beans'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', macros_per_serving: { calories: 132, protein_g: 8.9, carbs_g: 24, fat_g: 0.5 } },
  { id: 'ext-chickpeas-cooked', name: 'Chickpeas (cooked)', aliases: ['garbanzo beans'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', macros_per_serving: { calories: 164, protein_g: 9, carbs_g: 27, fat_g: 2.6 } },
  { id: 'ext-kidney-beans-cooked', name: 'Kidney beans (cooked)', aliases: ['kidney beans'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', macros_per_serving: { calories: 127, protein_g: 8.7, carbs_g: 23, fat_g: 0.5 } },
  { id: 'ext-quinoa-cooked', name: 'Quinoa (cooked)', aliases: ['quinoa'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', macros_per_serving: { calories: 120, protein_g: 4.4, carbs_g: 21.3, fat_g: 1.9 } },
  { id: 'ext-pasta-cooked', name: 'Pasta (cooked)', aliases: ['spaghetti', 'macaroni'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', macros_per_serving: { calories: 157, protein_g: 5.8, carbs_g: 30.9, fat_g: 0.9 } },
  { id: 'ext-white-bread', name: 'White bread', aliases: ['sandwich bread'], default_serving_amount: 1, default_serving_unit: 'slice', default_serving_label: '1 slice', macros_per_serving: { calories: 79, protein_g: 2.7, carbs_g: 14.3, fat_g: 1 } },
  { id: 'ext-sourdough-bread', name: 'Sourdough bread', aliases: ['sourdough'], default_serving_amount: 1, default_serving_unit: 'slice', default_serving_label: '1 slice', macros_per_serving: { calories: 93, protein_g: 3.2, carbs_g: 18, fat_g: 0.7 } },
  { id: 'ext-bagel', name: 'Bagel', aliases: ['plain bagel'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 bagel', macros_per_serving: { calories: 250, protein_g: 9.6, carbs_g: 48, fat_g: 1.5 } },
  { id: 'ext-english-muffin', name: 'English muffin', aliases: ['muffin'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 muffin', macros_per_serving: { calories: 132, protein_g: 4.6, carbs_g: 25, fat_g: 1 } },
  { id: 'ext-tortilla-corn', name: 'Corn tortilla', aliases: ['corn tortillas'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 tortilla', macros_per_serving: { calories: 52, protein_g: 1.4, carbs_g: 10.7, fat_g: 0.7 } },
  { id: 'ext-potato-fries', name: 'French fries', aliases: ['fries', 'french fries'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', macros_per_serving: { calories: 312, protein_g: 3.4, carbs_g: 41, fat_g: 15 } },
  { id: 'ext-mashed-potato', name: 'Mashed potato', aliases: ['mashed potatoes'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', macros_per_serving: { calories: 116, protein_g: 2, carbs_g: 17, fat_g: 4.4 } },
  { id: 'ext-zucchini', name: 'Zucchini', aliases: ['courgette'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', macros_per_serving: { calories: 17, protein_g: 1.2, carbs_g: 3.1, fat_g: 0.3 } },
  { id: 'ext-carrot', name: 'Carrot', aliases: ['carrots'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', macros_per_serving: { calories: 41, protein_g: 0.9, carbs_g: 9.6, fat_g: 0.2 } },
  { id: 'ext-cauliflower', name: 'Cauliflower', aliases: ['cauliflower florets'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', macros_per_serving: { calories: 25, protein_g: 1.9, carbs_g: 5, fat_g: 0.3 } },
  { id: 'ext-cabbage', name: 'Cabbage', aliases: ['green cabbage'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', macros_per_serving: { calories: 25, protein_g: 1.3, carbs_g: 5.8, fat_g: 0.1 } },
  { id: 'ext-onion', name: 'Onion', aliases: ['yellow onion', 'white onion'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', macros_per_serving: { calories: 40, protein_g: 1.1, carbs_g: 9.3, fat_g: 0.1 } },
  { id: 'ext-garlic', name: 'Garlic', aliases: ['garlic cloves'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 clove', macros_per_serving: { calories: 4, protein_g: 0.2, carbs_g: 1, fat_g: 0 } },
  { id: 'ext-mushroom', name: 'Mushrooms', aliases: ['mushroom'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', macros_per_serving: { calories: 22, protein_g: 3.1, carbs_g: 3.3, fat_g: 0.3 } },
  { id: 'ext-peppers-green', name: 'Green bell pepper', aliases: ['green pepper'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', macros_per_serving: { calories: 20, protein_g: 0.9, carbs_g: 4.6, fat_g: 0.2 } },
  { id: 'ext-peppers-red', name: 'Red bell pepper', aliases: ['red pepper'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', macros_per_serving: { calories: 31, protein_g: 1, carbs_g: 6, fat_g: 0.3 } },
  { id: 'ext-lettuce-romaine', name: 'Romaine lettuce', aliases: ['romaine'], default_serving_amount: 1, default_serving_unit: 'cup', default_serving_label: '1 cup shredded', macros_per_serving: { calories: 8, protein_g: 0.6, carbs_g: 1.5, fat_g: 0.1 } },
  { id: 'ext-arugula', name: 'Arugula', aliases: ['rocket leaves'], default_serving_amount: 1, default_serving_unit: 'cup', default_serving_label: '1 cup', macros_per_serving: { calories: 5, protein_g: 0.5, carbs_g: 0.7, fat_g: 0.1 } },
  { id: 'ext-celery', name: 'Celery', aliases: ['celery stalk'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', macros_per_serving: { calories: 16, protein_g: 0.7, carbs_g: 3, fat_g: 0.2 } },
  { id: 'ext-corn', name: 'Corn (sweet)', aliases: ['sweet corn'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', macros_per_serving: { calories: 86, protein_g: 3.3, carbs_g: 19, fat_g: 1.4 } },
  { id: 'ext-peas', name: 'Green peas', aliases: ['peas'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', macros_per_serving: { calories: 81, protein_g: 5.4, carbs_g: 14, fat_g: 0.4 } },
  { id: 'ext-asparagus', name: 'Asparagus', aliases: ['asparagus spears'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', macros_per_serving: { calories: 20, protein_g: 2.2, carbs_g: 3.7, fat_g: 0.1 } },
  { id: 'ext-green-beans', name: 'Green beans', aliases: ['string beans', 'snap beans'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', macros_per_serving: { calories: 31, protein_g: 1.9, carbs_g: 7, fat_g: 0.2 } },
  { id: 'ext-bell-pepper-yellow', name: 'Yellow bell pepper', aliases: ['yellow pepper'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', macros_per_serving: { calories: 27, protein_g: 0.9, carbs_g: 6.3, fat_g: 0.3 } },
  { id: 'ext-strawberries', name: 'Strawberries', aliases: ['strawberry'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', macros_per_serving: { calories: 32, protein_g: 0.7, carbs_g: 7.7, fat_g: 0.3 } },
  { id: 'ext-raspberries', name: 'Raspberries', aliases: ['raspberry'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', macros_per_serving: { calories: 52, protein_g: 1.2, carbs_g: 12, fat_g: 0.7 } },
  { id: 'ext-grapes', name: 'Grapes', aliases: ['green grapes', 'red grapes'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', macros_per_serving: { calories: 69, protein_g: 0.7, carbs_g: 18, fat_g: 0.2 } },
  { id: 'ext-orange', name: 'Orange', aliases: ['oranges'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 medium orange', macros_per_serving: { calories: 62, protein_g: 1.2, carbs_g: 15.4, fat_g: 0.2 } },
  { id: 'ext-pineapple', name: 'Pineapple', aliases: ['pineapple chunks'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', macros_per_serving: { calories: 50, protein_g: 0.5, carbs_g: 13, fat_g: 0.1 } },
  { id: 'ext-watermelon', name: 'Watermelon', aliases: ['water melon'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', macros_per_serving: { calories: 30, protein_g: 0.6, carbs_g: 7.6, fat_g: 0.2 } },
  { id: 'ext-mango', name: 'Mango', aliases: ['mango fruit'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', macros_per_serving: { calories: 60, protein_g: 0.8, carbs_g: 15, fat_g: 0.4 } },
  { id: 'ext-pear', name: 'Pear', aliases: ['pears'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 medium pear', macros_per_serving: { calories: 101, protein_g: 0.6, carbs_g: 27, fat_g: 0.2 } },
  { id: 'ext-kiwi', name: 'Kiwi', aliases: ['kiwifruit'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 kiwi', macros_per_serving: { calories: 42, protein_g: 0.8, carbs_g: 10.1, fat_g: 0.4 } },
  { id: 'ext-egg-whites', name: 'Egg whites', aliases: ['egg white'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', macros_per_serving: { calories: 52, protein_g: 11, carbs_g: 0.7, fat_g: 0.2 } },
  { id: 'ext-cheese-mozzarella', name: 'Mozzarella cheese', aliases: ['mozzarella'], default_serving_amount: 1, default_serving_unit: 'oz', default_serving_label: '1 oz', macros_per_serving: { calories: 85, protein_g: 6.3, carbs_g: 1, fat_g: 6.3 } },
  { id: 'ext-cheese-parmesan', name: 'Parmesan cheese', aliases: ['parmesan'], default_serving_amount: 1, default_serving_unit: 'tbsp', default_serving_label: '1 tbsp', macros_per_serving: { calories: 22, protein_g: 1.9, carbs_g: 0.2, fat_g: 1.4 } },
  { id: 'ext-cheese-cream', name: 'Cream cheese', aliases: ['philadelphia cream cheese', 'cream cheese spread'], default_serving_amount: 1, default_serving_unit: 'tbsp', default_serving_label: '1 tbsp', macros_per_serving: { calories: 51, protein_g: 0.9, carbs_g: 0.8, fat_g: 5.1 } },
  { id: 'ext-yogurt-lowfat', name: 'Yogurt (low-fat plain)', aliases: ['plain yogurt', 'low fat yogurt'], default_serving_amount: 170, default_serving_unit: 'g', default_serving_label: '170 g', macros_per_serving: { calories: 106, protein_g: 8.9, carbs_g: 11.7, fat_g: 2.6 } },
  { id: 'ext-oat-milk', name: 'Oat milk', aliases: ['oatmilk'], default_serving_amount: 1, default_serving_unit: 'cup', default_serving_label: '1 cup', macros_per_serving: { calories: 120, protein_g: 3, carbs_g: 16, fat_g: 5 } },
  { id: 'ext-soy-milk', name: 'Soy milk', aliases: ['soymilk'], default_serving_amount: 1, default_serving_unit: 'cup', default_serving_label: '1 cup', macros_per_serving: { calories: 105, protein_g: 6.3, carbs_g: 12, fat_g: 3.6 } },
  { id: 'ext-rice-cake', name: 'Rice cake', aliases: ['rice cakes'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 cake', macros_per_serving: { calories: 35, protein_g: 0.7, carbs_g: 7.3, fat_g: 0.3 } },
  { id: 'ext-granola-bar', name: 'Granola bar', aliases: ['protein bar', 'snack bar'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 bar', macros_per_serving: { calories: 190, protein_g: 4, carbs_g: 29, fat_g: 7 } },
  { id: 'ext-popcorn-air', name: 'Air-popped popcorn', aliases: ['popcorn'], default_serving_amount: 1, default_serving_unit: 'cup', default_serving_label: '1 cup', macros_per_serving: { calories: 31, protein_g: 1, carbs_g: 6.2, fat_g: 0.4 } },
  { id: 'ext-potato-chips', name: 'Potato chips', aliases: ['chips'], default_serving_amount: 1, default_serving_unit: 'oz', default_serving_label: '1 oz', macros_per_serving: { calories: 152, protein_g: 2, carbs_g: 15, fat_g: 10 } },
  { id: 'ext-dark-chocolate', name: 'Dark chocolate', aliases: ['chocolate'], default_serving_amount: 1, default_serving_unit: 'oz', default_serving_label: '1 oz', macros_per_serving: { calories: 170, protein_g: 2.2, carbs_g: 13, fat_g: 12 } },
  { id: 'ext-ketchup', name: 'Ketchup', aliases: ['catsup'], default_serving_amount: 1, default_serving_unit: 'tbsp', default_serving_label: '1 tbsp', macros_per_serving: { calories: 17, protein_g: 0.2, carbs_g: 4.5, fat_g: 0 } },
  { id: 'ext-mayo', name: 'Mayonnaise', aliases: ['mayo'], default_serving_amount: 1, default_serving_unit: 'tbsp', default_serving_label: '1 tbsp', macros_per_serving: { calories: 94, protein_g: 0.1, carbs_g: 0.1, fat_g: 10.3 } },
  { id: 'ext-mustard', name: 'Mustard', aliases: ['yellow mustard'], default_serving_amount: 1, default_serving_unit: 'tbsp', default_serving_label: '1 tbsp', macros_per_serving: { calories: 10, protein_g: 0.6, carbs_g: 0.9, fat_g: 0.6 } },
  { id: 'ext-bbq-sauce', name: 'BBQ sauce', aliases: ['barbecue sauce'], default_serving_amount: 1, default_serving_unit: 'tbsp', default_serving_label: '1 tbsp', macros_per_serving: { calories: 29, protein_g: 0.1, carbs_g: 7.2, fat_g: 0.1 } },
  { id: 'ext-salsa', name: 'Salsa', aliases: ['tomato salsa'], default_serving_amount: 1, default_serving_unit: 'tbsp', default_serving_label: '1 tbsp', macros_per_serving: { calories: 4, protein_g: 0.2, carbs_g: 0.8, fat_g: 0 } },
  { id: 'ext-hummus', name: 'Hummus', aliases: ['hommus'], default_serving_amount: 2, default_serving_unit: 'tbsp', default_serving_label: '2 tbsp', macros_per_serving: { calories: 70, protein_g: 2, carbs_g: 4, fat_g: 5 } },
  { id: 'ext-olive', name: 'Olives', aliases: ['black olives', 'green olives'], default_serving_amount: 10, default_serving_unit: 'piece', default_serving_label: '10 olives', macros_per_serving: { calories: 50, protein_g: 0.3, carbs_g: 2.6, fat_g: 4.8 } },
  { id: 'ext-nuts-cashews', name: 'Cashews', aliases: ['cashew nuts'], default_serving_amount: 1, default_serving_unit: 'oz', default_serving_label: '1 oz', macros_per_serving: { calories: 157, protein_g: 5.2, carbs_g: 8.6, fat_g: 12.4 } },
  { id: 'ext-nuts-walnuts', name: 'Walnuts', aliases: ['walnut'], default_serving_amount: 1, default_serving_unit: 'oz', default_serving_label: '1 oz', macros_per_serving: { calories: 185, protein_g: 4.3, carbs_g: 3.9, fat_g: 18.5 } },
  { id: 'ext-seeds-pumpkin', name: 'Pumpkin seeds', aliases: ['pepitas'], default_serving_amount: 1, default_serving_unit: 'oz', default_serving_label: '1 oz', macros_per_serving: { calories: 151, protein_g: 7, carbs_g: 5, fat_g: 13 } },
  { id: 'ext-seeds-sunflower', name: 'Sunflower seeds', aliases: ['sunflower kernels'], default_serving_amount: 1, default_serving_unit: 'oz', default_serving_label: '1 oz', macros_per_serving: { calories: 164, protein_g: 5.8, carbs_g: 6.8, fat_g: 14 } },
  { id: 'ext-cereal-cornflakes', name: 'Corn flakes cereal', aliases: ['cornflakes'], default_serving_amount: 1, default_serving_unit: 'cup', default_serving_label: '1 cup', macros_per_serving: { calories: 100, protein_g: 2, carbs_g: 24, fat_g: 0.1 } },
  { id: 'ext-cereal-oat', name: 'Oat cereal', aliases: ['cheerios'], default_serving_amount: 1, default_serving_unit: 'cup', default_serving_label: '1 cup', macros_per_serving: { calories: 105, protein_g: 3.5, carbs_g: 20.5, fat_g: 1.9 } },
  { id: 'ext-waffle', name: 'Waffle', aliases: ['frozen waffle'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 waffle', macros_per_serving: { calories: 97, protein_g: 2.4, carbs_g: 12.7, fat_g: 4.4 } },
  { id: 'ext-pancake', name: 'Pancake', aliases: ['pancakes'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 pancake', macros_per_serving: { calories: 86, protein_g: 2.4, carbs_g: 11, fat_g: 3.2 } },
  { id: 'ext-burger-bun', name: 'Burger bun', aliases: ['hamburger bun'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 bun', macros_per_serving: { calories: 140, protein_g: 5, carbs_g: 26, fat_g: 2 } },
  { id: 'ext-hamburger-patty', name: 'Hamburger patty', aliases: ['beef patty'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 patty', macros_per_serving: { calories: 220, protein_g: 20, carbs_g: 0, fat_g: 15 } },
  { id: 'ext-chicken-nuggets', name: 'Chicken nuggets', aliases: ['nuggets'], default_serving_amount: 6, default_serving_unit: 'piece', default_serving_label: '6 pieces', macros_per_serving: { calories: 270, protein_g: 14, carbs_g: 16, fat_g: 17 } },
  { id: 'ext-pizza-slice', name: 'Pizza slice (cheese)', aliases: ['pizza', 'cheese pizza'], default_serving_amount: 1, default_serving_unit: 'slice', default_serving_label: '1 slice', macros_per_serving: { calories: 285, protein_g: 12, carbs_g: 36, fat_g: 10 } },
  { id: 'ext-burrito', name: 'Burrito', aliases: ['bean burrito', 'chicken burrito'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 burrito', macros_per_serving: { calories: 320, protein_g: 13, carbs_g: 43, fat_g: 10 } },
  { id: 'ext-taco', name: 'Taco', aliases: ['beef taco', 'chicken taco'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 taco', macros_per_serving: { calories: 156, protein_g: 7, carbs_g: 13, fat_g: 8 } },
  { id: 'ext-sushi-roll', name: 'Sushi roll', aliases: ['california roll'], default_serving_amount: 1, default_serving_unit: 'serving', default_serving_label: '1 roll', macros_per_serving: { calories: 255, protein_g: 9, carbs_g: 38, fat_g: 7 } },
  { id: 'ext-ramen', name: 'Instant ramen noodles', aliases: ['ramen noodles'], default_serving_amount: 1, default_serving_unit: 'serving', default_serving_label: '1 package', macros_per_serving: { calories: 380, protein_g: 8, carbs_g: 52, fat_g: 14 } },
  { id: 'ext-curry-rice', name: 'Chicken curry with rice', aliases: ['curry and rice'], default_serving_amount: 1, default_serving_unit: 'serving', default_serving_label: '1 bowl', macros_per_serving: { calories: 520, protein_g: 24, carbs_g: 62, fat_g: 18 } },
  { id: 'ext-espresso', name: 'Espresso', aliases: ['coffee shot'], default_serving_amount: 1, default_serving_unit: 'serving', default_serving_label: '1 shot', macros_per_serving: { calories: 3, protein_g: 0.2, carbs_g: 0.5, fat_g: 0 } },
  { id: 'ext-coffee-black', name: 'Black coffee', aliases: ['coffee'], default_serving_amount: 1, default_serving_unit: 'cup', default_serving_label: '1 cup', macros_per_serving: { calories: 2, protein_g: 0.3, carbs_g: 0, fat_g: 0 } },
  { id: 'ext-latte', name: 'Latte', aliases: ['caffe latte'], default_serving_amount: 1, default_serving_unit: 'serving', default_serving_label: '1 medium', macros_per_serving: { calories: 190, protein_g: 10, carbs_g: 18, fat_g: 9 } },
  { id: 'ext-green-tea', name: 'Green tea', aliases: ['tea'], default_serving_amount: 1, default_serving_unit: 'cup', default_serving_label: '1 cup', macros_per_serving: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 } },
  { id: 'ext-orange-juice', name: 'Orange juice', aliases: ['oj'], default_serving_amount: 1, default_serving_unit: 'cup', default_serving_label: '1 cup', macros_per_serving: { calories: 112, protein_g: 1.7, carbs_g: 25.8, fat_g: 0.5 } },
  { id: 'ext-apple-juice', name: 'Apple juice', aliases: ['juice'], default_serving_amount: 1, default_serving_unit: 'cup', default_serving_label: '1 cup', macros_per_serving: { calories: 114, protein_g: 0.2, carbs_g: 28, fat_g: 0.3 } },
  { id: 'ext-soda-zero', name: 'Diet soda', aliases: ['zero soda', 'diet coke'], default_serving_amount: 1, default_serving_unit: 'serving', default_serving_label: '12 fl oz can', macros_per_serving: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 } },
  { id: 'ext-energy-drink', name: 'Energy drink', aliases: ['monster', 'red bull'], default_serving_amount: 1, default_serving_unit: 'serving', default_serving_label: '1 can', macros_per_serving: { calories: 110, protein_g: 0, carbs_g: 28, fat_g: 0 } },
]

// --- EXTRA FOOD CATALOG (200+ additional items) ---
const EXTRA_FOOD_CATALOG: FoodCatalogItem[] = [
  // ── Red Meats ──
  { id: 'xf-ribeye', name: 'Ribeye steak', aliases: ['ribeye', 'rib eye'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 291, protein_g: 24, carbs_g: 0, fat_g: 21 } },
  { id: 'xf-t-bone', name: 'T-bone steak', aliases: ['t bone', 'tbone'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 247, protein_g: 26, carbs_g: 0, fat_g: 15 } },
  { id: 'xf-filet-mignon', name: 'Filet mignon', aliases: ['beef tenderloin', 'tenderloin steak'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 232, protein_g: 27, carbs_g: 0, fat_g: 13 } },
  { id: 'xf-flank-steak', name: 'Flank steak', aliases: ['flank'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 192, protein_g: 28, carbs_g: 0, fat_g: 8 } },
  { id: 'xf-bison-ground', name: 'Ground bison', aliases: ['bison', 'buffalo meat'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 146, protein_g: 22, carbs_g: 0, fat_g: 6 } },
  { id: 'xf-lamb-chop', name: 'Lamb chop', aliases: ['lamb'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 294, protein_g: 25, carbs_g: 0, fat_g: 21 } },
  { id: 'xf-ground-lamb', name: 'Ground lamb', aliases: ['lamb mince'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 283, protein_g: 23, carbs_g: 0, fat_g: 21 } },
  { id: 'xf-veal-cutlet', name: 'Veal cutlet', aliases: ['veal'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 172, protein_g: 28, carbs_g: 0, fat_g: 6 } },
  { id: 'xf-venison', name: 'Venison', aliases: ['deer meat'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 158, protein_g: 30, carbs_g: 0, fat_g: 3.2 } },
  { id: 'xf-beef-ribs', name: 'Beef short ribs', aliases: ['short ribs', 'beef ribs'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 295, protein_g: 18, carbs_g: 0, fat_g: 24 } },
  { id: 'xf-beef-brisket', name: 'Beef brisket', aliases: ['brisket'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 227, protein_g: 26, carbs_g: 0, fat_g: 13 } },
  { id: 'xf-corned-beef', name: 'Corned beef', aliases: ['corn beef'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 251, protein_g: 18, carbs_g: 0.5, fat_g: 19 } },
  { id: 'xf-bologna', name: 'Bologna', aliases: ['baloney'], default_serving_amount: 1, default_serving_unit: 'slice', default_serving_label: '1 slice (28 g)', grams_per_serving: 28, macros_per_serving: { calories: 87, protein_g: 3.4, carbs_g: 1.1, fat_g: 7.9 } },
  { id: 'xf-salami', name: 'Salami', aliases: ['italian salami', 'genoa salami'], default_serving_amount: 3, default_serving_unit: 'slice', default_serving_label: '3 slices (30 g)', grams_per_serving: 30, macros_per_serving: { calories: 120, protein_g: 6, carbs_g: 0.5, fat_g: 10 } },
  { id: 'xf-pepperoni', name: 'Pepperoni', aliases: ['pizza pepperoni'], default_serving_amount: 14, default_serving_unit: 'piece', default_serving_label: '14 slices (30 g)', grams_per_serving: 30, macros_per_serving: { calories: 138, protein_g: 6, carbs_g: 0.4, fat_g: 12 } },
  { id: 'xf-chorizo', name: 'Chorizo', aliases: ['spanish chorizo', 'mexican chorizo'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 455, protein_g: 24, carbs_g: 2.5, fat_g: 38 } },
  { id: 'xf-prosciutto', name: 'Prosciutto', aliases: ['parma ham'], default_serving_amount: 2, default_serving_unit: 'slice', default_serving_label: '2 slices (28 g)', grams_per_serving: 28, macros_per_serving: { calories: 70, protein_g: 7, carbs_g: 0, fat_g: 4.5 } },
  { id: 'xf-ham', name: 'Ham (deli)', aliases: ['deli ham', 'sliced ham'], default_serving_amount: 2, default_serving_unit: 'slice', default_serving_label: '2 slices (57 g)', grams_per_serving: 57, macros_per_serving: { calories: 68, protein_g: 10, carbs_g: 2, fat_g: 2.2 } },
  { id: 'xf-hot-dog', name: 'Hot dog', aliases: ['frankfurter', 'wiener'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 frank (45 g)', grams_per_serving: 45, macros_per_serving: { calories: 137, protein_g: 4.8, carbs_g: 1.1, fat_g: 12.4 } },
  { id: 'xf-bratwurst', name: 'Bratwurst', aliases: ['brat', 'pork sausage'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 link (85 g)', grams_per_serving: 85, macros_per_serving: { calories: 283, protein_g: 12, carbs_g: 2, fat_g: 25 } },
  { id: 'xf-pork-ribs', name: 'Pork ribs (baby back)', aliases: ['baby back ribs', 'pork ribs'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 292, protein_g: 17, carbs_g: 0, fat_g: 25 } },
  { id: 'xf-pork-belly', name: 'Pork belly', aliases: ['braised pork belly'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 518, protein_g: 9, carbs_g: 0, fat_g: 53 } },
  { id: 'xf-pork-shoulder', name: 'Pork shoulder', aliases: ['pork butt', 'boston butt'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 215, protein_g: 22, carbs_g: 0, fat_g: 14 } },
  // ── Poultry ──
  { id: 'xf-chicken-thigh', name: 'Chicken thigh (skinless)', aliases: ['chicken thighs'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 177, protein_g: 24, carbs_g: 0, fat_g: 9 } },
  { id: 'xf-chicken-thigh-skin', name: 'Chicken thigh (skin-on)', aliases: ['chicken thigh with skin'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 229, protein_g: 22, carbs_g: 0, fat_g: 15 } },
  { id: 'xf-chicken-wing', name: 'Chicken wings', aliases: ['wings', 'buffalo wings'], default_serving_amount: 3, default_serving_unit: 'piece', default_serving_label: '3 wings (90 g)', grams_per_serving: 90, macros_per_serving: { calories: 244, protein_g: 21, carbs_g: 0, fat_g: 17 } },
  { id: 'xf-chicken-drumstick', name: 'Chicken drumstick', aliases: ['drumstick'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 drumstick (85 g)', grams_per_serving: 85, macros_per_serving: { calories: 172, protein_g: 21, carbs_g: 0, fat_g: 9 } },
  { id: 'xf-rotisserie-chicken', name: 'Rotisserie chicken', aliases: ['roast chicken', 'rotisserie'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 195, protein_g: 24, carbs_g: 0, fat_g: 11 } },
  { id: 'xf-duck-breast', name: 'Duck breast', aliases: ['duck'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 201, protein_g: 27, carbs_g: 0, fat_g: 10 } },
  { id: 'xf-turkey-bacon', name: 'Turkey bacon', aliases: ['turkey strips'], default_serving_amount: 2, default_serving_unit: 'slice', default_serving_label: '2 slices (28 g)', grams_per_serving: 28, macros_per_serving: { calories: 70, protein_g: 8, carbs_g: 1, fat_g: 3.5 } },
  { id: 'xf-turkey-ground', name: 'Ground turkey (93% lean)', aliases: ['ground turkey'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 176, protein_g: 20, carbs_g: 0, fat_g: 10 } },
  // ── Fish & Seafood ──
  { id: 'xf-halibut', name: 'Halibut', aliases: ['halibut fillet'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 111, protein_g: 23, carbs_g: 0, fat_g: 2.3 } },
  { id: 'xf-mahi-mahi', name: 'Mahi-mahi', aliases: ['dolphinfish', 'mahi mahi'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 85, protein_g: 19, carbs_g: 0, fat_g: 0.7 } },
  { id: 'xf-mackerel', name: 'Mackerel', aliases: ['atlantic mackerel'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 205, protein_g: 19, carbs_g: 0, fat_g: 14 } },
  { id: 'xf-sardines-canned', name: 'Sardines (canned in oil)', aliases: ['sardines', 'canned sardines'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 208, protein_g: 25, carbs_g: 0, fat_g: 11 } },
  { id: 'xf-herring', name: 'Herring', aliases: ['atlantic herring'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 158, protein_g: 18, carbs_g: 0, fat_g: 9 } },
  { id: 'xf-trout', name: 'Rainbow trout', aliases: ['trout'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 141, protein_g: 20, carbs_g: 0, fat_g: 6.2 } },
  { id: 'xf-sea-bass', name: 'Sea bass', aliases: ['bass', 'striped bass'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 97, protein_g: 18, carbs_g: 0, fat_g: 2.6 } },
  { id: 'xf-snapper', name: 'Red snapper', aliases: ['snapper'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 100, protein_g: 21, carbs_g: 0, fat_g: 1.3 } },
  { id: 'xf-swordfish', name: 'Swordfish', aliases: ['sword fish'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 121, protein_g: 20, carbs_g: 0, fat_g: 4 } },
  { id: 'xf-anchovies-canned', name: 'Anchovies (canned)', aliases: ['anchovies'], default_serving_amount: 5, default_serving_unit: 'piece', default_serving_label: '5 fillets (20 g)', grams_per_serving: 20, macros_per_serving: { calories: 42, protein_g: 5.8, carbs_g: 0, fat_g: 2 } },
  { id: 'xf-tuna-steak', name: 'Tuna steak', aliases: ['ahi tuna'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 144, protein_g: 30, carbs_g: 0, fat_g: 1.3 } },
  { id: 'xf-crab', name: 'Crab meat', aliases: ['crab', 'dungeness crab'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 87, protein_g: 18, carbs_g: 0, fat_g: 1.1 } },
  { id: 'xf-lobster', name: 'Lobster', aliases: ['lobster tail'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 89, protein_g: 19, carbs_g: 0.5, fat_g: 0.9 } },
  { id: 'xf-scallops', name: 'Scallops', aliases: ['sea scallops', 'bay scallops'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 88, protein_g: 17, carbs_g: 2.6, fat_g: 0.8 } },
  { id: 'xf-oysters', name: 'Oysters', aliases: ['raw oysters'], default_serving_amount: 6, default_serving_unit: 'piece', default_serving_label: '6 medium (84 g)', grams_per_serving: 84, macros_per_serving: { calories: 57, protein_g: 6, carbs_g: 3.5, fat_g: 2 } },
  { id: 'xf-clams', name: 'Clams', aliases: ['steamed clams'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 148, protein_g: 26, carbs_g: 5.1, fat_g: 2 } },
  { id: 'xf-mussels', name: 'Mussels', aliases: ['steamed mussels'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 172, protein_g: 24, carbs_g: 7.4, fat_g: 4.5 } },
  { id: 'xf-octopus', name: 'Octopus', aliases: ['tako'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 82, protein_g: 15, carbs_g: 2.2, fat_g: 1.0 } },
  // ── Dairy ──
  { id: 'xf-cottage-cheese-lf', name: 'Cottage cheese (low-fat)', aliases: ['cottage cheese'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 81, protein_g: 11, carbs_g: 3.4, fat_g: 2.3 } },
  { id: 'xf-cottage-cheese-ff', name: 'Cottage cheese (full-fat)', aliases: ['full fat cottage cheese'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 98, protein_g: 11, carbs_g: 3.4, fat_g: 4.3 } },
  { id: 'xf-ricotta', name: 'Ricotta cheese', aliases: ['ricotta'], default_serving_amount: 60, default_serving_unit: 'g', default_serving_label: '¼ cup (60 g)', grams_per_serving: 60, macros_per_serving: { calories: 107, protein_g: 7, carbs_g: 2, fat_g: 8 } },
  { id: 'xf-brie', name: 'Brie cheese', aliases: ['brie'], default_serving_amount: 28, default_serving_unit: 'g', default_serving_label: '1 oz (28 g)', grams_per_serving: 28, macros_per_serving: { calories: 95, protein_g: 5.9, carbs_g: 0.1, fat_g: 7.9 } },
  { id: 'xf-camembert', name: 'Camembert cheese', aliases: ['camembert'], default_serving_amount: 28, default_serving_unit: 'g', default_serving_label: '1 oz (28 g)', grams_per_serving: 28, macros_per_serving: { calories: 85, protein_g: 5.6, carbs_g: 0.1, fat_g: 6.9 } },
  { id: 'xf-swiss-cheese', name: 'Swiss cheese', aliases: ['swiss', 'emmental'], default_serving_amount: 28, default_serving_unit: 'g', default_serving_label: '1 oz (28 g)', grams_per_serving: 28, macros_per_serving: { calories: 108, protein_g: 7.6, carbs_g: 1.5, fat_g: 7.9 } },
  { id: 'xf-gouda', name: 'Gouda cheese', aliases: ['gouda'], default_serving_amount: 28, default_serving_unit: 'g', default_serving_label: '1 oz (28 g)', grams_per_serving: 28, macros_per_serving: { calories: 101, protein_g: 7.1, carbs_g: 0.6, fat_g: 7.8 } },
  { id: 'xf-blue-cheese', name: 'Blue cheese', aliases: ['bleu cheese', 'gorgonzola'], default_serving_amount: 28, default_serving_unit: 'g', default_serving_label: '1 oz (28 g)', grams_per_serving: 28, macros_per_serving: { calories: 100, protein_g: 6.1, carbs_g: 0.7, fat_g: 8.1 } },
  { id: 'xf-provolone', name: 'Provolone cheese', aliases: ['provolone'], default_serving_amount: 28, default_serving_unit: 'g', default_serving_label: '1 oz (28 g)', grams_per_serving: 28, macros_per_serving: { calories: 98, protein_g: 7.3, carbs_g: 0.6, fat_g: 7.5 } },
  { id: 'xf-muenster', name: 'Muenster cheese', aliases: ['muenster'], default_serving_amount: 28, default_serving_unit: 'g', default_serving_label: '1 oz (28 g)', grams_per_serving: 28, macros_per_serving: { calories: 104, protein_g: 6.6, carbs_g: 0.3, fat_g: 8.5 } },
  { id: 'xf-sour-cream', name: 'Sour cream', aliases: ['soured cream'], default_serving_amount: 2, default_serving_unit: 'tbsp', default_serving_label: '2 tbsp (30 g)', grams_per_serving: 30, macros_per_serving: { calories: 59, protein_g: 0.7, carbs_g: 1.2, fat_g: 5.8 } },
  { id: 'xf-heavy-cream', name: 'Heavy cream', aliases: ['heavy whipping cream', 'double cream'], default_serving_amount: 1, default_serving_unit: 'tbsp', default_serving_label: '1 tbsp (15 ml)', grams_per_serving: 15, macros_per_serving: { calories: 51, protein_g: 0.3, carbs_g: 0.4, fat_g: 5.5 } },
  { id: 'xf-half-and-half', name: 'Half and half', aliases: ['half & half', 'coffee creamer'], default_serving_amount: 2, default_serving_unit: 'tbsp', default_serving_label: '2 tbsp (30 ml)', grams_per_serving: 30, macros_per_serving: { calories: 39, protein_g: 1, carbs_g: 1.3, fat_g: 3.5 } },
  { id: 'xf-butter', name: 'Butter', aliases: ['salted butter', 'unsalted butter'], default_serving_amount: 1, default_serving_unit: 'tbsp', default_serving_label: '1 tbsp (14 g)', grams_per_serving: 14, macros_per_serving: { calories: 102, protein_g: 0.1, carbs_g: 0, fat_g: 11.5 } },
  { id: 'xf-ghee', name: 'Ghee', aliases: ['clarified butter'], default_serving_amount: 1, default_serving_unit: 'tbsp', default_serving_label: '1 tbsp (13 g)', grams_per_serving: 13, macros_per_serving: { calories: 112, protein_g: 0, carbs_g: 0, fat_g: 12.7 } },
  { id: 'xf-whole-milk', name: 'Whole milk', aliases: ['full fat milk', 'full cream milk'], default_serving_amount: 1, default_serving_unit: 'cup', default_serving_label: '1 cup (244 ml)', grams_per_serving: 244, macros_per_serving: { calories: 149, protein_g: 8, carbs_g: 12, fat_g: 8 } },
  { id: 'xf-skim-milk', name: 'Skim milk', aliases: ['nonfat milk', '0% milk', 'fat free milk'], default_serving_amount: 1, default_serving_unit: 'cup', default_serving_label: '1 cup (244 ml)', grams_per_serving: 244, macros_per_serving: { calories: 83, protein_g: 8.3, carbs_g: 12.2, fat_g: 0.2 } },
  { id: 'xf-2pct-milk', name: '2% milk', aliases: ['reduced fat milk', '2 percent milk'], default_serving_amount: 1, default_serving_unit: 'cup', default_serving_label: '1 cup (244 ml)', grams_per_serving: 244, macros_per_serving: { calories: 122, protein_g: 8.1, carbs_g: 11.7, fat_g: 4.8 } },
  { id: 'xf-almond-milk', name: 'Almond milk (unsweetened)', aliases: ['almond milk', 'oat milk'], default_serving_amount: 1, default_serving_unit: 'cup', default_serving_label: '1 cup (240 ml)', grams_per_serving: 240, macros_per_serving: { calories: 39, protein_g: 1.5, carbs_g: 3.5, fat_g: 2.5 } },
  { id: 'xf-coconut-milk', name: 'Coconut milk (canned)', aliases: ['canned coconut milk'], default_serving_amount: 60, default_serving_unit: 'ml', default_serving_label: '¼ cup (60 ml)', grams_per_serving: 60, macros_per_serving: { calories: 113, protein_g: 1.2, carbs_g: 1.6, fat_g: 12 } },
  { id: 'xf-chocolate-milk', name: 'Chocolate milk', aliases: ['choc milk'], default_serving_amount: 1, default_serving_unit: 'cup', default_serving_label: '1 cup (244 ml)', grams_per_serving: 244, macros_per_serving: { calories: 208, protein_g: 8, carbs_g: 31, fat_g: 5 } },
  { id: 'xf-kefir', name: 'Kefir (plain)', aliases: ['kefir'], default_serving_amount: 240, default_serving_unit: 'ml', default_serving_label: '1 cup (240 ml)', grams_per_serving: 240, macros_per_serving: { calories: 149, protein_g: 9, carbs_g: 12, fat_g: 5 } },
  { id: 'xf-whey-protein', name: 'Whey protein powder', aliases: ['protein powder', 'whey'], default_serving_amount: 1, default_serving_unit: 'serving', default_serving_label: '1 scoop (30 g)', grams_per_serving: 30, macros_per_serving: { calories: 120, protein_g: 25, carbs_g: 3, fat_g: 1.5 } },
  { id: 'xf-casein-protein', name: 'Casein protein powder', aliases: ['casein', 'micellar casein'], default_serving_amount: 1, default_serving_unit: 'serving', default_serving_label: '1 scoop (32 g)', grams_per_serving: 32, macros_per_serving: { calories: 120, protein_g: 24, carbs_g: 3, fat_g: 1 } },
  // ── Grains & Bread ──
  { id: 'xf-rye-bread', name: 'Rye bread', aliases: ['dark rye', 'rye'], default_serving_amount: 1, default_serving_unit: 'slice', default_serving_label: '1 slice (32 g)', grams_per_serving: 32, macros_per_serving: { calories: 83, protein_g: 2.7, carbs_g: 15.5, fat_g: 1.1 } },
  { id: 'xf-pumpernickel', name: 'Pumpernickel bread', aliases: ['pumpernickel'], default_serving_amount: 1, default_serving_unit: 'slice', default_serving_label: '1 slice (26 g)', grams_per_serving: 26, macros_per_serving: { calories: 65, protein_g: 2.3, carbs_g: 12.4, fat_g: 0.8 } },
  { id: 'xf-croissant', name: 'Croissant', aliases: ['butter croissant'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 medium (57 g)', grams_per_serving: 57, macros_per_serving: { calories: 231, protein_g: 4.7, carbs_g: 26, fat_g: 12 } },
  { id: 'xf-pita-bread', name: 'Pita bread', aliases: ['pita', 'pitta'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 pita (60 g)', grams_per_serving: 60, macros_per_serving: { calories: 165, protein_g: 5.5, carbs_g: 33.4, fat_g: 0.7 } },
  { id: 'xf-naan', name: 'Naan bread', aliases: ['naan', 'garlic naan'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 naan (90 g)', grams_per_serving: 90, macros_per_serving: { calories: 262, protein_g: 8.7, carbs_g: 45, fat_g: 5 } },
  { id: 'xf-flatbread', name: 'Flatbread', aliases: ['lavash'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 piece (57 g)', grams_per_serving: 57, macros_per_serving: { calories: 143, protein_g: 4.4, carbs_g: 25, fat_g: 2.5 } },
  { id: 'xf-ciabatta', name: 'Ciabatta bread', aliases: ['ciabatta roll'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 roll (100 g)', grams_per_serving: 100, macros_per_serving: { calories: 260, protein_g: 8.5, carbs_g: 50, fat_g: 2 } },
  { id: 'xf-brioche', name: 'Brioche', aliases: ['brioche bread'], default_serving_amount: 1, default_serving_unit: 'slice', default_serving_label: '1 slice (40 g)', grams_per_serving: 40, macros_per_serving: { calories: 135, protein_g: 3.7, carbs_g: 19, fat_g: 5.5 } },
  { id: 'xf-cornbread', name: 'Cornbread', aliases: ['corn bread'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 piece (60 g)', grams_per_serving: 60, macros_per_serving: { calories: 173, protein_g: 3, carbs_g: 28, fat_g: 6 } },
  { id: 'xf-flour-tortilla', name: 'Flour tortilla', aliases: ['tortilla wrap', 'wheat tortilla'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 large (72 g)', grams_per_serving: 72, macros_per_serving: { calories: 218, protein_g: 5.7, carbs_g: 35, fat_g: 5.5 } },
  { id: 'xf-rice-noodles', name: 'Rice noodles (cooked)', aliases: ['rice vermicelli', 'pad thai noodles'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 135, protein_g: 1.8, carbs_g: 30, fat_g: 0.2 } },
  { id: 'xf-udon', name: 'Udon noodles (cooked)', aliases: ['udon'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 130, protein_g: 3.3, carbs_g: 27, fat_g: 0.5 } },
  { id: 'xf-soba', name: 'Soba noodles (cooked)', aliases: ['buckwheat noodles', 'soba'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 99, protein_g: 5.1, carbs_g: 21.4, fat_g: 0.1 } },
  { id: 'xf-couscous', name: 'Couscous (cooked)', aliases: ['couscous'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 112, protein_g: 3.8, carbs_g: 23, fat_g: 0.2 } },
  { id: 'xf-bulgur', name: 'Bulgur wheat (cooked)', aliases: ['bulgur', 'bulgar'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 83, protein_g: 3.1, carbs_g: 18.6, fat_g: 0.2 } },
  { id: 'xf-farro', name: 'Farro (cooked)', aliases: ['farro'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 170, protein_g: 7, carbs_g: 34, fat_g: 1 } },
  { id: 'xf-barley', name: 'Barley (cooked)', aliases: ['pearl barley'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 123, protein_g: 2.3, carbs_g: 28, fat_g: 0.4 } },
  { id: 'xf-millet', name: 'Millet (cooked)', aliases: ['millet'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 119, protein_g: 3.5, carbs_g: 23.7, fat_g: 1 } },
  { id: 'xf-amaranth', name: 'Amaranth (cooked)', aliases: ['amaranth'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 102, protein_g: 3.8, carbs_g: 18.7, fat_g: 1.6 } },
  { id: 'xf-granola', name: 'Granola', aliases: ['store bought granola'], default_serving_amount: 60, default_serving_unit: 'g', default_serving_label: '½ cup (60 g)', grams_per_serving: 60, macros_per_serving: { calories: 298, protein_g: 7, carbs_g: 45, fat_g: 11 } },
  { id: 'xf-muesli', name: 'Muesli', aliases: ['raw muesli'], default_serving_amount: 60, default_serving_unit: 'g', default_serving_label: '60 g', grams_per_serving: 60, macros_per_serving: { calories: 215, protein_g: 5.6, carbs_g: 40, fat_g: 4 } },
  { id: 'xf-cream-of-wheat', name: 'Cream of wheat (cooked)', aliases: ['semolina porridge', 'farina'], default_serving_amount: 240, default_serving_unit: 'g', default_serving_label: '1 cup cooked', grams_per_serving: 240, macros_per_serving: { calories: 126, protein_g: 3.7, carbs_g: 26, fat_g: 0.5 } },
  { id: 'xf-grits', name: 'Grits (cooked)', aliases: ['corn grits', 'polenta'], default_serving_amount: 240, default_serving_unit: 'g', default_serving_label: '1 cup cooked', grams_per_serving: 240, macros_per_serving: { calories: 182, protein_g: 4.3, carbs_g: 38, fat_g: 1 } },
  // ── Vegetables ──
  { id: 'xf-brussels-sprouts', name: 'Brussels sprouts', aliases: ['brussel sprouts'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 43, protein_g: 3.4, carbs_g: 9, fat_g: 0.3 } },
  { id: 'xf-beets', name: 'Beets', aliases: ['beetroot', 'red beets'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 43, protein_g: 1.6, carbs_g: 9.6, fat_g: 0.2 } },
  { id: 'xf-leek', name: 'Leek', aliases: ['leeks'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 61, protein_g: 1.5, carbs_g: 14.2, fat_g: 0.3 } },
  { id: 'xf-fennel', name: 'Fennel', aliases: ['fennel bulb'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 31, protein_g: 1.2, carbs_g: 7.3, fat_g: 0.2 } },
  { id: 'xf-artichoke', name: 'Artichoke', aliases: ['globe artichoke'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 medium (120 g)', grams_per_serving: 120, macros_per_serving: { calories: 60, protein_g: 4.2, carbs_g: 13.4, fat_g: 0.2 } },
  { id: 'xf-okra', name: 'Okra', aliases: ['lady fingers', 'ladyfinger'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 33, protein_g: 1.9, carbs_g: 7.5, fat_g: 0.2 } },
  { id: 'xf-eggplant', name: 'Eggplant', aliases: ['aubergine'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 25, protein_g: 1, carbs_g: 5.9, fat_g: 0.2 } },
  { id: 'xf-butternut-squash', name: 'Butternut squash', aliases: ['butternut', 'squash'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 45, protein_g: 1, carbs_g: 11.7, fat_g: 0.1 } },
  { id: 'xf-acorn-squash', name: 'Acorn squash', aliases: ['acorn squash'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 40, protein_g: 0.8, carbs_g: 10.4, fat_g: 0.1 } },
  { id: 'xf-yam', name: 'Yam', aliases: ['yams'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 118, protein_g: 1.5, carbs_g: 28, fat_g: 0.2 } },
  { id: 'xf-radish', name: 'Radish', aliases: ['daikon radish', 'red radish'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 16, protein_g: 0.7, carbs_g: 3.4, fat_g: 0.1 } },
  { id: 'xf-turnip', name: 'Turnip', aliases: ['turnips'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 28, protein_g: 0.9, carbs_g: 6.4, fat_g: 0.1 } },
  { id: 'xf-bok-choy', name: 'Bok choy', aliases: ['pak choi', 'chinese cabbage'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 13, protein_g: 1.5, carbs_g: 2.2, fat_g: 0.2 } },
  { id: 'xf-nori', name: 'Nori (dried seaweed)', aliases: ['seaweed', 'dried nori'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 sheet (2.5 g)', grams_per_serving: 2.5, macros_per_serving: { calories: 5, protein_g: 0.5, carbs_g: 0.7, fat_g: 0.1 } },
  { id: 'xf-edamame', name: 'Edamame (shelled)', aliases: ['edamame beans', 'soybeans'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 121, protein_g: 11, carbs_g: 8.9, fat_g: 5.2 } },
  { id: 'xf-bean-sprouts', name: 'Bean sprouts', aliases: ['mung bean sprouts'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 30, protein_g: 3, carbs_g: 5.9, fat_g: 0.2 } },
  { id: 'xf-kimchi', name: 'Kimchi', aliases: ['fermented kimchi'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 15, protein_g: 1.1, carbs_g: 2.4, fat_g: 0.5 } },
  { id: 'xf-sauerkraut', name: 'Sauerkraut', aliases: ['fermented cabbage'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 19, protein_g: 0.9, carbs_g: 4.3, fat_g: 0.1 } },
  { id: 'xf-shallots', name: 'Shallots', aliases: ['shallot'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 medium (30 g)', grams_per_serving: 30, macros_per_serving: { calories: 22, protein_g: 0.8, carbs_g: 5, fat_g: 0 } },
  { id: 'xf-sun-dried-tomato', name: 'Sun-dried tomatoes', aliases: ['sundried tomatoes'], default_serving_amount: 30, default_serving_unit: 'g', default_serving_label: '¼ cup (30 g)', grams_per_serving: 30, macros_per_serving: { calories: 70, protein_g: 3.8, carbs_g: 15.2, fat_g: 0.8 } },
  { id: 'xf-cucumber', name: 'Cucumber', aliases: ['english cucumber', 'cucumbers'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 15, protein_g: 0.7, carbs_g: 3.6, fat_g: 0.1 } },
  { id: 'xf-watercress', name: 'Watercress', aliases: ['watercress leaves'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 11, protein_g: 2.3, carbs_g: 1.3, fat_g: 0.1 } },
  // ── Legumes ──
  { id: 'xf-navy-beans', name: 'Navy beans (cooked)', aliases: ['haricot beans', 'navy beans'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 140, protein_g: 8.2, carbs_g: 26.1, fat_g: 0.6 } },
  { id: 'xf-pinto-beans', name: 'Pinto beans (cooked)', aliases: ['pinto beans'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 143, protein_g: 9, carbs_g: 26.9, fat_g: 0.6 } },
  { id: 'xf-cannellini-beans', name: 'Cannellini beans (cooked)', aliases: ['white kidney beans', 'cannellini'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 139, protein_g: 9.7, carbs_g: 25, fat_g: 0.3 } },
  { id: 'xf-lima-beans', name: 'Lima beans (cooked)', aliases: ['butter beans', 'lima beans'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 115, protein_g: 7.8, carbs_g: 20.9, fat_g: 0.4 } },
  { id: 'xf-mung-beans', name: 'Mung beans (cooked)', aliases: ['moong dal', 'mung'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 105, protein_g: 7.0, carbs_g: 19.2, fat_g: 0.4 } },
  { id: 'xf-split-peas', name: 'Split peas (cooked)', aliases: ['yellow split peas', 'green split peas'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 118, protein_g: 8.3, carbs_g: 21.1, fat_g: 0.4 } },
  { id: 'xf-adzuki-beans', name: 'Adzuki beans (cooked)', aliases: ['aduki beans', 'azuki'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 128, protein_g: 7.5, carbs_g: 25, fat_g: 0.1 } },
  // ── Fruits ──
  { id: 'xf-peach', name: 'Peach', aliases: ['peaches'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 medium (150 g)', grams_per_serving: 150, macros_per_serving: { calories: 59, protein_g: 1.4, carbs_g: 14.3, fat_g: 0.4 } },
  { id: 'xf-plum', name: 'Plum', aliases: ['plums'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 medium (66 g)', grams_per_serving: 66, macros_per_serving: { calories: 30, protein_g: 0.5, carbs_g: 7.5, fat_g: 0.2 } },
  { id: 'xf-apricot', name: 'Apricot', aliases: ['apricots'], default_serving_amount: 2, default_serving_unit: 'piece', default_serving_label: '2 medium (70 g)', grams_per_serving: 70, macros_per_serving: { calories: 34, protein_g: 1, carbs_g: 7.8, fat_g: 0.3 } },
  { id: 'xf-nectarine', name: 'Nectarine', aliases: ['nectarines'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 medium (142 g)', grams_per_serving: 142, macros_per_serving: { calories: 62, protein_g: 1.5, carbs_g: 14.8, fat_g: 0.5 } },
  { id: 'xf-cherries', name: 'Cherries', aliases: ['sweet cherries', 'bing cherries'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g (about 17 cherries)', grams_per_serving: 100, macros_per_serving: { calories: 63, protein_g: 1.1, carbs_g: 16, fat_g: 0.2 } },
  { id: 'xf-cantaloupe', name: 'Cantaloupe', aliases: ['rockmelon', 'muskmelon'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 34, protein_g: 0.8, carbs_g: 8.2, fat_g: 0.2 } },
  { id: 'xf-honeydew', name: 'Honeydew melon', aliases: ['honeydew'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 36, protein_g: 0.5, carbs_g: 9.1, fat_g: 0.1 } },
  { id: 'xf-papaya', name: 'Papaya', aliases: ['pawpaw', 'papaw'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 43, protein_g: 0.5, carbs_g: 10.8, fat_g: 0.3 } },
  { id: 'xf-guava', name: 'Guava', aliases: ['guavas'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 medium (55 g)', grams_per_serving: 55, macros_per_serving: { calories: 37, protein_g: 1.4, carbs_g: 7.9, fat_g: 0.5 } },
  { id: 'xf-passion-fruit', name: 'Passion fruit', aliases: ['passionfruit', 'maracuya'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 fruit (18 g)', grams_per_serving: 18, macros_per_serving: { calories: 17, protein_g: 0.4, carbs_g: 4.2, fat_g: 0.1 } },
  { id: 'xf-pomegranate', name: 'Pomegranate arils', aliases: ['pomegranate seeds', 'pomegranate'], default_serving_amount: 100, default_serving_unit: 'g', default_serving_label: '100 g', grams_per_serving: 100, macros_per_serving: { calories: 83, protein_g: 1.7, carbs_g: 18.7, fat_g: 1.2 } },
  { id: 'xf-grapefruit', name: 'Grapefruit', aliases: ['pink grapefruit', 'red grapefruit'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '½ grapefruit (123 g)', grams_per_serving: 123, macros_per_serving: { calories: 52, protein_g: 0.9, carbs_g: 13.1, fat_g: 0.2 } },
  { id: 'xf-tangerine', name: 'Tangerine', aliases: ['mandarin', 'clementine'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 medium (88 g)', grams_per_serving: 88, macros_per_serving: { calories: 47, protein_g: 0.7, carbs_g: 11.7, fat_g: 0.3 } },
  { id: 'xf-fig', name: 'Figs', aliases: ['fresh fig', 'dried figs'], default_serving_amount: 2, default_serving_unit: 'piece', default_serving_label: '2 medium (100 g)', grams_per_serving: 100, macros_per_serving: { calories: 74, protein_g: 0.8, carbs_g: 19.2, fat_g: 0.3 } },
  { id: 'xf-dates', name: 'Dates (Medjool)', aliases: ['medjool dates', 'dates'], default_serving_amount: 2, default_serving_unit: 'piece', default_serving_label: '2 dates (48 g)', grams_per_serving: 48, macros_per_serving: { calories: 133, protein_g: 0.8, carbs_g: 35.8, fat_g: 0.1 } },
  { id: 'xf-raisins', name: 'Raisins', aliases: ['sultanas', 'dried grapes'], default_serving_amount: 40, default_serving_unit: 'g', default_serving_label: '40 g (small box)', grams_per_serving: 40, macros_per_serving: { calories: 122, protein_g: 1.3, carbs_g: 32.4, fat_g: 0.2 } },
  { id: 'xf-dried-cranberries', name: 'Dried cranberries', aliases: ['craisins', 'dried cranberry'], default_serving_amount: 40, default_serving_unit: 'g', default_serving_label: '¼ cup (40 g)', grams_per_serving: 40, macros_per_serving: { calories: 130, protein_g: 0, carbs_g: 33, fat_g: 0.5 } },
  { id: 'xf-coconut-flesh', name: 'Coconut (fresh)', aliases: ['coconut meat', 'fresh coconut'], default_serving_amount: 40, default_serving_unit: 'g', default_serving_label: '40 g', grams_per_serving: 40, macros_per_serving: { calories: 142, protein_g: 1.3, carbs_g: 6.1, fat_g: 13.4 } },
  { id: 'xf-lemon', name: 'Lemon', aliases: ['lemon juice', 'lemons'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 lemon (58 g)', grams_per_serving: 58, macros_per_serving: { calories: 17, protein_g: 0.6, carbs_g: 5.4, fat_g: 0.2 } },
  { id: 'xf-lime', name: 'Lime', aliases: ['lime juice', 'limes'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 lime (44 g)', grams_per_serving: 44, macros_per_serving: { calories: 11, protein_g: 0.3, carbs_g: 3.7, fat_g: 0.1 } },
  // ── Nuts & Seeds ──
  { id: 'xf-pecans', name: 'Pecans', aliases: ['pecan nuts'], default_serving_amount: 28, default_serving_unit: 'g', default_serving_label: '1 oz (28 g)', grams_per_serving: 28, macros_per_serving: { calories: 196, protein_g: 2.6, carbs_g: 4, fat_g: 20.4 } },
  { id: 'xf-pistachios', name: 'Pistachios', aliases: ['pistachio nuts', 'shelled pistachios'], default_serving_amount: 28, default_serving_unit: 'g', default_serving_label: '1 oz (28 g)', grams_per_serving: 28, macros_per_serving: { calories: 159, protein_g: 5.7, carbs_g: 7.7, fat_g: 12.9 } },
  { id: 'xf-hazelnuts', name: 'Hazelnuts', aliases: ['filberts', 'hazel nuts'], default_serving_amount: 28, default_serving_unit: 'g', default_serving_label: '1 oz (28 g)', grams_per_serving: 28, macros_per_serving: { calories: 178, protein_g: 4.2, carbs_g: 4.7, fat_g: 17.2 } },
  { id: 'xf-brazil-nuts', name: 'Brazil nuts', aliases: ['brazil nut'], default_serving_amount: 28, default_serving_unit: 'g', default_serving_label: '1 oz (about 6 nuts)', grams_per_serving: 28, macros_per_serving: { calories: 186, protein_g: 4.1, carbs_g: 3.5, fat_g: 18.8 } },
  { id: 'xf-macadamia', name: 'Macadamia nuts', aliases: ['macadamia'], default_serving_amount: 28, default_serving_unit: 'g', default_serving_label: '1 oz (28 g)', grams_per_serving: 28, macros_per_serving: { calories: 204, protein_g: 2.2, carbs_g: 3.9, fat_g: 21.5 } },
  { id: 'xf-pine-nuts', name: 'Pine nuts', aliases: ['pignoli', 'pine kernels'], default_serving_amount: 28, default_serving_unit: 'g', default_serving_label: '1 oz (28 g)', grams_per_serving: 28, macros_per_serving: { calories: 191, protein_g: 3.9, carbs_g: 3.7, fat_g: 19.4 } },
  { id: 'xf-hemp-seeds', name: 'Hemp seeds', aliases: ['hemp hearts', 'shelled hemp'], default_serving_amount: 30, default_serving_unit: 'g', default_serving_label: '3 tbsp (30 g)', grams_per_serving: 30, macros_per_serving: { calories: 166, protein_g: 9.5, carbs_g: 2.6, fat_g: 14.6 } },
  { id: 'xf-sesame-seeds', name: 'Sesame seeds', aliases: ['sesame', 'tahini seeds'], default_serving_amount: 9, default_serving_unit: 'g', default_serving_label: '1 tbsp (9 g)', grams_per_serving: 9, macros_per_serving: { calories: 52, protein_g: 1.6, carbs_g: 2.1, fat_g: 4.5 } },
  { id: 'xf-flaxseeds', name: 'Flaxseeds (ground)', aliases: ['flax seeds', 'linseed'], default_serving_amount: 7, default_serving_unit: 'g', default_serving_label: '1 tbsp (7 g)', grams_per_serving: 7, macros_per_serving: { calories: 37, protein_g: 1.3, carbs_g: 2, fat_g: 3 } },
  { id: 'xf-peanuts-dry', name: 'Dry roasted peanuts', aliases: ['peanuts', 'dry roasted nuts'], default_serving_amount: 28, default_serving_unit: 'g', default_serving_label: '1 oz (28 g)', grams_per_serving: 28, macros_per_serving: { calories: 166, protein_g: 6.7, carbs_g: 6.1, fat_g: 14 } },
  { id: 'xf-trail-mix', name: 'Trail mix', aliases: ['mixed nuts and fruit'], default_serving_amount: 40, default_serving_unit: 'g', default_serving_label: '¼ cup (40 g)', grams_per_serving: 40, macros_per_serving: { calories: 183, protein_g: 4.1, carbs_g: 19, fat_g: 11 } },
  // ── Oils & Fats ──
  { id: 'xf-olive-oil', name: 'Olive oil', aliases: ['extra virgin olive oil', 'evoo'], default_serving_amount: 1, default_serving_unit: 'tbsp', default_serving_label: '1 tbsp (14 g)', grams_per_serving: 14, macros_per_serving: { calories: 119, protein_g: 0, carbs_g: 0, fat_g: 13.5 } },
  { id: 'xf-coconut-oil', name: 'Coconut oil', aliases: ['cold pressed coconut oil'], default_serving_amount: 1, default_serving_unit: 'tbsp', default_serving_label: '1 tbsp (14 g)', grams_per_serving: 14, macros_per_serving: { calories: 121, protein_g: 0, carbs_g: 0, fat_g: 13.5 } },
  { id: 'xf-avocado-oil', name: 'Avocado oil', aliases: ['avocado cooking oil'], default_serving_amount: 1, default_serving_unit: 'tbsp', default_serving_label: '1 tbsp (14 g)', grams_per_serving: 14, macros_per_serving: { calories: 124, protein_g: 0, carbs_g: 0, fat_g: 14 } },
  { id: 'xf-vegetable-oil', name: 'Vegetable oil', aliases: ['canola oil', 'cooking oil'], default_serving_amount: 1, default_serving_unit: 'tbsp', default_serving_label: '1 tbsp (14 g)', grams_per_serving: 14, macros_per_serving: { calories: 124, protein_g: 0, carbs_g: 0, fat_g: 14 } },
  { id: 'xf-sesame-oil', name: 'Sesame oil', aliases: ['toasted sesame oil'], default_serving_amount: 1, default_serving_unit: 'tbsp', default_serving_label: '1 tbsp (14 g)', grams_per_serving: 14, macros_per_serving: { calories: 120, protein_g: 0, carbs_g: 0, fat_g: 13.6 } },
  // ── Condiments & Sauces ──
  { id: 'xf-soy-sauce', name: 'Soy sauce', aliases: ['tamari', 'shoyu'], default_serving_amount: 1, default_serving_unit: 'tbsp', default_serving_label: '1 tbsp (15 ml)', grams_per_serving: 15, macros_per_serving: { calories: 11, protein_g: 1.7, carbs_g: 1, fat_g: 0 } },
  { id: 'xf-sriracha', name: 'Sriracha', aliases: ['hot sauce', 'chili garlic sauce'], default_serving_amount: 1, default_serving_unit: 'tsp', default_serving_label: '1 tsp (5 g)', grams_per_serving: 5, macros_per_serving: { calories: 5, protein_g: 0.1, carbs_g: 1, fat_g: 0.1 } },
  { id: 'xf-ranch', name: 'Ranch dressing', aliases: ['ranch sauce', 'buttermilk ranch'], default_serving_amount: 2, default_serving_unit: 'tbsp', default_serving_label: '2 tbsp (30 g)', grams_per_serving: 30, macros_per_serving: { calories: 73, protein_g: 0.5, carbs_g: 1.5, fat_g: 7.3 } },
  { id: 'xf-caesar-dressing', name: 'Caesar dressing', aliases: ['caesar salad dressing'], default_serving_amount: 2, default_serving_unit: 'tbsp', default_serving_label: '2 tbsp (30 g)', grams_per_serving: 30, macros_per_serving: { calories: 163, protein_g: 1.4, carbs_g: 0.9, fat_g: 17 } },
  { id: 'xf-balsamic-vinegar', name: 'Balsamic vinegar', aliases: ['balsamic'], default_serving_amount: 1, default_serving_unit: 'tbsp', default_serving_label: '1 tbsp (15 ml)', grams_per_serving: 15, macros_per_serving: { calories: 14, protein_g: 0.1, carbs_g: 2.7, fat_g: 0 } },
  { id: 'xf-pesto', name: 'Pesto sauce', aliases: ['basil pesto', 'genoa pesto'], default_serving_amount: 2, default_serving_unit: 'tbsp', default_serving_label: '2 tbsp (30 g)', grams_per_serving: 30, macros_per_serving: { calories: 154, protein_g: 3, carbs_g: 2.9, fat_g: 15 } },
  { id: 'xf-tahini', name: 'Tahini', aliases: ['sesame paste', 'tahina'], default_serving_amount: 1, default_serving_unit: 'tbsp', default_serving_label: '1 tbsp (15 g)', grams_per_serving: 15, macros_per_serving: { calories: 89, protein_g: 2.6, carbs_g: 3.2, fat_g: 8 } },
  { id: 'xf-guacamole', name: 'Guacamole', aliases: ['avocado dip'], default_serving_amount: 2, default_serving_unit: 'tbsp', default_serving_label: '2 tbsp (30 g)', grams_per_serving: 30, macros_per_serving: { calories: 45, protein_g: 0.5, carbs_g: 2.5, fat_g: 4 } },
  { id: 'xf-teriyaki-sauce', name: 'Teriyaki sauce', aliases: ['teriyaki', 'yakitori sauce'], default_serving_amount: 2, default_serving_unit: 'tbsp', default_serving_label: '2 tbsp (30 ml)', grams_per_serving: 30, macros_per_serving: { calories: 30, protein_g: 1.2, carbs_g: 6.8, fat_g: 0 } },
  { id: 'xf-hoisin-sauce', name: 'Hoisin sauce', aliases: ['hoisin'], default_serving_amount: 1, default_serving_unit: 'tbsp', default_serving_label: '1 tbsp (16 g)', grams_per_serving: 16, macros_per_serving: { calories: 35, protein_g: 0.5, carbs_g: 7, fat_g: 0.5 } },
  { id: 'xf-fish-sauce', name: 'Fish sauce', aliases: ['nam pla', 'nuoc mam'], default_serving_amount: 1, default_serving_unit: 'tbsp', default_serving_label: '1 tbsp (15 ml)', grams_per_serving: 15, macros_per_serving: { calories: 13, protein_g: 1.9, carbs_g: 0.7, fat_g: 0 } },
  { id: 'xf-honey', name: 'Honey', aliases: ['raw honey', 'manuka honey'], default_serving_amount: 1, default_serving_unit: 'tbsp', default_serving_label: '1 tbsp (21 g)', grams_per_serving: 21, macros_per_serving: { calories: 64, protein_g: 0.1, carbs_g: 17.3, fat_g: 0 } },
  { id: 'xf-maple-syrup', name: 'Maple syrup', aliases: ['pure maple syrup'], default_serving_amount: 1, default_serving_unit: 'tbsp', default_serving_label: '1 tbsp (20 g)', grams_per_serving: 20, macros_per_serving: { calories: 52, protein_g: 0, carbs_g: 13.4, fat_g: 0 } },
  { id: 'xf-strawberry-jam', name: 'Strawberry jam', aliases: ['jam', 'jelly'], default_serving_amount: 1, default_serving_unit: 'tbsp', default_serving_label: '1 tbsp (20 g)', grams_per_serving: 20, macros_per_serving: { calories: 56, protein_g: 0.1, carbs_g: 13.8, fat_g: 0 } },
  // ── Snacks ──
  { id: 'xf-beef-jerky', name: 'Beef jerky', aliases: ['jerky', 'meat jerky'], default_serving_amount: 28, default_serving_unit: 'g', default_serving_label: '1 oz (28 g)', grams_per_serving: 28, macros_per_serving: { calories: 116, protein_g: 9.4, carbs_g: 3.1, fat_g: 7.3 } },
  { id: 'xf-string-cheese', name: 'String cheese', aliases: ['mozzarella stick'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 stick (28 g)', grams_per_serving: 28, macros_per_serving: { calories: 80, protein_g: 7, carbs_g: 1, fat_g: 5 } },
  { id: 'xf-pretzels', name: 'Pretzels', aliases: ['hard pretzels', 'salted pretzels'], default_serving_amount: 28, default_serving_unit: 'g', default_serving_label: '1 oz (28 g)', grams_per_serving: 28, macros_per_serving: { calories: 108, protein_g: 2.6, carbs_g: 22.5, fat_g: 0.8 } },
  { id: 'xf-graham-crackers', name: 'Graham crackers', aliases: ['honey grahams'], default_serving_amount: 2, default_serving_unit: 'piece', default_serving_label: '2 crackers (28 g)', grams_per_serving: 28, macros_per_serving: { calories: 118, protein_g: 2, carbs_g: 21, fat_g: 2.9 } },
  { id: 'xf-rice-crackers', name: 'Rice crackers', aliases: ['rice snaps', 'rice thins'], default_serving_amount: 10, default_serving_unit: 'piece', default_serving_label: '10 crackers (28 g)', grams_per_serving: 28, macros_per_serving: { calories: 112, protein_g: 2.2, carbs_g: 23, fat_g: 1.3 } },
  { id: 'xf-gummy-bears', name: 'Gummy bears', aliases: ['gummies', 'gummy candy'], default_serving_amount: 17, default_serving_unit: 'piece', default_serving_label: '17 bears (40 g)', grams_per_serving: 40, macros_per_serving: { calories: 130, protein_g: 2.3, carbs_g: 30, fat_g: 0.1 } },
  { id: 'xf-oreos', name: 'Oreo cookies', aliases: ['oreos', 'cream cookies'], default_serving_amount: 3, default_serving_unit: 'piece', default_serving_label: '3 cookies (34 g)', grams_per_serving: 34, macros_per_serving: { calories: 160, protein_g: 1.5, carbs_g: 25, fat_g: 7 } },
  { id: 'xf-peanut-butter-crackers', name: 'Peanut butter crackers', aliases: ['pb crackers', 'nabs'], default_serving_amount: 1, default_serving_unit: 'serving', default_serving_label: '1 pack (39 g)', grams_per_serving: 39, macros_per_serving: { calories: 190, protein_g: 4, carbs_g: 24, fat_g: 9 } },
  // ── Sweets & Desserts ──
  { id: 'xf-vanilla-ice-cream', name: 'Vanilla ice cream', aliases: ['ice cream', 'icecream'], default_serving_amount: 80, default_serving_unit: 'g', default_serving_label: '½ cup (80 g)', grams_per_serving: 80, macros_per_serving: { calories: 145, protein_g: 2.5, carbs_g: 17, fat_g: 7.9 } },
  { id: 'xf-frozen-yogurt', name: 'Frozen yogurt', aliases: ['froyo'], default_serving_amount: 80, default_serving_unit: 'g', default_serving_label: '½ cup (80 g)', grams_per_serving: 80, macros_per_serving: { calories: 106, protein_g: 2.5, carbs_g: 20, fat_g: 1.7 } },
  { id: 'xf-brownie', name: 'Brownie', aliases: ['chocolate brownie', 'fudge brownie'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 piece (56 g)', grams_per_serving: 56, macros_per_serving: { calories: 227, protein_g: 3, carbs_g: 36, fat_g: 9 } },
  { id: 'xf-chocolate-chip-cookie', name: 'Chocolate chip cookie', aliases: ['cookies', 'choc chip cookies'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 cookie (28 g)', grams_per_serving: 28, macros_per_serving: { calories: 130, protein_g: 1.5, carbs_g: 17, fat_g: 6.3 } },
  { id: 'xf-donut-glazed', name: 'Glazed donut', aliases: ['donut', 'doughnut'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 donut (60 g)', grams_per_serving: 60, macros_per_serving: { calories: 253, protein_g: 2.9, carbs_g: 30, fat_g: 14 } },
  { id: 'xf-cupcake', name: 'Cupcake', aliases: ['frosted cupcake'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 cupcake (70 g)', grams_per_serving: 70, macros_per_serving: { calories: 254, protein_g: 2.3, carbs_g: 37, fat_g: 11 } },
  { id: 'xf-cheesecake', name: 'Cheesecake', aliases: ['plain cheesecake', 'new york cheesecake'], default_serving_amount: 1, default_serving_unit: 'slice', default_serving_label: '1 slice (80 g)', grams_per_serving: 80, macros_per_serving: { calories: 257, protein_g: 4.4, carbs_g: 20.4, fat_g: 18 } },
  { id: 'xf-cake-slice', name: 'Chocolate cake', aliases: ['birthday cake', 'layer cake'], default_serving_amount: 1, default_serving_unit: 'slice', default_serving_label: '1 slice (95 g)', grams_per_serving: 95, macros_per_serving: { calories: 352, protein_g: 4, carbs_g: 51, fat_g: 14 } },
  { id: 'xf-muffin-blueberry', name: 'Blueberry muffin', aliases: ['bran muffin'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 muffin (105 g)', grams_per_serving: 105, macros_per_serving: { calories: 377, protein_g: 5, carbs_g: 59, fat_g: 14 } },
  { id: 'xf-milk-chocolate', name: 'Milk chocolate', aliases: ['chocolate bar'], default_serving_amount: 28, default_serving_unit: 'g', default_serving_label: '1 oz (28 g)', grams_per_serving: 28, macros_per_serving: { calories: 153, protein_g: 2, carbs_g: 17.4, fat_g: 8.5 } },
  { id: 'xf-nutella', name: 'Nutella', aliases: ['chocolate hazelnut spread'], default_serving_amount: 2, default_serving_unit: 'tbsp', default_serving_label: '2 tbsp (37 g)', grams_per_serving: 37, macros_per_serving: { calories: 200, protein_g: 2, carbs_g: 23, fat_g: 11 } },
  // ── Beverages ──
  { id: 'xf-protein-shake', name: 'Protein shake (mixed)', aliases: ['protein drink', 'protein smoothie'], default_serving_amount: 1, default_serving_unit: 'serving', default_serving_label: '1 shake (350 ml)', grams_per_serving: 350, macros_per_serving: { calories: 160, protein_g: 30, carbs_g: 8, fat_g: 3 } },
  { id: 'xf-smoothie-green', name: 'Green smoothie', aliases: ['green juice', 'kale smoothie'], default_serving_amount: 1, default_serving_unit: 'serving', default_serving_label: '1 glass (350 ml)', grams_per_serving: 350, macros_per_serving: { calories: 120, protein_g: 3, carbs_g: 25, fat_g: 1.5 } },
  { id: 'xf-smoothie-berry', name: 'Berry smoothie', aliases: ['fruit smoothie', 'mixed berry smoothie'], default_serving_amount: 1, default_serving_unit: 'serving', default_serving_label: '1 glass (350 ml)', grams_per_serving: 350, macros_per_serving: { calories: 180, protein_g: 3.5, carbs_g: 40, fat_g: 1 } },
  { id: 'xf-kombucha', name: 'Kombucha', aliases: ['fermented tea'], default_serving_amount: 1, default_serving_unit: 'serving', default_serving_label: '1 bottle (355 ml)', grams_per_serving: 355, macros_per_serving: { calories: 30, protein_g: 0, carbs_g: 7, fat_g: 0 } },
  { id: 'xf-coconut-water', name: 'Coconut water', aliases: ['coconut drink'], default_serving_amount: 1, default_serving_unit: 'cup', default_serving_label: '1 cup (240 ml)', grams_per_serving: 240, macros_per_serving: { calories: 46, protein_g: 1.7, carbs_g: 8.9, fat_g: 0.5 } },
  { id: 'xf-gatorade', name: 'Sports drink', aliases: ['gatorade', 'electrolyte drink', 'powerade'], default_serving_amount: 1, default_serving_unit: 'serving', default_serving_label: '1 bottle (591 ml)', grams_per_serving: 591, macros_per_serving: { calories: 140, protein_g: 0, carbs_g: 36, fat_g: 0 } },
  { id: 'xf-cappuccino', name: 'Cappuccino', aliases: ['cap', 'frothy coffee'], default_serving_amount: 1, default_serving_unit: 'serving', default_serving_label: '1 medium (240 ml)', grams_per_serving: 240, macros_per_serving: { calories: 74, protein_g: 4.6, carbs_g: 6, fat_g: 3.5 } },
  { id: 'xf-americano', name: 'Americano', aliases: ['caffe americano'], default_serving_amount: 1, default_serving_unit: 'serving', default_serving_label: '1 cup (240 ml)', grams_per_serving: 240, macros_per_serving: { calories: 15, protein_g: 1, carbs_g: 2, fat_g: 0 } },
  { id: 'xf-black-tea', name: 'Black tea', aliases: ['english breakfast tea', 'plain tea'], default_serving_amount: 1, default_serving_unit: 'cup', default_serving_label: '1 cup (240 ml)', grams_per_serving: 240, macros_per_serving: { calories: 2, protein_g: 0, carbs_g: 0.7, fat_g: 0 } },
  { id: 'xf-beer-regular', name: 'Beer (regular)', aliases: ['lager', 'ale', 'beer'], default_serving_amount: 1, default_serving_unit: 'serving', default_serving_label: '1 can (355 ml)', grams_per_serving: 355, macros_per_serving: { calories: 153, protein_g: 1.6, carbs_g: 12.6, fat_g: 0 } },
  { id: 'xf-beer-light', name: 'Light beer', aliases: ['lite beer', 'low calorie beer'], default_serving_amount: 1, default_serving_unit: 'serving', default_serving_label: '1 can (355 ml)', grams_per_serving: 355, macros_per_serving: { calories: 103, protein_g: 0.9, carbs_g: 5.8, fat_g: 0 } },
  { id: 'xf-wine-red', name: 'Red wine', aliases: ['cabernet', 'merlot', 'wine'], default_serving_amount: 148, default_serving_unit: 'ml', default_serving_label: '5 fl oz (148 ml)', grams_per_serving: 148, macros_per_serving: { calories: 125, protein_g: 0.1, carbs_g: 3.8, fat_g: 0 } },
  { id: 'xf-wine-white', name: 'White wine', aliases: ['chardonnay', 'sauvignon blanc'], default_serving_amount: 148, default_serving_unit: 'ml', default_serving_label: '5 fl oz (148 ml)', grams_per_serving: 148, macros_per_serving: { calories: 121, protein_g: 0.1, carbs_g: 3.8, fat_g: 0 } },
  // ── Prepared / Restaurant Foods ──
  { id: 'xf-caesar-salad', name: 'Caesar salad', aliases: ['chicken caesar', 'caesar salad bowl'], default_serving_amount: 1, default_serving_unit: 'serving', default_serving_label: '1 bowl (200 g)', grams_per_serving: 200, macros_per_serving: { calories: 358, protein_g: 12, carbs_g: 13, fat_g: 29 } },
  { id: 'xf-greek-salad', name: 'Greek salad', aliases: ['horiatiki'], default_serving_amount: 1, default_serving_unit: 'serving', default_serving_label: '1 bowl (200 g)', grams_per_serving: 200, macros_per_serving: { calories: 176, protein_g: 5, carbs_g: 12, fat_g: 13 } },
  { id: 'xf-grilled-cheese', name: 'Grilled cheese sandwich', aliases: ['toasted cheese sandwich'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 sandwich', grams_per_serving: 150, macros_per_serving: { calories: 391, protein_g: 16, carbs_g: 35, fat_g: 21 } },
  { id: 'xf-blt-sandwich', name: 'BLT sandwich', aliases: ['blt', 'bacon lettuce tomato'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 sandwich', grams_per_serving: 200, macros_per_serving: { calories: 339, protein_g: 14, carbs_g: 30, fat_g: 18 } },
  { id: 'xf-club-sandwich', name: 'Club sandwich', aliases: ['triple decker sandwich'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 sandwich', grams_per_serving: 280, macros_per_serving: { calories: 588, protein_g: 29, carbs_g: 52, fat_g: 28 } },
  { id: 'xf-pad-thai', name: 'Pad thai', aliases: ['thai noodles', 'pad thai noodles'], default_serving_amount: 1, default_serving_unit: 'serving', default_serving_label: '1 plate (300 g)', grams_per_serving: 300, macros_per_serving: { calories: 416, protein_g: 20, carbs_g: 51, fat_g: 14 } },
  { id: 'xf-fried-rice', name: 'Fried rice', aliases: ['egg fried rice', 'chinese fried rice'], default_serving_amount: 1, default_serving_unit: 'serving', default_serving_label: '1 cup (200 g)', grams_per_serving: 200, macros_per_serving: { calories: 333, protein_g: 7.2, carbs_g: 55, fat_g: 10 } },
  { id: 'xf-pho', name: 'Pho', aliases: ['beef pho', 'vietnamese noodle soup'], default_serving_amount: 1, default_serving_unit: 'serving', default_serving_label: '1 bowl (500 g)', grams_per_serving: 500, macros_per_serving: { calories: 381, protein_g: 26, carbs_g: 51, fat_g: 8 } },
  { id: 'xf-bibimbap', name: 'Bibimbap', aliases: ['korean rice bowl'], default_serving_amount: 1, default_serving_unit: 'serving', default_serving_label: '1 bowl (450 g)', grams_per_serving: 450, macros_per_serving: { calories: 490, protein_g: 25, carbs_g: 70, fat_g: 12 } },
  { id: 'xf-gyro', name: 'Gyro', aliases: ['chicken gyro', 'lamb gyro', 'doner kebab'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 gyro sandwich', grams_per_serving: 230, macros_per_serving: { calories: 430, protein_g: 25, carbs_g: 42, fat_g: 18 } },
  { id: 'xf-falafel', name: 'Falafel', aliases: ['falafel balls'], default_serving_amount: 3, default_serving_unit: 'piece', default_serving_label: '3 balls (60 g)', grams_per_serving: 60, macros_per_serving: { calories: 170, protein_g: 6, carbs_g: 16, fat_g: 9 } },
  { id: 'xf-shawarma', name: 'Shawarma wrap', aliases: ['chicken shawarma', 'beef shawarma'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 wrap', grams_per_serving: 280, macros_per_serving: { calories: 510, protein_g: 28, carbs_g: 48, fat_g: 21 } },
  { id: 'xf-fish-chips', name: 'Fish and chips', aliases: ['fish n chips'], default_serving_amount: 1, default_serving_unit: 'serving', default_serving_label: '1 serving (350 g)', grams_per_serving: 350, macros_per_serving: { calories: 804, protein_g: 35, carbs_g: 89, fat_g: 35 } },
  { id: 'xf-veggie-burger', name: 'Veggie burger', aliases: ['plant based burger', 'beyond burger', 'impossible burger'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 patty (113 g)', grams_per_serving: 113, macros_per_serving: { calories: 240, protein_g: 20, carbs_g: 9, fat_g: 14 } },
  { id: 'xf-chicken-sandwich', name: 'Crispy chicken sandwich', aliases: ['chicken burger', 'fried chicken sandwich'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 sandwich', grams_per_serving: 250, macros_per_serving: { calories: 560, protein_g: 33, carbs_g: 50, fat_g: 23 } },
  { id: 'xf-egg-mcmuffin', name: 'Egg McMuffin style sandwich', aliases: ['breakfast sandwich', 'egg muffin'], default_serving_amount: 1, default_serving_unit: 'piece', default_serving_label: '1 sandwich', grams_per_serving: 137, macros_per_serving: { calories: 300, protein_g: 17, carbs_g: 30, fat_g: 12 } },
  { id: 'xf-oatmeal-plain', name: 'Oatmeal (plain, instant)', aliases: ['instant oatmeal', 'porridge plain'], default_serving_amount: 1, default_serving_unit: 'serving', default_serving_label: '1 packet prepared (180 g)', grams_per_serving: 180, macros_per_serving: { calories: 130, protein_g: 5, carbs_g: 27, fat_g: 2.5 } },
  { id: 'xf-overnight-oats', name: 'Overnight oats', aliases: ['overnight oatmeal'], default_serving_amount: 1, default_serving_unit: 'serving', default_serving_label: '1 jar (330 g)', grams_per_serving: 330, macros_per_serving: { calories: 390, protein_g: 15, carbs_g: 58, fat_g: 10 } },
  { id: 'xf-acai-bowl', name: 'Açaí bowl', aliases: ['acai bowl', 'acai smoothie bowl'], default_serving_amount: 1, default_serving_unit: 'serving', default_serving_label: '1 bowl (350 g)', grams_per_serving: 350, macros_per_serving: { calories: 390, protein_g: 6, carbs_g: 70, fat_g: 11 } },
  { id: 'xf-stir-fry-chicken', name: 'Chicken stir fry', aliases: ['chicken stir-fry', 'stir fry'], default_serving_amount: 1, default_serving_unit: 'serving', default_serving_label: '1 plate (300 g)', grams_per_serving: 300, macros_per_serving: { calories: 320, protein_g: 30, carbs_g: 20, fat_g: 12 } },
  { id: 'xf-spaghetti-bolognese', name: 'Spaghetti bolognese', aliases: ['pasta bolognese', 'meat sauce pasta'], default_serving_amount: 1, default_serving_unit: 'serving', default_serving_label: '1 plate (400 g)', grams_per_serving: 400, macros_per_serving: { calories: 550, protein_g: 28, carbs_g: 65, fat_g: 18 } },
  { id: 'xf-lasagna', name: 'Lasagna', aliases: ['beef lasagna', 'meat lasagna'], default_serving_amount: 1, default_serving_unit: 'serving', default_serving_label: '1 slice (250 g)', grams_per_serving: 250, macros_per_serving: { calories: 336, protein_g: 17, carbs_g: 33, fat_g: 15 } },
  { id: 'xf-chili-con-carne', name: 'Chili con carne', aliases: ['beef chili', 'chili'], default_serving_amount: 1, default_serving_unit: 'serving', default_serving_label: '1 cup (250 g)', grams_per_serving: 250, macros_per_serving: { calories: 290, protein_g: 20, carbs_g: 26, fat_g: 12 } },
  { id: 'xf-minestrone-soup', name: 'Minestrone soup', aliases: ['vegetable soup', 'minestrone'], default_serving_amount: 1, default_serving_unit: 'serving', default_serving_label: '1 bowl (300 g)', grams_per_serving: 300, macros_per_serving: { calories: 132, protein_g: 5, carbs_g: 22, fat_g: 3 } },
  { id: 'xf-chicken-soup', name: 'Chicken noodle soup', aliases: ['chicken soup'], default_serving_amount: 1, default_serving_unit: 'serving', default_serving_label: '1 bowl (300 g)', grams_per_serving: 300, macros_per_serving: { calories: 156, protein_g: 13, carbs_g: 16, fat_g: 4 } },
  { id: 'xf-tomato-soup', name: 'Tomato soup', aliases: ['creamy tomato soup'], default_serving_amount: 1, default_serving_unit: 'serving', default_serving_label: '1 bowl (244 ml)', grams_per_serving: 244, macros_per_serving: { calories: 74, protein_g: 1.7, carbs_g: 16, fat_g: 0.8 } },
]
