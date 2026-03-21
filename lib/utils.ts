import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO, differenceInDays, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Fitness Calculations ────────────────────────────────────────────────────────

import type { ActivityLevel, FitnessGoal, Gender, UserProfile } from '@/types'

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
  gender: Gender
  activity_level: ActivityLevel
  fitness_goal: FitnessGoal
  workout_split: string
}): Omit<UserProfile, 'id' | 'created_at' | 'updated_at'> {
  const bmr = calculateBMR(formData.weight_kg, formData.height_cm, formData.age, formData.gender)
  const tdee = calculateTDEE(bmr, formData.activity_level)
  const calorie_target = calculateCalorieTarget(tdee, formData.fitness_goal)
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
    onboarded: true,
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
  const { avg_calories, avg_protein, workouts_this_week, current_weight } = recentData
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
