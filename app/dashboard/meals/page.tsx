'use client'

import React from 'react'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, startOfWeek, subDays } from 'date-fns'
import {
  ChefHat, ShoppingCart, Clock, Users, Flame,
  CheckCircle, Circle, Download, Plus, Zap, Pencil, Trash2, X, CalendarDays,
  Coffee, Soup, Moon, Cookie, GlassWater, Search, BookOpen, ChevronDown,
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
  getAvailableUnits,
  parseFraction,
} from '@/lib/food-search'
import { toast } from 'sonner'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'drink'] as const
type MealType = (typeof MEAL_TYPES)[number]
type MealSource = 'search' | 'saved' | 'recent' | 'recipe' | 'manual'
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

function fmtMacro(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0'
  if (n >= 1) return String(Math.round(n))
  return parseFloat(n.toFixed(2)).toString()
}

function scaleMealLogEntry(entry: MealLogEntry, multiplier: number): MealLogEntry {
  const clamp = Number.isFinite(multiplier) ? Math.max(0, multiplier) : 0
  const round1 = (n: number) => Math.round((Number(n) || 0) * 10) / 10

  return {
    ...entry,
    macros: {
      calories: Math.round((entry.macros?.calories || 0) * clamp),
      protein_g: round1((entry.macros?.protein_g || 0) * clamp),
      carbs_g: round1((entry.macros?.carbs_g || 0) * clamp),
      fat_g: round1((entry.macros?.fat_g || 0) * clamp),
    },
    recipe_amount: entry.recipe_amount
      ? entry.recipe_amount.kind === 'servings'
        ? { kind: 'servings', servings: round1(entry.recipe_amount.servings * clamp) }
        : { kind: 'units', units: round1(entry.recipe_amount.units * clamp) }
      : undefined,
    meal_items: (entry.meal_items || []).map((item) => ({
      ...item,
      macros: {
        calories: Math.round((item.macros?.calories || 0) * clamp),
        protein_g: round1((item.macros?.protein_g || 0) * clamp),
        carbs_g: round1((item.macros?.carbs_g || 0) * clamp),
        fat_g: round1((item.macros?.fat_g || 0) * clamp),
      },
      amount: item.amount != null ? round1(item.amount * clamp) : item.amount,
      servings: item.servings != null ? round1(item.servings * clamp) : item.servings,
    })),
  }
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

  // Exact matches get highest priority
  if (baseName === normalizedQuery) score += 200
  if (normalizedName === normalizedQuery) score += 180
  if (aliases.includes(normalizedQuery)) score += 140
  
  // Startswith matches
  if (baseName.startsWith(normalizedQuery)) score += 110
  if (normalizedName.startsWith(normalizedQuery)) score += 90
  
  // Contains matches
  if (baseName.includes(normalizedQuery)) score += 60
  if (normalizedName.includes(normalizedQuery)) score += 45

  // Token overlap
  const overlap = queryTokens.filter((token) => nameTokens.includes(token)).length
  score += overlap * 18

  // Smart prioritization logic
  const hasBrandKeywords = /kraft|heinz|general mills|kellogg|campbell|tyson|perdue|oreo|coca|pepsi|nike|adidas|sony|samsung|apple|google|microsoft|amazon|walmart|target|costco|whole foods|trader joe|fairlife|premier protein|orgain|quest|one bars|kind bars|clif bar|powerbar|pure protein|muscle milk|optimum nutrition|bsn|cellucor|musclepharm|myprotein|bulk|dymatize|universal|animal|ghost|legion|transparent|swole|kaged|jym|beast|mutant|hitech|hi-tech|pro sup|nutrex|mhp|mhp|blackstone|black stone|redcon1|hardcore|dark matter|force factor|six star|muscle tech|cell tech|hydroxycut|lipo|zantrex|xenadrine|thermogenic|fat burner|pre workout|bcaa|creatine|protein powder|whey|casein|isolate|concentrate|hydrolyzed|plant based|vegan|soy|pea|hemp|rice|egg|collagen|mass gainer|weight gainer|meal replacement|mrp|bar|shake|drink|mix|blend|complex|matrix|formula|system|tech|pro|advanced|ultimate|extreme|max|plus|ultra|super|mega|hyper|nitro|turbo|power|force|energy|fuel|charge|blast|rush|shock|impact|strike|boom|bang|furious|intense|vicious|brutal|hardcore|extreme|ultimate|pro|elite|gold|platinum|diamond|black|white|red|blue|green|purple|orange|yellow|pink|brown|grey|silver|bronze|copper|iron|steel|titanium|platinum|crystal|quantum|nuclear|atomic|molecular|cellular|genetic|bio|nano|micro|macro|mega|giga|tera|peta|exa|zetta|yotta/i.test(normalizedName)
  
  const isUserSearchingForBrand = hasBrandKeywords && queryTokens.some(token => 
    /kraft|heinz|general|mill|kellogg|campbell|tyson|perdue|oreo|coca|pepsi|nike|adidas|sony|samsung|apple|google|microsoft|amazon|walmart|target|costco|whole|trader|joe|fairlife|premier|orgain|quest|kind|clif|powerbar|pure|muscle|optimum|bsn|cellucor|musclepharm|myprotein|bulk|dymatize|universal|animal|ghost|legion|transparent|swole|kaged|jym|beast|mutant|hi-tech|pro|sup|nutrex|mhp|blackstone|redcon|hardcore|dark|matter|force|factor|six|muscle|tech|cell|hydroxycut|lipo|zantrex|xenadrine|thermogenic|fat|burner|pre|workout|bcaa|creatine|protein|whey|casein|isolate|concentrate|hydrolyzed|plant|vegan|soy|pea|hemp|rice|egg|collagen|mass|gainer|weight|meal|replacement|mrp|bar|shake|drink|mix|blend|complex|matrix|formula|system|tech|pro|advanced|ultimate|extreme|max|plus|ultra|super|mega|hyper|nitro|turbo|power|force|energy|fuel|charge|blast|rush|shock|impact|strike|boom|bang|furious|intense|vicious|brutal|hardcore|elite|gold|platinum|diamond|black|white|red|blue|green|purple|orange|yellow|pink|brown|grey|silver|bronze|copper|iron|steel|titanium|crystal|quantum|nuclear|atomic|molecular|cellular|genetic|bio|nano|micro|macro|mega|giga|tera|peta|exa|zetta|yotta/i.test(token)
  )
  
  // Penalize brand items unless user is specifically searching for brands
  if (hasBrandKeywords && !isUserSearchingForBrand) {
    score -= 150 // Heavy penalty for brand items in general searches
  } else if (hasBrandKeywords && isUserSearchingForBrand) {
    score += 50 // Boost brand items when user is searching for brands
  }
  
  // Boost generic/basic foods
  const isGenericFood = !hasBrandKeywords && (
    item.id.startsWith('food-') || 
    item.id.startsWith('ext-') ||
    (item.name && !/\b(kraft|heinz|general|mill|kellogg|campbell|tyson|perdue|oreo|coca|pepsi|nike|adidas|sony|samsung|apple|google|microsoft|amazon|walmart|target|costco|whole|trader|joe|fairlife|premier|orgain|quest|kind|clif|powerbar|pure|muscle|optimum|bsn|cellucor|musclepharm|myprotein|bulk|dymatize|universal|animal|ghost|legion|transparent|swole|kaged|jym|beast|mutant|hi-tech|pro|sup|nutrex|mhp|blackstone|redcon|hardcore|dark|matter|force|factor|six|muscle|tech|cell|hydroxycut|lipo|zantrex|xenadrine|thermogenic|fat|burner|pre|workout|bcaa|creatine|protein|whey|casein|isolate|concentrate|hydrolyzed|plant|vegan|soy|pea|hemp|rice|egg|collagen|mass|gainer|weight|meal|replacement|mrp|bar|shake|drink|mix|blend|complex|matrix|formula|system|tech|pro|advanced|ultimate|extreme|max|plus|ultra|super|mega|hyper|nitro|turbo|power|force|energy|fuel|charge|blast|rush|shock|impact|strike|boom|bang|furious|intense|vicious|brutal|hardcore|elite|gold|platinum|diamond|black|white|red|blue|green|purple|orange|yellow|pink|brown|grey|silver|bronze|copper|iron|steel|titanium|platinum|crystal|quantum|nuclear|atomic|molecular|cellular|genetic|bio|nano|micro|macro|mega|giga|tera|peta|exa|zetta|yotta)\b/i.test(item.name))
  )
  
  if (isGenericFood && !isUserSearchingForBrand) {
    score += 25 // Boost generic foods in general searches
  }

  // Prefer clean names without parentheses (usually basic versions)
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

type RecipeAmountMode = 'servings' | 'units'

function getRecipeAmountDefaults(recipe: Recipe): { mode: RecipeAmountMode; servings: string; units: string } {
  const hasYield = Number(recipe.yield_quantity) > 0 && !!recipe.yield_unit
  return {
    mode: hasYield ? 'units' : 'servings',
    servings: '1',
    units: '1',
  }
}

function scaleRecipeMacros(recipe: Recipe, mode: RecipeAmountMode, rawValue: string) {
  const value = Number(rawValue)
  const safeValue = Number.isFinite(value) ? value : 0

  let multiplier = 0
  if (mode === 'servings') {
    multiplier = safeValue
  } else {
    const yieldQty = Number(recipe.yield_quantity)
    if (Number.isFinite(yieldQty) && yieldQty > 0) {
      multiplier = safeValue / yieldQty
    }
  }

  const clampMultiplier = Math.max(0, multiplier)
  const roundMacro = (n: number) => Math.round(n * 10) / 10

  return {
    multiplier: clampMultiplier,
    macros: {
      calories: Math.round((recipe.macros.calories || 0) * clampMultiplier),
      protein_g: roundMacro((recipe.macros.protein_g || 0) * clampMultiplier),
      carbs_g: roundMacro((recipe.macros.carbs_g || 0) * clampMultiplier),
      fat_g: roundMacro((recipe.macros.fat_g || 0) * clampMultiplier),
    },
  }
}

function AddToTodayButton({ recipe }: { recipe: Recipe }) {
  const { addMealEntry } = useAppStore()
  const [mealType, setMealType] = useState<string>(recipe.meal_type)
  const defaults = useMemo(() => getRecipeAmountDefaults(recipe), [recipe])
  const [amountMode, setAmountMode] = useState<RecipeAmountMode>(defaults.mode)
  const [servings, setServings] = useState(defaults.servings)
  const [units, setUnits] = useState(defaults.units)
  const hasYield = Number(recipe.yield_quantity) > 0 && !!recipe.yield_unit

  useEffect(() => {
    setAmountMode(defaults.mode)
    setServings(defaults.servings)
    setUnits(defaults.units)
  }, [defaults.mode, defaults.servings, defaults.units])

  const selectedValue = amountMode === 'servings' ? servings : units
  const scaled = useMemo(() => scaleRecipeMacros(recipe, amountMode, selectedValue), [recipe, amountMode, selectedValue])

  return (
    <div className="flex gap-1.5 items-center">
      <Select value={mealType} onValueChange={setMealType}>
        <SelectTrigger className="h-8 text-xs flex-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="breakfast">Breakfast</SelectItem>
          <SelectItem value="lunch">Lunch</SelectItem>
          <SelectItem value="dinner">Dinner</SelectItem>
          <SelectItem value="snack">Snack</SelectItem>
        </SelectContent>
      </Select>
      <Select value={amountMode} onValueChange={(v) => setAmountMode(v as RecipeAmountMode)}>
        <SelectTrigger className="h-8 text-xs w-[96px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="servings">Servings</SelectItem>
          <SelectItem value="units" disabled={!hasYield}>{hasYield ? (recipe.yield_unit || 'Units') : 'Units'}</SelectItem>
        </SelectContent>
      </Select>
      <Input
        className="h-8 text-xs w-[84px]"
        type="number"
        min={0.1}
        step={0.1}
        value={selectedValue}
        onChange={(e) => {
          const v = e.target.value
          if (amountMode === 'servings') setServings(v)
          else setUnits(v)
        }}
        placeholder={amountMode === 'servings' ? '1' : '2'}
      />
      <Button
        size="sm"
        variant="outline"
        className="gap-1 text-xs shrink-0 px-3"
        onClick={() => {
          if (scaled.multiplier <= 0) {
            toast.error(`Enter a ${amountMode === 'servings' ? 'serving amount' : 'unit amount'} greater than 0.`)
            return
          }
          addMealEntry(getTodayISO(), {
            id: `m-${Date.now()}`,
            meal_type: mealType as MealType,
            name: recipe.name,
            macros: scaled.macros,
            time: format(new Date(), 'h:mm a'),
            recipe,
            recipe_amount: amountMode === 'servings'
              ? { kind: 'servings', servings: Number(servings) }
              : { kind: 'units', units: Number(units) },
          })
          toast.success(`${recipe.name} added to ${mealType}.`)
        }}
      >
        <Plus className="w-3 h-3" />
        Add
      </Button>
    </div>
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
  const { savedMeals, customRecipes, mealEntries } = useAppStore()
  const isMealTypeLocked = initialMealType !== null && !editingMeal && !editingSavedMeal
  const allRecipes = useMemo(() => [...customRecipes, ...RECIPES], [customRecipes])

  const recentMeals = useMemo(() => {
    const cutoff = format(subDays(new Date(), 7), 'yyyy-MM-dd')
    const rows: Array<{ key: string; date: string; entry: MealLogEntry }> = []

    for (const [date, entries] of Object.entries(mealEntries || {})) {
      if (date < cutoff) continue
      for (const entry of entries || []) {
        const recipeId = entry.recipe?.id || ''
        const key = `${entry.entry_source || ''}|${recipeId}|${entry.name || ''}|${entry.meal_type || ''}|${entry.macros?.calories || 0}|${(entry.meal_items || []).length}`
        rows.push({ key, date, entry })
      }
    }

    rows.sort((a, b) => b.date.localeCompare(a.date))

    const seen = new Set<string>()
    const out: Array<{ key: string; date: string; entry: MealLogEntry }> = []
    for (const row of rows) {
      if (seen.has(row.key)) continue
      seen.add(row.key)
      out.push(row)
      if (out.length >= 20) break
    }
    return out
  }, [mealEntries])

  const [source, setSource] = useState<MealSource>('search')
  const [recentMultipliers, setRecentMultipliers] = useState<Record<string, string>>({})
  const [selectedRecentMealKeys, setSelectedRecentMealKeys] = useState<Record<string, boolean>>({})
  const [selectedSavedMealId, setSelectedSavedMealId] = useState<string>('')
  const [expandedSavedMealIds, setExpandedSavedMealIds] = useState<Record<string, boolean>>({})
  const [savedMealModalSearch, setSavedMealModalSearch] = useState('')
  const [savedMealModalFilterType, setSavedMealModalFilterType] = useState<string>('all')
  const [recipeSearch, setRecipeSearch] = useState('')
  const [recipeTypeFilter, setRecipeTypeFilter] = useState<string>('all')
  // Saved-tab filter state
  const [savedEntryFiltersOpen, setSavedEntryFiltersOpen] = useState(false)
  const [savedEntryMealTypeFilter, setSavedEntryMealTypeFilter] = useState<string>('all')
  const [savedEntryNutritionFilters, setSavedEntryNutritionFilters] = useState<string[]>([])
  const [mealType, setMealType] = useState<MealType>(initialMealType ?? 'breakfast')
  const [recipeId, setRecipeId] = useState<string>('')
  const [recipeMealName, setRecipeMealName] = useState('')
  const [recipeAmountMode, setRecipeAmountMode] = useState<RecipeAmountMode>('servings')
  const [recipeServings, setRecipeServings] = useState('1')
  const [recipeUnits, setRecipeUnits] = useState('1')
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
  // Ingredient-only list for editing saved meal templates (no macros)
  const [savedMealIngredients, setSavedMealIngredients] = useState<Array<{ id: string; name: string; amount: number | null; unit: string; macros?: { calories: number; protein_g: number; carbs_g: number; fat_g: number } }>>([])
  const [savedMealIngName, setSavedMealIngName] = useState('')
  const [savedMealIngAmount, setSavedMealIngAmount] = useState('')
  const [savedMealIngUnit, setSavedMealIngUnit] = useState('g')
  const [catalogSuggestions, setCatalogSuggestions] = useState<FoodCatalogItem[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)

  // Initialize catalog with full catalog including user history
  useEffect(() => {
    setCatalogSuggestions(getKnownFoodCatalog())
  }, [])

  // Build a catalog from the user's own meal history and saved meal ingredients
  // so previously logged foods (incl. branded items) are always searchable
  const userFoodCatalog = useMemo((): FoodCatalogItem[] => {
    const seen = new Set<string>()
    const result: FoodCatalogItem[] = []
    const addItem = (name: string, amount: number, unit: string, macros: { calories: number; protein_g: number; carbs_g: number; fat_g: number }) => {
      const key = normalizeFoodText(name)
      if (!key || seen.has(key)) return
      seen.add(key)
      result.push({
        id: `user-${key.replace(/\s+/g, '-').slice(0, 40)}`,
        name,
        aliases: [],
        default_serving_amount: amount,
        default_serving_unit: unit,
        default_serving_label: `${amount}${unit}`,
        macros_per_serving: macros,
      })
    }
    for (const meal of (savedMeals || [])) {
      for (const item of meal.items) {
        addItem(item.matched_name, item.amount, item.unit, item.macros ?? { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 })
      }
    }
    for (const entries of Object.values(mealEntries || {})) {
      for (const entry of entries) {
        if (!entry.meal_items) continue
        for (const item of entry.meal_items) {
          addItem(item.name, item.amount ?? 1, item.unit ?? 'serving', item.macros)
        }
      }
    }
    return result
  }, [savedMeals, mealEntries])

  // Merge user history (deduplicated) with the catalog
  const allCatalogItems = useMemo((): FoodCatalogItem[] => {
    const fullCatalog = getKnownFoodCatalog()
    const userHistoryItems = userFoodCatalog.filter(i => 
      !fullCatalog.some(catalog => normalizeFoodText(catalog.name) === normalizeFoodText(i.name))
    )
    return [...userHistoryItems, ...fullCatalog]
  }, [userFoodCatalog])

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
    const catalogMatches = allCatalogItems
      .filter((item) => {
        const normalizedItemName = normalizeFoodText(item.name)
        // At least one query token must appear in the name or alias (more flexible)
        const nameMatches = qTokens.some((token) => normalizedItemName.includes(token))
        const aliasMatches = item.aliases.some((alias) => {
          const normalizedAlias = normalizeFoodText(alias)
          return qTokens.some((token) => normalizedAlias.includes(token))
        })
        const isDish = isDishCombination(item.name)
        const shouldInclude = !queryIsDish || !isDish
        return (nameMatches || aliasMatches) && shouldInclude
      })
      .sort((left, right) => scoreSuggestion(right, foodQuery) - scoreSuggestion(left, foodQuery))
      .map((item) => ({ ...item, _isSavedMeal: false as const }))

    return [...savedMatches, ...catalogMatches].slice(0, 100)
  }, [allCatalogItems, foodQuery, savedMeals, source])

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
    const selectedFood = filteredSuggestions.find(item => 
      (item._isSavedMeal ? item.name : item.name) === (searchItemName || foodQuery)
    )
    
    if (selectedFood && !selectedFood._isSavedMeal) {
      return getAvailableUnits(selectedFood).map(unit => ({
        value: unit as SearchMeasureUnit,
        label: unit
      }))
    }
    
    const options: Array<{ value: SearchMeasureUnit; label: string }> = [
      { value: 'serving', label: 'Serving' },
      { value: 'g', label: 'g' },
      { value: 'oz', label: 'oz' },
      { value: 'ml', label: 'ml' },
      { value: 'fl_oz', label: 'fl oz' },
    ]
    return options
  }, [filteredSuggestions, searchItemName, foodQuery])

  const filteredModalRecipes = useMemo(() => {
    let list = allRecipes
    if (recipeTypeFilter !== 'all') list = list.filter(r => r.meal_type === recipeTypeFilter)
    if (recipeSearch.trim()) {
      const q = recipeSearch.toLowerCase()
      list = list.filter(r => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q))
    }
    return list
  }, [allRecipes, recipeSearch, recipeTypeFilter])

  const filteredModalSavedMeals = useMemo(() => {
    let list = savedMeals
    if (savedMealModalFilterType !== 'all') list = list.filter(m => m.meal_type === savedMealModalFilterType)
    if (savedMealModalSearch.trim()) {
      const q = savedMealModalSearch.toLowerCase()
      list = list.filter(m => m.name.toLowerCase().includes(q))
    }
    return list
  }, [savedMeals, savedMealModalSearch, savedMealModalFilterType])

  const handleSourceChange = (nextSource: MealSource) => {
    if (source === 'recipe' && nextSource !== 'recipe') {
      setRecipeId('')
    }
    if (source === 'saved' && nextSource !== 'saved') {
      setSelectedSavedMealId('')
    }
    setSource(nextSource)
  }

  const selectedRecipe = useMemo(() => {
    if (!recipeId) return null
    return allRecipes.find((r) => r.id === recipeId) ?? null
  }, [allRecipes, recipeId])

  const recipeHasYield = useMemo(() => {
    return !!selectedRecipe && Number(selectedRecipe.yield_quantity) > 0 && !!selectedRecipe.yield_unit
  }, [selectedRecipe])

  const recipeAmountValue = recipeAmountMode === 'servings' ? recipeServings : recipeUnits
  const recipeScaled = useMemo(() => {
    if (!selectedRecipe) return null
    return scaleRecipeMacros(selectedRecipe, recipeAmountMode, recipeAmountValue)
  }, [selectedRecipe, recipeAmountMode, recipeAmountValue])

  useEffect(() => {
    if (source !== 'recipe') return
    if (!selectedRecipe) return
    const defaults = getRecipeAmountDefaults(selectedRecipe)
    setRecipeAmountMode(defaults.mode)
    setRecipeServings(defaults.servings)
    setRecipeUnits(defaults.units)
  }, [source, selectedRecipe])

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

    const amountNum = manualItemAmount ? parseFraction(manualItemAmount) : undefined

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
      setManualItemName('')
      setManualCalories(String(editingSavedMeal.macros.calories))
      setManualProtein(String(editingSavedMeal.macros.protein_g))
      setManualCarbs(String(editingSavedMeal.macros.carbs_g))
      setManualFat(String(editingSavedMeal.macros.fat_g))
      setManualItems([])
      setSavedMealIngredients(
        editingSavedMeal.items.map((item) => ({
          id: `ing-${Math.random().toString(36).slice(2)}`,
          name: item.matched_name,
          amount: item.amount ?? null,
          unit: item.unit ?? 'g',
          macros: item.macros,
        }))
      )
      setSavedMealIngName('')
      setSavedMealIngAmount('')
      setSavedMealIngUnit('g')
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
    // Only set meal type to recipe's default if no specific meal type was provided
    if (!initialMealType) {
      setMealType(recipe.meal_type)
    }
    setRecipeMealName(recipe.name)
    setCalories(String(recipe.macros.calories))
    setProtein(String(recipe.macros.protein_g))
    setCarbs(String(recipe.macros.carbs_g))
    setFat(String(recipe.macros.fat_g))
  }, [recipeId, source, allRecipes, initialMealType])

  const handleSave = () => {
    if (source === 'search') {
      const usingList = searchItems.length > 0;
      const singleName = (searchItemName.trim() || foodQuery.trim());
      const singleCalories = Number(searchCalories);
      const singleProtein = Number(searchProtein || 0);
      const singleCarbs = Number(searchCarbs || 0);
      const singleFat = Number(searchFat || 0);

      if (!usingList && !singleName) {
        toast.error('Add a search item first.');
        return;
      }

      if (!usingList && (!Number.isFinite(singleCalories) || singleCalories <= 0)) {
        toast.error('Calories must be a valid number greater than 0.');
        return;
      }

      if (searchSaveAsTemplate && !searchMealName.trim()) {
        toast.error('Add a meal name first.');
        return;
      }

      // If usingList (multiple search items), add each as a separate meal entry
      if (usingList && searchItems.length > 1) {
        searchItems.forEach((item) => {
          onSave({
            meal_type: mealType,
            name: item.name,
            macros: {
              calories: Math.round(item.macros.calories),
              protein_g: Math.round(item.macros.protein_g),
              carbs_g: Math.round(item.macros.carbs_g),
              fat_g: Math.round(item.macros.fat_g),
            },
            time: time.trim() || format(new Date(), 'h:mm a'),
            recipe: null,
            meal_items: [
              {
                name: item.name,
                macros: {
                  calories: Math.round(item.macros.calories),
                  protein_g: Math.round(item.macros.protein_g),
                  carbs_g: Math.round(item.macros.carbs_g),
                  fat_g: Math.round(item.macros.fat_g),
                },
              },
            ],
            entry_source: 'search',
          });
        });
        if (searchSaveAsTemplate) {
          // Save as a template with all items
          onSaveTemplate({
            name: searchMealName.trim() || 'Search meal',
            meal_type: mealType,
            macros: {
              calories: Math.round(searchTotals.calories),
              protein_g: Math.round(searchTotals.protein_g),
              carbs_g: Math.round(searchTotals.carbs_g),
              fat_g: Math.round(searchTotals.fat_g),
            },
            items: searchItems.map((item) => ({
              input: item.name,
              matched_name: item.name,
              amount: 1,
              unit: 'serving',
              macros: item.macros,
            })),
          });
        }
        onOpenChange(false);
        return;
      }

      // Single item (or only one in list) - keep original logic
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
          };

      const finalName =
        searchMealName.trim() ||
        (usingList
          ? searchItems.length === 1
            ? searchItems[0].name
            : 'Search meal total'
          : singleName);

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
          ];

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
            macros: item.macros,
          })),
        });
      }

      onSave({
        meal_type: mealType,
        name: finalName,
        macros: finalMacros,
        time: time.trim() || format(new Date(), 'h:mm a'),
        recipe: null,
        meal_items: mealItems,
        entry_source: 'search',
      });

      onOpenChange(false);
      return;
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
            amount: item.amount ?? 1,
            unit: item.unit ?? 'serving',
            macros: item.macros,
          }))
        : [
            {
              input: singleName,
              matched_name: singleName,
              amount: 1,
              unit: 'serving',
              macros: { calories: Math.round(singleCalories), protein_g: Math.round(singleProtein), carbs_g: Math.round(singleCarbs), fat_g: Math.round(singleFat) },
            },
          ]

      if (editingSavedMeal) {
        const ingredientItems = savedMealIngredients.map((ing) => ({
          input: ing.name,
          matched_name: ing.name,
          amount: ing.amount ?? 1,
          unit: ing.unit,
          macros: ing.macros,
        }))
        onSaveTemplate(
          {
            name: finalName,
            meal_type: mealType,
            macros: finalMacros,
            items: ingredientItems,
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

    if (source === 'saved') {
      if (!selectedSavedMealId) {
        toast.error('Select a saved meal first.')
        return
      }
      const template = savedMeals.find(m => m.id === selectedSavedMealId)
      if (!template) return
      onSave({
        meal_type: mealType,
        name: template.name,
        macros: template.macros,
        time: time.trim() || format(new Date(), 'h:mm a'),
        recipe: null,
        meal_items: template.items.map(item => ({
          name: item.matched_name,
          macros: item.macros ?? { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
          amount: item.amount,
          unit: item.unit,
        })),
        entry_source: 'saved',
        saved_meal_template_id: template.id,
      })
      onOpenChange(false)
      return
    }

    if (source === 'recent') {
      const selectedRows = recentMeals.filter((row) => selectedRecentMealKeys[row.key])
      if (selectedRows.length === 0) {
        toast.error('Select at least one recent meal first.')
        return
      }

      for (const row of selectedRows) {
        const multiplierText = recentMultipliers[row.key] ?? '1'
        const multiplier = Number(multiplierText)
        if (!Number.isFinite(multiplier) || multiplier <= 0) {
          toast.error('Each selected recent meal needs a serving size greater than 0.')
          return
        }
      }

      for (const row of selectedRows) {
        const multiplier = Number(recentMultipliers[row.key] ?? '1')
        const scaledEntry = scaleMealLogEntry(row.entry, multiplier)
        onSave({
          meal_type: row.entry.meal_type,
          name: scaledEntry.name,
          macros: scaledEntry.macros,
          time: time.trim() || format(new Date(), 'h:mm a'),
          recipe: scaledEntry.recipe,
          recipe_amount: scaledEntry.recipe_amount,
          meal_items: scaledEntry.meal_items || [],
          entry_source: scaledEntry.entry_source,
          saved_meal_template_id: scaledEntry.saved_meal_template_id,
        })
      }

      onOpenChange(false)
      return
    }

    if (!recipeId) {
      toast.error('Select a recipe first.')
      return
    }

    if (source === 'recipe') {
      const linkedRecipe = selectedRecipe
      if (!linkedRecipe || !recipeScaled) {
        toast.error('Select a recipe first.')
        return
      }
      if (recipeScaled.multiplier <= 0) {
        toast.error(`Enter a ${recipeAmountMode === 'servings' ? 'serving amount' : 'unit amount'} greater than 0.`)
        return
      }

      onSave({
        meal_type: mealType,
        name: recipeMealName.trim() || linkedRecipe.name,
        macros: recipeScaled.macros,
        time: time.trim() || format(new Date(), 'h:mm a'),
        recipe: linkedRecipe,
        meal_items: [],
        entry_source: 'recipe',
        recipe_amount: recipeAmountMode === 'servings'
          ? { kind: 'servings', servings: Number(recipeServings) }
          : { kind: 'units', units: Number(recipeUnits) },
      })

      onOpenChange(false)
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

    onSave({
      meal_type: mealType,
      name: recipeMealName.trim() || selectedRecipe?.name || 'Meal',
      macros: finalMacros,
      time: time.trim() || format(new Date(), 'h:mm a'),
      recipe: selectedRecipe,
      meal_items: [],
      entry_source: source,
    })

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editingSavedMeal ? 'Edit saved meal' : editingMeal ? 'Edit meal entry' : 'Add meal entry'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 px-1 max-h-[70vh] overflow-y-auto">
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
            <TabsList className="flex gap-2 h-auto bg-transparent p-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-1 px-1">
              <TabsTrigger value="search" className="shrink-0 text-xs rounded-lg border border-border/60 bg-muted/30 px-3 py-2 transition-colors hover:bg-accent/70 hover:text-foreground data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground focus-visible:ring-1 focus-visible:ring-primary/30">Search</TabsTrigger>
              <TabsTrigger value="saved" className="shrink-0 text-xs rounded-lg border border-border/60 bg-muted/30 px-3 py-2 transition-colors hover:bg-accent/70 hover:text-foreground data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground focus-visible:ring-1 focus-visible:ring-primary/30">Saved</TabsTrigger>
              <TabsTrigger value="recent" className="shrink-0 text-xs rounded-lg border border-border/60 bg-muted/30 px-3 py-2 transition-colors hover:bg-accent/70 hover:text-foreground data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground focus-visible:ring-1 focus-visible:ring-primary/30">Recent</TabsTrigger>
              <TabsTrigger value="recipe" className="shrink-0 text-xs rounded-lg border border-border/60 bg-muted/30 px-3 py-2 transition-colors hover:bg-accent/70 hover:text-foreground data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground focus-visible:ring-1 focus-visible:ring-primary/30">Recipes</TabsTrigger>
              <TabsTrigger value="manual" className="shrink-0 text-xs rounded-lg border border-border/60 bg-muted/30 px-3 py-2 transition-colors hover:bg-accent/70 hover:text-foreground data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground focus-visible:ring-1 focus-visible:ring-primary/30">Manual</TabsTrigger>
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
                    className="pl-9 pr-8"
                    autoFocus
                  />
                  {foodQuery && (
                    <button type="button" onClick={() => { setFoodQuery(''); setSearchMealName(''); setSearchItemName(''); setSearchBaseMacros(null); setShowSuggestions(false) }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {showSuggestions && foodQuery.trim().length > 0 && (filteredSuggestions.length > 0 || searchLoading) && (
                  <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
                    {filteredSuggestions.map((item) => {
                      const cals = item._isSavedMeal ? item.macros.calories : item.macros_per_serving.calories
                      const prot = item._isSavedMeal ? item.macros.protein_g : item.macros_per_serving.protein_g
                      const carbs = item._isSavedMeal ? item.macros.carbs_g : item.macros_per_serving.carbs_g
                      const fat = item._isSavedMeal ? item.macros.fat_g : item.macros_per_serving.fat_g
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectSuggestion(item)}
                          className="w-full px-3 py-2.5 text-left hover:bg-accent transition-colors border-b border-border/30 last:border-b-0"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium truncate">{item.name}</p>
                            {item._isSavedMeal && (
                              <Badge variant="outline" className="text-[10px] shrink-0">Saved</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-data text-xs text-muted-foreground">{fmtMacro(cals)} kcal</span>
                            <span className="text-[10px] text-border/50">·</span>
                            <span className="font-data text-xs text-emerald-500/80">{fmtMacro(prot)}g P</span>
                            <span className="text-[10px] text-border/50">·</span>
                            <span className="font-data text-xs text-muted-foreground">{fmtMacro(carbs)}g C</span>
                            <span className="text-[10px] text-border/50">·</span>
                            <span className="font-data text-xs text-muted-foreground">{fmtMacro(fat)}g F</span>
                          </div>
                        </button>
                      )
                    })}
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

            <TabsContent value="saved" className="mt-0 space-y-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  value={savedMealModalSearch}
                  onChange={e => setSavedMealModalSearch(e.target.value)}
                  placeholder="Search saved meals…"
                  type="search"
                  inputMode="search"
                  enterKeyHint="search"
                  autoCapitalize="none"
                  autoCorrect="off"
                  className="pl-9 pr-8 h-9"
                />
                {savedMealModalSearch && (
                  <button type="button" onClick={() => setSavedMealModalSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {/* Filter chips */}
              <div className="flex flex-wrap gap-1.5">
                {(['all', 'breakfast', 'lunch', 'dinner', 'snack'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSavedMealModalFilterType(t)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                      savedMealModalFilterType === t
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/40 text-muted-foreground border-border/50 hover:text-foreground'
                    }`}
                  >
                    {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
                <span className="text-[10px] text-muted-foreground ml-auto self-center tabular-nums">
                  {filteredModalSavedMeals.length} meal{filteredModalSavedMeals.length !== 1 ? 's' : ''}
                </span>
              </div>
              {/* List */}
              <div className="max-h-52 overflow-y-auto overscroll-contain space-y-1.5 pr-0.5">
              {savedMeals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border/60 rounded-xl">
                  <p className="font-medium text-muted-foreground text-sm">No saved meals yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Save a meal first to reuse it here</p>
                </div>
              ) : filteredModalSavedMeals.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No saved meals match.</p>
              ) : (
                filteredModalSavedMeals.map((meal) => {
                  const isSelected = selectedSavedMealId === meal.id
                  const isExpanded = expandedSavedMealIds[meal.id] || false
                  return (
                    <div
                      key={meal.id}
                      className={`rounded-xl border transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10'
                          : 'border-border/50 bg-muted/20'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedSavedMealId(meal.id)}
                        className="w-full text-left px-3 py-2.5 hover:bg-muted/20 rounded-xl transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{meal.name}</p>
                            <p className="font-data text-[11px] text-muted-foreground/60 mt-0.5 tabular-nums">
                              {meal.macros.calories} kcal · <span className="text-emerald-500/70">{meal.macros.protein_g}g P</span> · {meal.macros.carbs_g}g C · {meal.macros.fat_g}g F
                            </p>
                          </div>
                          {isSelected && <CheckCircle className="w-4 h-4 text-primary shrink-0" />}
                        </div>
                      </button>
                      {meal.items.length > 0 && (
                        <div className="px-3 pb-2.5">
                          <button
                            type="button"
                            onClick={() => setExpandedSavedMealIds(prev => ({ ...prev, [meal.id]: !prev[meal.id] }))}
                            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`} />
                            {isExpanded ? 'Hide' : 'Show'} ingredients ({meal.items.length})
                          </button>
                          {isExpanded && (
                            <div className="mt-1.5 rounded-lg border border-border/40 divide-y divide-border/30">
                              {meal.items.map((item, idx) => (
                                <div key={idx} className="px-2.5 py-1.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-medium text-foreground/80 truncate">{item.matched_name}</span>
                                    {item.amount != null && (
                                      <span className="font-data text-[10px] text-muted-foreground/60 shrink-0">{item.amount}{item.unit}</span>
                                    )}
                                  </div>
                                  {item.macros && (
                                    <p className="font-data text-[10px] tabular-nums text-muted-foreground/55 mt-0.5">
                                      {item.macros.calories} kcal · <span className="text-emerald-500/70">{item.macros.protein_g}g P</span> · {item.macros.carbs_g}g C · {item.macros.fat_g}g F
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
              </div>
            </TabsContent>

            <TabsContent value="recent" className="mt-0 space-y-3">
              {recentMeals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border/60 rounded-xl">
                  <p className="font-medium text-muted-foreground text-sm">No recent meals yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Log meals for a few days and they’ll show up here</p>
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto overscroll-contain space-y-2 pr-0.5">
                  {recentMeals.map(({ key, date, entry }) => {
                    const multiplierText = recentMultipliers[key] ?? '1'
                    const multiplier = Number(multiplierText)
                    const scaled = scaleMealLogEntry(entry, Number.isFinite(multiplier) ? multiplier : 0)
                    const shortDate = format(new Date(date), 'MM/dd/yy')

                    return (
                      <div key={key} className="rounded-xl border border-border/50 bg-muted/20 p-3">
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => setSelectedRecentMealKeys((prev) => ({ ...prev, [key]: !prev[key] }))}
                            className="flex items-center gap-2 text-left w-full"
                          >
                            <span
                              className={`w-4 h-4 rounded border shrink-0 ${
                                selectedRecentMealKeys[key]
                                  ? 'bg-primary border-primary'
                                  : 'border-border bg-background'
                              }`}
                            />
                            <p className="text-sm font-medium truncate">{entry.name}</p>
                          </button>
                          <p className="font-data text-[10px] text-muted-foreground/60 mt-0.5 tabular-nums whitespace-nowrap overflow-hidden text-ellipsis">
                            {shortDate} · {entry.meal_type} · {scaled.macros.calories} kcal · <span className="text-emerald-500/70">{fmtMacro(scaled.macros.protein_g)}g P</span> · {fmtMacro(scaled.macros.carbs_g)}g C · {fmtMacro(scaled.macros.fat_g)}g F
                          </p>
                        </div>

                        <div className="flex items-end gap-2 mt-3">
                          <div className="w-24 shrink-0">
                            <Label className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Servings</Label>
                            <Input
                              value={multiplierText}
                              onChange={(e) => setRecentMultipliers((prev) => ({ ...prev, [key]: e.target.value }))}
                              inputMode="decimal"
                              className="h-8 mt-1"
                            />
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            className="flex-1 h-9"
                            onClick={() => {
                              const m = Number(multiplierText)
                              if (!Number.isFinite(m) || m <= 0) {
                                toast.error('Enter a serving size greater than 0.')
                                return
                              }
                              const scaledEntry = scaleMealLogEntry(entry, m)
                              onSave({
                                meal_type: entry.meal_type,
                                name: scaledEntry.name,
                                macros: scaledEntry.macros,
                                time: format(new Date(), 'h:mm a'),
                                recipe: scaledEntry.recipe,
                                recipe_amount: scaledEntry.recipe_amount,
                                meal_items: scaledEntry.meal_items || [],
                                entry_source: scaledEntry.entry_source,
                                saved_meal_template_id: scaledEntry.saved_meal_template_id,
                              })
                            }}
                          >
                            Quick add
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="manual" className="mt-0 space-y-4">
              {editingSavedMeal ? (
                /* ── Edit saved meal: name + macros + ingredient list ── */
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Meal name</Label>
                    <Input
                      value={manualMealName}
                      onChange={(e) => setManualMealName(e.target.value)}
                      placeholder="e.g. High-protein lunch bowl"
                    />
                  </div>

                  <div className="rounded-lg border border-border/70 bg-background/50 p-3 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Total macros</p>
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
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Ingredients</p>
                    {savedMealIngredients.length > 0 && (
                      <div className="rounded-lg border border-border/60 bg-muted/20 divide-y divide-border/30">
                        {savedMealIngredients.map((ing) => (
                          <div key={ing.id} className="flex items-center justify-between px-3 py-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium">{ing.name}</span>
                                {ing.amount != null && (
                                  <span className="text-xs text-muted-foreground/60 font-data">{ing.amount}{ing.unit}</span>
                                )}
                              </div>
                              {ing.macros && (
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="font-data text-xs text-muted-foreground">{ing.macros.calories} kcal</span>
                                  <span className="text-[10px] text-border/40">·</span>
                                  <span className="font-data text-xs text-muted-foreground">{ing.macros.protein_g}g P</span>
                                  <span className="text-[10px] text-border/40">·</span>
                                  <span className="font-data text-xs text-muted-foreground">{ing.macros.carbs_g}g C</span>
                                  <span className="text-[10px] text-border/40">·</span>
                                  <span className="font-data text-xs text-muted-foreground">{ing.macros.fat_g}g F</span>
                                </div>
                              )}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              onClick={() => setSavedMealIngredients((prev) => prev.filter((i) => i.id !== ing.id))}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Input
                        placeholder="Ingredient name"
                        value={savedMealIngName}
                        onChange={(e) => setSavedMealIngName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && savedMealIngName.trim()) {
                            setSavedMealIngredients((prev) => [...prev, {
                              id: `ing-${Math.random().toString(36).slice(2)}`,
                              name: savedMealIngName.trim(),
                              amount: savedMealIngAmount ? parseFraction(savedMealIngAmount) : null,
                              unit: savedMealIngUnit,
                            }])
                            setSavedMealIngName('')
                            setSavedMealIngAmount('')
                          }
                        }}
                        className="flex-1"
                      />
                      <Input
                        placeholder="Amt"
                        value={savedMealIngAmount}
                        onChange={(e) => setSavedMealIngAmount(e.target.value)}
                        className="w-20"
                      />
                      <Select value={savedMealIngUnit} onValueChange={setSavedMealIngUnit}>
                        <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {getAvailableUnits({
                            id: 'manual',
                            name: savedMealIngName,
                            aliases: [],
                            default_serving_amount: 1,
                            default_serving_unit: 'g',
                            default_serving_label: '1 g',
                            macros_per_serving: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
                          }).map(u => (
                            <SelectItem key={u} value={u}>{u}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          if (!savedMealIngName.trim()) return
                          setSavedMealIngredients((prev) => [...prev, {
                            id: `ing-${Math.random().toString(36).slice(2)}`,
                            name: savedMealIngName.trim(),
                            amount: savedMealIngAmount ? parseFraction(savedMealIngAmount) : null,
                            unit: savedMealIngUnit,
                          }])
                          setSavedMealIngName('')
                          setSavedMealIngAmount('')
                        }}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
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
                      placeholder="e.g. 200 or 1/3"
                      value={manualItemAmount}
                      onChange={(e) => setManualItemAmount(e.target.value)}
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
              )}

              {!editingSavedMeal && manualItems.length > 0 ? (
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
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-data text-xs text-muted-foreground">{item.macros.calories} kcal</span>
                            <span className="text-[10px] text-border/40">·</span>
                            <span className="font-data text-xs text-muted-foreground">{item.macros.protein_g}g P</span>
                            <span className="text-[10px] text-border/40">·</span>
                            <span className="font-data text-xs text-muted-foreground">{item.macros.carbs_g}g C</span>
                            <span className="text-[10px] text-border/40">·</span>
                            <span className="font-data text-xs text-muted-foreground">{item.macros.fat_g}g F</span>
                          </div>
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

                  {(manualTotals.calories > 0 || manualTotals.protein_g > 0) && (
                    <div className="rounded-md border border-border/60 bg-background/60 px-3 py-2">
                      <p className="text-xs font-semibold mb-1 text-muted-foreground">Total macros</p>
                      <div className="flex items-center gap-1.5">
                        <span className="font-data text-sm">{Math.round(manualTotals.calories)} kcal</span>
                        <span className="text-[10px] text-border/40">·</span>
                        <span className="font-data text-sm">{Math.round(manualTotals.protein_g)}g P</span>
                        <span className="text-[10px] text-border/40">·</span>
                        <span className="font-data text-sm">{Math.round(manualTotals.carbs_g)}g C</span>
                        <span className="text-[10px] text-border/40">·</span>
                        <span className="font-data text-sm">{Math.round(manualTotals.fat_g)}g F</span>
                      </div>
                    </div>
                  )}
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
                  type="search"
                  inputMode="search"
                  enterKeyHint="search"
                  autoCapitalize="none"
                  autoCorrect="off"
                  className="pl-9 pr-8 h-9"
                />
                {recipeSearch && (
                  <button type="button" onClick={() => setRecipeSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
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
                  {selectedRecipe && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Amount type</Label>
                        <Select value={recipeAmountMode} onValueChange={(v) => setRecipeAmountMode(v as RecipeAmountMode)}>
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="servings">Servings</SelectItem>
                            <SelectItem value="units" disabled={!recipeHasYield}>
                              {recipeHasYield ? (selectedRecipe.yield_unit || 'Units') : 'Units'}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">{recipeAmountMode === 'servings' ? 'Servings' : (selectedRecipe.yield_unit || 'Units')}</Label>
                        <Input
                          type="number"
                          min={0.1}
                          step={0.1}
                          value={recipeAmountMode === 'servings' ? recipeServings : recipeUnits}
                          onChange={(e) => recipeAmountMode === 'servings' ? setRecipeServings(e.target.value) : setRecipeUnits(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Yield</Label>
                        <div className="h-9 rounded-md border border-border/60 bg-muted/20 px-3 flex items-center text-xs text-muted-foreground">
                          {recipeHasYield ? `${selectedRecipe.yield_quantity} ${selectedRecipe.yield_unit}` : '—'}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-4 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Calories</Label>
                      <Input type="number" value={recipeScaled ? recipeScaled.macros.calories : calories} onChange={(e) => setCalories(e.target.value)} disabled={source === 'recipe'} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Protein</Label>
                      <Input type="number" value={recipeScaled ? recipeScaled.macros.protein_g : protein} onChange={(e) => setProtein(e.target.value)} disabled={source === 'recipe'} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Carbs</Label>
                      <Input type="number" value={recipeScaled ? recipeScaled.macros.carbs_g : carbs} onChange={(e) => setCarbs(e.target.value)} disabled={source === 'recipe'} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Fat</Label>
                      <Input type="number" value={recipeScaled ? recipeScaled.macros.fat_g : fat} onChange={(e) => setFat(e.target.value)} disabled={source === 'recipe'} />
                    </div>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>

          <Button onClick={handleSave} className="w-full" variant="brand">
            {editingSavedMeal
              ? 'Update saved meal'
              : editingMeal
                ? 'Save changes'
                : source === 'recent'
                  ? 'Add meals'
                  : 'Add meal'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function RecipeDetailModal({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  return (
    <DialogContent
      className="max-w-2xl max-h-[90vh] overflow-y-auto"
      onOpenAutoFocus={(e) => e.preventDefault()}
    >
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

// ─── Edit Saved Meal Modal ───────────────────────────────────────────────────

function EditSavedMealModal({
  open,
  onOpenChange,
  meal,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  meal: SavedMealTemplate | null
  onSave: (payload: Omit<SavedMealTemplate, 'id' | 'updated_at'>, id?: string) => void
}) {
  type IngItem = {
    id: string
    name: string
    amount: number
    unit: string
    macros?: { calories: number; protein_g: number; carbs_g: number; fat_g: number }
  }

  const [name, setName] = useState('')
  const [mealType, setMealType] = useState<MealType>('breakfast')
  const [items, setItems] = useState<IngItem[]>([])
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<FoodCatalogItem[]>([])
  const [showSugg, setShowSugg] = useState(false)
  // Pending item — selected from suggestions, waiting for amount confirmation
  const [pendingFood, setPendingFood] = useState<FoodCatalogItem | null>(null)
  const [pendingAmount, setPendingAmount] = useState('')
  const [pendingUnit, setPendingUnit] = useState('g')
  // Manual ingredient entry mode
  const [ingredientMode, setIngredientMode] = useState<'search' | 'manual'>('search')
  const [manualIngName, setManualIngName] = useState('')
  const [manualIngAmount, setManualIngAmount] = useState('')
  const [manualIngUnit, setManualIngUnit] = useState('g')
  const [manualIngCalories, setManualIngCalories] = useState('')
  const [manualIngProtein, setManualIngProtein] = useState('')
  const [manualIngCarbs, setManualIngCarbs] = useState('')
  const [manualIngFat, setManualIngFat] = useState('')
  const queryRef = useRef<HTMLInputElement>(null)
  const pendingAmountRef = useRef<HTMLInputElement>(null)

  // Load from meal whenever dialog opens
  useEffect(() => {
    if (!open) return
    if (meal) {
      setName(meal.name)
      setMealType(meal.meal_type)
      setItems(
        meal.items.map(item => ({
          id: `ing-${Math.random().toString(36).slice(2)}`,
          name: item.matched_name,
          amount: item.amount ?? 1,
          unit: item.unit ?? 'serving',
          macros: item.macros,
        }))
      )
    } else {
      setName('')
      setMealType('breakfast')
      setItems([])
    }
    setQuery('')
    setShowSugg(false)
    setPendingFood(null)
    setIngredientMode('search')
    setManualIngName('')
    setManualIngAmount('')
    setManualIngUnit('g')
    setManualIngCalories('')
    setManualIngProtein('')
    setManualIngCarbs('')
    setManualIngFat('')
  }, [open, meal])

  // Food search suggestions
  useEffect(() => {
    const q = query.trim()
    if (!q) { setSuggestions([]); setShowSugg(false); return }
    const catalog = getKnownFoodCatalog()
    const scored = catalog
      .map(item => ({ item, score: scoreSuggestion(item, q) }))
      .filter(x => x.score >= 10) // Lower threshold to show more results
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map(x => x.item)
    setSuggestions(scored)
    setShowSugg(scored.length > 0)
  }, [query])

  const selectFood = (food: FoodCatalogItem) => {
    setPendingFood(food)
    setPendingAmount(String(food.default_serving_amount))
    setPendingUnit(food.default_serving_unit)
    setQuery('')
    setShowSugg(false)
    setTimeout(() => pendingAmountRef.current?.focus(), 50)
  }

  const confirmPendingFood = () => {
    if (!pendingFood) return
    const amt = parseFloat(pendingAmount)
    const baseAmt = pendingFood.default_serving_amount || 1
    const ratio = Number.isFinite(amt) && amt > 0 ? amt / baseAmt : 1
    setItems(prev => [...prev, {
      id: `ing-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: pendingFood.name,
      amount: Number.isFinite(amt) && amt > 0 ? amt : baseAmt,
      unit: pendingUnit || pendingFood.default_serving_unit,
      macros: {
        calories: Math.round(pendingFood.macros_per_serving.calories * ratio),
        protein_g: Math.round(pendingFood.macros_per_serving.protein_g * ratio * 10) / 10,
        carbs_g: Math.round(pendingFood.macros_per_serving.carbs_g * ratio * 10) / 10,
        fat_g: Math.round(pendingFood.macros_per_serving.fat_g * ratio * 10) / 10,
      },
    }])
    setPendingFood(null)
    setPendingAmount('')
    queryRef.current?.focus()
  }

  const addManualIngredient = () => {
    const name = manualIngName.trim()
    if (!name) {
      toast.error('Ingredient name is required.')
      return
    }

    const calories = Number(manualIngCalories)
    const protein = Number(manualIngProtein || 0)
    const carbs = Number(manualIngCarbs || 0)
    const fat = Number(manualIngFat || 0)

    if (!Number.isFinite(calories) || calories <= 0) {
      toast.error('Calories must be a valid number greater than 0.')
      return
    }

    const amount = manualIngAmount ? Number(manualIngAmount) : 1
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Amount must be a valid number greater than 0.')
      return
    }

    setItems(prev => [...prev, {
      id: `ing-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      amount,
      unit: manualIngUnit || 'serving',
      macros: {
        calories: Math.round(calories),
        protein_g: Math.round(protein * 10) / 10,
        carbs_g: Math.round(carbs * 10) / 10,
        fat_g: Math.round(fat * 10) / 10,
      },
    }])

    // Clear manual form
    setManualIngName('')
    setManualIngAmount('')
    setManualIngUnit('g')
    setManualIngCalories('')
    setManualIngProtein('')
    setManualIngCarbs('')
    setManualIngFat('')
    toast.success('Manual ingredient added.')
  }

  const totalMacros = useMemo(() => {
    if (items.length === 0 || !items.every(i => i.macros)) return null
    return items.reduce(
      (acc, i) => ({
        calories: acc.calories + (i.macros?.calories ?? 0),
        protein_g: acc.protein_g + (i.macros?.protein_g ?? 0),
        carbs_g: acc.carbs_g + (i.macros?.carbs_g ?? 0),
        fat_g: acc.fat_g + (i.macros?.fat_g ?? 0),
      }),
      { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
    )
  }, [items])

  const handleSave = () => {
    if (!name.trim()) { toast.error('Meal name is required.'); return }
    const macros = totalMacros
      ? { calories: Math.round(totalMacros.calories), protein_g: Math.round(totalMacros.protein_g), carbs_g: Math.round(totalMacros.carbs_g), fat_g: Math.round(totalMacros.fat_g) }
      : meal?.macros ?? { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
    onSave({
      name: name.trim(),
      meal_type: mealType,
      macros,
      items: items.map(i => ({ input: i.name, matched_name: i.name, amount: i.amount, unit: i.unit, macros: i.macros })),
    }, meal?.id)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-border/40 shrink-0">
          <DialogTitle>{meal ? 'Edit saved meal' : 'New saved meal'}</DialogTitle>
        </DialogHeader>

        {/* Scrollable ingredient list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
          {/* Name + meal type */}
          <div className="space-y-1.5">
            <Label>Meal name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Morning Smoothie" />
          </div>
          <div className="space-y-1.5">
            <Label>Meal type</Label>
            <Select value={mealType} onValueChange={(v) => setMealType(v as MealType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEAL_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{mealTypeLabel(t)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Ingredients */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Ingredients</p>
              {totalMacros && (
                <span className="font-data text-xs text-muted-foreground/70">
                  {fmtMacro(totalMacros.calories)} kcal · {fmtMacro(totalMacros.protein_g)}g P · {fmtMacro(totalMacros.carbs_g)}g C · {fmtMacro(totalMacros.fat_g)}g F
                </span>
              )}
            </div>

            {items.length > 0 ? (
              <div className="rounded-lg border border-border/50 divide-y divide-border/30">
                {items.map(item => (
                  <div key={item.id} className="flex items-center gap-3 px-3 py-2.5 group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-medium">{item.name}</span>
                        <span className="text-xs text-muted-foreground/55 font-data">{item.amount}{item.unit}</span>
                      </div>
                      {item.macros ? (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-data text-xs text-muted-foreground">{fmtMacro(item.macros.calories)} kcal</span>
                          <span className="text-[10px] text-border/50">·</span>
                          <span className="font-data text-xs text-emerald-500/80">{fmtMacro(item.macros.protein_g)}g P</span>
                          <span className="text-[10px] text-border/50">·</span>
                          <span className="font-data text-xs text-muted-foreground">{fmtMacro(item.macros.carbs_g)}g C</span>
                          <span className="text-[10px] text-border/50">·</span>
                          <span className="font-data text-xs text-muted-foreground">{fmtMacro(item.macros.fat_g)}g F</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">No macro data</span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      onClick={() => setItems(prev => prev.filter(i => i.id !== item.id))}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border/50 py-6 text-center">
                <p className="text-sm text-muted-foreground">No ingredients yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Sticky add-ingredient section */}
        <div className="shrink-0 border-t border-border/40 px-5 pt-3 pb-2 space-y-2 bg-background">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Add ingredient</p>

          {/* Mode toggle */}
          <div className="flex border border-border/60 rounded-lg p-0.5 bg-muted/30">
            <button
              onClick={() => setIngredientMode('search')}
              className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors ${
                ingredientMode === 'search'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Search
            </button>
            <button
              onClick={() => setIngredientMode('manual')}
              className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors ${
                ingredientMode === 'manual'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Manual
            </button>
          </div>

          {ingredientMode === 'search' ? (
            <>
              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  ref={queryRef}
                  placeholder="Search food…"
                  value={query}
                  onChange={e => { setQuery(e.target.value); setPendingFood(null) }}
                  onFocus={() => { if (query.trim() && suggestions.length > 0) setShowSugg(true) }}
                  type="search"
                  inputMode="search"
                  enterKeyHint="search"
                  autoCapitalize="none"
                  autoCorrect="off"
                  className="pl-9"
                />
                {query && (
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => { setQuery(''); setShowSugg(false); setPendingFood(null) }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                {showSugg && suggestions.length > 0 && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowSugg(false)} />
                    <div className="absolute left-0 right-0 bottom-full z-50 mb-1 rounded-xl border border-border bg-background shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                      {suggestions.map(item => (
                        <button
                          key={item.id}
                          className="w-full px-3 py-2.5 text-left hover:bg-muted/40 transition-colors border-b border-border/30 last:border-0"
                          onClick={() => selectFood(item)}
                        >
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-data text-xs text-muted-foreground">{fmtMacro(item.macros_per_serving.calories)} kcal</span>
                            <span className="text-[10px] text-border/50">·</span>
                            <span className="font-data text-xs text-emerald-500/80">{fmtMacro(item.macros_per_serving.protein_g)}g P</span>
                            <span className="text-[10px] text-border/50">·</span>
                            <span className="font-data text-xs text-muted-foreground">{fmtMacro(item.macros_per_serving.carbs_g)}g C</span>
                            <span className="text-[10px] text-border/50">·</span>
                            <span className="font-data text-xs text-muted-foreground">{fmtMacro(item.macros_per_serving.fat_g)}g F</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Pending item: adjust amount before adding */}
              {pendingFood && (
                <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{pendingFood.name}</p>
                  </div>
                  <Input
                    ref={pendingAmountRef}
                    type="number"
                    min={0}
                    step="any"
                    value={pendingAmount}
                    onChange={e => setPendingAmount(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') confirmPendingFood() }}
                    className="h-7 w-20 text-xs"
                  />
                  <Select value={pendingUnit} onValueChange={setPendingUnit}>
                    <SelectTrigger className="h-7 w-16 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {pendingFood ? getAvailableUnits(pendingFood).map(unit => (
                        <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                      )) : ['g', 'oz', 'cup', 'tbsp', 'tsp', 'piece', 'slice'].map(unit => (
                        <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" className="h-7 px-3 text-xs" onClick={confirmPendingFood}>Add</Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setPendingFood(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Manual ingredient form - matching existing design */}
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col">
                    <label htmlFor="manual-ingredient-name" className="text-xs text-muted-foreground mb-1">Ingredient name</label>
                    <Input
                      id="manual-ingredient-name"
                      placeholder="e.g. Chicken Breast"
                      value={manualIngName}
                      onChange={e => setManualIngName(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex flex-col flex-grow">
                      <label htmlFor="manual-amount" className="text-xs text-muted-foreground mb-1">Amount</label>
                      <Input
                        id="manual-amount"
                        type="number"
                        value={manualIngAmount}
                        onChange={e => setManualIngAmount(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div className="flex flex-col justify-end">
                      <Select value={manualIngUnit} onValueChange={setManualIngUnit}>
                        <SelectTrigger className="w-20 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {getAvailableUnits({
                            id: 'manual',
                            name: manualIngName,
                            aliases: [],
                            default_serving_amount: 1,
                            default_serving_unit: 'g',
                            default_serving_label: '1 g',
                            macros_per_serving: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
                          }).map(unit => (
                            <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div className="flex flex-col">
                    <label htmlFor="manual-calories" className="text-xs text-muted-foreground mb-1">Calories</label>
                    <Input
                      id="manual-calories"
                      type="number"
                      value={manualIngCalories}
                      onChange={e => setManualIngCalories(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label htmlFor="manual-protein" className="text-xs text-muted-foreground mb-1">Protein (g)</label>
                    <Input
                      id="manual-protein"
                      type="number"
                      value={manualIngProtein}
                      onChange={e => setManualIngProtein(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label htmlFor="manual-carbs" className="text-xs text-muted-foreground mb-1">Carbs (g)</label>
                    <Input
                      id="manual-carbs"
                      type="number"
                      value={manualIngCarbs}
                      onChange={e => setManualIngCarbs(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label htmlFor="manual-fat" className="text-xs text-muted-foreground mb-1">Fat (g)</label>
                    <Input
                      id="manual-fat"
                      type="number"
                      value={manualIngFat}
                      onChange={e => setManualIngFat(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>
                <Button
                  onClick={addManualIngredient}
                  disabled={!manualIngName.trim() || !manualIngCalories || !manualIngAmount}
                  className="w-full"
                  size="sm"
                >
                  Add Manual Ingredient
                </Button>
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border/40 shrink-0">
          <Button onClick={handleSave} className="w-full" variant="brand">{meal ? 'Update saved meal' : 'Save meal'}</Button>
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
  const [editSavedMealOpen, setEditSavedMealOpen] = useState(false)
  const [savedMealTargets, setSavedMealTargets] = useState<Partial<Record<string, MealType>>>({})
  const [expandedSavedMeals, setExpandedSavedMeals] = useState<Record<string, boolean>>({})
  const [savedMealSearchText, setSavedMealSearchText] = useState('')
  const [savedMealFilterType, setSavedMealFilterType] = useState<string>('all')
  const [savedMealFilterTag, setSavedMealFilterTag] = useState<string>('all')
  const [activeTab, setActiveTab] = useState('today')
  // Recipe filter state
  const [recipeFilterType, setRecipeFilterType] = useState<string>('all')
  const [recipeFilterTag, setRecipeFilterTag] = useState<string>('all')
  const [recipeSearchText, setRecipeSearchText] = useState('')
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
  const [addMealMode, setAddMealMode] = useState<'recipe' | 'saved' | 'custom'>('saved')
  const [expandedMeals, setExpandedMeals] = useState<Record<string, boolean>>({})
  // Planner filter state
  const [plannerFiltersOpen, setPlannerFiltersOpen] = useState(false)
  const [plannerMealTypeFilter, setPlannerMealTypeFilter] = useState<string>('all')
  const [plannerNutritionFilters, setPlannerNutritionFilters] = useState<string[]>([])

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
    let list = RECIPES
    if (recipeSearchQuery.trim()) {
      const q = recipeSearchQuery.toLowerCase()
      list = list.filter(r => r.name.toLowerCase().includes(q) || r.tags.some((t: string) => t.toLowerCase().includes(q)))
    }
    if (plannerMealTypeFilter !== 'all') {
      list = list.filter(r => r.meal_type === plannerMealTypeFilter)
    }
    if (plannerNutritionFilters.includes('high_protein')) list = list.filter(r => r.macros.protein_g >= 25)
    if (plannerNutritionFilters.includes('low_calories')) list = list.filter(r => r.macros.calories <= 400)
    if (plannerNutritionFilters.includes('low_fat')) list = list.filter(r => r.macros.fat_g <= 10)
    if (plannerNutritionFilters.includes('high_carb')) list = list.filter(r => r.macros.carbs_g >= 50)
    return list
  }, [recipeSearchQuery, plannerMealTypeFilter, plannerNutritionFilters])

  const filteredPlanSavedMeals = useMemo(() => {
    let list = savedMeals
    if (savedMealSearchQuery.trim()) {
      const q = savedMealSearchQuery.toLowerCase()
      list = list.filter(m => m.name.toLowerCase().includes(q))
    }
    if (plannerMealTypeFilter !== 'all') {
      list = list.filter(m => m.meal_type === plannerMealTypeFilter)
    }
    if (plannerNutritionFilters.includes('high_protein')) list = list.filter(m => m.macros.protein_g >= 25)
    if (plannerNutritionFilters.includes('low_calories')) list = list.filter(m => m.macros.calories <= 400)
    if (plannerNutritionFilters.includes('low_fat')) list = list.filter(m => m.macros.fat_g <= 10)
    if (plannerNutritionFilters.includes('high_carb')) list = list.filter(m => m.macros.carbs_g >= 50)
    return list
  }, [savedMeals, savedMealSearchQuery, plannerMealTypeFilter, plannerNutritionFilters])

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
    const amount = parseFraction(customIngAmount)
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
    setEditingSavedMeal(meal)
    setEditSavedMealOpen(true)
  }

  const openNewSavedMeal = () => {
    setEditingSavedMeal(null)
    setEditSavedMealOpen(true)
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

  const handleDeleteSavedMealTemplate = (mealId: string) => {
    removeSavedMeal(mealId)
    toast.success('Saved meal deleted.')
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
        macros: item.macros ?? { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
        amount: item.amount,
        unit: item.unit,
      })),
      entry_source: 'saved',
      saved_meal_template_id: meal.id,
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

        {/* Macro snapshot bar - simplified */}
        <div className="flex gap-4 sm:gap-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Calories</span>
            <span className="font-data text-lg font-semibold tabular-nums">{todayTotals.calories}</span>
            {user.calorie_target > 0 && (
              <span className="text-xs text-muted-foreground">/ {user.calorie_target}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Protein</span>
            <span className="font-data text-lg font-semibold text-emerald-500 tabular-nums">{todayTotals.protein_g}g</span>
            {user.protein_target_g > 0 && (
              <span className="text-xs text-muted-foreground">/ {user.protein_target_g}g</span>
            )}
          </div>
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
          {/* Search + New button */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search saved meals…"
                value={savedMealSearchText}
                onChange={e => setSavedMealSearchText(e.target.value)}
                type="search"
                inputMode="search"
                enterKeyHint="search"
                autoCapitalize="none"
                autoCorrect="off"
                className="h-9 pl-9 pr-8"
              />
              {savedMealSearchText && (
                <button type="button" onClick={() => setSavedMealSearchText('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <Button variant="brand" size="sm" className="gap-1.5 shrink-0" onClick={openNewSavedMeal}>
              <Plus className="w-3.5 h-3.5" />
              New Saved Meal
            </Button>
          </div>
          {/* Filter dropdowns */}
          <div className="flex gap-2">
            <Select value={savedMealFilterType} onValueChange={setSavedMealFilterType}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="breakfast">Breakfast</SelectItem>
                <SelectItem value="lunch">Lunch</SelectItem>
                <SelectItem value="dinner">Dinner</SelectItem>
                <SelectItem value="snack">Snack</SelectItem>
              </SelectContent>
            </Select>
            <Select value={savedMealFilterTag} onValueChange={setSavedMealFilterTag}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All filters</SelectItem>
                <SelectItem value="high-protein">High protein</SelectItem>
                <SelectItem value="low-calorie">Low calorie</SelectItem>
                <SelectItem value="low-carb">Low carb</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
          ) : (() => {
            const filteredSavedMeals = savedMeals.filter(m => {
              const matchesSearch = !savedMealSearchText.trim() || m.name.toLowerCase().includes(savedMealSearchText.toLowerCase())
              const matchesType = savedMealFilterType === 'all' || m.meal_type === savedMealFilterType
              const matchesTag = savedMealFilterTag === 'all' ||
                (savedMealFilterTag === 'high-protein' && m.macros.protein_g >= 25) ||
                (savedMealFilterTag === 'low-calorie' && m.macros.calories <= 400) ||
                (savedMealFilterTag === 'low-carb' && m.macros.carbs_g <= 20)
              return matchesSearch && matchesType && matchesTag
            })
            return filteredSavedMeals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 border border-dashed border-border/60 rounded-xl">
                <p className="text-sm text-muted-foreground">No saved meals match your filters</p>
              </div>
            ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredSavedMeals.map((meal) => (
                (() => {
                  const type = mealTypePresentation(meal.meal_type)
                  const selectedTarget = savedMealTargets[meal.id] ?? meal.meal_type
                  const selectedTargetType = mealTypePresentation(selectedTarget)
                  const MealTypeIcon = type.icon
                  const isExpanded = expandedSavedMeals[meal.id] || false

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

                        {/* Expandable ingredients */}
                        {meal.items.length > 0 && (
                          <div className="mt-4">
                            <button
                              type="button"
                              onClick={() => setExpandedSavedMeals(prev => ({ ...prev, [meal.id]: !prev[meal.id] }))}
                              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`} />
                              {isExpanded ? 'Hide' : 'Show'} ingredients ({meal.items.length})
                            </button>
                            {isExpanded && (
                              <div className="mt-2 rounded-lg border border-border/40 divide-y divide-border/30">
                                {meal.items.map((item, idx) => (
                                  <div key={idx} className="px-3 py-2">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-xs font-medium text-foreground/80 truncate">{item.matched_name}</span>
                                      {item.amount != null && (
                                        <span className="font-data text-[10px] text-muted-foreground/60 shrink-0">{item.amount}{item.unit}</span>
                                      )}
                                    </div>
                                    {item.macros && (
                                      <p className="font-data text-[10px] tabular-nums text-muted-foreground/55 mt-0.5">
                                        {item.macros.calories} kcal · <span className="text-emerald-500/70">{item.macros.protein_g}g P</span> · {item.macros.carbs_g}g C · {item.macros.fat_g}g F
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="px-4 pb-4 pt-3 flex items-center gap-2 border-t border-border/20">
                        <Select
                          value={selectedTarget}
                          onValueChange={(v) => setSavedMealTargets(prev => ({ ...prev, [meal.id]: v as MealType }))}
                        >
                          <SelectTrigger className="h-8 text-xs flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MEAL_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>{mealTypeLabel(t)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="brand" size="sm" className="gap-1.5 text-xs h-8 shrink-0" onClick={() => handleAddSavedMealToToday(meal)}>
                          <Plus className="w-3 h-3" />
                          Add
                        </Button>
                        <Button variant="ghost" size="icon-sm" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => openEditSavedMeal(meal)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" className="h-8 w-8 text-destructive/60 hover:text-destructive" onClick={() => handleDeleteSavedMealTemplate(meal.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )
                })()
              ))}
            </div>
          )
        })()}
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

            const rows = meals.map((meal) => ({
              meal,
              isExpandable: !!meal.recipe || meal.entry_source === 'saved',
            }))

            return (
              <div key={mealType} className="bg-card border border-border/20 rounded-xl overflow-hidden">
                {/* Section header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
                  <div className="flex items-center gap-3">
                    <div>
                      <h3 className="font-display font-black text-2xl sm:text-3xl tracking-tight leading-none text-foreground underline decoration-primary decoration-[3px] underline-offset-[5px]">
                        {mealTypeLabel(mealType)}
                      </h3>
                      {meals.length > 0 && (
                        <p className="font-data text-[11px] tabular-nums text-muted-foreground/70 mt-2">
                          {totalMacros.calories} kcal · {totalMacros.protein_g}g P · {totalMacros.carbs_g}g C · {totalMacros.fat_g}g F
                        </p>
                      )}
                    </div>
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
                    {rows.map(({ meal, isExpandable }, rowIdx) => {
                      const borderClass = rowIdx < rows.length - 1 ? 'border-b border-border/20' : ''
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
                                  <span className="font-semibold text-base text-foreground leading-snug">{meal.name}</span>
                                  <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 text-muted-foreground/40 transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`} />
                                </button>
                              ) : (
                                <p className="font-semibold text-base text-foreground leading-snug">{meal.name}</p>
                              )}
                              <p className="font-data text-[11px] tabular-nums text-muted-foreground/65 mt-0.5">
                                {meal.macros.calories} kcal · <span className="text-emerald-500/70">{meal.macros.protein_g}g P</span> · {meal.macros.carbs_g}g C · {meal.macros.fat_g}g F
                              </p>
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
                          {/* Expanded ingredients */}
                          {isExpandable && expanded && (
                            <div className="mt-2 ml-1 space-y-1.5 pl-3 border-l border-border/30">
                              {meal.recipe ? (
                                // Show recipe ingredients
                                meal.recipe.ingredients.map((ingredient, ingredientIndex) => (
                                  <div key={`${meal.id}-recipe-ingredient-${ingredientIndex}`}>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs text-foreground/80 leading-tight">{ingredient.name}</span>
                                      <span className="font-data text-[10px] text-muted-foreground/55">{ingredient.amount} {ingredient.unit}</span>
                                    </div>
                                  </div>
                                ))
                              ) : meal.meal_items && meal.meal_items.length > 0 ? (
                                // Show meal items (for saved meals)
                                meal.meal_items.map((item, itemIndex) => (
                                  <div key={`${meal.id}-item-${itemIndex}`}>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs text-foreground/80 leading-tight">{item.name}</span>
                                      {item.amount != null && (
                                        <span className="font-data text-[10px] text-muted-foreground/55">{item.amount}{item.unit}</span>
                                      )}
                                    </div>
                                    {item.macros.calories > 0 && (
                                      <p className="font-data text-[10px] tabular-nums text-muted-foreground/55 mt-0.5">
                                        {item.macros.calories} kcal · {item.macros.protein_g}g P · {item.macros.carbs_g}g C · {item.macros.fat_g}g F
                                      </p>
                                    )}
                                  </div>
                                ))
                              ) : null}
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
          {/* Search + create recipe */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search recipes…"
                value={recipeSearchText}
                onChange={e => setRecipeSearchText(e.target.value)}
                type="search"
                inputMode="search"
                enterKeyHint="search"
                autoCapitalize="none"
                autoCorrect="off"
                className="h-9 pl-9 pr-8"
              />
              {recipeSearchText && (
                <button type="button" onClick={() => setRecipeSearchText('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
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
          <div className="flex gap-2">
            <Select value={recipeFilterType} onValueChange={setRecipeFilterType}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="breakfast">Breakfast</SelectItem>
                <SelectItem value="lunch">Lunch</SelectItem>
                <SelectItem value="dinner">Dinner</SelectItem>
                <SelectItem value="snack">Snack</SelectItem>
              </SelectContent>
            </Select>
            <Select value={recipeFilterTag} onValueChange={setRecipeFilterTag}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All filters</SelectItem>
                <SelectItem value="high-protein">High protein</SelectItem>
                <SelectItem value="low-calorie">Low calorie</SelectItem>
                <SelectItem value="low-carb">Low carb</SelectItem>
                <SelectItem value="quick">Quick (&lt;15 min)</SelectItem>
                <SelectItem value="vegetarian">Vegetarian</SelectItem>
                <SelectItem value="meal-prep">Meal prep</SelectItem>
                <SelectItem value="high-fiber">High fiber</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
                      <div className="px-4 pb-4 space-y-1.5">
                        <AddToTodayButton recipe={recipe} />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="w-full text-xs text-destructive/60 hover:text-destructive"
                          onClick={() => removeCustomRecipe(recipe.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          Delete
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
                  <AddToTodayButton recipe={recipe} />
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
            {(['saved', 'recipe', 'custom'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => { setAddMealMode(mode); setPlannerFiltersOpen(false); setPlannerMealTypeFilter('all'); setPlannerNutritionFilters([]) }}
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
            {(addMealMode === 'saved' || addMealMode === 'recipe') && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder={addMealMode === 'recipe' ? 'Search recipes...' : 'Search saved meals...'}
                      value={addMealMode === 'recipe' ? recipeSearchQuery : savedMealSearchQuery}
                      onChange={(e) => addMealMode === 'recipe' ? setRecipeSearchQuery(e.target.value) : setSavedMealSearchQuery(e.target.value)}
                      className="pl-9"
                      autoFocus
                    />
                  </div>
                  <button
                    onClick={() => setPlannerFiltersOpen(o => !o)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors ${
                      plannerFiltersOpen || plannerMealTypeFilter !== 'all' || plannerNutritionFilters.length > 0
                        ? 'border-primary/60 bg-primary/10 text-primary'
                        : 'border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground hover:border-border'
                    }`}
                  >
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 2.5h11M3 6.5h7M5 10.5h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    <span>Filters</span>
                    {(plannerMealTypeFilter !== 'all' || plannerNutritionFilters.length > 0) && (
                      <span className="flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
                        {(plannerMealTypeFilter !== 'all' ? 1 : 0) + plannerNutritionFilters.length}
                      </span>
                    )}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${plannerFiltersOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {plannerFiltersOpen && (
                  <div className="rounded-xl border border-border/40 bg-muted/20 p-3 space-y-3">
                    <div className="space-y-1.5">
                      <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">Meal type</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(['all', 'breakfast', 'lunch', 'dinner', 'snack'] as const).map(t => (
                          <button
                            key={t}
                            onClick={() => setPlannerMealTypeFilter(t)}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                              plannerMealTypeFilter === t
                                ? 'bg-primary/15 border-primary/50 text-primary'
                                : 'bg-background border-border/50 text-muted-foreground hover:text-foreground hover:border-border'
                            }`}
                          >
                            {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">Nutrition</p>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { key: 'high_protein', label: 'High Protein' },
                          { key: 'low_calories', label: 'Low Calories' },
                          { key: 'low_fat', label: 'Low Fat' },
                          { key: 'high_carb', label: 'High Carb' },
                        ].map(({ key, label }) => {
                          const active = plannerNutritionFilters.includes(key)
                          return (
                            <button
                              key={key}
                              onClick={() => setPlannerNutritionFilters(prev => active ? prev.filter(f => f !== key) : [...prev, key])}
                              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                                active
                                  ? 'bg-primary/15 border-primary/50 text-primary'
                                  : 'bg-background border-border/50 text-muted-foreground hover:text-foreground hover:border-border'
                              }`}
                            >
                              {label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    {(plannerMealTypeFilter !== 'all' || plannerNutritionFilters.length > 0) && (
                      <button
                        onClick={() => { setPlannerMealTypeFilter('all'); setPlannerNutritionFilters([]) }}
                        className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Clear all filters
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {addMealMode === 'recipe' && (
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
            )}

            {addMealMode === 'saved' && (
              savedMeals.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">No saved meals yet.</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Build meals in the &quot;Today&apos;s Meals&quot; tab and save them as templates.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredPlanSavedMeals.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No matches found</p>
                  ) : filteredPlanSavedMeals.map((meal) => (
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
                  ))}
                </div>
              )
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
                      type="text"
                      placeholder="e.g. 200 or 1/3"
                      value={customIngAmount}
                      onChange={(e) => setCustomIngAmount(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addCustomIngredient()}
                      className="w-24"
                    />
                    <Select value={customIngUnit} onValueChange={setCustomIngUnit}>
                      <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {getAvailableUnits({
                          id: 'manual',
                          name: customIngName,
                          aliases: [],
                          default_serving_amount: 1,
                          default_serving_unit: 'g',
                          default_serving_label: '1 g',
                          macros_per_serving: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
                        }).map(u => (
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
        editingSavedMeal={null}
        onSave={handleSaveMeal}
        onSaveTemplate={handleSaveTemplate}
      />

      <EditSavedMealModal
        open={editSavedMealOpen}
        onOpenChange={setEditSavedMealOpen}
        meal={editingSavedMeal}
        onSave={handleSaveTemplate}
      />
    </div>
  )
}
