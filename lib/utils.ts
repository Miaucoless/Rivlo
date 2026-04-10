import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO, differenceInDays, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Fitness Calculations ────────────────────────────────────────────────────────

import type { ActivityLevel, DietaryStyle, FitnessGoal, Gender, PreferredWorkoutTime, TrainingExperience, UnitSystem, UserProfile } from '@/types'

/**
 * Mifflin-St Jeor BMR formula (most accurate for most people)
 */
export function calculateBMR(weight_kg: number, height_cm: number, age: number, gender: Gender): number {
  const base = 10 * weight_kg + 6.25 * height_cm - 5 * age
  return gender === 'male' ? base + 5 : base - 161
}

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extra_active: 1.9,
}

export function calculateTDEE(bmr: number, activity_level: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activity_level])
}

const GOAL_CALORIE_ADJUSTMENTS: Record<FitnessGoal, number> = {
  fat_loss: -500,        // 0.5kg/week deficit
  muscle_gain: 250,      // lean bulk surplus
  maintenance: 0,
  athletic_performance: 200,
}

export function calculateCalorieTarget(tdee: number, goal: FitnessGoal): number {
  return tdee + GOAL_CALORIE_ADJUSTMENTS[goal]
}

export function calculateDetailedCalorieTarget(args: {
  tdee: number
  goal: FitnessGoal
  goal_target_change_kg?: number
  goal_timeframe_weeks?: number
}) {
  const { tdee, goal, goal_target_change_kg, goal_timeframe_weeks } = args

  if (
    !goal_target_change_kg ||
    !goal_timeframe_weeks ||
    goal_timeframe_weeks <= 0 ||
    goal === 'maintenance' ||
    goal === 'athletic_performance'
  ) {
    return calculateCalorieTarget(tdee, goal)
  }

  const weeklyChangeKg = goal_target_change_kg / goal_timeframe_weeks
  const dailyKcalDelta = (weeklyChangeKg * 7700) / 7

  if (goal === 'fat_loss') {
    return Math.round(Math.max(tdee - 1100, tdee - dailyKcalDelta))
  }

  if (goal === 'muscle_gain') {
    return Math.round(Math.min(tdee + 500, tdee + dailyKcalDelta))
  }

  return calculateCalorieTarget(tdee, goal)
}

/**
 * Protein targets based on goals:
 * - Fat loss: 2.2g/kg (preserve muscle)
 * - Muscle gain: 2.0g/kg (build muscle)
 * - Maintenance: 1.6g/kg
 * - Athletic: 2.0–2.5g/kg
 */
export function calculateProteinTarget(weight_kg: number, goal: FitnessGoal): number {
  const multipliers: Record<FitnessGoal, number> = {
    fat_loss: 2.2,
    muscle_gain: 2.0,
    maintenance: 1.6,
    athletic_performance: 2.2,
  }
  return Math.round(weight_kg * multipliers[goal])
}

export function calculateMacros(calorie_target: number, protein_g: number, goal: FitnessGoal) {
  const protein_calories = protein_g * 4

  // Fat as % of remaining calories (varies by goal)
  const fat_pct: Record<FitnessGoal, number> = {
    fat_loss: 0.30,
    muscle_gain: 0.25,
    maintenance: 0.28,
    athletic_performance: 0.25,
  }

  const remaining = calorie_target - protein_calories
  const fat_calories = remaining * fat_pct[goal]
  const carb_calories = remaining - fat_calories

  return {
    protein_g,
    fat_g: Math.round(fat_calories / 9),
    carbs_g: Math.round(carb_calories / 4),
  }
}

