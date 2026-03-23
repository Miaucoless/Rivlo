'use client'

import React from 'react'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, startOfWeek } from 'date-fns'
import {
  ChefHat, ShoppingCart, Clock, Users, Flame,
  CheckCircle, Circle, Download, Plus, Zap, Pencil, Trash2, X, CalendarDays,
  Coffee, Soup, Moon, Cookie, GlassWater, Search, Loader2, Globe, BookOpen, ChevronDown,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAppStore, type SavedMealTemplate } from '@/store/useAppStore'
import { getTodayISO } from '@/lib/utils'
import { RECIPES } from '@/lib/mock-data'
import type { Recipe, PlannedSlot, CustomMealIngredient } from '@/types'
import { generateGroceryItems, categorizeIngredient, estimatePrice } from '@/lib/grocery-generator'
import type { MealLogEntry } from '@/lib/mock-data'
import {
  type FoodCatalogItem,
  getKnownFoodCatalog,
  primeFoodSearchCache,
  sumMacros,
} from '@/lib/food-search'
import { toast } from 'sonner'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'drink'] as const
type MealType = (typeof MEAL_TYPES)[number]
type MealSource = 'search' | 'manual' | 'recipe'
type SearchMeasureUnit = 'serving' | 'g' | 'oz' | 'ml' | 'fl_oz'

type ManualItemRow = {
  id: string
  name: string
  amount?: number
  unit?: string
  macros: {
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
  }
}

