export type ScannedFoodResult = {
  barcode: string | null
  name: string
  brand: string | null
  image_url: string | null
  serving_label: string
  serving_amount: number
  serving_unit: string
  macros: {
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
  }
  source: 'open_food_facts' | 'nutrition_label_ocr'
  raw_text?: string | null
}

export type BarcodeFoodLookupResult = ScannedFoodResult

type OpenFoodFactsResponse = {
  status?: number
  product?: {
    product_name?: string
    product_name_en?: string
    brands?: string
    serving_size?: string
    quantity?: string
    image_url?: string
    image_front_small_url?: string
    nutriments?: Record<string, unknown>
  }
}

type ServingMeta = {
  label: string
  amount: number
  unit: string
  normalized_unit: 'g' | 'ml' | null
}

export function normalizeBarcodeCandidate(value: string) {
  const cleaned = value.trim()
  if (!cleaned) return null

  const directDigits = cleaned.replace(/\D/g, '')
  if (directDigits.length >= 8 && directDigits.length <= 14) return directDigits

  const embeddedDigits = cleaned.match(/\b\d{8,14}\b/)
  return embeddedDigits ? embeddedDigits[0] : null
}

function parseNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const normalized = value.replace(',', '.').trim()
    const parsed = Number(normalized)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function roundMacro(value: number) {
  return Math.round(value * 10) / 10
}

function parseServingSize(value: string | undefined): ServingMeta | null {
  if (!value) return null

  const trimmed = value.trim()
  if (!trimmed) return null

  const match = trimmed.match(/(\d+(?:[.,]\d+)?)\s*(g|gram|grams|kg|ml|milliliter|milliliters|l|liter|liters|fl\.?\s*oz|oz|serving|servings|piece|pieces|slice|slices|cup|cups)\b/i)
  if (!match) {
    return {
      label: trimmed,
      amount: 1,
      unit: 'serving',
      normalized_unit: null,
    }
  }

  const rawAmount = parseNumber(match[1]) ?? 1
  const rawUnit = match[2].toLowerCase().replace(/\s+/g, '')

  if (rawUnit === 'kg') {
    return {
      label: trimmed,
      amount: rawAmount * 1000,
      unit: 'g',
      normalized_unit: 'g',
    }
  }

  if (rawUnit === 'l' || rawUnit === 'liter' || rawUnit === 'liters') {
    return {
      label: trimmed,
      amount: rawAmount * 1000,
      unit: 'ml',
      normalized_unit: 'ml',
    }
  }

  if (rawUnit === 'gram' || rawUnit === 'grams') {
    return {
      label: trimmed,
      amount: rawAmount,
      unit: 'g',
      normalized_unit: 'g',
    }
  }

  if (rawUnit === 'milliliter' || rawUnit === 'milliliters') {
    return {
      label: trimmed,
      amount: rawAmount,
      unit: 'ml',
      normalized_unit: 'ml',
    }
  }

  // Convert oz → g and fl oz → ml so US products get a proper serving scale
  if (rawUnit === 'floz' || rawUnit === 'fl.oz') {
    return {
      label: trimmed,
      amount: Math.round(rawAmount * 29.5735 * 10) / 10,
      unit: 'ml',
      normalized_unit: 'ml',
    }
  }

  if (rawUnit === 'oz') {
    return {
      label: trimmed,
      amount: Math.round(rawAmount * 28.3495 * 10) / 10,
      unit: 'g',
      normalized_unit: 'g',
    }
  }

  return {
    label: trimmed,
    amount: rawAmount,
    unit: rawUnit,
    normalized_unit: rawUnit === 'g' || rawUnit === 'ml' ? rawUnit : null,
  }
}

function getPerServingNutrient(nutriments: Record<string, unknown>, key: string) {
  return parseNumber(nutriments[`${key}_serving`])
}

function getPer100Nutrient(nutriments: Record<string, unknown>, key: string) {
  return parseNumber(nutriments[`${key}_100g`]) ?? parseNumber(nutriments[`${key}_100ml`])
}