export function buildUserProfile(formData: {
  name: string
  email: string
  height_cm: number
  weight_kg: number
  age: number
  unit_system: UnitSystem
  gender: Gender
  activity_level: ActivityLevel
  fitness_goal: FitnessGoal
  workout_split: string
  goal_target_change_kg?: number
  goal_timeframe_weeks?: number
  preferred_workout_time?: PreferredWorkoutTime
  preferred_workout_days?: string[]
  training_experience?: TrainingExperience
  dietary_style?: DietaryStyle
  biggest_challenge?: string
  preferred_foods?: string[]
  avoided_foods?: string[]
}): Omit<UserProfile, 'id' | 'created_at' | 'updated_at'> {
  const bmr = calculateBMR(formData.weight_kg, formData.height_cm, formData.age, formData.gender)
  const tdee = calculateTDEE(bmr, formData.activity_level)
  const calorie_target = calculateDetailedCalorieTarget({
    tdee,
    goal: formData.fitness_goal,
    goal_target_change_kg: formData.goal_target_change_kg,
    goal_timeframe_weeks: formData.goal_timeframe_weeks,
  })
  const protein_target_g = calculateProteinTarget(formData.weight_kg, formData.fitness_goal)
  const macros = calculateMacros(calorie_target, protein_target_g, formData.fitness_goal)

  return {
    ...formData,
    workout_split: formData.workout_split as UserProfile['workout_split'],
    bmr: Math.round(bmr),
    tdee,
    calorie_target,
    protein_target_g,
    carb_target_g: macros.carbs_g,
    fat_target_g: macros.fat_g,
    water_goal_ml: Math.round(((formData.weight_kg ?? 70) * 35) / 50) * 50,
    onboarded: true,
    onboarding_completed_at: new Date().toISOString(),
    avatar_url: undefined,
  }
}

// ─── Date Utilities ──────────────────────────────────────────────────────────────

export function formatDate(date: string | Date, fmt = 'MMM d, yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, fmt)
}

export function getWeekDays(date: Date = new Date()): Date[] {
  const start = startOfWeek(date, { weekStartsOn: 1 }) // Monday
  const end = endOfWeek(date, { weekStartsOn: 1 })
  return eachDayOfInterval({ start, end })
}

export function getTodayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function getDaysSince(dateStr: string): number {
  return differenceInDays(new Date(), parseISO(dateStr))
}

// ─── Number Utilities ────────────────────────────────────────────────────────────

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function percentage(value: number, total: number): number {
  if (total === 0) return 0
  return clamp(Math.round((value / total) * 100), 0, 100)
}

export function formatWeight(kg: number, unit: 'kg' | 'lbs' = 'kg'): string {
  if (unit === 'lbs') return `${(kg * 2.205).toFixed(1)} lbs`
  return `${kg.toFixed(1)} kg`
}

export function kgToLbs(kg: number): number {
  return kg * 2.20462
}

export function lbsToKg(lbs: number): number {
  return lbs / 2.20462
}

export function inchesToCm(inches: number): number {
  return inches * 2.54
}

export function cmToInches(cm: number): number {
  return cm / 2.54
}

export function cmToFeetAndInches(cm: number) {
  const totalInches = Math.round(cmToInches(cm))
  const feet = Math.floor(totalInches / 12)
  const inches = totalInches % 12
  return { feet, inches }
}

export function formatHeightForInput(heightCm: number, unitSystem: UnitSystem): string {
  if (unitSystem === 'metric') return Math.round(heightCm).toString()
  const { feet, inches } = cmToFeetAndInches(heightCm)
  return `${feet}'${inches}`
}

export function formatWeightForInput(weightKg: number, unitSystem: UnitSystem): string {
  if (unitSystem === 'metric') return weightKg.toFixed(1)
  return Math.round(kgToLbs(weightKg)).toString()
}

export function formatGoalWeightChangeForInput(goalChangeKg: number | undefined, unitSystem: UnitSystem): string {
  if (goalChangeKg === undefined) return ''
  return unitSystem === 'metric' ? goalChangeKg.toFixed(1) : Math.round(kgToLbs(goalChangeKg)).toString()
}

export function normalizePhoneNumber(input: string): string | null {
  const cleaned = input.trim().replace(/[^\d+]/g, '')
  if (!cleaned) return null

  const normalized = cleaned.startsWith('+') ? cleaned : `+${cleaned}`
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) return null

  return normalized
}

