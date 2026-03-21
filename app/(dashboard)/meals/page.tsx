'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { format, addDays, startOfWeek } from 'date-fns'
import {
  ChefHat, ShoppingCart, Clock, Users, Flame, RotateCcw,
  CheckCircle, Circle, Download, Plus, Zap, ChevronRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAppStore } from '@/store/useAppStore'
import { RECIPES, WEEKLY_MEAL_PLAN } from '@/lib/mock-data'
import type { Recipe } from '@/types'
import { toast } from 'sonner'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'] as const

function RecipeCard({ recipe, compact = false, onClick }: { recipe: Recipe; compact?: boolean; onClick?: () => void }) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18 }}
      onClick={onClick}
      className={`group bg-card border border-border rounded-xl overflow-hidden cursor-pointer hover:border-primary/30 hover:shadow-lg transition-all duration-200 ${compact ? '' : ''}`}
    >
      {/* Colored header */}
      <div className={`h-1.5 ${
        recipe.meal_type === 'breakfast' ? 'bg-gradient-to-r from-amber-400 to-orange-400' :
        recipe.meal_type === 'lunch' ? 'bg-gradient-to-r from-blue-400 to-cyan-400' :
        'bg-gradient-to-r from-emerald-400 to-teal-400'
      }`} />

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <p className="font-semibold text-sm leading-tight">{recipe.name}</p>
            {!compact && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{recipe.description}</p>}
          </div>
          <Badge
            variant={recipe.meal_type === 'breakfast' ? 'warning' : recipe.meal_type === 'lunch' ? 'info' : 'success'}
            className="text-xs capitalize flex-shrink-0"
          >
            {recipe.meal_type}
          </Badge>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Flame className="w-3 h-3 text-orange-400" />{recipe.macros.calories} kcal</span>
          <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-emerald-400" />{recipe.macros.protein_g}g P</span>
          {!compact && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{recipe.prep_time_min + recipe.cook_time_min} min</span>}
        </div>
      </div>
    </motion.div>
  )
}

