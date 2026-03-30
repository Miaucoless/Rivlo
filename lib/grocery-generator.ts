import type { GroceryItem, WeeklyMealPlan } from '@/types'

// ─── Category mapping ──────────────────────────────────────────────────────────

const CATEGORY_KEYWORDS: Array<[string, string]> = [
  ['chicken', 'Protein'], ['beef', 'Protein'], ['turkey', 'Protein'], ['salmon', 'Protein'],
  ['tuna', 'Protein'], ['shrimp', 'Protein'], ['fish', 'Protein'], ['pork', 'Protein'],
  ['steak', 'Protein'], ['tilapia', 'Protein'], ['cod', 'Protein'], ['halibut', 'Protein'],
  ['egg', 'Protein'], ['tofu', 'Protein'], ['tempeh', 'Protein'],
  ['ground meat', 'Protein'], ['deli', 'Protein'],
  ['yogurt', 'Dairy'], ['cheese', 'Dairy'], ['butter', 'Dairy'],
  ['cream cheese', 'Dairy'], ['cottage cheese', 'Dairy'], ['whey', 'Dairy'],
  ['almond milk', 'Dairy Alternatives'], ['oat milk', 'Dairy Alternatives'],
  ['soy milk', 'Dairy Alternatives'], ['coconut milk', 'Dairy Alternatives'],
  ['milk', 'Dairy'],
  ['rice', 'Grains'], ['oat', 'Grains'], ['bread', 'Grains'], ['pasta', 'Grains'],
  ['tortilla', 'Grains'], ['quinoa', 'Grains'], ['granola', 'Grains'],
  ['cereal', 'Grains'], ['bagel', 'Grains'], ['wrap', 'Grains'], ['flour', 'Grains'],
  ['cracker', 'Grains'], ['barley', 'Grains'], ['farro', 'Grains'],
  ['broccoli', 'Vegetables'], ['spinach', 'Vegetables'], ['kale', 'Vegetables'],
  ['asparagus', 'Vegetables'], ['pepper', 'Vegetables'], ['tomato', 'Vegetables'],
  ['onion', 'Vegetables'], ['garlic', 'Vegetables'], ['sweet potato', 'Vegetables'],
  ['potato', 'Vegetables'], ['carrot', 'Vegetables'], ['cucumber', 'Vegetables'],
  ['lettuce', 'Vegetables'], ['celery', 'Vegetables'], ['zucchini', 'Vegetables'],
  ['cauliflower', 'Vegetables'], ['cabbage', 'Vegetables'], ['mushroom', 'Vegetables'],
  ['bean', 'Vegetables'], ['lentil', 'Vegetables'], ['pea', 'Vegetables'],
  ['corn', 'Vegetables'],
  ['avocado', 'Fruits'], ['banana', 'Fruits'], ['berry', 'Fruits'], ['apple', 'Fruits'],
  ['mango', 'Fruits'], ['strawberry', 'Fruits'], ['blueberry', 'Fruits'],
  ['raspberry', 'Fruits'], ['orange', 'Fruits'], ['grape', 'Fruits'],
  ['peach', 'Fruits'], ['pineapple', 'Fruits'], ['lemon', 'Fruits'], ['lime', 'Fruits'],
  ['almond', 'Nuts & Seeds'], ['cashew', 'Nuts & Seeds'], ['walnut', 'Nuts & Seeds'],
  ['chia', 'Nuts & Seeds'], ['flax', 'Nuts & Seeds'], ['peanut', 'Nuts & Seeds'],
  ['hemp seed', 'Nuts & Seeds'], ['sunflower seed', 'Nuts & Seeds'],
  ['pumpkin seed', 'Nuts & Seeds'], ['nut butter', 'Nuts & Seeds'],
  ['olive oil', 'Pantry'], ['coconut oil', 'Pantry'], ['oil', 'Pantry'],
  ['soy sauce', 'Pantry'], ['vinegar', 'Pantry'], ['honey', 'Pantry'],
  ['tahini', 'Pantry'], ['hummus', 'Pantry'], ['mayo', 'Pantry'],
  ['mustard', 'Pantry'], ['ketchup', 'Pantry'], ['salsa', 'Pantry'],
  ['hot sauce', 'Pantry'], ['sriracha', 'Pantry'],
  ['seasoning', 'Pantry'], ['spice', 'Pantry'], ['sauce', 'Pantry'],
  ['broth', 'Pantry'], ['stock', 'Pantry'], ['canned', 'Pantry'],
  ['maple syrup', 'Pantry'],
  ['protein powder', 'Supplements'], ['creatine', 'Supplements'],
  ['bcaa', 'Supplements'], ['pre-workout', 'Supplements'], ['collagen', 'Supplements'],
]