export function parseHeightInput(input: string, unitSystem: UnitSystem): number | null {
  const value = input.trim().toLowerCase()
  if (!value) return null

  if (unitSystem === 'metric') {
    const centimeters = Number(value)
    return Number.isFinite(centimeters) ? centimeters : null
  }

  const feetInchesMatch = value.match(/^(\d+)\s*(?:'|ft)\s*(\d{1,2})?\s*(?:"|in)?$/)
  if (feetInchesMatch) {
    const feet = Number(feetInchesMatch[1])
    const inches = Number(feetInchesMatch[2] || 0)
    return inchesToCm((feet * 12) + inches)
  }

  const splitMatch = value.match(/^(\d+)\s+(\d{1,2})$/)
  if (splitMatch) {
    const feet = Number(splitMatch[1])
    const inches = Number(splitMatch[2])
    return inchesToCm((feet * 12) + inches)
  }

  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return null
  if (numeric >= 4 && numeric <= 8) return inchesToCm(numeric * 12)
  if (numeric >= 48 && numeric <= 96) return inchesToCm(numeric)
  return null
}

export function parseWeightInput(input: string, unitSystem: UnitSystem): number | null {
  const numeric = Number(input.trim())
  if (!Number.isFinite(numeric)) return null
  return unitSystem === 'metric' ? numeric : lbsToKg(numeric)
}

export function formatWeightValue(weightKg: number, unitSystem: UnitSystem, digits = 1): string {
  if (unitSystem === 'metric') return `${weightKg.toFixed(digits)} kg`
  return `${kgToLbs(weightKg).toFixed(digits)} lbs`
}

export function formatWeightNumber(weightKg: number, unitSystem: UnitSystem, digits = 1): string {
  if (unitSystem === 'metric') return weightKg.toFixed(digits)
  return kgToLbs(weightKg).toFixed(digits)
}

export function formatWeightDelta(weightKg: number, unitSystem: UnitSystem, digits = 1): string {
  const sign = weightKg > 0 ? '+' : ''
  if (unitSystem === 'metric') return `${sign}${weightKg.toFixed(digits)} kg`
  return `${sign}${kgToLbs(weightKg).toFixed(digits)} lbs`
}

export function getWeightUnitLabel(unitSystem: UnitSystem): 'kg' | 'lbs' {
  return unitSystem === 'metric' ? 'kg' : 'lbs'
}

export function formatVolumeValue(volumeKg: number, unitSystem: UnitSystem, digits = 0): string {
  const value = unitSystem === 'metric' ? volumeKg : kgToLbs(volumeKg)
  return `${value.toFixed(digits)} ${getWeightUnitLabel(unitSystem)}`
}

export function getHeightUnitLabel(unitSystem: UnitSystem): string {
  return unitSystem === 'metric' ? 'cm' : 'ft/in'
}

export function formatCalories(cal: number): string {
  return cal.toLocaleString()
}

// ─── Color Utilities ─────────────────────────────────────────────────────────────

export function getMacroColor(type: 'protein' | 'carbs' | 'fat'): string {
  const colors = {
    protein: 'hsl(142, 76%, 36%)',
    carbs: 'hsl(217, 91%, 60%)',
    fat: 'hsl(38, 92%, 50%)',
  }
  return colors[type]
}

export function getProgressColor(pct: number): string {
  if (pct < 30) return 'text-red-500'
  if (pct < 60) return 'text-yellow-500'
  if (pct < 90) return 'text-emerald-500'
  if (pct <= 100) return 'text-emerald-400'
  return 'text-red-400' // over target
}

export function getProgressBarColor(pct: number): string {
  if (pct > 100) return 'bg-red-500'
  if (pct > 85) return 'bg-emerald-500'
  if (pct > 50) return 'bg-blue-500'
  return 'bg-zinc-500'
}

// ─── AI Recommendation Logic ─────────────────────────────────────────────────────

export function generateRecommendation(profile: UserProfile, recentData: {
  avg_calories: number
  avg_protein: number
  workouts_this_week: number
  current_weight: number
}): string {
  const { avg_calories, avg_protein, workouts_this_week } = recentData
  const recommendations: string[] = []

  const calorie_diff = profile.calorie_target - avg_calories
  if (calorie_diff > 300) {
    recommendations.push(`You're averaging ${Math.round(calorie_diff)} calories below your target. Try adding a protein-rich snack to fuel your workouts.`)
  } else if (calorie_diff < -300) {
    recommendations.push(`You're exceeding your calorie target by ~${Math.round(-calorie_diff)} kcal/day. Focus on high-volume, low-calorie foods.`)
  }

  const protein_diff = profile.protein_target_g - avg_protein
  if (protein_diff > 20) {
    recommendations.push(`Protein intake is low (avg ${Math.round(avg_protein)}g vs ${profile.protein_target_g}g target). Add chicken, Greek yogurt, or protein shakes.`)
  }

  if (workouts_this_week < 3 && profile.fitness_goal !== 'maintenance') {
    recommendations.push(`You've only logged ${workouts_this_week} workout${workouts_this_week !== 1 ? 's' : ''} this week. Aim for at least 3 sessions.`)
  }

  if (recommendations.length === 0) {
    recommendations.push(`Great work this week! You're hitting your targets consistently. Stay the course.`)
  }

  return recommendations[0]
}