function RecipeDetailModal({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ChefHat className="w-5 h-5 text-emerald-400" />
          {recipe.name}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Calories', value: recipe.macros.calories, unit: 'kcal', color: 'text-orange-400' },
            { label: 'Protein', value: recipe.macros.protein_g, unit: 'g', color: 'text-emerald-400' },
            { label: 'Carbs', value: recipe.macros.carbs_g, unit: 'g', color: 'text-blue-400' },
            { label: 'Fat', value: recipe.macros.fat_g, unit: 'g', color: 'text-amber-400' },
          ].map((s) => (
            <div key={s.label} className="bg-muted/50 rounded-xl p-3 text-center">
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.unit}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Meta */}
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" />Prep: {recipe.prep_time_min} min</span>
          <span className="flex items-center gap-1.5"><Flame className="w-4 h-4" />Cook: {recipe.cook_time_min} min</span>
          <span className="flex items-center gap-1.5"><Users className="w-4 h-4" />{recipe.servings} serving</span>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {recipe.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs capitalize">{tag.replace('-', ' ')}</Badge>
          ))}
        </div>

        {/* Ingredients */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-muted-foreground" />
            Ingredients
          </h3>
          <div className="space-y-2">
            {recipe.ingredients.map((ing) => (
              <div key={ing.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <span className="text-sm">{ing.name}</span>
                <span className="text-sm text-muted-foreground font-medium">
                  {ing.amount}{ing.unit}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <ChefHat className="w-4 h-4 text-muted-foreground" />
            Instructions
          </h3>
          <ol className="space-y-3">
            {recipe.instructions.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
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

export default function MealsPage() {
  const { weeklyMealPlan, groceryList, toggleGroceryItem, setWeeklyMealPlan } = useAppStore()
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)
  const [selectedDay, setSelectedDay] = useState(0) // 0 = monday

  const mealPlan = weeklyMealPlan || WEEKLY_MEAL_PLAN
  const grocery = groceryList

  // Group grocery items by category
  const groceryByCategory = grocery
    ? grocery.items.reduce<Record<string, typeof grocery.items>>((acc, item) => {
        if (!acc[item.category]) acc[item.category] = []
        acc[item.category].push(item)
        return acc
      }, {})
    : {}

  const groceryProgress = grocery
    ? Math.round((grocery.items.filter((i) => i.checked).length / grocery.items.length) * 100)
    : 0

  const handleSwapMeal = (day: string, mealType: string) => {
    toast.success(`Swapped ${mealType} for ${day} — feature coming soon!`)
  }

  const handleExport = () => {
    const data = JSON.stringify(mealPlan, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'meal-plan.json'
    a.click()
    toast.success('Meal plan exported!')
  }

  const todayWeekday = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Meal Planning</h2>
          <p className="text-muted-foreground text-sm">Your weekly meal plan with recipes and grocery list</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}>
            <Download className="w-3.5 h-3.5" />
            Export
          </Button>
          <Button variant="brand" size="sm" className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Customize Plan
          </Button>
        </div>
      </div>

      <Tabs defaultValue="plan">
        <TabsList>
          <TabsTrigger value="plan">Weekly Plan</TabsTrigger>
          <TabsTrigger value="recipes">Recipe Library</TabsTrigger>
          <TabsTrigger value="grocery">Grocery List</TabsTrigger>
        </TabsList>

        {/* Weekly Plan Tab */}
        <TabsContent value="plan" className="mt-4">
          {/* Day selector */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {DAYS.map((day, i) => (
              <button
                key={day}
                onClick={() => setSelectedDay(i)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  selectedDay === i
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : day === todayWeekday
                    ? 'bg-primary/10 text-primary border border-primary/30'
                    : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                {DAY_LABELS[i]}
                {day === todayWeekday && <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />}
              </button>
            ))}
          </div>

          {/* Meals for selected day */}
          <div className="grid md:grid-cols-3 gap-4">
            {MEAL_TYPES.map((mealType) => {
              const dayData = mealPlan.days[DAYS[selectedDay]]
              const recipe = dayData?.[mealType] as Recipe | null

              return (
                <Card key={mealType} className="hover-lift">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm capitalize font-semibold">{mealType}</CardTitle>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground"
                        onClick={() => handleSwapMeal(DAYS[selectedDay], mealType)}
                        title="Swap meal"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {recipe ? (
                      <RecipeCard
                        recipe={recipe}
                        compact
                        onClick={() => setSelectedRecipe(recipe)}
                      />
                    ) : (
                      <div className="h-24 rounded-xl border-2 border-dashed border-border flex items-center justify-center">
                        <Button variant="ghost" size="sm" className="text-muted-foreground text-xs gap-1">
                          <Plus className="w-3.5 h-3.5" /> Add Meal
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Daily nutrition summary */}
          {(() => {
            const dayData = mealPlan.days[DAYS[selectedDay]]
            if (!dayData) return null
            const meals = [dayData.breakfast, dayData.lunch, dayData.dinner].filter(Boolean) as Recipe[]
            const totals = meals.reduce((acc, r) => ({
              calories: acc.calories + r.macros.calories,
              protein_g: acc.protein_g + r.macros.protein_g,
              carbs_g: acc.carbs_g + r.macros.carbs_g,
              fat_g: acc.fat_g + r.macros.fat_g,
            }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 })

            return (
              <Card className="mt-4 bg-muted/30">
                <CardContent className="p-4">
                  <p className="text-sm font-semibold mb-3">
                    {DAY_LABELS[selectedDay]}'s Nutrition Summary
                  </p>
                  <div className="grid grid-cols-4 gap-4">
                    {[
                      { label: 'Calories', value: `${totals.calories}`, unit: 'kcal', color: 'text-orange-400' },
                      { label: 'Protein', value: `${totals.protein_g}g`, color: 'text-emerald-400' },
                      { label: 'Carbs', value: `${totals.carbs_g}g`, color: 'text-blue-400' },
                      { label: 'Fat', value: `${totals.fat_g}g`, color: 'text-amber-400' },
                    ].map((stat) => (
                      <div key={stat.label} className="text-center">
                        <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                        <p className="text-xs text-muted-foreground">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          })()}
        </TabsContent>

        {/* Recipe Library Tab */}
        <TabsContent value="recipes" className="mt-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {RECIPES.map((recipe) => (
              <motion.div
                key={recipe.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                <RecipeCard recipe={recipe} onClick={() => setSelectedRecipe(recipe)} />
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* Grocery List Tab */}
        <TabsContent value="grocery" className="mt-4">
          {grocery ? (
            <div className="space-y-4">
              {/* Progress */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold text-sm">Shopping Progress</p>
                      <p className="text-xs text-muted-foreground">
                        {grocery.items.filter(i => i.checked).length} of {grocery.items.length} items checked
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-emerald-400">${grocery.total_estimated_cost.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">Estimated total</p>
                    </div>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill bg-emerald-500"
                      style={{ width: `${groceryProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{groceryProgress}% complete</p>
                </CardContent>
              </Card>

              {/* Items by category */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(groceryByCategory).map(([category, items]) => (
                  <Card key={category}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{category}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {items.map((item, idx) => {
                        const globalIdx = grocery.items.indexOf(item)
                        return (
                          <button
                            key={idx}
                            onClick={() => toggleGroceryItem(globalIdx)}
                            className="w-full flex items-center gap-2.5 text-left group"
                          >
                            {item.checked ? (
                              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                            ) : (
                              <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0 group-hover:text-foreground transition-colors" />
                            )}
                            <div className="flex-1 min-w-0">
                              <span className={`text-xs font-medium ${item.checked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                {item.ingredient}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {item.amount}{item.unit}
                            </span>
                          </button>
                        )
                      })}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <ShoppingCart className="w-12 h-12 mb-4 opacity-20" />
              <p className="font-medium">No grocery list yet</p>
              <p className="text-sm mt-1">Generate one from your meal plan</p>
              <Button variant="brand" className="mt-4" size="sm">
                Generate Grocery List
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Recipe detail modal */}
      <Dialog open={!!selectedRecipe} onOpenChange={() => setSelectedRecipe(null)}>
        {selectedRecipe && (
          <RecipeDetailModal recipe={selectedRecipe} onClose={() => setSelectedRecipe(null)} />
        )}
      </Dialog>
    </div>
  )
}