function normalizeFoodText(text: string) {
  return text
    .toLowerCase()
    .replace(/['''`]/g, '') // strip apostrophes so "mcdonald's" → "mcdonalds"
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isDishCombination(itemName: string) {
  const combinationKeywords = [' and ', ' with ', ' & ', ' or ', ' plus ', ' mixed with ', ' blend ', ' combo ']
  const lowerName = itemName.toLowerCase()
  return combinationKeywords.some(keyword => lowerName.includes(keyword))
}

function scoreSuggestion(item: FoodCatalogItem, query: string) {
  const normalizedQuery = normalizeFoodText(query)
  const normalizedName = normalizeFoodText(item.name)
  const baseName = normalizeFoodText(item.name.replace(/\s*\([^)]*\)\s*/g, ''))
  const aliases = item.aliases.map(normalizeFoodText)
  const queryTokens = normalizedQuery.split(' ').filter(Boolean)
  const nameTokens = normalizedName.split(' ').filter(Boolean)

  let score = 0

  if (baseName === normalizedQuery) score += 200
  if (normalizedName === normalizedQuery) score += 180
  if (aliases.includes(normalizedQuery)) score += 140
  if (baseName.startsWith(normalizedQuery)) score += 110
  if (normalizedName.startsWith(normalizedQuery)) score += 90
  if (baseName.includes(normalizedQuery)) score += 60
  if (normalizedName.includes(normalizedQuery)) score += 45

  const overlap = queryTokens.filter((token) => nameTokens.includes(token)).length
  score += overlap * 18

  if (!item.name.includes('(')) score += 22
  if (item.id.startsWith('food-') || item.id.startsWith('ext-')) score += 18
  if (item.id.startsWith('fatsecret-')) score += 12
  if (item.id.startsWith('usda-') && item.name.includes('(')) score -= 18
  if (item.name === item.name.toUpperCase()) score -= 14

  const queryIsDish = isDishCombination(query)
  const itemIsDish = isDishCombination(item.name)
  if (itemIsDish && !queryIsDish) {
    score -= 100
  }

  return score
}

function createManualItemRow(name: string, macros: ManualItemRow['macros'], amount?: number, unit?: string): ManualItemRow {
  return {
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    amount,
    unit,
    macros,
  }
}

function mealTypeLabel(type: MealType) {
  return type.charAt(0).toUpperCase() + type.slice(1)
}

function mealTypePresentation(type: MealType) {
  if (type === 'breakfast') {
    return {
      label: 'Breakfast',
      icon: Coffee,
      dot: 'bg-foreground/70',
      chip: 'border-border/70 bg-muted/40 text-foreground',
      accentText: 'text-foreground',
    }
  }

  if (type === 'lunch') {
    return {
      label: 'Lunch',
      icon: Soup,
      dot: 'bg-foreground/70',
      chip: 'border-border/70 bg-muted/40 text-foreground',
      accentText: 'text-foreground',
    }
  }

  if (type === 'dinner') {
    return {
      label: 'Dinner',
      icon: Moon,
      dot: 'bg-foreground/70',
      chip: 'border-border/70 bg-muted/40 text-foreground',
      accentText: 'text-foreground',
    }
  }

  if (type === 'snack') {
    return {
      label: 'Snack',
      icon: Cookie,
      dot: 'bg-foreground/70',
      chip: 'border-border/70 bg-muted/40 text-foreground',
      accentText: 'text-foreground',
    }
  }

  return {
    label: 'Drink',
    icon: GlassWater,
    dot: 'bg-foreground/70',
    chip: 'border-border/70 bg-muted/40 text-foreground',
    accentText: 'text-foreground',
  }
}

function mealTypeTheme(type: MealType) {
  if (type === 'breakfast') {
    return {
      accent: 'from-amber-400/25 to-orange-400/10',
      border: 'border-amber-500/20',
      badge: 'bg-amber-500/10 text-amber-300',
      text: 'text-amber-300',
      hint: 'Start the day with a strong first meal.',
    }
  }

  if (type === 'lunch') {
    return {
      accent: 'from-sky-400/25 to-cyan-400/10',
      border: 'border-sky-500/20',
      badge: 'bg-sky-500/10 text-sky-300',
      text: 'text-sky-300',
      hint: 'Midday fuel for energy and focus.',
    }
  }

  if (type === 'dinner') {
    return {
      accent: 'from-violet-400/20 to-fuchsia-400/10',
      border: 'border-violet-500/20',
      badge: 'bg-violet-500/10 text-violet-300',
      text: 'text-violet-300',
      hint: 'Close the day with a balanced plate.',
    }
  }

  if (type === 'snack') {
    return {
      accent: 'from-emerald-400/25 to-teal-400/10',
      border: 'border-emerald-500/20',
      badge: 'bg-emerald-500/10 text-emerald-300',
      text: 'text-emerald-300',
      hint: 'Keep hunger down between meals.',
    }
  }

  return {
    accent: 'from-rose-400/20 to-pink-400/10',
    border: 'border-rose-500/20',
    badge: 'bg-rose-500/10 text-rose-300',
    text: 'text-rose-300',
    hint: 'Track shakes, coffees, and drinks.',
  }
}

function RecipeCard({ recipe, compact = false, onClick }: { recipe: Recipe; compact?: boolean; onClick?: () => void }) {
  const mealTypeConfig: Record<string, { dot: string; label: string }> = {
    breakfast: { dot: 'bg-amber-400', label: 'Breakfast' },
    lunch: { dot: 'bg-sky-400', label: 'Lunch' },
    dinner: { dot: 'bg-violet-400', label: 'Dinner' },
    snack: { dot: 'bg-emerald-400', label: 'Snack' },
    drink: { dot: 'bg-rose-400', label: 'Drink' },
  }
  const typeConfig = mealTypeConfig[recipe.meal_type] || mealTypeConfig.snack

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18 }}
      onClick={onClick}
      className="group bg-card border border-border/50 rounded-xl overflow-hidden cursor-pointer hover:border-border hover:shadow-lg transition-all duration-200"
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <p className="font-semibold text-sm leading-tight flex-1 min-w-0">{recipe.name}</p>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className={`w-1.5 h-1.5 rounded-full ${typeConfig.dot}`} />
            <span className="text-[10px] text-muted-foreground font-medium">{typeConfig.label}</span>
          </div>
        </div>

        {!compact && (
          <p className="text-xs text-muted-foreground mb-3 line-clamp-1">{recipe.description}</p>
        )}

        <div className="flex items-center gap-3 text-xs">
          <span className="font-data font-medium tabular-nums">{recipe.macros.calories}<span className="text-muted-foreground font-normal ml-0.5">cal</span></span>
          <span className="text-border/60">·</span>
          <span className="font-data font-medium text-emerald-500 tabular-nums">{recipe.macros.protein_g}g<span className="text-muted-foreground font-normal ml-0.5">prot</span></span>
          {!compact && (
            <>
              <span className="text-border/60">·</span>
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />{recipe.prep_time_min + recipe.cook_time_min}m
              </span>
            </>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function MealEditorModal({
  open,
  onOpenChange,
  initialMealType,
  editingMeal,
  editingSavedMeal,
  onSave,
  onSaveTemplate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialMealType: MealType | null
  editingMeal: MealLogEntry | null
  editingSavedMeal: SavedMealTemplate | null
  onSave: (data: Omit<MealLogEntry, 'id'>) => void
  onSaveTemplate: (meal: Omit<SavedMealTemplate, 'id' | 'updated_at'>, existingId?: string) => void
}) {
  const { savedMeals, customRecipes } = useAppStore()
  const isMealTypeLocked = initialMealType !== null && !editingMeal && !editingSavedMeal
  const allRecipes = useMemo(() => [...customRecipes, ...RECIPES], [customRecipes])

  const [source, setSource] = useState<MealSource>('search')
  const [recipeSearch, setRecipeSearch] = useState('')
  const [recipeTypeFilter, setRecipeTypeFilter] = useState<string>('all')
  const [mealType, setMealType] = useState<MealType>(initialMealType ?? 'breakfast')
  const [recipeId, setRecipeId] = useState<string>('')
  const [recipeMealName, setRecipeMealName] = useState('')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [time, setTime] = useState(format(new Date(), 'h:mm a'))
  const [foodQuery, setFoodQuery] = useState('')
  const [searchMealName, setSearchMealName] = useState('')
  const [searchItemName, setSearchItemName] = useState('')
  const [searchQuantity, setSearchQuantity] = useState('1')
  const [searchUnit, setSearchUnit] = useState<SearchMeasureUnit>('serving')
  const [searchBaseMacros, setSearchBaseMacros] = useState<{ calories: number; protein_g: number; carbs_g: number; fat_g: number } | null>(null)
  const [searchBaseMeasure, setSearchBaseMeasure] = useState<{
    servingLabel: string
    gramsPerServing?: number
    servingMl?: number
  } | null>(null)
  const [searchCalories, setSearchCalories] = useState('')
  const [searchProtein, setSearchProtein] = useState('')
  const [searchCarbs, setSearchCarbs] = useState('')
  const [searchFat, setSearchFat] = useState('')
  const [searchItems, setSearchItems] = useState<ManualItemRow[]>([])
  const [searchSaveAsTemplate, setSearchSaveAsTemplate] = useState(false)
  const [manualMealName, setManualMealName] = useState('')
  const [manualItemName, setManualItemName] = useState('')
  const [manualItemAmount, setManualItemAmount] = useState('')
  const [manualItemUnit, setManualItemUnit] = useState('g')
  const [manualCalories, setManualCalories] = useState('')
  const [manualProtein, setManualProtein] = useState('')
  const [manualCarbs, setManualCarbs] = useState('')
  const [manualFat, setManualFat] = useState('')
  const [manualItems, setManualItems] = useState<ManualItemRow[]>([])
  const [catalogSuggestions, setCatalogSuggestions] = useState<FoodCatalogItem[]>(getKnownFoodCatalog())
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)

  const filteredSuggestions = useMemo(() => {
    const q = normalizeFoodText(foodQuery)
    if (!q || source !== 'search') return []

    const savedMatches = (savedMeals || [])
      .filter((meal) => {
        const isManualTemplate = meal.items.length > 0
        const nameMatch = normalizeFoodText(meal.name).includes(q)
        return isManualTemplate && nameMatch
      })
      .map((meal) => ({
        ...meal,
        _isSavedMeal: true as const,
      }))

    const qTokens = q.split(' ').filter(Boolean)
    const queryIsDish = isDishCombination(foodQuery)
    const catalogMatches = catalogSuggestions
      .filter((item) => {
        const normalizedItemName = normalizeFoodText(item.name)
        // Every query token must appear somewhere in the name or alias (order-independent)
        const nameMatches = qTokens.every((token) => normalizedItemName.includes(token))
        const aliasMatches = item.aliases.some((alias) => {
          const normalizedAlias = normalizeFoodText(alias)
          return qTokens.every((token) => normalizedAlias.includes(token))
        })
        const isDish = isDishCombination(item.name)
        const shouldInclude = !queryIsDish || !isDish
        return (nameMatches || aliasMatches) && shouldInclude
      })
      .sort((left, right) => scoreSuggestion(right, foodQuery) - scoreSuggestion(left, foodQuery))
      .map((item) => ({ ...item, _isSavedMeal: false as const }))

    return [...savedMatches, ...catalogMatches].slice(0, 30)
  }, [catalogSuggestions, foodQuery, savedMeals, source])

  const manualTotals = useMemo(() => {
    return sumMacros(
      manualItems.map((item) => ({ macros: item.macros }))
    )
  }, [manualItems])

  const searchTotals = useMemo(() => {
    return sumMacros(
      searchItems.map((item) => ({ macros: item.macros }))
    )
  }, [searchItems])

  const searchUnitOptions = useMemo(() => {
    const options: Array<{ value: SearchMeasureUnit; label: string }> = [
      { value: 'serving', label: 'Serving' },
      { value: 'g', label: 'g' },
      { value: 'oz', label: 'oz' },
    ]

    if (searchBaseMeasure?.servingMl && searchBaseMeasure.servingMl > 0) {
      options.push({ value: 'ml', label: 'ml' })
      options.push({ value: 'fl_oz', label: 'fl oz' })
    }

    return options
  }, [searchBaseMeasure])

  const filteredModalRecipes = useMemo(() => {
    let list = allRecipes
    if (recipeTypeFilter !== 'all') list = list.filter(r => r.meal_type === recipeTypeFilter)
    if (recipeSearch.trim()) {
      const q = recipeSearch.toLowerCase()
      list = list.filter(r => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q))
    }
    return list
  }, [allRecipes, recipeSearch, recipeTypeFilter])

  const handleSourceChange = (nextSource: MealSource) => {
    if (source === 'recipe' && nextSource !== 'recipe') {
      setRecipeId('')
    }
    setSource(nextSource)
  }

  const handleSelectSuggestion = (item: (SavedMealTemplate & { _isSavedMeal: true }) | (FoodCatalogItem & { _isSavedMeal: false })) => {
    setFoodQuery(item.name)
    setSearchItemName(item.name)
    setSearchMealName(item.name)

    const baseMacros = item._isSavedMeal
      ? {
          calories: item.macros.calories,
          protein_g: item.macros.protein_g,
          carbs_g: item.macros.carbs_g,
          fat_g: item.macros.fat_g,
        }
      : {
          calories: item.macros_per_serving.calories,
          protein_g: item.macros_per_serving.protein_g,
          carbs_g: item.macros_per_serving.carbs_g,
          fat_g: item.macros_per_serving.fat_g,
        }

    setSearchBaseMacros(baseMacros)
    setSearchQuantity('1')
    setSearchUnit('serving')

    if (item._isSavedMeal) {
      setSearchBaseMeasure({ servingLabel: '1 serving' })
    } else {
      const defaultUnit = item.default_serving_unit.toLowerCase()
      const servingMl =
        defaultUnit === 'ml'
          ? item.default_serving_amount
          : defaultUnit === 'fl oz' || defaultUnit === 'fl_oz' || defaultUnit === 'floz'
            ? item.default_serving_amount * 29.5735
            : undefined

      setSearchBaseMeasure({
        servingLabel: item.default_serving_label || `${item.default_serving_amount} ${item.default_serving_unit}`,
        gramsPerServing: item.grams_per_serving,
        servingMl,
      })
    }

    if (item._isSavedMeal) {
      setSearchCalories(String(item.macros.calories))
      setSearchProtein(String(item.macros.protein_g))
      setSearchCarbs(String(item.macros.carbs_g))
      setSearchFat(String(item.macros.fat_g))
    } else {
      setSearchCalories(String(item.macros_per_serving.calories))
      setSearchProtein(String(item.macros_per_serving.protein_g))
      setSearchCarbs(String(item.macros_per_serving.carbs_g))
      setSearchFat(String(item.macros_per_serving.fat_g))
    }

    setShowSuggestions(false)
  }

  useEffect(() => {
    if (!searchBaseMacros) return

    const quantity = Number(searchQuantity)
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setSearchCalories('')
      setSearchProtein('')
      setSearchCarbs('')
      setSearchFat('')
      return
    }

    let multiplier = quantity

    if (searchUnit === 'g' || searchUnit === 'oz') {
      // Fall back to 100g as reference serving when gramsPerServing is unknown
      const gramsPerServing = searchBaseMeasure?.gramsPerServing && searchBaseMeasure.gramsPerServing > 0
        ? searchBaseMeasure.gramsPerServing
        : 100
      const gramsInput = searchUnit === 'g' ? quantity : quantity * 28.3495
      multiplier = gramsInput / gramsPerServing
    }

    if (searchUnit === 'ml' || searchUnit === 'fl_oz') {
      const servingMl = searchBaseMeasure?.servingMl
      if (!servingMl || servingMl <= 0) {
        setSearchCalories('')
        setSearchProtein('')
        setSearchCarbs('')
        setSearchFat('')
        return
      }
      const mlInput = searchUnit === 'ml' ? quantity : quantity * 29.5735
      multiplier = mlInput / servingMl
    }

    const scaledCalories = Math.round(searchBaseMacros.calories * multiplier * 10) / 10
    const scaledProtein = Math.round(searchBaseMacros.protein_g * multiplier * 10) / 10
    const scaledCarbs = Math.round(searchBaseMacros.carbs_g * multiplier * 10) / 10
    const scaledFat = Math.round(searchBaseMacros.fat_g * multiplier * 10) / 10

    setSearchCalories(String(scaledCalories))
    setSearchProtein(String(scaledProtein))
    setSearchCarbs(String(scaledCarbs))
    setSearchFat(String(scaledFat))
  }, [searchBaseMacros, searchBaseMeasure, searchQuantity, searchUnit])

  const addSearchItem = () => {
    const itemName = searchItemName.trim() || foodQuery.trim()
    if (!itemName) {
      toast.error('Select or type an item first.')
      return
    }

    const caloriesNum = Number(searchCalories)
    const proteinNum = Number(searchProtein || 0)
    const carbsNum = Number(searchCarbs || 0)
    const fatNum = Number(searchFat || 0)

    if (!Number.isFinite(caloriesNum) || caloriesNum <= 0) {
      toast.error('Calories must be a valid number greater than 0.')
      return
    }

    const quantity = Number(searchQuantity || 1)
    const hasValidQuantity = Number.isFinite(quantity) && quantity > 0
    const displayUnitLabel =
      searchUnit === 'serving'
        ? `serving${quantity === 1 ? '' : 's'}`
        : searchUnit === 'fl_oz'
          ? 'fl oz'
          : searchUnit
    const displayName = hasValidQuantity && quantity !== 1
      ? `${itemName} (${quantity} ${displayUnitLabel})`
      : itemName

    setSearchItems((rows) => [
      ...rows,
      createManualItemRow(displayName, {
        calories: Math.round(caloriesNum),
        protein_g: Math.round(proteinNum),
        carbs_g: Math.round(carbsNum),
        fat_g: Math.round(fatNum),
      }),
    ])

    if (!searchMealName.trim()) setSearchMealName(itemName)

    setFoodQuery('')
    setSearchItemName('')
    setSearchQuantity('1')
    setSearchUnit('serving')
    setSearchBaseMacros(null)
    setSearchBaseMeasure(null)
    setSearchCalories('')
    setSearchProtein('')
    setSearchCarbs('')
    setSearchFat('')
    setShowSuggestions(false)
    toast.success('Item added to search meal list.')
  }

  const addManualItem = () => {
    const itemName = manualItemName.trim()
    if (!itemName) {
      toast.error('Add an item name first.')
      return
    }

    const caloriesNum = Number(manualCalories)
    const proteinNum = Number(manualProtein || 0)
    const carbsNum = Number(manualCarbs || 0)
    const fatNum = Number(manualFat || 0)

    if (!Number.isFinite(caloriesNum) || caloriesNum <= 0) {
      toast.error('Calories must be a valid number greater than 0.')
      return
    }

    const amountNum = manualItemAmount ? Number(manualItemAmount) : undefined

    setManualItems((rows) => [
      ...rows,
      createManualItemRow(
        itemName,
        {
          calories: Math.round(caloriesNum),
          protein_g: Math.round(proteinNum),
          carbs_g: Math.round(carbsNum),
          fat_g: Math.round(fatNum),
        },
        amountNum && Number.isFinite(amountNum) && amountNum > 0 ? amountNum : undefined,
        manualItemUnit || undefined,
      ),
    ])

    if (!manualMealName.trim()) setManualMealName(itemName)

    setManualItemName('')
    setManualItemAmount('')
    setManualCalories('')
    setManualProtein('')
    setManualCarbs('')
    setManualFat('')
    toast.success('Item added to manual list.')
  }

  useEffect(() => {
    if (source !== 'search') return
    const query = foodQuery.trim()
    if (query.length < 3) {
      setSearchLoading(false)
      return
    }

    setSearchLoading(true)
    const timer = setTimeout(async () => {
      // Run existing catalog search + API Ninjas nutrition in parallel
      const [inserted] = await Promise.all([
        primeFoodSearchCache(query),
        (async () => {
          try {
            const res = await fetch(`/api/nutrition?query=${encodeURIComponent(query)}`)
            if (!res.ok) return
            const items: Array<{
              name: string
              calories: number
              serving_size_g: number
              fat_total_g: number
              protein_g: number
              carbohydrates_total_g: number
              fiber_g: number
            }> = await res.json()

            if (!Array.isArray(items) || items.length === 0) return

            // Convert to FoodCatalogItem and insert into catalog
            const ninjaItems: import('@/lib/food-search').FoodCatalogItem[] = items.map((item) => ({
              id: `ninja-food-${item.name.toLowerCase().replace(/\s+/g, '-')}`,
              name: item.name.charAt(0).toUpperCase() + item.name.slice(1),
              aliases: [],
              default_serving_amount: 100,
              default_serving_unit: 'g',
              default_serving_label: '100g',
              grams_per_serving: item.serving_size_g || 100,
              macros_per_serving: {
                calories: Math.round(item.calories),
                protein_g: Math.round(item.protein_g * 10) / 10,
                carbs_g: Math.round(item.carbohydrates_total_g * 10) / 10,
                fat_g: Math.round(item.fat_total_g * 10) / 10,
                fiber_g: Math.round(item.fiber_g * 10) / 10,
              },
            }))

            setCatalogSuggestions((prev) => {
              const existingIds = new Set(prev.map((i) => i.id))
              const newItems = ninjaItems.filter((i) => !existingIds.has(i.id))
              return newItems.length > 0 ? [...prev, ...newItems] : prev
            })
          } catch {
            // ignore nutrition API errors silently
          }
        })(),
      ])

      if (inserted > 0) {
        setCatalogSuggestions(getKnownFoodCatalog())
      }
      setSearchLoading(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [foodQuery, source])

  useEffect(() => {
    if (!open) return
    if (editingSavedMeal) {
      setSource('manual')
      setMealType(editingSavedMeal.meal_type)
      setRecipeId('')
      setRecipeMealName('')
      setCalories(String(editingSavedMeal.macros.calories))
      setProtein(String(editingSavedMeal.macros.protein_g))
      setCarbs(String(editingSavedMeal.macros.carbs_g))
      setFat(String(editingSavedMeal.macros.fat_g))
      setTime(format(new Date(), 'h:mm a'))
      setFoodQuery('')
      setSearchMealName('')
      setSearchItemName('')
      setSearchQuantity('1')
      setSearchUnit('serving')
      setSearchBaseMacros(null)
      setSearchBaseMeasure(null)
      setSearchCalories('')
      setSearchProtein('')
      setSearchCarbs('')
      setSearchFat('')
      setSearchItems([])
      setSearchSaveAsTemplate(false)
      setShowSuggestions(false)
      setManualMealName(editingSavedMeal.name)
      setManualItemName(editingSavedMeal.name)
      setManualCalories(String(editingSavedMeal.macros.calories))
      setManualProtein(String(editingSavedMeal.macros.protein_g))
      setManualCarbs(String(editingSavedMeal.macros.carbs_g))
      setManualFat(String(editingSavedMeal.macros.fat_g))
      setManualItems([])
      return
    }

    if (editingMeal) {
      const editSource: MealSource = editingMeal.recipe
        ? 'recipe'
        : editingMeal.entry_source === 'manual'
          ? 'manual'
          : 'search'
      const storedItems = editingMeal.meal_items || []

      setSource(editSource)
      setMealType(editingMeal.meal_type)
      setRecipeId(editingMeal.recipe?.id || '')
      setRecipeMealName(editingMeal.recipe ? editingMeal.name : '')
      setCalories(String(editingMeal.macros.calories))
      setProtein(String(editingMeal.macros.protein_g))
      setCarbs(String(editingMeal.macros.carbs_g))
      setFat(String(editingMeal.macros.fat_g))
      setTime(editingMeal.time)
      setFoodQuery(editSource === 'search' ? editingMeal.name : '')
      setSearchMealName(editSource === 'search' ? editingMeal.name : '')
      setSearchItemName(editSource === 'search' ? editingMeal.name : '')
      setSearchQuantity('1')
      setSearchUnit('serving')
      setSearchBaseMacros(null)
      setSearchBaseMeasure(null)
      setSearchCalories(editSource === 'search' ? String(editingMeal.macros.calories) : '')
      setSearchProtein(editSource === 'search' ? String(editingMeal.macros.protein_g) : '')
      setSearchCarbs(editSource === 'search' ? String(editingMeal.macros.carbs_g) : '')
      setSearchFat(editSource === 'search' ? String(editingMeal.macros.fat_g) : '')
      setSearchSaveAsTemplate(false)
      setSearchItems(
        editSource !== 'search'
          ? []
          : storedItems.length > 0
            ? storedItems.map((item) =>
                createManualItemRow(item.name, {
                  calories: item.macros.calories,
                  protein_g: item.macros.protein_g,
                  carbs_g: item.macros.carbs_g,
                  fat_g: item.macros.fat_g,
                })
              )
            : [
                createManualItemRow(editingMeal.name, {
                  calories: editingMeal.macros.calories,
                  protein_g: editingMeal.macros.protein_g,
                  carbs_g: editingMeal.macros.carbs_g,
                  fat_g: editingMeal.macros.fat_g,
                }),
              ]
      )
      setShowSuggestions(false)
      setManualMealName(editSource === 'manual' ? editingMeal.name : '')
      setManualItemName(editSource === 'manual' ? editingMeal.name : '')
      setManualCalories(editSource === 'manual' ? String(editingMeal.macros.calories) : '')
      setManualProtein(editSource === 'manual' ? String(editingMeal.macros.protein_g) : '')
      setManualCarbs(editSource === 'manual' ? String(editingMeal.macros.carbs_g) : '')
      setManualFat(editSource === 'manual' ? String(editingMeal.macros.fat_g) : '')
      setManualItems(
        editSource !== 'manual'
          ? []
          : storedItems.length > 0
            ? storedItems.map((item) =>
                createManualItemRow(item.name, {
                  calories: item.macros.calories,
                  protein_g: item.macros.protein_g,
                  carbs_g: item.macros.carbs_g,
                  fat_g: item.macros.fat_g,
                })
              )
            : [
                createManualItemRow(editingMeal.name, {
                  calories: editingMeal.macros.calories,
                  protein_g: editingMeal.macros.protein_g,
                  carbs_g: editingMeal.macros.carbs_g,
                  fat_g: editingMeal.macros.fat_g,
                }),
              ]
      )
    } else {
      setSource('search')
      setMealType(initialMealType ?? 'breakfast')
      setRecipeId('')
      setRecipeMealName('')
      setCalories('')
      setProtein('')
      setCarbs('')
      setFat('')
      setTime(format(new Date(), 'h:mm a'))
      setFoodQuery('')
      setSearchMealName('')
      setSearchItemName('')
      setSearchQuantity('1')
      setSearchUnit('serving')
      setSearchBaseMacros(null)
      setSearchBaseMeasure(null)
      setSearchCalories('')
      setSearchProtein('')
      setSearchCarbs('')
      setSearchFat('')
      setSearchItems([])
      setSearchSaveAsTemplate(false)
      setShowSuggestions(false)
      setManualMealName('')
      setManualItemName('')
      setManualItemAmount('')
      setManualItemUnit('g')
      setManualCalories('')
      setManualProtein('')
      setManualCarbs('')
      setManualFat('')
      setManualItems([])
    }
  }, [editingMeal, editingSavedMeal, initialMealType, open])

  useEffect(() => {
    if (source !== 'recipe' || !recipeId) return
    const recipe = allRecipes.find((r) => r.id === recipeId)
    if (!recipe) return
    setMealType(recipe.meal_type)
    setRecipeMealName(recipe.name)
    setCalories(String(recipe.macros.calories))
    setProtein(String(recipe.macros.protein_g))
    setCarbs(String(recipe.macros.carbs_g))
    setFat(String(recipe.macros.fat_g))
  }, [recipeId, source, allRecipes])

  const handleSave = () => {
    if (source === 'search') {
      const usingList = searchItems.length > 0
      const singleName = (searchItemName.trim() || foodQuery.trim())
      const singleCalories = Number(searchCalories)
      const singleProtein = Number(searchProtein || 0)
      const singleCarbs = Number(searchCarbs || 0)
      const singleFat = Number(searchFat || 0)

      if (!usingList && !singleName) {
        toast.error('Add a search item first.')
        return
      }

      if (!usingList && (!Number.isFinite(singleCalories) || singleCalories <= 0)) {
        toast.error('Calories must be a valid number greater than 0.')
        return
      }

      if (searchSaveAsTemplate && !searchMealName.trim()) {
        toast.error('Add a meal name first.')
        return
      }

      const finalMacros = usingList
        ? {
            calories: Math.round(searchTotals.calories),
            protein_g: Math.round(searchTotals.protein_g),
            carbs_g: Math.round(searchTotals.carbs_g),
            fat_g: Math.round(searchTotals.fat_g),
          }
        : {
            calories: Math.round(singleCalories),
            protein_g: Math.round(singleProtein),
            carbs_g: Math.round(singleCarbs),
            fat_g: Math.round(singleFat),
          }

      const finalName =
        searchMealName.trim() ||
        (usingList
          ? searchItems.length === 1
            ? searchItems[0].name
            : 'Search meal total'
          : singleName)

      const mealItems = usingList
        ? searchItems.map((item) => ({
            name: item.name,
            macros: {
              calories: item.macros.calories,
              protein_g: item.macros.protein_g,
              carbs_g: item.macros.carbs_g,
              fat_g: item.macros.fat_g,
            },
          }))
        : [
            {
              name: singleName,
              macros: {
                calories: Math.round(singleCalories),
                protein_g: Math.round(singleProtein),
                carbs_g: Math.round(singleCarbs),
                fat_g: Math.round(singleFat),
              },
            },
          ]

      if (searchSaveAsTemplate) {
        onSaveTemplate({
          name: finalName,
          meal_type: mealType,
          macros: finalMacros,
          items: mealItems.map((item) => ({
            input: item.name,
            matched_name: item.name,
            amount: 1,
            unit: 'serving',
          })),
        })
      }

      onSave({
        meal_type: mealType,
        name: finalName,
        macros: finalMacros,
        time: time.trim() || format(new Date(), 'h:mm a'),
        recipe: null,
        meal_items: mealItems,
        entry_source: 'search',
      })

      onOpenChange(false)
      return
    }

    if (source === 'manual') {
      const usingList = manualItems.length > 0
      const singleName = manualItemName.trim()
      const singleCalories = Number(manualCalories)
      const singleProtein = Number(manualProtein || 0)
      const singleCarbs = Number(manualCarbs || 0)
      const singleFat = Number(manualFat || 0)

      if (!usingList && !singleName) {
        toast.error('Add a manual item name first.')
        return
      }

      if (!usingList && (!Number.isFinite(singleCalories) || singleCalories <= 0)) {
        toast.error('Calories must be a valid number greater than 0.')
        return
      }

      const finalMacros = usingList
        ? {
            calories: Math.round(manualTotals.calories),
            protein_g: Math.round(manualTotals.protein_g),
            carbs_g: Math.round(manualTotals.carbs_g),
            fat_g: Math.round(manualTotals.fat_g),
          }
        : {
            calories: Math.round(singleCalories),
            protein_g: Math.round(singleProtein),
            carbs_g: Math.round(singleCarbs),
            fat_g: Math.round(singleFat),
          }

      const finalName =
        manualMealName.trim() ||
        (usingList
          ? manualItems.length === 1
            ? manualItems[0].name
            : 'Manual meal total'
          : singleName)

      const manualTemplateItems = usingList
        ? manualItems.map((item) => ({
            input: item.name,
            matched_name: item.name,
            amount: 1,
            unit: 'serving',
          }))
        : [
            {
              input: singleName,
              matched_name: singleName,
              amount: 1,
              unit: 'serving',
            },
          ]

      if (editingSavedMeal) {
        onSaveTemplate(
          {
            name: finalName,
            meal_type: mealType,
            macros: finalMacros,
            items: manualTemplateItems,
          },
          editingSavedMeal.id
        )

        onOpenChange(false)
        return
      }

      onSave({
        meal_type: mealType,
        name: finalName,
        macros: finalMacros,
        time: time.trim() || format(new Date(), 'h:mm a'),
        recipe: null,
        meal_items: usingList
          ? manualItems.map((item) => ({
              name: item.name,
              macros: {
                calories: item.macros.calories,
                protein_g: item.macros.protein_g,
                carbs_g: item.macros.carbs_g,
                fat_g: item.macros.fat_g,
              },
            }))
          : [
              {
                name: singleName,
                macros: {
                  calories: Math.round(singleCalories),
                  protein_g: Math.round(singleProtein),
                  carbs_g: Math.round(singleCarbs),
                  fat_g: Math.round(singleFat),
                },
              },
            ],
        entry_source: 'manual',
      })

      onOpenChange(false)
      return
    }

    if (!recipeId) {
      toast.error('Select a recipe first.')
      return
    }

    const caloriesNum = Number(calories)
    const proteinNum = Number(protein || 0)
    const carbsNum = Number(carbs || 0)
    const fatNum = Number(fat || 0)

    if (!Number.isFinite(caloriesNum) || caloriesNum <= 0) {
      toast.error('Calories must be a valid number greater than 0.')
      return
    }

    const finalMacros = {
      calories: Math.round(caloriesNum),
      protein_g: Math.round(proteinNum),
      carbs_g: Math.round(carbsNum),
      fat_g: Math.round(fatNum),
    }

    const linkedRecipe = source === 'recipe' ? allRecipes.find((r) => r.id === recipeId) || null : null

    onSave({
      meal_type: mealType,
      name: recipeMealName.trim() || linkedRecipe?.name || 'Recipe meal',
      macros: finalMacros,
      time: time.trim() || format(new Date(), 'h:mm a'),
      recipe: linkedRecipe,
      meal_items: [],
      entry_source: 'recipe',
    })

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingSavedMeal ? 'Edit saved meal' : editingMeal ? 'Edit meal entry' : 'Add meal entry'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pr-1">
          {!isMealTypeLocked && !editingMeal && !editingSavedMeal && (
            <div className="space-y-1.5">
              <Label>Meal type</Label>
              <Select value={mealType} onValueChange={(v) => setMealType(v as MealType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEAL_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{mealTypeLabel(type)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(isMealTypeLocked || editingMeal || editingSavedMeal) && (
            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Meal type</p>
                <p className="text-sm font-medium">{mealTypeLabel(mealType)}</p>
              </div>
              <Badge variant="outline" className="capitalize">{mealType}</Badge>
            </div>
          )}

          <Tabs value={source} onValueChange={(value) => handleSourceChange(value as MealSource)} className="space-y-4">
            <TabsList className="grid grid-cols-3 gap-2 h-auto bg-transparent p-0">
              <TabsTrigger value="search" className="text-xs rounded-lg border border-border/60 bg-muted/30 px-3 py-2 transition-colors hover:bg-accent/70 hover:text-foreground data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground focus-visible:ring-1 focus-visible:ring-primary/30">Search</TabsTrigger>
              <TabsTrigger value="manual" className="text-xs rounded-lg border border-border/60 bg-muted/30 px-3 py-2 transition-colors hover:bg-accent/70 hover:text-foreground data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground focus-visible:ring-1 focus-visible:ring-primary/30">Manual Input</TabsTrigger>
              <TabsTrigger value="recipe" className="text-xs rounded-lg border border-border/60 bg-muted/30 px-3 py-2 transition-colors hover:bg-accent/70 hover:text-foreground data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground focus-visible:ring-1 focus-visible:ring-primary/30">Recipes</TabsTrigger>
            </TabsList>

            <TabsContent value="search" className="mt-0 space-y-4">
              <div className="space-y-1.5 relative">
                <Label>Search food or meal name</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    value={foodQuery}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
                    onChange={(e) => {
                      const value = e.target.value
                      setFoodQuery(value)
                      setSearchMealName(value)
                      setSearchItemName(value)
                      setSearchBaseMacros(null)
                      setSearchQuantity('1')
                      setShowSuggestions(true)
                    }}
                    placeholder="e.g. chicken breast, Greek yogurt…"
                    className="pl-9"
                    autoFocus
                  />
                </div>
                {showSuggestions && foodQuery.trim().length > 0 && (filteredSuggestions.length > 0 || searchLoading) && (
                  <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
                    {filteredSuggestions.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectSuggestion(item)}
                        className="w-full px-3 py-2 text-left hover:bg-accent transition-colors border-b border-border/30 last:border-b-0"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          {item._isSavedMeal && (
                            <Badge variant="outline" className="text-[10px]">Saved</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {item._isSavedMeal
                            ? `Calories: ${item.macros.calories} • Protein: ${item.macros.protein_g}g`
                            : `Calories: ${item.macros_per_serving.calories} • Protein: ${item.macros_per_serving.protein_g}g`}
                        </p>
                      </button>
                    ))}
                    {searchLoading && (
                      <div className="flex items-center gap-2 px-3 py-2.5 text-xs text-muted-foreground border-t border-border/30">
                        <svg className="animate-spin h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Searching food databases…
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-border/70 bg-background/50 p-3">
                <p className="text-xs font-semibold mb-3 uppercase tracking-[0.16em] text-muted-foreground">Nutrition</p>
                <div className="space-y-1.5 mb-3">
                  <Label className="text-xs">Amount</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={searchQuantity}
                      onChange={(e) => setSearchQuantity(e.target.value)}
                      placeholder="1"
                      className="col-span-2"
                    />
                    <Select value={searchUnit} onValueChange={(value) => setSearchUnit(value as SearchMeasureUnit)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {searchUnitOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {searchBaseMeasure
                      ? searchBaseMeasure.gramsPerServing && searchBaseMeasure.gramsPerServing > 0
                        ? `1 serving is ${searchBaseMeasure.servingLabel}.`
                        : `1 serving is ${searchBaseMeasure.servingLabel}. g/oz estimated from 100g reference.`
                      : 'Pick a search result to see serving details.'}
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Calories</Label>
                    <Input type="number" value={searchCalories} onChange={(e) => {
                      setSearchCalories(e.target.value)
                      setSearchBaseMacros(null)
                      setSearchBaseMeasure(null)
                    }} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Protein</Label>
                    <Input type="number" value={searchProtein} onChange={(e) => {
                      setSearchProtein(e.target.value)
                      setSearchBaseMacros(null)
                      setSearchBaseMeasure(null)
                    }} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Carbs</Label>
                    <Input type="number" value={searchCarbs} onChange={(e) => {
                      setSearchCarbs(e.target.value)
                      setSearchBaseMacros(null)
                      setSearchBaseMeasure(null)
                    }} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Fat</Label>
                    <Input type="number" value={searchFat} onChange={(e) => {
                      setSearchFat(e.target.value)
                      setSearchBaseMacros(null)
                      setSearchBaseMeasure(null)
                    }} />
                  </div>
                </div>
                <Button type="button" variant="outline" className="w-full mt-3" onClick={addSearchItem}>
                  Add item to meal
                </Button>
              </div>

              {searchItems.length > 0 ? (
                <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3">
                  <div className="space-y-2">
                    {searchItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-md border border-border/60 px-2.5 py-2">
                        <div>
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Cal: {item.macros.calories} • Protein: {item.macros.protein_g} • Carb: {item.macros.carbs_g} • Fat: {item.macros.fat_g}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setSearchItems((rows) => rows.filter((row) => row.id !== item.id))}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-md border border-border/60 bg-background/60 px-3 py-2">
                    <p className="text-xs font-semibold mb-1 text-muted-foreground">Total macros</p>
                    <p className="text-sm">
                      Cal: {Math.round(searchTotals.calories)} • Protein: {Math.round(searchTotals.protein_g)} • Carb: {Math.round(searchTotals.carbs_g)} • Fat: {Math.round(searchTotals.fat_g)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Add one or multiple items to auto-calculate totals before saving this meal entry.
                </p>
              )}

              <button
                type="button"
                onClick={() => setSearchSaveAsTemplate((value) => !value)}
                className={`w-full rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                  searchSaveAsTemplate
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                    : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                {searchSaveAsTemplate ? '✓ Add to Saved Meals enabled' : 'Add to Saved Meals'}
              </button>

              {searchSaveAsTemplate && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Saved meal name</Label>
                  <Input
                    value={searchMealName}
                    onChange={(e) => setSearchMealName(e.target.value)}
                    placeholder="e.g. Post-workout shake"
                  />
                </div>
              )}
            </TabsContent>

            <TabsContent value="manual" className="mt-0 space-y-4">
              {editingSavedMeal && (
                <div className="space-y-1.5">
                  <Label>Saved meal name</Label>
                  <Input
                    value={manualMealName}
                    onChange={(e) => setManualMealName(e.target.value)}
                    placeholder="e.g. High-protein lunch bowl"
                  />
                </div>
              )}

              <div className="rounded-lg border border-border/70 bg-background/50 p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Add manual item</p>
                <div className="space-y-1.5">
                  <Label className="text-xs">Item name</Label>
                  <Input value={manualItemName} onChange={(e) => setManualItemName(e.target.value)} placeholder="e.g. Avocado toast" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Amount</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={manualItemAmount}
                      onChange={(e) => setManualItemAmount(e.target.value)}
                      placeholder="e.g. 200"
                      className="col-span-2"
                    />
                    <Select value={manualItemUnit} onValueChange={setManualItemUnit}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="g">g</SelectItem>
                        <SelectItem value="oz">oz</SelectItem>
                        <SelectItem value="ml">ml</SelectItem>
                        <SelectItem value="fl oz">fl oz</SelectItem>
                        <SelectItem value="serving">serving</SelectItem>
                        <SelectItem value="cup">cup</SelectItem>
                        <SelectItem value="tbsp">tbsp</SelectItem>
                        <SelectItem value="tsp">tsp</SelectItem>
                        <SelectItem value="piece">piece</SelectItem>
                        <SelectItem value="slice">slice</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Calories</Label>
                    <Input type="number" value={manualCalories} onChange={(e) => setManualCalories(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Protein</Label>
                    <Input type="number" value={manualProtein} onChange={(e) => setManualProtein(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Carbs</Label>
                    <Input type="number" value={manualCarbs} onChange={(e) => setManualCarbs(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Fat</Label>
                    <Input type="number" value={manualFat} onChange={(e) => setManualFat(e.target.value)} />
                  </div>
                </div>
                <Button type="button" variant="outline" className="w-full" onClick={addManualItem}>
                  Add item to meal
                </Button>
              </div>

              {manualItems.length > 0 ? (
                <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3">
                  <div className="space-y-2">
                    {manualItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-md border border-border/60 px-2.5 py-2">
                        <div>
                          <p className="text-sm font-medium">
                            {item.name}
                            {item.amount != null && item.unit && (
                              <span className="ml-1.5 text-xs font-normal text-muted-foreground">({item.amount}{item.unit})</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Cal: {item.macros.calories} • Protein: {item.macros.protein_g} • Carb: {item.macros.carbs_g} • Fat: {item.macros.fat_g}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setManualItems((rows) => rows.filter((row) => row.id !== item.id))}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-md border border-border/60 bg-background/60 px-3 py-2">
                    <p className="text-xs font-semibold mb-1 text-muted-foreground">Total macros</p>
                    <p className="text-sm">
                      Cal: {Math.round(manualTotals.calories)} • Protein: {Math.round(manualTotals.protein_g)} • Carb: {Math.round(manualTotals.carbs_g)} • Fat: {Math.round(manualTotals.fat_g)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Add multiple items to auto-calculate totals, or leave one item in the form and press save.
                </p>
              )}
            </TabsContent>

            <TabsContent value="recipe" className="mt-0 space-y-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  value={recipeSearch}
                  onChange={e => setRecipeSearch(e.target.value)}
                  placeholder="Search recipes…"
                  className="pl-9 h-9"
                />
              </div>

              {/* Meal type filter chips */}
              <div className="flex flex-wrap gap-1.5">
                {(['all', 'breakfast', 'lunch', 'dinner', 'snack'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setRecipeTypeFilter(t)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                      recipeTypeFilter === t
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/40 text-muted-foreground border-border/50 hover:text-foreground'
                    }`}
                  >
                    {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
                <span className="text-[10px] text-muted-foreground ml-auto self-center tabular-nums">
                  {filteredModalRecipes.length} recipe{filteredModalRecipes.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Recipe list */}
              <div className="max-h-52 overflow-y-auto overscroll-contain space-y-1.5 pr-0.5">
                {filteredModalRecipes.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8">No recipes match.</p>
                )}
                {filteredModalRecipes.map(recipe => {
                  const isCustom = customRecipes.some(r => r.id === recipe.id)
                  const isSelected = recipeId === recipe.id
                  return (
                    <button
                      key={recipe.id}
                      type="button"
                      onClick={() => setRecipeId(recipe.id)}
                      className={`w-full text-left rounded-xl border px-3 py-2.5 transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10'
                          : 'border-border/50 bg-muted/20 hover:bg-muted/40 hover:border-border'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-medium truncate">{recipe.name}</p>
                            {isCustom && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium shrink-0">My Recipe</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{recipe.description}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-data text-sm font-semibold tabular-nums">{recipe.macros.calories}</p>
                          <p className="text-[10px] text-muted-foreground">kcal</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span className="font-data text-emerald-500">{recipe.macros.protein_g}g prot</span>
                        <span>{recipe.macros.carbs_g}g carb</span>
                        <span>{recipe.macros.fat_g}g fat</span>
                        <span className="ml-auto flex items-center gap-1"><Clock className="w-3 h-3" />{recipe.prep_time_min + recipe.cook_time_min}m</span>
                      </div>
                    </button>
                  )
                })}
              </div>

              {recipeId && (
                <>
                  <div className="space-y-1.5">
                    <Label>Meal name</Label>
                    <Input value={recipeMealName} onChange={(e) => setRecipeMealName(e.target.value)} placeholder="e.g. Chicken wrap" />
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Calories</Label>
                      <Input type="number" value={calories} onChange={(e) => setCalories(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Protein</Label>
                      <Input type="number" value={protein} onChange={(e) => setProtein(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Carbs</Label>
                      <Input type="number" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Fat</Label>
                      <Input type="number" value={fat} onChange={(e) => setFat(e.target.value)} />
                    </div>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>

          <Button onClick={handleSave} className="w-full" variant="brand">
            {editingSavedMeal ? 'Update saved meal' : editingMeal ? 'Save changes' : 'Add meal'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function RecipeDetailModal({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="font-display font-bold text-xl tracking-tight">
          {recipe.name}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-6">
        {/* Macro stats */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Calories', value: recipe.macros.calories, unit: 'kcal', accent: 'border-border/50 bg-muted/30' },
            { label: 'Protein', value: recipe.macros.protein_g, unit: 'g', accent: 'border-emerald-500/20 bg-emerald-500/5' },
            { label: 'Carbs', value: recipe.macros.carbs_g, unit: 'g', accent: 'border-border/50 bg-muted/30' },
            { label: 'Fat', value: recipe.macros.fat_g, unit: 'g', accent: 'border-border/50 bg-muted/30' },
          ].map((s) => (
            <div key={s.label} className={`border rounded-xl p-3 text-center ${s.accent}`}>
              <p className="font-data text-2xl font-bold tabular-nums">{s.value}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-5 text-xs text-muted-foreground pb-4 border-b border-border/50">
          <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Prep <span className="font-data font-medium text-foreground">{recipe.prep_time_min}m</span></span>
          <span className="flex items-center gap-1.5"><Flame className="w-3.5 h-3.5" />Cook <span className="font-data font-medium text-foreground">{recipe.cook_time_min}m</span></span>
          <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /><span className="font-data font-medium text-foreground">{recipe.servings}</span> serving</span>
          <div className="flex flex-wrap gap-1 ml-auto">
            {recipe.tags.map((tag) => (
              <span key={tag} className="text-[10px] px-2.5 py-1 rounded-full border border-border/50 bg-muted/20 text-muted-foreground">{tag}</span>
            ))}
          </div>
        </div>

        {/* Ingredients */}
        <div>
          <h3 className="font-display font-semibold text-sm mb-3 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-muted-foreground" />
            Ingredients
          </h3>
          <div className="rounded-xl border border-border/50 overflow-hidden">
            {recipe.ingredients.map((ing, i) => (
              <div key={ing.id} className={`flex items-center justify-between px-4 py-2.5 ${i < recipe.ingredients.length - 1 ? 'border-b border-border/30' : ''}`}>
                <span className="text-sm">{ing.name}</span>
                <span className="font-data text-xs text-muted-foreground font-medium">{ing.amount}{ing.unit}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <div>
          <h3 className="font-display font-semibold text-sm mb-3 flex items-center gap-2">
            <ChefHat className="w-4 h-4 text-muted-foreground" />
            Instructions
          </h3>
          <ol className="space-y-3">
            {recipe.instructions.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="font-data w-6 h-6 rounded-lg bg-muted text-muted-foreground text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p className="text-sm text-muted-foreground leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </DialogContent>
  )
}

type RecipeIngredientRow = { id: string; name: string; amount: string; unit: string }

function CreateRecipeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { addCustomRecipe } = useAppStore()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [mealType, setMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('lunch')
  const [prepTime, setPrepTime] = useState('10')
  const [cookTime, setCookTime] = useState('20')
  const [servings, setServings] = useState('1')
  const [ingredients, setIngredients] = useState<RecipeIngredientRow[]>([])
  const [ingName, setIngName] = useState('')
  const [ingAmount, setIngAmount] = useState('')
  const [ingUnit, setIngUnit] = useState('g')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [instructions, setInstructions] = useState('')
  const [tags, setTags] = useState('')

  function reset() {
    setName(''); setDescription(''); setMealType('lunch')
    setPrepTime('10'); setCookTime('20'); setServings('1')
    setIngredients([]); setIngName(''); setIngAmount(''); setIngUnit('g')
    setCalories(''); setProtein(''); setCarbs(''); setFat('')
    setInstructions(''); setTags('')
  }

  function addIngredient() {
    if (!ingName.trim()) return
    setIngredients(prev => [...prev, {
      id: `ing-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: ingName.trim(), amount: ingAmount, unit: ingUnit,
    }])
    setIngName(''); setIngAmount(''); setIngUnit('g')
  }

  function handleSave() {
    if (!name.trim()) { toast.error('Recipe name is required.'); return }
    const cal = Number(calories)
    if (!cal || !Number.isFinite(cal) || cal <= 0) { toast.error('Enter valid calories.'); return }
    const recipeIngredients = ingredients.map((ing, i) => ({
      id: `ri-${i}`,
      name: ing.name,
      amount: Number(ing.amount) || 0,
      unit: ing.unit,
      calories_per_unit: 0,
      macros: { protein_g: 0, carbs_g: 0, fat_g: 0 },
    }))
    const tagList = tags.split(',').map(t => t.trim()).filter(Boolean)
    const instrList = instructions.split('\n').map(s => s.trim()).filter(Boolean)
    addCustomRecipe({
      id: `cr-${Date.now()}`,
      name: name.trim(),
      description: description.trim() || name.trim(),
      meal_type: mealType,
      prep_time_min: Number(prepTime) || 0,
      cook_time_min: Number(cookTime) || 0,
      servings: Number(servings) || 1,
      ingredients: recipeIngredients,
      instructions: instrList,
      macros: {
        calories: Math.round(cal),
        protein_g: Math.round(Number(protein) || 0),
        carbs_g: Math.round(Number(carbs) || 0),
        fat_g: Math.round(Number(fat) || 0),
      },
      tags: tagList,
    })
    toast.success(`"${name.trim()}" saved to your recipes.`)
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Recipe</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pr-1">
          {/* Basic info */}
          <div className="space-y-1.5">
            <Label>Recipe name <span className="text-destructive">*</span></Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. High-Protein Oat Bowl" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Short description…" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Meal type</Label>
              <Select value={mealType} onValueChange={v => setMealType(v as typeof mealType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="breakfast">Breakfast</SelectItem>
                  <SelectItem value="lunch">Lunch</SelectItem>
                  <SelectItem value="dinner">Dinner</SelectItem>
                  <SelectItem value="snack">Snack</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Servings</Label>
              <Input type="number" min="1" value={servings} onChange={e => setServings(e.target.value)} placeholder="1" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Prep time (min)</Label>
              <Input type="number" min="0" value={prepTime} onChange={e => setPrepTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Cook time (min)</Label>
              <Input type="number" min="0" value={cookTime} onChange={e => setCookTime(e.target.value)} />
            </div>
          </div>

          {/* Macros */}
          <div className="rounded-lg border border-border/70 bg-muted/20 p-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Macros (per serving) <span className="text-destructive">*</span></p>
            <div className="grid grid-cols-4 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Calories</Label>
                <Input type="number" value={calories} onChange={e => setCalories(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Protein (g)</Label>
                <Input type="number" value={protein} onChange={e => setProtein(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Carbs (g)</Label>
                <Input type="number" value={carbs} onChange={e => setCarbs(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fat (g)</Label>
                <Input type="number" value={fat} onChange={e => setFat(e.target.value)} placeholder="0" />
              </div>
            </div>
          </div>

          {/* Ingredients */}
          <div className="rounded-lg border border-border/70 bg-muted/20 p-3 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Ingredients (optional)</p>
            <div className="flex gap-2">
              <Input
                value={ingName}
                onChange={e => setIngName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addIngredient() }}}
                placeholder="e.g. Chicken breast"
                className="flex-1"
              />
              <Input type="number" value={ingAmount} onChange={e => setIngAmount(e.target.value)} placeholder="100" className="w-20" />
              <Select value={ingUnit} onValueChange={setIngUnit}>
                <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['g', 'oz', 'ml', 'cup', 'tbsp', 'tsp', 'piece', 'slice', 'serving'].map(u => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="sm" onClick={addIngredient}>Add</Button>
            </div>
            {ingredients.length > 0 && (
              <div className="space-y-1">
                {ingredients.map(ing => (
                  <div key={ing.id} className="flex items-center justify-between text-sm rounded-md border border-border/50 px-2.5 py-1.5">
                    <span>{ing.name}{ing.amount ? ` — ${ing.amount}${ing.unit}` : ''}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6"
                      onClick={() => setIngredients(prev => prev.filter(i => i.id !== ing.id))}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="space-y-1.5">
            <Label>Instructions (optional, one per line)</Label>
            <textarea
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              placeholder={"1. Cook the chicken breast...\n2. Prepare the rice..."}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label>Tags (optional, comma-separated)</Label>
            <Input value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. high-protein, meal-prep, quick" />
          </div>

          <Button onClick={handleSave} className="w-full" variant="brand">Save Recipe</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function MealsPage() {
  const {
    user,
    groceryList,
    weeklyMealPlan,
    setGroceryList,
    addPlannedMeal,
    removePlannedMealItem,
    clearMealPlan,
    toggleGroceryItem,
    addGroceryItem,
    removeGroceryItem,
    updateGroceryItem,
    clearCheckedItems,
    clearGroceryList,
    getDailyMeals,
    getDailyTotals,
    addMealEntry,
    updateMealEntry,
    removeMealEntry,
    savedMeals,
    addSavedMeal,
    updateSavedMeal,
    removeSavedMeal,
    customRecipes,
    removeCustomRecipe,
  } = useAppStore()
  const [createRecipeOpen, setCreateRecipeOpen] = useState(false)
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMealType, setEditorMealType] = useState<MealType | null>(null)
  const [editingMeal, setEditingMeal] = useState<MealLogEntry | null>(null)
  const [editingSavedMeal, setEditingSavedMeal] = useState<SavedMealTemplate | null>(null)
  const [savedMealTargets, setSavedMealTargets] = useState<Partial<Record<string, MealType>>>({})
  const [activeTab, setActiveTab] = useState('today')
  // Recipe filter state
  const [recipeFilterType, setRecipeFilterType] = useState<string>('all')
  const [recipeFilterTag, setRecipeFilterTag] = useState<string>('all')
  const [recipeSearchText, setRecipeSearchText] = useState('')
  // Live recipe search
  const [liveRecipes, setLiveRecipes] = useState<Recipe[]>([])
  const [liveRecipesLoading, setLiveRecipesLoading] = useState(false)
  const [liveSearchedQuery, setLiveSearchedQuery] = useState('')
  // Grocery list state
  const [addItemOpen, setAddItemOpen] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [newItemAmount, setNewItemAmount] = useState('')
  const [newItemUnit, setNewItemUnit] = useState('g')
  const [grocerySearchQuery, setGrocerySearchQuery] = useState('')
  const [groceryShowSuggestions, setGroceryShowSuggestions] = useState(false)
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editUnit, setEditUnit] = useState('')
  // Meal planner state
  const [selectedPlanDay, setSelectedPlanDay] = useState<string>('monday')
  const [addMealDialogOpen, setAddMealDialogOpen] = useState(false)
  const [pendingSlot, setPendingSlot] = useState<{ day: string; slot: 'breakfast' | 'lunch' | 'dinner' | 'snack' } | null>(null)
  const [recipeSearchQuery, setRecipeSearchQuery] = useState('')
  const [savedMealSearchQuery, setSavedMealSearchQuery] = useState('')
  const [customMealInput, setCustomMealInput] = useState('')
  const [customIngredients, setCustomIngredients] = useState<CustomMealIngredient[]>([])
  const [customIngName, setCustomIngName] = useState('')
  const [customIngAmount, setCustomIngAmount] = useState('')
  const [customIngUnit, setCustomIngUnit] = useState('g')
  const [addMealMode, setAddMealMode] = useState<'recipe' | 'saved' | 'custom'>('recipe')
  const [expandedMeals, setExpandedMeals] = useState<Record<string, boolean>>({})

  const grocery = groceryList
  const today = getTodayISO()
  const todayMeals = getDailyMeals(today)
  const todayTotals = getDailyTotals(today)

  // Group grocery items by category
  const groceryByCategory = grocery
    ? grocery.items.reduce<Record<string, Array<{ item: typeof grocery.items[0]; globalIdx: number }>>>((acc, item, idx) => {
        if (!acc[item.category]) acc[item.category] = []
        acc[item.category].push({ item, globalIdx: idx })
        return acc
      }, {})
    : {}

  const groceryProgress = grocery && grocery.items.length > 0
    ? Math.round((grocery.items.filter((i) => i.checked).length / grocery.items.length) * 100)
    : 0

  async function searchLiveRecipes() {
    const q = recipeSearchText.trim()
    if (!q || q === liveSearchedQuery) return
    setLiveRecipesLoading(true)
    try {
      const res = await fetch(`/api/recipes?query=${encodeURIComponent(q)}`)
      const data = await res.json()
      setLiveRecipes(Array.isArray(data) ? data : [])
      setLiveSearchedQuery(q)
    } catch {
      toast.error('Live recipe search failed.')
    } finally {
      setLiveRecipesLoading(false)
    }
  }

  const filteredRecipes = useMemo(() => {
    let list = RECIPES
    if (recipeFilterType !== 'all') list = list.filter(r => r.meal_type === recipeFilterType)
    if (recipeFilterTag === 'high-protein') list = list.filter(r => r.macros.protein_g >= 25)
    else if (recipeFilterTag === 'low-calorie') list = list.filter(r => r.macros.calories <= 400)
    else if (recipeFilterTag === 'low-carb') list = list.filter(r => r.macros.carbs_g <= 20)
    else if (recipeFilterTag === 'quick') list = list.filter(r => (r.prep_time_min + r.cook_time_min) <= 15)
    else if (recipeFilterTag === 'vegetarian') list = list.filter(r => r.tags.includes('vegetarian') || r.tags.includes('vegan'))
    else if (recipeFilterTag === 'meal-prep') list = list.filter(r => r.tags.includes('meal-prep'))
    else if (recipeFilterTag === 'high-fiber') list = list.filter(r => (r.macros.fiber_g ?? 0) >= 7)
    if (recipeSearchText.trim()) {
      const q = recipeSearchText.toLowerCase()
      list = list.filter(r => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q))
    }
    return list
  }, [recipeFilterType, recipeFilterTag, recipeSearchText])

  const grocerySuggestions = useMemo(() => {
    const q = grocerySearchQuery.toLowerCase().trim()
    if (!q) return []
    return getKnownFoodCatalog()
      .filter(item => {
        const name = item.name.toLowerCase()
        const alias = item.aliases.some(a => a.toLowerCase().includes(q))
        return name.includes(q) || alias
      })
      .sort((a, b) => {
        const an = a.name.toLowerCase(), bn = b.name.toLowerCase()
        const aStarts = an.startsWith(q) ? 0 : 1
        const bStarts = bn.startsWith(q) ? 0 : 1
        return aStarts - bStarts || an.localeCompare(bn)
      })
      .slice(0, 12)
  }, [grocerySearchQuery])

  function openAddItemDialog() {
    setNewItemName('')
    setNewItemAmount('')
    setNewItemUnit('g')
    setGrocerySearchQuery('')
    setGroceryShowSuggestions(false)
    setAddItemOpen(true)
  }

  function selectGrocerySuggestion(name: string, defaultUnit: string) {
    setNewItemName(name)
    setGrocerySearchQuery(name)
    setNewItemUnit(defaultUnit)
    setGroceryShowSuggestions(false)
  }

  function handleAddItem() {
    const name = newItemName.trim()
    if (!name) return
    const amount = parseFloat(newItemAmount) || 0
    const category = categorizeIngredient(name)
    addGroceryItem({
      ingredient: name,
      amount,
      unit: newItemUnit,
      category,
      estimated_price: amount > 0 ? estimatePrice(amount, newItemUnit, category) : 0,
    })
    setNewItemName('')
    setNewItemAmount('')
    setNewItemUnit('g')
    setGrocerySearchQuery('')
    setAddItemOpen(false)
  }

  function startEditItem(idx: number) {
    const item = grocery!.items[idx]
    setEditingItemIndex(idx)
    setEditAmount(String(item.amount))
    setEditUnit(item.unit)
  }

  function commitEditItem() {
    if (editingItemIndex === null) return
    const amount = parseFloat(editAmount)
    if (isNaN(amount) || amount <= 0) { setEditingItemIndex(null); return }
    const item = grocery!.items[editingItemIndex]
    updateGroceryItem(editingItemIndex, {
      amount,
      unit: editUnit,
      estimated_price: estimatePrice(amount, editUnit, item.category),
    })
    setEditingItemIndex(null)
  }

  // ─── Meal planner constants & helpers ───────────────────────────────────────
  const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
  const DAY_LABELS: Record<string, string> = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' }
  const DAY_FULL: Record<string, string> = { monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday' }
  const PLAN_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const
  const SLOT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = { breakfast: Coffee, lunch: Soup, dinner: Moon, snack: Cookie }
  const SLOT_COLORS: Record<string, string> = { breakfast: 'text-amber-400', lunch: 'text-sky-400', dinner: 'text-violet-400', snack: 'text-emerald-400' }

  const filteredPlanRecipes = useMemo(() => {
    if (!recipeSearchQuery.trim()) return RECIPES
    const q = recipeSearchQuery.toLowerCase()
    return RECIPES.filter(r => r.name.toLowerCase().includes(q) || r.tags.some((t: string) => t.toLowerCase().includes(q)))
  }, [recipeSearchQuery])

  const planFilledSlots = useMemo(() => {
    if (!weeklyMealPlan) return 0
    return Object.values(weeklyMealPlan.days).reduce((total, day) =>
      total + PLAN_SLOTS.filter(s => Array.isArray(day[s]) && (day[s] as unknown[]).length > 0).length, 0)
  }, [weeklyMealPlan])

  function openAddMealDialog(day: string, slot: 'breakfast' | 'lunch' | 'dinner' | 'snack') {
    setPendingSlot({ day, slot })
    setRecipeSearchQuery('')
    setSavedMealSearchQuery('')
    setCustomMealInput('')
    setCustomIngredients([])
    setCustomIngName('')
    setCustomIngAmount('')
    setCustomIngUnit('g')
    setAddMealMode('recipe')
    setAddMealDialogOpen(true)
  }

  function confirmAddRecipe(recipe: Recipe) {
    if (!pendingSlot) return
    addPlannedMeal(pendingSlot.day, pendingSlot.slot, { type: 'recipe', recipe })
    setAddMealDialogOpen(false)
    setPendingSlot(null)
  }

  function confirmAddSavedMeal(meal: SavedMealTemplate) {
    if (!pendingSlot) return
    addPlannedMeal(pendingSlot.day, pendingSlot.slot, { type: 'saved', savedMeal: meal })
    setAddMealDialogOpen(false)
    setPendingSlot(null)
  }

  function addCustomIngredient() {
    const name = customIngName.trim()
    const amount = parseFloat(customIngAmount)
    if (!name || isNaN(amount) || amount <= 0) return
    setCustomIngredients(prev => [...prev, { name, amount, unit: customIngUnit }])
    setCustomIngName('')
    setCustomIngAmount('')
    setCustomIngUnit('g')
  }

  function confirmAddCustom() {
    if (!pendingSlot || !customMealInput.trim()) return
    addPlannedMeal(pendingSlot.day, pendingSlot.slot, {
      type: 'custom',
      name: customMealInput.trim(),
      ingredients: customIngredients,
    })
    setAddMealDialogOpen(false)
    setPendingSlot(null)
  }

  function handleGenerateGroceryList() {
    const { items, count } = generateGroceryItems(weeklyMealPlan ?? null)
    if (count === 0) {
      toast.error('No ingredients found. Add recipes, saved meals with items, or custom meals with ingredients.')
      return
    }
    const total = items.reduce((sum, i) => sum + i.estimated_price, 0)
    setGroceryList({
      id: `gl_${Date.now()}`,
      user_id: user?.id ?? 'local',
      week_start: weeklyMealPlan?.week_start ?? new Date().toISOString().slice(0, 10),
      items,
      total_estimated_cost: Math.round(total * 100) / 100,
      created_at: new Date().toISOString(),
    })
    toast.success(`${count} items added to your grocery list`)
    setActiveTab('grocery')
  }

  const todayMealsByType = useMemo(() => {
    return MEAL_TYPES.reduce<Record<MealType, MealLogEntry[]>>((acc, type) => {
      acc[type] = todayMeals.filter((meal) => meal.meal_type === type)
      return acc
    }, { breakfast: [], lunch: [], dinner: [], snack: [], drink: [] })
  }, [todayMeals])

  const handleExport = () => {
    const data = JSON.stringify({ date: today, meals: todayMeals, totals: todayTotals }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `meal-log-${today}.json`
    a.click()
    toast.success('Meal log exported!')
  }

  const openAdd = (mealType?: MealType) => {
    setEditingMeal(null)
    setEditingSavedMeal(null)
    setEditorMealType(mealType ?? null)
    setEditorOpen(true)
  }

  const openEdit = (meal: MealLogEntry) => {
    setEditingMeal(meal)
    setEditingSavedMeal(null)
    setEditorMealType(meal.meal_type)
    setEditorOpen(true)
  }

  const openEditSavedMeal = (meal: SavedMealTemplate) => {
    setEditingMeal(null)
    setEditingSavedMeal(meal)
    setEditorMealType(meal.meal_type)
    setEditorOpen(true)
  }

  const handleSaveMeal = (data: Omit<MealLogEntry, 'id'>) => {
    if (editingMeal) {
      updateMealEntry(today, editingMeal.id, data)
      toast.success('Meal updated.')
      return
    }

    addMealEntry(today, {
      id: `m-${Date.now()}`,
      ...data,
    })
    toast.success('Meal added.')
  }

  const handleDeleteMeal = (mealId: string) => {
    removeMealEntry(today, mealId)
    toast.success('Meal removed.')
  }

  const handleAddSavedMealToToday = (meal: SavedMealTemplate) => {
    const selectedMealType = savedMealTargets[meal.id] ?? meal.meal_type

    addMealEntry(today, {
      id: `m-${Date.now()}`,
      meal_type: selectedMealType,
      name: meal.name,
      macros: meal.macros,
      time: format(new Date(), 'h:mm a'),
      recipe: null,
      meal_items: meal.items.map(item => ({
        name: item.matched_name,
        macros: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
        amount: item.amount,
        unit: item.unit,
      })),
      entry_source: 'saved',
    })
    toast.success(`${meal.name} added to ${mealTypeLabel(selectedMealType).toLowerCase()}.`)
  }

  const handleSaveTemplate = (payload: Omit<SavedMealTemplate, 'id' | 'updated_at'>, existingId?: string) => {
    if (existingId) {
      updateSavedMeal(existingId, payload)
      toast.success('Saved meal updated.')
      return
    }

    addSavedMeal({
      id: `sm-${Date.now()}`,
      ...payload,
      updated_at: new Date().toISOString(),
    })
    toast.success('Meal saved for later.')
  }

  if (!user) return null

  // Calorie progress %
  const calProgress = user.calorie_target > 0 ? Math.min(100, Math.round((todayTotals.calories / user.calorie_target) * 100)) : 0
  const proteinProgress = user.protein_target_g > 0 ? Math.min(100, Math.round((todayTotals.protein_g / user.protein_target_g) * 100)) : 0

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display font-bold text-3xl tracking-tight">Meals</h2>
            <p className="text-sm text-muted-foreground mt-1 hidden sm:block">Track today&apos;s intake · Save meals for reuse · Browse recipes</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}>
              <Download className="w-3.5 h-3.5" />
              Export
            </Button>
            <Button variant="brand" size="sm" className="gap-1.5" onClick={() => openAdd()}>
              <Plus className="w-3.5 h-3.5" />
              Add Meal
            </Button>
          </div>
        </div>

        {/* Macro snapshot bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Calories', value: todayTotals.calories, target: user.calorie_target, unit: 'kcal', bar: 'bg-emerald-500', progress: calProgress },
            { label: 'Protein', value: todayTotals.protein_g, target: user.protein_target_g, unit: 'g', bar: 'bg-emerald-500', progress: proteinProgress },
            { label: 'Carbs', value: todayTotals.carbs_g, target: null, unit: 'g', bar: 'bg-emerald-400', progress: null },
            { label: 'Fat', value: todayTotals.fat_g, target: null, unit: 'g', bar: 'bg-emerald-300', progress: null },
          ].map((stat) => (
            <div key={stat.label} className="bg-card border border-border/50 rounded-xl p-4">
              <div className="flex items-baseline justify-between mb-2">
                <p className="font-data text-2xl font-bold leading-none tabular-nums">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.unit}</p>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{stat.label}{stat.target ? ` · ${stat.target} target` : ''}</p>
              {stat.progress !== null && (
                <div className="h-0.5 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${stat.bar} rounded-full transition-all duration-700`} style={{ width: `${stat.progress}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="border-b border-border/60 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="inline-flex h-auto min-w-max items-center bg-transparent p-0 gap-0">
            {[
              { value: 'today', label: "Today's Meals", count: todayMeals.length },
              { value: 'saved', label: 'Saved Meals', count: null },
              { value: 'recipes', label: 'Recipes', count: null },
              { value: 'planner', label: 'Meal Planner', count: planFilledSlots > 0 ? planFilledSlots : null },
              { value: 'grocery', label: 'Grocery', count: grocery ? grocery.items.length : null },
            ].map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="relative px-4 py-2.5 rounded-none border-0 bg-transparent text-sm font-medium text-muted-foreground shadow-none transition-none data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent after:transition-colors"
              >
                {tab.label}
                {tab.count !== null && tab.count > 0 && (
                  <span className="ml-1.5 font-data text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{tab.count}</span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="saved" className="mt-6 space-y-4">
          {savedMeals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border/60 rounded-xl">
              <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                <CheckCircle className="w-6 h-6 text-muted-foreground/30" />
              </div>
              <p className="font-medium text-muted-foreground">No saved meals yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Build a meal and save it as a template for fast reuse</p>
              <Button variant="brand" size="sm" className="mt-4 gap-1.5" onClick={() => openAdd()}>
                <Plus className="w-3.5 h-3.5" />
                Build a Meal
              </Button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {savedMeals.map((meal) => (
                (() => {
                  const type = mealTypePresentation(meal.meal_type)
                  const selectedTarget = savedMealTargets[meal.id] ?? meal.meal_type
                  const selectedTargetType = mealTypePresentation(selectedTarget)
                  const MealTypeIcon = type.icon

                  return (
                    <div
                      key={meal.id}
                      className="overflow-hidden rounded-2xl border border-border/60 bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-md"
                    >
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-muted/30 text-muted-foreground">
                                <MealTypeIcon className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`h-1.5 w-1.5 rounded-full ${type.dot}`} />
                                  <Badge variant="outline" className={`capitalize ${type.chip}`}>
                                    {type.label}
                                  </Badge>
                                </div>
                                <p className="mt-2 truncate text-base font-semibold leading-tight">{meal.name}</p>
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                  Saved {format(new Date(meal.updated_at), 'MMM d')}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-right">
                            <p className="font-data text-lg font-semibold text-foreground">{meal.macros.calories}</p>
                            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">kcal</p>
                          </div>
                        </div>

                        <div className="mt-5 grid grid-cols-3 gap-2">
                          {[
                            { val: `${meal.macros.protein_g}g`, lbl: 'Protein' },
                            { val: `${meal.macros.carbs_g}g`, lbl: 'Carbs' },
                            { val: `${meal.macros.fat_g}g`, lbl: 'Fat' },
                          ].map((macro) => (
                            <div key={macro.lbl} className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5">
                              <p className="font-data text-sm font-semibold text-foreground">{macro.val}</p>
                              <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{macro.lbl}</p>
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-1.5">
                          {meal.items.slice(0, 3).map((item, idx) => (
                            <span key={idx} className="max-w-[140px] truncate rounded-full border border-border/50 bg-muted/20 px-2.5 py-1 text-[10px] text-muted-foreground">
                              {item.matched_name}
                            </span>
                          ))}
                          {meal.items.length > 3 && (
                            <span className="rounded-full border border-border/50 bg-muted/20 px-2.5 py-1 text-[10px] text-muted-foreground">
                              +{meal.items.length - 3} more
                            </span>
                          )}
                          {meal.items.length === 0 && (
                            <span className="rounded-full border border-dashed border-border/50 bg-transparent px-2.5 py-1 text-[10px] text-muted-foreground">
                              Quick template
                            </span>
                          )}
                        </div>

                        <div className="mt-5 rounded-2xl border border-border/60 bg-muted/10 p-3.5">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Add To Today</p>
                              <p className="text-xs text-muted-foreground">Choose the meal slot before adding it.</p>
                            </div>
                            <Badge variant="outline" className={`capitalize ${selectedTargetType.chip}`}>
                              {selectedTargetType.label}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                            <Select
                              value={selectedTarget}
                              onValueChange={(value) => setSavedMealTargets((current) => ({ ...current, [meal.id]: value as MealType }))}
                            >
                              <SelectTrigger className="bg-background">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {MEAL_TYPES.map((typeOption) => (
                                  <SelectItem key={typeOption} value={typeOption}>
                                    {mealTypeLabel(typeOption)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button size="sm" variant="outline" className="px-4" onClick={() => handleAddSavedMealToToday(meal)}>
                              Add
                            </Button>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center gap-2 border-t border-border/50 pt-3">
                          <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => openEditSavedMeal(meal)}>
                            Edit template
                          </Button>
                          <Button size="sm" variant="ghost" className="text-xs text-destructive/60 hover:text-destructive" onClick={() => handleDeleteMeal(meal.id)}>
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })()
              ))}
            </div>
          )}
        </TabsContent>

        {/* Today log tab */}
        <TabsContent value="today" className="mt-6 space-y-3">
          {MEAL_TYPES.map((mealType) => {
            const meals = todayMealsByType[mealType]
            const theme = mealTypeTheme(mealType)
            const totalMacros = meals.reduce(
              (acc, m) => ({
                calories: acc.calories + m.macros.calories,
                protein_g: acc.protein_g + m.macros.protein_g,
                carbs_g: acc.carbs_g + m.macros.carbs_g,
                fat_g: acc.fat_g + m.macros.fat_g,
              }),
              { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
            )

            type MealItem = NonNullable<MealLogEntry['meal_items']>[number]
            type FlatRow =
              | { kind: 'meal'; meal: MealLogEntry; isExpandable: boolean }
              | { kind: 'flat-item'; meal: MealLogEntry; item: MealItem; itemIdx: number }

            const rows: FlatRow[] = meals.flatMap((meal): FlatRow[] => {
              const isExpandable = !!meal.recipe || meal.entry_source === 'saved'
              if (!isExpandable && meal.meal_items && meal.meal_items.length > 0) {
                return meal.meal_items.map((item, itemIdx): FlatRow => ({
                  kind: 'flat-item',
                  meal,
                  item,
                  itemIdx,
                }))
              }
              return [{ kind: 'meal', meal, isExpandable }]
            })

            return (
              <div key={mealType} className="bg-card border border-border/20 rounded-xl overflow-hidden">
                {/* Section header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${theme.badge.split(' ')[0]}`} />
                    <span className="font-semibold text-sm">{mealTypeLabel(mealType)}</span>
                    {meals.length > 0 && (
                      <span className="font-data text-xs text-muted-foreground/50 flex gap-1.5 items-center">
                        <span>{totalMacros.calories} kcal</span>
                        <span className="opacity-40">·</span>
                        <span>{totalMacros.protein_g}g P</span>
                        <span className="opacity-40">·</span>
                        <span>{totalMacros.carbs_g}g C</span>
                        <span className="opacity-40">·</span>
                        <span>{totalMacros.fat_g}g F</span>
                      </span>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground" onClick={() => openAdd(mealType)}>
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </Button>
                </div>

                {/* Meals list */}
                {meals.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => openAdd(mealType)}
                    className="w-full px-4 py-5 text-left transition-colors hover:bg-muted/30 group"
                  >
                    <p className="text-xs text-muted-foreground group-hover:text-muted-foreground/80">{theme.hint}</p>
                  </button>
                ) : (
                  <div>
                    {rows.map((row, rowIdx) => {
                      const borderClass = rowIdx < rows.length - 1 ? 'border-b border-border/20' : ''

                      if (row.kind === 'flat-item') {
                        return (
                          <div key={`${row.meal.id}-flat-${row.itemIdx}`} className={`flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors group ${borderClass}`}>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground leading-tight">{row.item.name}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {row.item.amount != null && (
                                  <>
                                    <span className="text-[11px] font-data text-muted-foreground/40">{row.item.amount}{row.item.unit}</span>
                                    <span className="text-[11px] text-border/40">·</span>
                                  </>
                                )}
                                <span className="text-[11px] font-data text-muted-foreground/55">{row.item.macros.calories} kcal</span>
                                <span className="text-[11px] text-border/40">·</span>
                                <span className="text-[11px] font-data text-muted-foreground/55">{row.item.macros.protein_g}g P</span>
                                <span className="text-[11px] text-border/40">·</span>
                                <span className="text-[11px] font-data text-muted-foreground/55">{row.item.macros.carbs_g}g C</span>
                                <span className="text-[11px] text-border/40">·</span>
                                <span className="text-[11px] font-data text-muted-foreground/55">{row.item.macros.fat_g}g F</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button size="icon-sm" variant="ghost" className="h-7 w-7" onClick={() => openEdit(row.meal)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="icon-sm" variant="ghost" className="h-7 w-7 text-destructive/60 hover:text-destructive" onClick={() => handleDeleteMeal(row.meal.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        )
                      }

                      const { meal, isExpandable } = row
                      const expanded = expandedMeals[meal.id] || false
                      return (
                        <div key={meal.id} className={`flex flex-col px-4 py-3 hover:bg-muted/20 transition-colors group ${borderClass}`}>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              {isExpandable ? (
                                <button
                                  className="flex items-center gap-1.5 text-left"
                                  onClick={() => setExpandedMeals(prev => ({ ...prev, [meal.id]: !prev[meal.id] }))}
                                >
                                  <span className="text-sm font-semibold text-foreground">{meal.name}</span>
                                  <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 text-muted-foreground/50 transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`} />
                                </button>
                              ) : (
                                <p className="text-sm font-semibold text-foreground">{meal.name}</p>
                              )}
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[11px] font-data text-muted-foreground/55">{meal.macros.calories} kcal</span>
                                <span className="text-[11px] text-border/40">·</span>
                                <span className="text-[11px] font-data text-muted-foreground/55">{meal.macros.protein_g}g P</span>
                                <span className="text-[11px] text-border/40">·</span>
                                <span className="text-[11px] font-data text-muted-foreground/55">{meal.macros.carbs_g}g C</span>
                                <span className="text-[11px] text-border/40">·</span>
                                <span className="text-[11px] font-data text-muted-foreground/55">{meal.macros.fat_g}g F</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button size="icon-sm" variant="ghost" className="h-7 w-7" onClick={() => openEdit(meal)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="icon-sm" variant="ghost" className="h-7 w-7 text-destructive/60 hover:text-destructive" onClick={() => handleDeleteMeal(meal.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                          {/* Expanded ingredients for saved meals and recipes */}
                          {isExpandable && expanded && meal.meal_items && meal.meal_items.length > 0 && (
                            <div className="mt-2 ml-1 space-y-1.5 pl-3 border-l border-border/30">
                              {meal.meal_items.map((item, itemIndex) => (
                                <div key={`${meal.id}-item-${itemIndex}`}>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-medium text-foreground/70 leading-tight">{item.name}</span>
                                    {item.amount != null && (
                                      <span className="text-[11px] font-data text-muted-foreground/40">{item.amount}{item.unit}</span>
                                    )}
                                  </div>
                                  {item.macros.calories > 0 && (
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span className="text-[11px] font-data text-muted-foreground/50">{item.macros.calories} kcal</span>
                                      <span className="text-[11px] text-border/30">·</span>
                                      <span className="text-[11px] font-data text-muted-foreground/50">{item.macros.protein_g}g P</span>
                                      <span className="text-[11px] text-border/30">·</span>
                                      <span className="text-[11px] font-data text-muted-foreground/50">{item.macros.carbs_g}g C</span>
                                      <span className="text-[11px] text-border/30">·</span>
                                      <span className="text-[11px] font-data text-muted-foreground/50">{item.macros.fat_g}g F</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </TabsContent>

        {/* Recipe Library Tab */}
        <TabsContent value="recipes" className="mt-6 space-y-4">
          {/* Search bar with live search button + create recipe */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search recipes…"
                value={recipeSearchText}
                onChange={e => { setRecipeSearchText(e.target.value); if (!e.target.value) { setLiveRecipes([]); setLiveSearchedQuery('') } }}
                onKeyDown={e => { if (e.key === 'Enter') searchLiveRecipes() }}
                className="h-9 pl-9"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 shrink-0"
              onClick={searchLiveRecipes}
              disabled={!recipeSearchText.trim() || liveRecipesLoading}
            >
              {liveRecipesLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
              Search live
            </Button>
            <Button
              size="sm"
              variant="brand"
              className="gap-1.5 shrink-0"
              onClick={() => setCreateRecipeOpen(true)}
            >
              <Plus className="w-3.5 h-3.5" />
              Create Recipe
            </Button>
          </div>

          <CreateRecipeDialog open={createRecipeOpen} onOpenChange={setCreateRecipeOpen} />
          {/* Filter row */}
          <div className="flex flex-wrap gap-2">
            {/* Meal type pills */}
            {(['all', 'breakfast', 'lunch', 'dinner', 'snack'] as const).map(t => (
              <button
                key={t}
                onClick={() => setRecipeFilterType(t)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                  recipeFilterType === t
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted/40 text-muted-foreground border-border/50 hover:text-foreground hover:border-border'
                }`}
              >
                {t === 'all' ? 'All types' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
            <span className="w-px bg-border/50 mx-1 self-stretch" />
            {/* Tag filters */}
            {([
              { id: 'all', label: 'All' },
              { id: 'high-protein', label: 'High protein' },
              { id: 'low-calorie', label: 'Low calorie' },
              { id: 'low-carb', label: 'Low carb' },
              { id: 'quick', label: 'Quick (<15 min)' },
              { id: 'vegetarian', label: 'Vegetarian' },
              { id: 'meal-prep', label: 'Meal prep' },
              { id: 'high-fiber', label: 'High fiber' },
            ] as const).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setRecipeFilterTag(id)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                  recipeFilterTag === id
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    : 'bg-muted/40 text-muted-foreground border-border/50 hover:text-foreground hover:border-border'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {/* Live results */}
          {liveRecipes.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                <p className="text-xs font-semibold text-emerald-400">
                  {liveRecipes.length} live results for &ldquo;{liveSearchedQuery}&rdquo;
                </p>
                <button
                  onClick={() => { setLiveRecipes([]); setLiveSearchedQuery('') }}
                  className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {liveRecipes.map((recipe, idx) => (
                  <motion.div
                    key={recipe.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: idx * 0.03 }}
                    className="bg-card border border-emerald-500/20 rounded-xl overflow-hidden hover:border-emerald-500/40 transition-all duration-200"
                  >
                    <div onClick={() => setSelectedRecipe(recipe)} className="cursor-pointer">
                      <RecipeCard recipe={recipe} />
                    </div>
                    <div className="px-4 pb-4">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs gap-1.5"
                        onClick={() => {
                          addMealEntry(today, {
                            id: `m-${Date.now()}`,
                            meal_type: recipe.meal_type,
                            name: recipe.name,
                            macros: {
                              calories: recipe.macros.calories,
                              protein_g: recipe.macros.protein_g,
                              carbs_g: recipe.macros.carbs_g,
                              fat_g: recipe.macros.fat_g,
                            },
                            time: format(new Date(), 'h:mm a'),
                            recipe,
                          })
                          toast.success(`${recipe.name} added to today's meals.`)
                        }}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add to today
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="border-t border-border/50 pt-2">
                <p className="text-xs text-muted-foreground">Library recipes below</p>
              </div>
            </div>
          )}

          {/* My Recipes (custom) */}
          {customRecipes.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                <p className="text-xs font-semibold text-emerald-400">My Recipes ({customRecipes.length})</p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {customRecipes
                  .filter(r => {
                    if (recipeFilterType !== 'all' && r.meal_type !== recipeFilterType) return false
                    if (recipeSearchText.trim()) {
                      const q = recipeSearchText.toLowerCase()
                      return r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)
                    }
                    return true
                  })
                  .map((recipe, idx) => (
                    <motion.div
                      key={recipe.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: idx * 0.04 }}
                      className="bg-card border border-border/50 rounded-xl overflow-hidden hover:border-border transition-all duration-200 group"
                    >
                      <div onClick={() => setSelectedRecipe(recipe)} className="cursor-pointer">
                        <RecipeCard recipe={recipe} />
                      </div>
                      <div className="px-4 pb-4 flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-xs gap-1.5"
                          onClick={() => {
                            addMealEntry(today, {
                              id: `m-${Date.now()}`,
                              meal_type: recipe.meal_type,
                              name: recipe.name,
                              macros: { calories: recipe.macros.calories, protein_g: recipe.macros.protein_g, carbs_g: recipe.macros.carbs_g, fat_g: recipe.macros.fat_g },
                              time: format(new Date(), 'h:mm a'),
                              recipe,
                            })
                            toast.success(`${recipe.name} added to today's meals.`)
                          }}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add to today
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs text-destructive/60 hover:text-destructive px-3"
                          onClick={() => removeCustomRecipe(recipe.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
              </div>
              <div className="border-t border-border/50 pt-2">
                <p className="text-xs text-muted-foreground">Library recipes below</p>
              </div>
            </div>
          )}

          {/* Count line */}
          <p className="text-xs text-muted-foreground">
            <span className="font-data text-foreground font-semibold">{filteredRecipes.length}</span> of {RECIPES.length} library recipes
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredRecipes.length === 0 && (
              <div className="col-span-full text-center py-16 text-muted-foreground text-sm">
                No recipes match your filters.
              </div>
            )}
            {filteredRecipes.map((recipe, idx) => (
              <motion.div
                key={recipe.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: idx * 0.04 }}
                className="bg-card border border-border/50 rounded-xl overflow-hidden hover:border-border transition-all duration-200 group"
              >
                <div onClick={() => setSelectedRecipe(recipe)} className="cursor-pointer">
                  <RecipeCard recipe={recipe} />
                </div>
                <div className="px-4 pb-4">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs gap-1.5"
                    onClick={() => {
                      addMealEntry(today, {
                        id: `m-${Date.now()}`,
                        meal_type: recipe.meal_type,
                        name: recipe.name,
                        macros: { calories: recipe.macros.calories, protein_g: recipe.macros.protein_g, carbs_g: recipe.macros.carbs_g, fat_g: recipe.macros.fat_g },
                        time: format(new Date(), 'h:mm a'),
                        recipe,
                      })
                      toast.success(`${recipe.name} added to today's meals.`)
                    }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add to today
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* Meal Planner Tab */}
        <TabsContent value="planner" className="mt-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Plan meals for the week, then generate your grocery list.</p>
            </div>
            <div className="flex items-center gap-2">
              {planFilledSlots > 0 && (
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={clearMealPlan}>
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear plan
                </Button>
              )}
              <Button
                variant="brand"
                size="sm"
                className="gap-1.5"
                onClick={handleGenerateGroceryList}
                disabled={planFilledSlots === 0}
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                Generate Grocery List
              </Button>
            </div>
          </div>

          {/* Day selector pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {DAYS_OF_WEEK.map((day) => {
              const dayPlan = weeklyMealPlan?.days[day]
              const filled = dayPlan ? PLAN_SLOTS.filter(s => Array.isArray(dayPlan[s]) && (dayPlan[s] as unknown[]).length > 0).length : 0
              return (
                <button
                  key={day}
                  onClick={() => setSelectedPlanDay(day)}
                  className={`flex-shrink-0 flex flex-col items-center px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 border ${
                    selectedPlanDay === day
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/30'
                      : 'bg-card border-border/50 text-muted-foreground hover:text-foreground hover:border-border'
                  }`}
                >
                  <span>{DAY_LABELS[day]}</span>
                  {filled > 0 && (
                    <span className={`text-[10px] mt-0.5 font-data ${selectedPlanDay === day ? 'text-primary-foreground/70' : 'text-emerald-400'}`}>
                      {filled}/4
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Slot cards for selected day */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
              {DAY_FULL[selectedPlanDay]}
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {PLAN_SLOTS.map((slot) => {
                const rawSlot = weeklyMealPlan?.days[selectedPlanDay]?.[slot]
                const items = Array.isArray(rawSlot) ? rawSlot : []
                const SlotIcon = SLOT_ICONS[slot]
                const slotColor = SLOT_COLORS[slot]
                return (
                  <div key={slot} className="bg-card border border-border/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <SlotIcon className={`w-4 h-4 ${slotColor}`} />
                      <span className="text-sm font-medium capitalize flex-1">{slot}</span>
                      {items.length > 0 && (
                        <span className="font-data text-[10px] text-muted-foreground">{items.length} item{items.length !== 1 ? 's' : ''}</span>
                      )}
                    </div>

                    {items.length > 0 && (
                      <div className="space-y-2 mb-2">
                        {items.map((planned, itemIdx) => (
                          <div key={itemIdx} className="flex items-start gap-2 group">
                            <div className={`w-1 self-stretch min-h-[1.5rem] rounded-full flex-shrink-0 ${slotColor.replace('text-', 'bg-')}`} />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium leading-tight truncate">
                                {planned.type === 'recipe' ? planned.recipe.name : planned.type === 'saved' ? planned.savedMeal.name : planned.name}
                              </p>
                              {planned.type === 'recipe' && (
                                <p className="text-[11px] text-muted-foreground">
                                  {planned.recipe.macros.calories} cal · {planned.recipe.macros.protein_g}g protein
                                </p>
                              )}
                              {planned.type === 'saved' && (
                                <p className="text-[11px] text-muted-foreground">
                                  Saved meal · {planned.savedMeal.macros.calories} cal
                                </p>
                              )}
                              {planned.type === 'custom' && (
                                <p className="text-[11px] text-muted-foreground">
                                  Custom{planned.ingredients.length > 0 ? ` · ${planned.ingredients.length} ingredient${planned.ingredients.length !== 1 ? 's' : ''}` : ''}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => removePlannedMealItem(selectedPlanDay, slot, itemIdx)}
                              className="flex-shrink-0 text-muted-foreground/30 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={() => openAddMealDialog(selectedPlanDay, slot)}
                      className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed text-sm transition-colors ${
                        items.length > 0
                          ? 'border-border/30 text-muted-foreground/50 hover:text-muted-foreground hover:border-border/50'
                          : 'border-border/50 text-muted-foreground hover:text-foreground hover:border-border py-3'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {items.length > 0 ? 'Add another' : 'Add meal'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Empty state */}
          {planFilledSlots === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CalendarDays className="w-8 h-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Select a day and start adding meals to plan your week.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Once planned, generate a grocery list with one click.</p>
            </div>
          )}
        </TabsContent>

        {/* Grocery List Tab */}
        <TabsContent value="grocery" className="mt-6 space-y-4">
          {grocery ? (
            <div className="space-y-4">
              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={openAddItemDialog}>
                  <Plus className="w-3.5 h-3.5" />
                  Add Item
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleGenerateGroceryList} disabled={planFilledSlots === 0} title={planFilledSlots === 0 ? 'Add meals to your plan first' : 'Regenerate from meal plan'}>
                  <CalendarDays className="w-3.5 h-3.5" />
                  From Plan
                </Button>
                {grocery.items.some(i => i.checked) && (
                  <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={clearCheckedItems}>
                    <X className="w-3.5 h-3.5" />
                    Clear checked
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="gap-1.5 text-destructive/70 hover:text-destructive ml-auto" onClick={clearGroceryList}>
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear all
                </Button>
              </div>

              {/* Progress header */}
              <div className="bg-card border border-border/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold text-sm">Shopping Progress</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <span className="font-data text-foreground">{grocery.items.filter((item) => item.checked).length}</span> of <span className="font-data">{grocery.items.length}</span> items checked off
                    </p>
                  </div>
                  <span className="font-data font-bold text-2xl text-emerald-400">{groceryProgress}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${groceryProgress}%` }} />
                </div>
              </div>

              {/* Category cards */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(groceryByCategory).map(([category, entries]) => (
                  <div key={category} className="bg-card border border-border/50 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                      <span className="font-semibold text-sm">{category}</span>
                      <span className="font-data text-[10px] text-muted-foreground">
                        {entries.filter(e => e.item.checked).length}/{entries.length}
                      </span>
                    </div>
                    <div>
                      {entries.map(({ item, globalIdx }, idx) => (
                        <div
                          key={globalIdx}
                          className={`flex items-center gap-2 px-3 py-2.5 group ${idx < entries.length - 1 ? 'border-b border-border/30' : ''}`}
                        >
                          <button
                            onClick={() => toggleGroceryItem(globalIdx)}
                            className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {item.checked
                              ? <CheckCircle className="w-4 h-4 text-emerald-400" />
                              : <Circle className="w-4 h-4" />}
                          </button>

                          {editingItemIndex === globalIdx ? (
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              <Input
                                type="number"
                                value={editAmount}
                                onChange={(e) => setEditAmount(e.target.value)}
                                className="h-7 w-20 text-xs px-2"
                                onKeyDown={(e) => { if (e.key === 'Enter') commitEditItem(); if (e.key === 'Escape') setEditingItemIndex(null) }}
                                autoFocus
                              />
                              <Select value={editUnit} onValueChange={setEditUnit}>
                                <SelectTrigger className="h-7 w-20 text-xs px-2"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {['g', 'oz', 'lb', 'ml', 'cup', 'tbsp', 'tsp', 'serving', 'piece', 'slice', 'ground'].map(u => (
                                    <SelectItem key={u} value={u}>{u}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <button onClick={commitEditItem} className="text-emerald-400 hover:text-emerald-300 transition-colors">
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEditItem(globalIdx)}
                              className={`flex-1 min-w-0 text-left text-sm truncate ${item.checked ? 'line-through text-muted-foreground' : ''}`}
                            >
                              {item.ingredient}
                            </button>
                          )}

                          <button
                            onClick={() => removeGroceryItem(globalIdx)}
                            className="flex-shrink-0 text-muted-foreground/40 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border/60 rounded-xl">
              <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                <ShoppingCart className="w-6 h-6 text-muted-foreground/30" />
              </div>
              <p className="font-medium text-muted-foreground">No grocery list yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1 text-center px-4">Plan your meals for the week, then generate a list — or add items manually.</p>
              <div className="flex gap-2 mt-4">
                <Button variant="brand" size="sm" className="gap-1.5" onClick={() => setActiveTab('planner')}>
                  <CalendarDays className="w-3.5 h-3.5" />
                  Plan Meals
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={openAddItemDialog}>
                  <Plus className="w-3.5 h-3.5" />
                  Add Manually
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Grocery Item dialog */}
      <Dialog open={addItemOpen} onOpenChange={(open) => { if (!open) { setAddItemOpen(false); setGrocerySearchQuery(''); setGroceryShowSuggestions(false) } }}>
        <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-4 border-b border-border/60 flex-shrink-0">
            <DialogTitle>Add Grocery Item</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Search with autocomplete */}
            <div className="space-y-1.5">
              <Label>Search ingredient</Label>
              <div className="relative">
                <Input
                  placeholder="Type to search (e.g. chicken, oats, spinach...)"
                  value={grocerySearchQuery}
                  onChange={(e) => {
                    const v = e.target.value
                    setGrocerySearchQuery(v)
                    setNewItemName(v)
                    setGroceryShowSuggestions(v.trim().length > 0)
                  }}
                  onFocus={() => grocerySearchQuery.trim() && setGroceryShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setGroceryShowSuggestions(false), 150)}
                  autoFocus
                />
                {groceryShowSuggestions && grocerySuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                    {grocerySuggestions.map((item) => (
                      <button
                        key={item.id}
                        onMouseDown={() => selectGrocerySuggestion(item.name, item.default_serving_unit === 'g' ? 'g' : item.default_serving_unit === 'oz' ? 'oz' : 'serving')}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 flex items-center justify-between gap-2 border-b border-border/30 last:border-0"
                      >
                        <span className="truncate">{item.name}</span>
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">{categorizeIngredient(item.name)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {newItemName && (
                <p className="text-[11px] text-muted-foreground">
                  Category: <span className="text-foreground font-medium">{categorizeIngredient(newItemName)}</span>
                </p>
              )}
            </div>

            {/* Amount + unit */}
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 200"
                  value={newItemAmount}
                  onChange={(e) => setNewItemAmount(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                  className="flex-1"
                />
                <Select value={newItemUnit} onValueChange={setNewItemUnit}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[
                      { value: 'g', label: 'g (grams)' },
                      { value: 'oz', label: 'oz' },
                      { value: 'lb', label: 'lb' },
                      { value: 'ml', label: 'ml' },
                      { value: 'cup', label: 'cup' },
                      { value: 'tbsp', label: 'tbsp' },
                      { value: 'tsp', label: 'tsp' },
                      { value: 'serving', label: 'serving' },
                      { value: 'piece', label: 'piece' },
                      { value: 'slice', label: 'slice' },
                    ].map(u => (
                      <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Quick-add common items */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick add common items</p>
              {[
                { label: 'Protein', color: 'text-rose-400', items: [
                  { name: 'Chicken breast', unit: 'g' }, { name: 'Ground beef', unit: 'g' },
                  { name: 'Salmon fillet', unit: 'g' }, { name: 'Eggs', unit: 'piece' },
                  { name: 'Greek yogurt', unit: 'g' }, { name: 'Tuna (canned)', unit: 'g' },
                ]},
                { label: 'Produce', color: 'text-emerald-400', items: [
                  { name: 'Broccoli', unit: 'g' }, { name: 'Spinach', unit: 'g' },
                  { name: 'Banana', unit: 'piece' }, { name: 'Sweet potato', unit: 'g' },
                  { name: 'Avocado', unit: 'piece' }, { name: 'Blueberries', unit: 'g' },
                ]},
                { label: 'Grains & Dairy', color: 'text-amber-400', items: [
                  { name: 'Oats', unit: 'g' }, { name: 'Brown rice', unit: 'g' },
                  { name: 'Whole wheat bread', unit: 'slice' }, { name: 'Milk', unit: 'ml' },
                  { name: 'Cheddar cheese', unit: 'g' }, { name: 'Cottage cheese', unit: 'g' },
                ]},
                { label: 'Pantry', color: 'text-sky-400', items: [
                  { name: 'Olive oil', unit: 'tbsp' }, { name: 'Almond butter', unit: 'tbsp' },
                  { name: 'Honey', unit: 'tbsp' }, { name: 'Soy sauce', unit: 'tbsp' },
                  { name: 'Protein powder', unit: 'g' }, { name: 'Almonds', unit: 'g' },
                ]},
              ].map((group) => (
                <div key={group.label} className="space-y-1.5">
                  <p className={`text-[11px] font-medium ${group.color}`}>{group.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.items.map((item) => (
                      <button
                        key={item.name}
                        onClick={() => selectGrocerySuggestion(item.name, item.unit)}
                        className="text-xs px-2.5 py-1 rounded-full border border-border/60 bg-muted/30 hover:bg-muted/60 hover:border-border text-muted-foreground hover:text-foreground transition-all duration-150"
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="px-5 pb-5 pt-3 border-t border-border/60 flex gap-2 flex-shrink-0">
            <Button variant="brand" className="flex-1" onClick={handleAddItem} disabled={!newItemName.trim()}>
              Add to List
            </Button>
            <Button variant="outline" onClick={() => { setAddItemOpen(false); setGrocerySearchQuery('') }}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Meal to Planner dialog */}
      <Dialog open={addMealDialogOpen} onOpenChange={setAddMealDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-4 border-b border-border/60 flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              {pendingSlot && (
                <>
                  {(() => { const Icon = SLOT_ICONS[pendingSlot.slot]; return <Icon className={`w-4 h-4 ${SLOT_COLORS[pendingSlot.slot]}`} /> })()}
                  <span>Add {pendingSlot.slot.charAt(0).toUpperCase() + pendingSlot.slot.slice(1)} · {DAY_FULL[pendingSlot.day]}</span>
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {/* Mode selector */}
          <div className="flex border-b border-border/60 flex-shrink-0">
            {(['recipe', 'saved', 'custom'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setAddMealMode(mode)}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  addMealMode === mode
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {mode === 'recipe' ? 'Recipes' : mode === 'saved' ? 'Saved Meals' : 'Custom'}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {addMealMode === 'recipe' && (
              <>
                <Input
                  placeholder="Search recipes..."
                  value={recipeSearchQuery}
                  onChange={(e) => setRecipeSearchQuery(e.target.value)}
                  autoFocus
                />
                <div className="space-y-2">
                  {filteredPlanRecipes.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No recipes found</p>
                  ) : filteredPlanRecipes.map((recipe) => (
                    <button
                      key={recipe.id}
                      onClick={() => confirmAddRecipe(recipe)}
                      className="w-full text-left bg-card border border-border/50 rounded-xl p-3 hover:border-border hover:shadow-sm transition-all duration-150"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{recipe.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{recipe.description}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-data text-sm font-semibold tabular-nums">{recipe.macros.calories}<span className="text-muted-foreground font-normal text-xs ml-0.5">cal</span></p>
                          <p className="font-data text-xs text-emerald-500 tabular-nums">{recipe.macros.protein_g}g<span className="text-muted-foreground font-normal ml-0.5">prot</span></p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {addMealMode === 'saved' && (
              <>
                <Input
                  placeholder="Search saved meals..."
                  value={savedMealSearchQuery}
                  onChange={(e) => setSavedMealSearchQuery(e.target.value)}
                  autoFocus
                />
                {savedMeals.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">No saved meals yet.</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Build meals in the &quot;Today&apos;s Meals&quot; tab and save them as templates.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {savedMeals
                      .filter(m => !savedMealSearchQuery.trim() || m.name.toLowerCase().includes(savedMealSearchQuery.toLowerCase()))
                      .map((meal) => (
                        <button
                          key={meal.id}
                          onClick={() => confirmAddSavedMeal(meal)}
                          className="w-full text-left bg-card border border-border/50 rounded-xl p-3 hover:border-border hover:shadow-sm transition-all duration-150"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{meal.name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                                {meal.meal_type}
                                {meal.items.length > 0 && ` · ${meal.items.length} ingredient${meal.items.length !== 1 ? 's' : ''}`}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="font-data text-sm font-semibold tabular-nums">{meal.macros.calories}<span className="text-muted-foreground font-normal text-xs ml-0.5">cal</span></p>
                              <p className="font-data text-xs text-emerald-500 tabular-nums">{meal.macros.protein_g}g<span className="text-muted-foreground font-normal ml-0.5">prot</span></p>
                            </div>
                          </div>
                        </button>
                      ))
                    }
                    {savedMeals.filter(m => !savedMealSearchQuery.trim() || m.name.toLowerCase().includes(savedMealSearchQuery.toLowerCase())).length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No matches found</p>
                    )}
                  </div>
                )}
              </>
            )}

            {addMealMode === 'custom' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Meal name</Label>
                  <Input
                    placeholder="e.g. Grilled chicken with rice"
                    value={customMealInput}
                    onChange={(e) => setCustomMealInput(e.target.value)}
                    autoFocus
                  />
                </div>

                {/* Ingredient builder */}
                <div className="space-y-2">
                  <Label>Ingredients <span className="text-muted-foreground font-normal">(for grocery list)</span></Label>
                  <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                    <Input
                      placeholder="e.g. chicken breast"
                      value={customIngName}
                      onChange={(e) => setCustomIngName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addCustomIngredient()}
                      className="flex-1 min-w-0"
                    />
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="Amount"
                      value={customIngAmount}
                      onChange={(e) => setCustomIngAmount(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addCustomIngredient()}
                      className="w-24"
                    />
                    <Select value={customIngUnit} onValueChange={setCustomIngUnit}>
                      <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['g', 'oz', 'lb', 'ml', 'cup', 'tbsp', 'tsp', 'serving', 'piece', 'slice', 'ground'].map(u => (
                          <SelectItem key={u} value={u}>{u}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addCustomIngredient} disabled={!customIngName.trim() || !customIngAmount}>
                    <Plus className="w-3.5 h-3.5" />
                    Add ingredient
                  </Button>
                </div>

                {customIngredients.length > 0 && (
                  <div className="rounded-lg border border-border/60 bg-muted/20 divide-y divide-border/30">
                    {customIngredients.map((ing, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2">
                        <span className="text-sm">{ing.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-data text-xs text-muted-foreground">{ing.amount}{ing.unit}</span>
                          <button
                            onClick={() => setCustomIngredients(prev => prev.filter((_, j) => j !== i))}
                            className="text-muted-foreground/40 hover:text-destructive transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {customIngredients.length === 0 && (
                  <p className="text-xs text-muted-foreground">No ingredients added — this meal won&apos;t contribute to your grocery list.</p>
                )}

                <Button variant="brand" className="w-full" onClick={confirmAddCustom} disabled={!customMealInput.trim()}>
                  Add to Plan
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Recipe detail modal */}
      <Dialog open={!!selectedRecipe} onOpenChange={() => setSelectedRecipe(null)}>
        {selectedRecipe && (
          <RecipeDetailModal recipe={selectedRecipe} onClose={() => setSelectedRecipe(null)} />
        )}
      </Dialog>

      <MealEditorModal
        open={editorOpen}
        onOpenChange={setEditorOpen}
        initialMealType={editorMealType}
        editingMeal={editingMeal}
        editingSavedMeal={editingSavedMeal}
        onSave={handleSaveMeal}
        onSaveTemplate={handleSaveTemplate}
      />
    </div>
  )
}
