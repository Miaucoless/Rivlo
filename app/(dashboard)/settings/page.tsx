'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  User, Target, BarChart3, Bell, Shield, Download,
  Save, Trash2, Moon, Sun, Monitor, Zap, Check,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAppStore } from '@/store/useAppStore'
import { buildUserProfile } from '@/lib/utils'
import type { ActivityLevel, FitnessGoal, WorkoutSplit } from '@/types'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'

export default function SettingsPage() {
  const { user, updateProfile, setTheme, isDemoMode, weightHistory, journalEntries, workoutLogs, mealEntries } = useAppStore()
  const { theme, setTheme: setNextTheme } = useTheme()

  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
    height_cm: user?.height_cm || 175,
    weight_kg: user?.weight_kg || 75,
    age: user?.age || 25,
  })

  const [goals, setGoals] = useState({
    fitness_goal: user?.fitness_goal || 'fat_loss',
    activity_level: user?.activity_level || 'moderately_active',
    workout_split: user?.workout_split || 'ppl',
    calorie_target: user?.calorie_target || 2200,
    protein_target_g: user?.protein_target_g || 180,
    carb_target_g: user?.carb_target_g || 220,
    fat_target_g: user?.fat_target_g || 80,
  })

  const handleSaveProfile = () => {
    updateProfile(profile)
    toast.success('Profile updated!')
  }

  const handleRecalculate = () => {
    if (!user) return
    const updated = buildUserProfile({
      name: profile.name,
      email: profile.email,
      height_cm: profile.height_cm,
      weight_kg: profile.weight_kg,
      age: profile.age,
      gender: user.gender,
      activity_level: goals.activity_level as ActivityLevel,
      fitness_goal: goals.fitness_goal as FitnessGoal,
      workout_split: goals.workout_split,
    })
    updateProfile({
      ...updated,
      calorie_target: updated.calorie_target,
      protein_target_g: updated.protein_target_g,
      carb_target_g: updated.carb_target_g,
      fat_target_g: updated.fat_target_g,
    })
    setGoals((prev) => ({
      ...prev,
      calorie_target: updated.calorie_target,
      protein_target_g: updated.protein_target_g,
      carb_target_g: updated.carb_target_g,
      fat_target_g: updated.fat_target_g,
    }))
    toast.success('Macros recalculated from your profile!')
  }

  const handleSaveGoals = () => {
    updateProfile({
      fitness_goal: goals.fitness_goal as FitnessGoal,
      activity_level: goals.activity_level as ActivityLevel,
      workout_split: goals.workout_split as WorkoutSplit,
      calorie_target: Number(goals.calorie_target),
      protein_target_g: Number(goals.protein_target_g),
      carb_target_g: Number(goals.carb_target_g),
      fat_target_g: Number(goals.fat_target_g),
    })
    toast.success('Goals updated!')
  }

  const handleExportJSON = () => {
    const data = {
      profile: user,
      weight_history: weightHistory,
      journal_entries: journalEntries,
      workout_logs: workoutLogs,
      meal_entries: mealEntries,
      exported_at: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `grays-fitness-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    toast.success('Data exported as JSON!')
  }

  const handleExportCSV = () => {
    const csvRows = [
      ['Date', 'Weight (kg)', 'Body Fat (%)'],
      ...weightHistory.map((w) => [w.date, w.weight_kg.toFixed(1), w.body_fat_pct?.toFixed(1) || '']),
    ]
    const csv = csvRows.map((row) => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'weight-history.csv'
    a.click()
    toast.success('Weight data exported as CSV!')
  }

  if (!user) return null

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold">Settings</h2>
        <p className="text-muted-foreground text-sm">Manage your profile, goals, and preferences</p>
        {isDemoMode && (
          <Badge variant="warning" className="mt-2">
            Demo Mode — changes are stored locally
          </Badge>
        )}
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile" className="gap-1.5">
            <User className="w-3.5 h-3.5" /> Profile
          </TabsTrigger>
          <TabsTrigger value="goals" className="gap-1.5">
            <Target className="w-3.5 h-3.5" /> Goals
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-1.5">
            <Monitor className="w-3.5 h-3.5" /> Display
          </TabsTrigger>
          <TabsTrigger value="data" className="gap-1.5">
            <Download className="w-3.5 h-3.5" /> Data
          </TabsTrigger>
        </TabsList>

        {/* Profile tab */}
        <TabsContent value="profile" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Personal Information</CardTitle>
              <CardDescription>Update your basic profile details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Full Name</Label>
                  <Input
                    value={profile.name}
                    onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Height (cm)</Label>
                  <Input
                    type="number"
                    value={profile.height_cm}
                    onChange={(e) => setProfile((p) => ({ ...p, height_cm: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Weight (kg)</Label>
                  <Input
                    type="number"
                    value={profile.weight_kg}
                    onChange={(e) => setProfile((p) => ({ ...p, weight_kg: Number(e.target.value) }))}
                    step={0.5}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Age</Label>
                  <Input
                    type="number"
                    value={profile.age}
                    onChange={(e) => setProfile((p) => ({ ...p, age: Number(e.target.value) }))}
                  />
                </div>
              </div>

              {/* Stats summary */}
              <div className="bg-muted/40 rounded-xl p-4 grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-lg font-bold text-emerald-400">{user.bmr}</p>
                  <p className="text-xs text-muted-foreground">BMR (kcal)</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-blue-400">{user.tdee}</p>
                  <p className="text-xs text-muted-foreground">TDEE (kcal)</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-amber-400">{user.calorie_target}</p>
                  <p className="text-xs text-muted-foreground">Daily Target</p>
                </div>
              </div>

              <Button variant="brand" className="gap-1.5" onClick={handleSaveProfile}>
                <Save className="w-3.5 h-3.5" />
                Save Profile
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Goals tab */}
        <TabsContent value="goals" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fitness Goals</CardTitle>
              <CardDescription>Adjust your targets and program preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Primary Goal</Label>
                  <Select value={goals.fitness_goal} onValueChange={(v) => setGoals((g) => ({ ...g, fitness_goal: v as FitnessGoal }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fat_loss">Fat Loss</SelectItem>
                      <SelectItem value="muscle_gain">Muscle Gain</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="athletic_performance">Athletic Performance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Activity Level</Label>
                  <Select value={goals.activity_level} onValueChange={(v) => setGoals((g) => ({ ...g, activity_level: v as ActivityLevel }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sedentary">Sedentary</SelectItem>
                      <SelectItem value="lightly_active">Lightly Active</SelectItem>
                      <SelectItem value="moderately_active">Moderately Active</SelectItem>
                      <SelectItem value="very_active">Very Active</SelectItem>
                      <SelectItem value="extra_active">Extra Active (Athlete)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Workout Split</Label>
                <Select value={goals.workout_split} onValueChange={(v) => setGoals((g) => ({ ...g, workout_split: v as WorkoutSplit }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ppl">Push/Pull/Legs (6-day)</SelectItem>
                    <SelectItem value="upper_lower">Upper/Lower (4-day)</SelectItem>
                    <SelectItem value="3day_fullbody">Full Body (3-day)</SelectItem>
                    <SelectItem value="4day">4-Day Split</SelectItem>
                    <SelectItem value="5day">5-Day Split</SelectItem>
                    <SelectItem value="cardio_focus">Cardio Focus</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Macro targets */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Daily Macro Targets</Label>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleRecalculate}>
                    <Zap className="w-3 h-3" />
                    Auto-Calculate
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Calories (kcal)', key: 'calorie_target', color: 'text-orange-400' },
                    { label: 'Protein (g)', key: 'protein_target_g', color: 'text-emerald-400' },
                    { label: 'Carbs (g)', key: 'carb_target_g', color: 'text-blue-400' },
                    { label: 'Fat (g)', key: 'fat_target_g', color: 'text-amber-400' },
                  ].map((field) => (
                    <div key={field.key} className="space-y-1.5">
                      <Label className={`text-xs ${field.color}`}>{field.label}</Label>
                      <Input
                        type="number"
                        value={goals[field.key as keyof typeof goals]}
                        onChange={(e) => setGoals((g) => ({ ...g, [field.key]: Number(e.target.value) }))}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <Button variant="brand" className="gap-1.5" onClick={handleSaveGoals}>
                <Save className="w-3.5 h-3.5" />
                Save Goals
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance tab */}
        <TabsContent value="appearance" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Theme</CardTitle>
              <CardDescription>Choose your preferred color scheme</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'light', label: 'Light', icon: Sun },
                  { value: 'dark', label: 'Dark', icon: Moon },
                  { value: 'system', label: 'System', icon: Monitor },
                ].map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setNextTheme(value)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200 ${
                      theme === value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card hover:border-foreground/30'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm font-medium">{label}</span>
                    {theme === value && <Check className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notifications</CardTitle>
              <CardDescription>Configure your reminder preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: 'Daily workout reminder', sub: 'Get reminded to log your workout', enabled: true },
                { label: 'Meal logging reminder', sub: 'Reminder to log meals', enabled: true },
                { label: 'Weekly progress summary', sub: 'Summary of your week every Sunday', enabled: false },
                { label: 'Goal milestone alerts', sub: 'Notify when you hit a milestone', enabled: true },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.sub}</p>
                  </div>
                  <div
                    className={`w-10 h-5 rounded-full transition-colors cursor-pointer ${item.enabled ? 'bg-emerald-500' : 'bg-muted'}`}
                    onClick={() => toast.info('Notification settings — connect to a backend to persist')}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white mt-0.5 transition-transform duration-200 ${item.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data tab */}
        <TabsContent value="data" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Export Your Data</CardTitle>
              <CardDescription>Download a copy of all your fitness data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 border border-border rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Download className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">JSON Export</p>
                      <p className="text-xs text-muted-foreground">All data, full structure</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="w-full" onClick={handleExportJSON}>
                    Export JSON
                  </Button>
                </div>
                <div className="p-4 border border-border rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <BarChart3 className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">CSV Export</p>
                      <p className="text-xs text-muted-foreground">Weight history as CSV</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="w-full" onClick={handleExportCSV}>
                    Export CSV
                  </Button>
                </div>
              </div>

              {/* Data summary */}
              <div className="bg-muted/40 rounded-xl p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-3">Your data summary</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { label: 'Weight entries', value: weightHistory.length },
                    { label: 'Journal entries', value: journalEntries.length },
                    { label: 'Workout logs', value: workoutLogs.length },
                    { label: 'Meal log days', value: Object.keys(mealEntries).length },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-semibold">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
              <CardDescription>Irreversible actions — proceed with caution</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                size="sm"
                className="gap-1.5"
                onClick={() => toast.error('Delete account — requires Supabase backend to implement')}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Account & All Data
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