function hasPerServingNutrient(nutriments: Record<string, unknown>, key: string) {
  return getPerServingNutrient(nutriments, key) !== null
}

function inferPer100Unit(nutriments: Record<string, unknown>): 'g' | 'ml' {
  const has100ml = ['energy-kcal', 'proteins', 'carbohydrates', 'fat'].some((key) => parseNumber(nutriments[`${key}_100ml`]) !== null)
  return has100ml ? 'ml' : 'g'
}

function getServingScale(servingMeta: ServingMeta | null) {
  if (!servingMeta || !servingMeta.normalized_unit) return null
  return servingMeta.amount / 100
}

function resolveNutrientValue(
  nutriments: Record<string, unknown>,
  key: string,
  servingScale: number | null
) {
  const directServing = getPerServingNutrient(nutriments, key)
  if (directServing !== null) return directServing

  const per100 = getPer100Nutrient(nutriments, key)
  if (per100 === null) return null
  if (servingScale !== null) return per100 * servingScale
  return per100
}

export function normalizeOpenFoodFactsProduct(barcode: string, payload: OpenFoodFactsResponse): BarcodeFoodLookupResult | null {
  if (payload.status !== 1 || !payload.product) return null

  const product = payload.product
  const nutriments = product.nutriments ?? {}
  const servingMeta = parseServingSize(product.serving_size)
  const packageMeta = parseServingSize(product.quantity)
  const servingScale = getServingScale(servingMeta)
  const hasDirectServingData = ['energy-kcal', 'proteins', 'carbohydrates', 'fat'].some((key) => hasPerServingNutrient(nutriments, key))
  const fallbackPer100Unit = inferPer100Unit(nutriments)

  const calories = resolveNutrientValue(nutriments, 'energy-kcal', servingScale)
  const protein = resolveNutrientValue(nutriments, 'proteins', servingScale)
  const carbs = resolveNutrientValue(nutriments, 'carbohydrates', servingScale)
  const fat = resolveNutrientValue(nutriments, 'fat', servingScale)

  if (calories === null && protein === null && carbs === null && fat === null) {
    return null
  }

  const name = product.product_name_en?.trim() || product.product_name?.trim()
  if (!name) return null

  // Only use servingMeta as the display label when it has a normalized unit (g/ml)
  // or when we have direct _serving nutrient values. Otherwise the label would say
  // "1 serving" while the macros are actually per-100g, which is the inflation bug.
  const servingMetaHasScale = servingMeta !== null && servingMeta.normalized_unit !== null
  const displayServingMeta = servingMetaHasScale
    ? servingMeta
    : hasDirectServingData
      ? (servingMeta ?? packageMeta)
      : null

  return {
    barcode,
    name,
    brand: product.brands?.split(',')[0]?.trim() || null,
    image_url: product.image_front_small_url || product.image_url || null,
    serving_label: displayServingMeta?.label || `100 ${fallbackPer100Unit}`,
    serving_amount: displayServingMeta?.amount ?? 100,
    serving_unit: displayServingMeta?.unit ?? fallbackPer100Unit,
    macros: {
      calories: Math.round(calories ?? 0),
      protein_g: roundMacro(protein ?? 0),
      carbs_g: roundMacro(carbs ?? 0),
      fat_g: roundMacro(fat ?? 0),
    },
    source: 'open_food_facts',
  }
}

export async function lookupBarcodeFood(barcode: string): Promise<BarcodeFoodLookupResult | null> {
  const response = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,product_name_en,brands,serving_size,quantity,image_url,image_front_small_url,nutriments`,
    {
      headers: {
        'User-Agent': 'Rivora/1.0 (barcode lookup)',
      },
      next: { revalidate: 60 * 60 * 12 },
    }
  )

  if (!response.ok) return null

  const payload = await response.json() as OpenFoodFactsResponse
  return normalizeOpenFoodFactsProduct(barcode, payload)
}