export function categorizeIngredient(name: string): string {
  const lower = name.toLowerCase()
  for (const [keyword, category] of CATEGORY_KEYWORDS) {
    if (lower.includes(keyword)) return category
  }
  return 'Other'
}

// ─── Price estimation ──────────────────────────────────────────────────────────

const PRICE_PER_100G: Record<string, number> = {
  'Protein': 1.8, 'Dairy': 0.55, 'Dairy Alternatives': 0.28, 'Grains': 0.18,
  'Vegetables': 0.38, 'Fruits': 0.45, 'Nuts & Seeds': 1.6,
  'Pantry': 0.9, 'Supplements': 2.8, 'Other': 0.5,
}

function toGrams(amount: number, unit: string): number {
  switch (unit.toLowerCase()) {
    case 'oz': return amount * 28.35
    case 'lb': return amount * 453.6
    case 'cup': return amount * 240
    case 'tbsp': return amount * 15
    case 'tsp': return amount * 5
    case 'piece': case 'slice': case 'serving': return amount * 120
    case 'ml': return amount
    default: return amount
  }
}

export function estimatePrice(amount: number, unit: string, category: string): number {
  const grams = toGrams(amount, unit)
  const per100g = PRICE_PER_100G[category] ?? 0.5
  return Math.max(0.10, Math.round((grams / 100) * per100g * 100) / 100)
}

// ─── Normalization ─────────────────────────────────────────────────────────────

function normalizeKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

function normalizeUnit(unit: string): string {
  const u = unit.toLowerCase().trim()
  if (u === 'grams' || u === 'gram') return 'g'
  if (u === 'ounces' || u === 'ounce') return 'oz'
  if (u === 'milliliters' || u === 'milliliter') return 'ml'
  if (u === 'cups' || u === 'cup') return 'cup'
  if (u === 'tablespoon' || u === 'tablespoons' || u === 'tbsp') return 'tbsp'
  if (u === 'teaspoon' || u === 'teaspoons' || u === 'tsp') return 'tsp'
  return u
}

// ─── Main generator ────────────────────────────────────────────────────────────

export function generateGroceryItems(weeklyMealPlan: WeeklyMealPlan | null): {
  items: GroceryItem[]
  count: number
} {
  const raw: Array<{ name: string; amount: number; unit: string }> = []

  const getRecipeMultiplier = (planned: Extract<WeeklyMealPlan['days'][string][keyof WeeklyMealPlan['days'][string]][number], { type: 'recipe' }>) => {
    const amount = planned.recipe_amount
    if (!amount) return 1
    if (amount.kind === 'servings') return Math.max(0, amount.servings)

    const yieldQty = Number(planned.recipe.yield_quantity)
    if (!Number.isFinite(yieldQty) || yieldQty <= 0) return 0
    return Math.max(0, amount.units / yieldQty)
  }

  if (weeklyMealPlan?.days) {
    for (const day of Object.values(weeklyMealPlan.days)) {
      for (const slot of ['breakfast', 'lunch', 'dinner', 'snack'] as const) {
        const items = day[slot]
        if (!items || items.length === 0) continue
        for (const planned of items) {
          if (planned.type === 'recipe') {
            const multiplier = getRecipeMultiplier(planned)
            if (multiplier <= 0) continue
            for (const ing of planned.recipe.ingredients) {
              raw.push({ name: ing.name, amount: ing.amount * multiplier, unit: ing.unit })
            }
          } else if (planned.type === 'saved') {
            for (const item of planned.savedMeal.items) {
              if (item.matched_name && item.amount > 0) {
                raw.push({ name: item.matched_name, amount: item.amount, unit: item.unit || 'serving' })
              }
            }
          } else if (planned.type === 'custom') {
            for (const ing of planned.ingredients) {
              raw.push({ name: ing.name, amount: ing.amount, unit: ing.unit })
            }
          }
        }
      }
    }
  }

  const aggregated = new Map<string, { name: string; amount: number; unit: string }>()
  for (const item of raw) {
    const unit = normalizeUnit(item.unit)
    const key = `${normalizeKey(item.name)}|${unit}`
    if (aggregated.has(key)) {
      aggregated.get(key)!.amount = Math.round((aggregated.get(key)!.amount + item.amount) * 10) / 10
    } else {
      aggregated.set(key, { name: item.name, amount: item.amount, unit: normalizeUnit(item.unit) })
    }
  }

  const items: GroceryItem[] = Array.from(aggregated.values()).map((item) => {
    const category = categorizeIngredient(item.name)
    return {
      ingredient: item.name,
      amount: item.amount,
      unit: item.unit,
      category,
      estimated_price: estimatePrice(item.amount, item.unit, category),
      checked: false,
    }
  })

  items.sort((a, b) =>
    a.category !== b.category ? a.category.localeCompare(b.category) : a.ingredient.localeCompare(b.ingredient)
  )

  return { items, count: items.length }
}
