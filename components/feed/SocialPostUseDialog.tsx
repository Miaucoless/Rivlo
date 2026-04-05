'use client'

import { useEffect, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { MealData, SocialMealIngredient, SocialPost, UnitSystem, WeekDay, WorkoutData, WorkoutSplit } from '@/types'
import { getWeightUnitLabel, kgToLbs, lbsToKg } from '@/lib/utils'

type MealPlanSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'
type WorkoutScheduleChoice = 'none' | 'today' | 'tomorrow'

export type SocialUseDialogPayload =
  | {
      mode: 'use' | 'remix'
      postType: 'meal'
      title: string
      caption: string
      mealData: MealData
      addToMyMeals: boolean
      addToMealPlan: boolean
      mealPlanDay: WeekDay
      mealPlanSlot: MealPlanSlot
      addIngredientsToGrocery: boolean
    }
  | {
      mode: 'use' | 'remix'
      postType: 'workout'
      title: string
      caption: string
      workoutData: WorkoutData
      addToMyWorkouts: boolean
      addToSplit: boolean
      splitType: WorkoutSplit
      splitDayLabel: string
      scheduleFor: WorkoutScheduleChoice
      keepWeights: boolean
      autoAdjustWeights: boolean
    }

const WEEK_DAYS: WeekDay[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const MEAL_PLAN_SLOTS: MealPlanSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']
const SPLIT_OPTIONS: WorkoutSplit[] = ['ppl', 'upper_lower', '3day_fullbody', '4day', '5day', '6day', 'cardio_focus', 'custom']

function formatLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function emptyMealData(): MealData {
  return {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    servings: 1,
    serving_size: '1 serving',
    ingredients: [],
    instructions: [],
  }
}

function emptyWorkoutData(): WorkoutData {
  return {
    duration: 45,
    level: 'Beginner',
    equipment: [],
    focus: [],
    exercises: [],
    notes: '',
  }
}

function formatWorkoutWeightInput(weightKg: number | undefined, unitSystem: UnitSystem) {
  if (weightKg === undefined) return ''
  if (unitSystem === 'metric') return String(weightKg)

  const weightLbs = kgToLbs(weightKg)
  const roundedToTenth = Math.round(weightLbs * 10) / 10
  if (Math.abs(roundedToTenth - Math.round(roundedToTenth)) < 0.001) {
    return String(Math.round(roundedToTenth))
  }
  return String(roundedToTenth)
}

function parseWorkoutWeightInput(value: string, unitSystem: UnitSystem) {
  if (value === '') return undefined
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return undefined
  return unitSystem === 'metric' ? numeric : lbsToKg(numeric)
}

export function SocialPostUseDialog({
  post,
  open,
  mode,
  defaultSplitType,
  unitSystem,
  onOpenChange,
  onSubmit,
}: {
  post: SocialPost | null
  open: boolean
  mode: 'use' | 'remix'
  defaultSplitType: WorkoutSplit
  unitSystem: UnitSystem
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: SocialUseDialogPayload) => void
}) {
  const [title, setTitle] = useState('')
  const [caption, setCaption] = useState('')
  const [mealData, setMealData] = useState<MealData>(emptyMealData)
  const [workoutData, setWorkoutData] = useState<WorkoutData>(emptyWorkoutData)
  const [addToMyMeals, setAddToMyMeals] = useState(true)
  const [addToMealPlan, setAddToMealPlan] = useState(false)
  const [mealPlanDay, setMealPlanDay] = useState<WeekDay>('monday')
  const [mealPlanSlot, setMealPlanSlot] = useState<MealPlanSlot>('lunch')
  const [addIngredientsToGrocery, setAddIngredientsToGrocery] = useState(false)
  const [addToMyWorkouts, setAddToMyWorkouts] = useState(true)
  const [addToSplit, setAddToSplit] = useState(true)
  const [splitType, setSplitType] = useState<WorkoutSplit>(defaultSplitType)
  const [splitDayLabel, setSplitDayLabel] = useState('Push')
  const [scheduleFor, setScheduleFor] = useState<WorkoutScheduleChoice>('none')
  const [keepWeights, setKeepWeights] = useState(true)
  const [autoAdjustWeights, setAutoAdjustWeights] = useState(false)
  const weightUnitLabel = getWeightUnitLabel(unitSystem)

  useEffect(() => {
    if (!post || !open) return

    setTitle(mode === 'remix' ? `${post.title} Remix` : post.title)
    setCaption(post.caption)
    setMealData(post.mealData ? structuredClone(post.mealData) : emptyMealData())
    setWorkoutData(post.workoutData ? structuredClone(post.workoutData) : emptyWorkoutData())
    setAddToMyMeals(true)
    setAddToMealPlan(false)
    setMealPlanDay('monday')
    setMealPlanSlot('lunch')
    setAddIngredientsToGrocery(false)
    setAddToMyWorkouts(true)
    setAddToSplit(true)
    setSplitType(defaultSplitType)
    setSplitDayLabel(post.workoutData?.focus[0] ? formatLabel(post.workoutData.focus[0]) : 'Push')
    setScheduleFor('none')
    setKeepWeights(true)
    setAutoAdjustWeights(false)
  }, [defaultSplitType, mode, open, post])

  if (!post) return null

  const updateIngredient = (index: number, updates: Partial<SocialMealIngredient>) => {
    setMealData((current) => ({
      ...current,
      ingredients: current.ingredients.map((ingredient, ingredientIndex) =>
        ingredientIndex === index ? { ...ingredient, ...updates } : ingredient
      ),
    }))
  }

  const updateInstruction = (index: number, nextValue: string) => {
    setMealData((current) => ({
      ...current,
      instructions: current.instructions.map((instruction, instructionIndex) =>
        instructionIndex === index ? nextValue : instruction
      ),
    }))
  }

  const submit = () => {
    if (post.type === 'meal') {
      onSubmit({
        mode,
        postType: 'meal',
        title,
        caption,
        mealData,
        addToMyMeals,
        addToMealPlan,
        mealPlanDay,
        mealPlanSlot,
        addIngredientsToGrocery,
      })
      return
    }

    onSubmit({
      mode,
      postType: 'workout',
      title,
      caption,
      workoutData,
      addToMyWorkouts,
      addToSplit,
      splitType,
      splitDayLabel,
      scheduleFor,
      keepWeights,
      autoAdjustWeights,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!left-1/2 !top-auto !bottom-0 !h-[92dvh] !w-[calc(100vw-0.5rem)] !max-w-4xl !translate-x-[-50%] !translate-y-0 overflow-hidden rounded-t-[1.75rem] border-border/80 p-0 sm:!top-1/2 sm:!bottom-auto sm:!h-[90dvh] sm:!max-h-[90dvh] sm:!w-[calc(100vw-2rem)] sm:!translate-y-[-50%] sm:rounded-[1.75rem]">
        <div className="flex h-full min-h-0 max-h-[92dvh] flex-col overflow-hidden sm:max-h-[90dvh]">
          <div className="flex justify-center py-2 sm:hidden">
            <span className="h-1.5 w-12 rounded-full bg-border/80" />
          </div>
          <DialogHeader className="border-b border-border/70 px-4 py-4 text-left sm:px-6">
            <DialogTitle>{mode === 'use' ? 'Use This' : 'Remix This'}</DialogTitle>
            <DialogDescription>
              {mode === 'use'
                ? 'Adjust the structure before adding it into your own flow.'
                : `This version will preserve attribution to @${post.user.username}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-y-contain px-4 py-4 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input value={title} onChange={(event) => setTitle(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Caption</Label>
                <Input value={caption} onChange={(event) => setCaption(event.target.value)} />
              </div>
            </div>

            {post.type === 'meal' ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="space-y-1.5">
                    <Label>Calories</Label>
                    <Input type="number" value={mealData.calories} onChange={(event) => setMealData((current) => ({ ...current, calories: Number(event.target.value) || 0 }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Protein</Label>
                    <Input type="number" value={mealData.protein} onChange={(event) => setMealData((current) => ({ ...current, protein: Number(event.target.value) || 0 }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Carbs</Label>
                    <Input type="number" value={mealData.carbs} onChange={(event) => setMealData((current) => ({ ...current, carbs: Number(event.target.value) || 0 }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Fat</Label>
                    <Input type="number" value={mealData.fat} onChange={(event) => setMealData((current) => ({ ...current, fat: Number(event.target.value) || 0 }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Servings</Label>
                    <Input type="number" value={mealData.servings} onChange={(event) => setMealData((current) => ({ ...current, servings: Number(event.target.value) || 1 }))} />
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Ingredients</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1 rounded-full"
                        onClick={() => setMealData((current) => ({
                          ...current,
                          ingredients: [...current.ingredients, { name: '', amount: 1, unit: 'serving' }],
                        }))}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add
                      </Button>
                    </div>
                    <div className="space-y-3 rounded-3xl border border-border/70 bg-muted/10 p-4">
                      {mealData.ingredients.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No ingredients yet.</p>
                      ) : mealData.ingredients.map((ingredient, index) => (
                        <div key={`ingredient-${index}`} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_88px_88px_auto]">
                          <Input
                            placeholder="Ingredient"
                            value={ingredient.name}
                            onChange={(event) => updateIngredient(index, { name: event.target.value })}
                          />
                          <Input
                            type="number"
                            placeholder="Amount"
                            value={ingredient.amount}
                            onChange={(event) => updateIngredient(index, { amount: Number(event.target.value) || 0 })}
                          />
                          <Input
                            placeholder="Unit"
                            value={ingredient.unit}
                            onChange={(event) => updateIngredient(index, { unit: event.target.value })}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setMealData((current) => ({
                              ...current,
                              ingredients: current.ingredients.filter((_, ingredientIndex) => ingredientIndex !== index),
                            }))}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Instructions</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1 rounded-full"
                        onClick={() => setMealData((current) => ({
                          ...current,
                          instructions: [...current.instructions, ''],
                        }))}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add
                      </Button>
                    </div>
                    <div className="space-y-3 rounded-3xl border border-border/70 bg-muted/10 p-4">
                      {mealData.instructions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No instructions yet.</p>
                      ) : mealData.instructions.map((instruction, index) => (
                        <div key={`instruction-${index}`} className="flex gap-2">
                          <Textarea
                            value={instruction}
                            onChange={(event) => updateInstruction(index, event.target.value)}
                            className="min-h-[78px]"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="mt-1 shrink-0"
                            onClick={() => setMealData((current) => ({
                              ...current,
                              instructions: current.instructions.filter((_, instructionIndex) => instructionIndex !== index),
                            }))}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-border/70 bg-muted/10 p-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="flex items-start gap-3 rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
                      <input type="checkbox" checked={addToMyMeals} onChange={(event) => setAddToMyMeals(event.target.checked)} className="mt-1" />
                      <div>
                        <p className="text-sm font-medium">Add to My Meals</p>
                        <p className="mt-1 text-xs text-muted-foreground">Create a reusable meal in your account.</p>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
                      <input type="checkbox" checked={addToMealPlan} onChange={(event) => setAddToMealPlan(event.target.checked)} className="mt-1" />
                      <div>
                        <p className="text-sm font-medium">Add to Meal Plan</p>
                        <p className="mt-1 text-xs text-muted-foreground">Schedule it into this week&apos;s plan.</p>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 rounded-2xl border border-border/70 bg-background/80 px-4 py-3 md:col-span-2">
                      <input type="checkbox" checked={addIngredientsToGrocery} onChange={(event) => setAddIngredientsToGrocery(event.target.checked)} className="mt-1" />
                      <div>
                        <p className="text-sm font-medium">Add ingredients to grocery list</p>
                        <p className="mt-1 text-xs text-muted-foreground">Every listed ingredient will be added to your current grocery list.</p>
                      </div>
                    </label>
                  </div>

                  {addToMealPlan ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Plan day</Label>
                        <Select value={mealPlanDay} onValueChange={(value) => setMealPlanDay(value as WeekDay)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {WEEK_DAYS.map((day) => (
                              <SelectItem key={day} value={day}>{formatLabel(day)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Meal slot</Label>
                        <Select value={mealPlanSlot} onValueChange={(value) => setMealPlanSlot(value as MealPlanSlot)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {MEAL_PLAN_SLOTS.map((slot) => (
                              <SelectItem key={slot} value={slot}>{formatLabel(slot)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label>Duration</Label>
                    <Input type="number" value={workoutData.duration} onChange={(event) => setWorkoutData((current) => ({ ...current, duration: Number(event.target.value) || 0 }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Level</Label>
                    <Select value={workoutData.level} onValueChange={(value) => setWorkoutData((current) => ({ ...current, level: value as WorkoutData['level'] }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(['Beginner', 'Intermediate', 'Advanced'] as const).map((level) => (
                          <SelectItem key={level} value={level}>{level}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 lg:col-span-2">
                    <Label>Equipment</Label>
                    <Input
                      value={workoutData.equipment.join(', ')}
                      onChange={(event) => setWorkoutData((current) => ({ ...current, equipment: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) }))}
                      placeholder="Barbell, bench, cable"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Focus</Label>
                  <Input
                    value={workoutData.focus.join(', ')}
                    onChange={(event) => setWorkoutData((current) => ({ ...current, focus: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) }))}
                    placeholder="Push, chest, shoulders"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Exercises</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1 rounded-full"
                      onClick={() => setWorkoutData((current) => ({
                        ...current,
                        exercises: [...current.exercises, { name: '', sets: 3, reps: '10', weight: undefined, rest: 75, notes: '' }],
                      }))}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </Button>
                  </div>

                  <div className="space-y-3 rounded-3xl border border-border/70 bg-muted/10 p-4">
                    {workoutData.exercises.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No exercises yet.</p>
                    ) : workoutData.exercises.map((exercise, index) => (
                      <div key={`exercise-${index}`} className="rounded-2xl border border-border/70 bg-background/80 p-3">
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_72px_88px_88px_88px_auto]">
                          <Input
                            placeholder="Exercise name"
                            value={exercise.name}
                            onChange={(event) => setWorkoutData((current) => ({
                              ...current,
                              exercises: current.exercises.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item),
                            }))}
                          />
                          <div className="space-y-1">
                            <p className="px-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Sets</p>
                            <Input
                              type="number"
                              placeholder="Sets"
                              value={exercise.sets}
                              onChange={(event) => setWorkoutData((current) => ({
                                ...current,
                                exercises: current.exercises.map((item, itemIndex) => itemIndex === index ? { ...item, sets: Number(event.target.value) || 0 } : item),
                              }))}
                            />
                          </div>
                          <div className="space-y-1">
                            <p className="px-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Reps</p>
                            <Input
                              placeholder="Reps"
                              value={exercise.reps}
                              onChange={(event) => setWorkoutData((current) => ({
                                ...current,
                                exercises: current.exercises.map((item, itemIndex) => itemIndex === index ? { ...item, reps: event.target.value } : item),
                              }))}
                            />
                          </div>
                          <div className="space-y-1">
                            <p className="px-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Weight ({weightUnitLabel})</p>
                            <Input
                              inputMode="decimal"
                              placeholder={`Weight (${weightUnitLabel})`}
                              value={formatWorkoutWeightInput(exercise.weight, unitSystem)}
                              onChange={(event) => setWorkoutData((current) => ({
                                ...current,
                                exercises: current.exercises.map((item, itemIndex) => itemIndex === index ? { ...item, weight: parseWorkoutWeightInput(event.target.value, unitSystem) } : item),
                              }))}
                            />
                          </div>
                          <div className="space-y-1">
                            <p className="px-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Rest (sec)</p>
                            <Input
                              type="number"
                              placeholder="Rest"
                              value={exercise.rest ?? ''}
                              onChange={(event) => setWorkoutData((current) => ({
                                ...current,
                                exercises: current.exercises.map((item, itemIndex) => itemIndex === index ? { ...item, rest: event.target.value === '' ? undefined : Number(event.target.value) || 0 } : item),
                              }))}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setWorkoutData((current) => ({
                              ...current,
                              exercises: current.exercises.filter((_, exerciseIndex) => exerciseIndex !== index),
                            }))}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        </div>
                        <Textarea
                          value={exercise.notes || ''}
                          onChange={(event) => setWorkoutData((current) => ({
                            ...current,
                            exercises: current.exercises.map((item, itemIndex) => itemIndex === index ? { ...item, notes: event.target.value } : item),
                          }))}
                          placeholder="Optional notes"
                          className="mt-2 min-h-[72px]"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Notes</Label>
                  <Textarea value={workoutData.notes || ''} onChange={(event) => setWorkoutData((current) => ({ ...current, notes: event.target.value }))} className="min-h-[90px]" />
                </div>

                <div className="rounded-3xl border border-border/70 bg-muted/10 p-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="flex items-start gap-3 rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
                      <input type="checkbox" checked={addToMyWorkouts} onChange={(event) => setAddToMyWorkouts(event.target.checked)} className="mt-1" />
                      <div>
                        <p className="text-sm font-medium">Add to My Workouts</p>
                        <p className="mt-1 text-xs text-muted-foreground">Save it as a reusable workout in your library.</p>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
                      <input type="checkbox" checked={addToSplit} onChange={(event) => setAddToSplit(event.target.checked)} className="mt-1" />
                      <div>
                        <p className="text-sm font-medium">Add to split</p>
                        <p className="mt-1 text-xs text-muted-foreground">Assign the workout to a split label you use.</p>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
                      <input type="checkbox" checked={keepWeights} onChange={(event) => setKeepWeights(event.target.checked)} className="mt-1" />
                      <div>
                        <p className="text-sm font-medium">Keep weights</p>
                        <p className="mt-1 text-xs text-muted-foreground">Preserve the loads the creator shared.</p>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
                      <input type="checkbox" checked={autoAdjustWeights} onChange={(event) => setAutoAdjustWeights(event.target.checked)} className="mt-1" />
                      <div>
                        <p className="text-sm font-medium">Auto-adjust weights</p>
                        <p className="mt-1 text-xs text-muted-foreground">Applies a simple placeholder increase to saved loads.</p>
                      </div>
                    </label>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label>Split type</Label>
                      <Select value={splitType} onValueChange={(value) => setSplitType(value as WorkoutSplit)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SPLIT_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>{formatLabel(option)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Split label</Label>
                      <Input value={splitDayLabel} onChange={(event) => setSplitDayLabel(event.target.value)} placeholder="Push" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Schedule</Label>
                      <Select value={scheduleFor} onValueChange={(value) => setScheduleFor(value as WorkoutScheduleChoice)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Don&apos;t schedule</SelectItem>
                          <SelectItem value="today">Today</SelectItem>
                          <SelectItem value="tomorrow">Tomorrow</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="shrink-0 border-t border-border/70 px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-4">
            <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button className="rounded-full" onClick={submit}>
              {mode === 'use' ? 'Apply' : 'Save Remix'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
