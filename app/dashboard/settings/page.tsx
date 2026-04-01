'use client'

import React from 'react'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  User, Target, BarChart3, Bell, Shield, Download,
  Save, Trash2, Moon, Sun, Monitor, Zap, Check,
  Users, UserPlus, UserCheck, UserX, X, Loader2, Search, ExternalLink, FileText, Mail,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAppStore } from '@/store/useAppStore'
import { deleteAccount as deleteSupabaseAccount, updateProfile as persistProfile } from '@/lib/auth'
import { sendTestEmailNotification } from '@/lib/email-notifications'
import { getPushNotificationStatus, sendTestPushNotification, subscribeToPushNotifications, unsubscribeFromPushNotifications } from '@/lib/push-notifications'
import { sendTestSmsNotification } from '@/lib/sms-notifications'
import { buildUserProfile, formatGoalWeightChangeForInput, formatHeightForInput, formatWeightForInput, getHeightUnitLabel, getWeightUnitLabel, normalizePhoneNumber, parseHeightInput, parseWeightInput } from '@/lib/utils'
import type { ActivityLevel, FitnessGoal, NotificationPreferenceKey, PreferredWorkoutTime, UnitSystem, WorkoutSplit } from '@/types'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'

export default function SettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') ?? 'profile')

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab) setActiveTab(tab)
  }, [searchParams])
  const {
    user,
    updateProfile: updateLocalProfile,
    updateNotificationPreference,
    notificationPreferences,
    isDemoMode,
    weightHistory,
    journalEntries,
    workoutLogs,
    mealEntries,
  } = useAppStore()
  const { theme, setTheme: setNextTheme } = useTheme()

  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
    username: user?.username || '',
    height_input: formatHeightForInput(user?.height_cm || 175, user?.unit_system || 'imperial'),
    weight_input: formatWeightForInput(user?.weight_kg || 75, user?.unit_system || 'imperial'),
    age: user?.age || 25,
    unit_system: user?.unit_system || 'imperial' as UnitSystem,
  })

  const [goals, setGoals] = useState({
    fitness_goal: user?.fitness_goal || 'fat_loss',
    activity_level: user?.activity_level || 'moderately_active',
    workout_split: user?.workout_split || 'ppl',
    goal_target_change_input: formatGoalWeightChangeForInput(user?.goal_target_change_kg, user?.unit_system || 'imperial'),
    goal_timeframe_weeks_input: user?.goal_timeframe_weeks ? String(user.goal_timeframe_weeks) : '12',
    preferred_workout_time: user?.preferred_workout_time || 'evening',
    preferred_foods_input: user?.preferred_foods?.join(', ') || '',
    avoided_foods_input: user?.avoided_foods?.join(', ') || '',
    calorie_target: user?.calorie_target || 2200,
    protein_target_g: user?.protein_target_g || 180,
    carb_target_g: user?.carb_target_g || 220,
    fat_target_g: user?.fat_target_g || 80,
  })
  const [pushSupported, setPushSupported] = useState(false)
  const [pushPermission, setPushPermission] = useState<'default' | 'denied' | 'granted' | 'unsupported'>('default')
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  const [emailEnabled, setEmailEnabled] = useState(Boolean(user?.email_notifications_enabled))
  const [emailLoading, setEmailLoading] = useState(false)
  const [smsPhone, setSmsPhone] = useState(user?.phone_number || '')
  const [smsEnabled, setSmsEnabled] = useState(Boolean(user?.sms_notifications_enabled))
  const [smsLoading, setSmsLoading] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const status = await getPushNotificationStatus()

      if (cancelled) return

      setPushSupported(status.supported)
      setPushPermission(status.permission)
      setPushEnabled(status.subscribed)
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const handleUnitSystemChange = (unitSystem: UnitSystem) => {
    const currentHeightCm = parseHeightInput(profile.height_input, profile.unit_system) ?? user?.height_cm ?? 175
    const currentWeightKg = parseWeightInput(profile.weight_input, profile.unit_system) ?? user?.weight_kg ?? 75
    setProfile((prev) => ({
      ...prev,
      unit_system: unitSystem,
      height_input: formatHeightForInput(currentHeightCm, unitSystem),
      weight_input: formatWeightForInput(currentWeightKg, unitSystem),
    }))
  }

  const saveUserProfile = async (updates: Record<string, any>, successMessage: string) => {
    if (!user) return false

    if (isDemoMode) {
      updateLocalProfile(updates)
      toast.success(successMessage)
      return true
    }

    const response = await persistProfile(user.id, updates)
    if (!response.success || !response.user) {
      toast.error(response.error || 'Failed to save changes.')
      return false
    }

    updateLocalProfile(response.user)
    toast.success(successMessage)
    return true
  }

  const handleSaveProfile = async () => {
    const height_cm = parseHeightInput(profile.height_input, profile.unit_system)
    const weight_kg = parseWeightInput(profile.weight_input, profile.unit_system)

    if (!height_cm || !weight_kg) {
      toast.error('Enter a valid height and weight.')
      return
    }

    // If username changed, save it via the profile API (updates profiles table)
    const trimmedUsername = profile.username.trim()
    if (trimmedUsername && trimmedUsername !== (user?.username ?? '')) {
      if (trimmedUsername.length < 3) {
        toast.error('Username must be at least 3 characters.')
        return
      }
      const { createClient } = await import('@/lib/supabase')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        const res = await fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ username: trimmedUsername }),
        })
        if (!res.ok) {
          const err = await res.json()
          toast.error(err.error ?? 'Could not save username.')
          return
        }
        updateLocalProfile({ username: trimmedUsername })
      }
    }

    await saveUserProfile({
      name: profile.name,
      email: profile.email,
      height_cm,
      weight_kg,
      age: profile.age,
      unit_system: profile.unit_system,
    }, 'Profile updated!')
  }

  const handleRecalculate = async () => {
    if (!user) return
    const height_cm = parseHeightInput(profile.height_input, profile.unit_system)
    const weight_kg = parseWeightInput(profile.weight_input, profile.unit_system)

    if (!height_cm || !weight_kg) {
      toast.error('Enter a valid height and weight.')
      return
    }

    const updated = buildUserProfile({
      name: profile.name,
      email: profile.email,
      height_cm,
      weight_kg,
      age: profile.age,
      unit_system: profile.unit_system,
      gender: user.gender,
      activity_level: goals.activity_level as ActivityLevel,
      fitness_goal: goals.fitness_goal as FitnessGoal,
      workout_split: goals.workout_split,
      goal_target_change_kg: parseWeightInput(goals.goal_target_change_input, profile.unit_system) ?? undefined,
      goal_timeframe_weeks: Number(goals.goal_timeframe_weeks_input) || undefined,
      preferred_workout_time: goals.preferred_workout_time as PreferredWorkoutTime,
      preferred_foods: goals.preferred_foods_input.split(',').map((item) => item.trim()).filter(Boolean),
      avoided_foods: goals.avoided_foods_input.split(',').map((item) => item.trim()).filter(Boolean),
    })

    const saved = await saveUserProfile({
      ...updated,
      calorie_target: updated.calorie_target,
      protein_target_g: updated.protein_target_g,
      carb_target_g: updated.carb_target_g,
      fat_target_g: updated.fat_target_g,
    }, 'Macros recalculated from your profile!')

    if (!saved) return

    setGoals((prev) => ({
      ...prev,
      calorie_target: updated.calorie_target,
      protein_target_g: updated.protein_target_g,
      carb_target_g: updated.carb_target_g,
      fat_target_g: updated.fat_target_g,
    }))
  }

  const handleSaveGoals = async () => {
    await saveUserProfile({
      fitness_goal: goals.fitness_goal as FitnessGoal,
      activity_level: goals.activity_level as ActivityLevel,
      workout_split: goals.workout_split as WorkoutSplit,
      goal_target_change_kg: parseWeightInput(goals.goal_target_change_input, profile.unit_system) ?? undefined,
      goal_timeframe_weeks: Number(goals.goal_timeframe_weeks_input) || undefined,
      preferred_workout_time: goals.preferred_workout_time as PreferredWorkoutTime,
      preferred_foods: goals.preferred_foods_input.split(',').map((item) => item.trim()).filter(Boolean),
      avoided_foods: goals.avoided_foods_input.split(',').map((item) => item.trim()).filter(Boolean),
      calorie_target: Number(goals.calorie_target),
      protein_target_g: Number(goals.protein_target_g),
      carb_target_g: Number(goals.carb_target_g),
      fat_target_g: Number(goals.fat_target_g),
    }, 'Goals updated!')
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
    a.download = `rivora-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    toast.success('Data exported as JSON!')
  }

  const handleExportCSV = () => {
    const csvRows = [
      [`Date`, `Weight (${getWeightUnitLabel(profile.unit_system)})`, 'Body Fat (%)'],
      ...weightHistory.map((w) => [
        w.date,
        profile.unit_system === 'metric' ? w.weight_kg.toFixed(1) : (w.weight_kg * 2.20462).toFixed(1),
        w.body_fat_pct?.toFixed(1) || '',
      ]),
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

  const handleDeleteAccount = async () => {
    if (!user) return
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      toast.error('Type DELETE to confirm permanent account deletion.')
      return
    }

    if (isDemoMode) {
      toast.error('Demo accounts cannot be deleted from Supabase.')
      return
    }

    setDeleteLoading(true)

    try {
      const response = await deleteSupabaseAccount()
      if (!response.success) {
        toast.error(response.error || 'Failed to delete your account.')
        return
      }

      toast.success('Your account was deleted.')
      setDeleteDialogOpen(false)
      setDeleteConfirmText('')
      router.replace('/login')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleToggleNotification = async (key: NotificationPreferenceKey) => {
    const nextValue = !notificationPreferences[key]
    updateNotificationPreference(key, nextValue)

    if (!user || isDemoMode) {
      toast.success(nextValue ? 'Notification enabled.' : 'Notification disabled.')
      return
    }

    const nextPreferences = {
      ...(user.notification_preferences ?? notificationPreferences),
      [key]: nextValue,
    }

    const response = await persistProfile(user.id, {
      notification_preferences: nextPreferences,
    } as Partial<typeof user>)

    if (!response.success || !response.user) {
      toast.info('Preference saved locally. Run the notification preferences SQL migration to persist it in Supabase too.')
      return
    }

    updateLocalProfile(response.user)
    toast.success(nextValue ? 'Notification enabled.' : 'Notification disabled.')
  }

  const refreshPushStatus = async () => {
    const status = await getPushNotificationStatus()
    setPushSupported(status.supported)
    setPushPermission(status.permission)
    setPushEnabled(status.subscribed)
  }

  const handleEnablePush = async () => {
    if (isDemoMode) {
      toast.info('Push notifications require a real signed-in account.')
      return
    }

    setPushLoading(true)

    try {
      await subscribeToPushNotifications()
      await refreshPushStatus()
      toast.success('Device notifications are enabled.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to enable push notifications.')
    } finally {
      setPushLoading(false)
    }
  }

  const handleDisablePush = async () => {
    setPushLoading(true)

    try {
      await unsubscribeFromPushNotifications()
      await refreshPushStatus()
      toast.success('Device notifications are disabled.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to disable push notifications.')
    } finally {
      setPushLoading(false)
    }
  }

  const handleSendTestPush = async () => {
    setPushLoading(true)

    try {
      await sendTestPushNotification()
      toast.success('Test notification sent.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send a test notification.')
    } finally {
      setPushLoading(false)
    }
  }

  const handleSaveSmsSettings = async () => {
    const normalizedPhone = smsPhone.trim() ? normalizePhoneNumber(smsPhone) : null

    if (smsEnabled && !normalizedPhone) {
      toast.error('Enter a valid phone number in international format, like +15551234567.')
      return
    }

    setSmsLoading(true)

    try {
      const nextConsentAt = smsEnabled
        ? (user?.sms_notifications_consent_at || new Date().toISOString())
        : user?.sms_notifications_consent_at

      const saved = await saveUserProfile({
        phone_number: normalizedPhone || null,
        sms_notifications_enabled: smsEnabled,
        sms_notifications_consent_at: nextConsentAt,
      }, smsEnabled ? 'SMS reminders updated!' : 'SMS reminders turned off.')

      if (saved) {
        setSmsPhone(normalizedPhone || '')
      }
    } finally {
      setSmsLoading(false)
    }
  }

  const handleSaveEmailSettings = async () => {
    setEmailLoading(true)

    try {
      const nextConsentAt = emailEnabled
        ? (user?.email_notifications_consent_at || new Date().toISOString())
        : user?.email_notifications_consent_at

      await saveUserProfile({
        email_notifications_enabled: emailEnabled,
        email_notifications_consent_at: nextConsentAt,
      }, emailEnabled ? 'Email reminders updated!' : 'Email reminders turned off.')
    } finally {
      setEmailLoading(false)
    }
  }

  const handleSendTestEmail = async () => {
    setEmailLoading(true)

    try {
      await sendTestEmailNotification()
      toast.success('Test email sent.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send a test email.')
    } finally {
      setEmailLoading(false)
    }
  }

  const handleSendTestSms = async () => {
    setSmsLoading(true)

    try {
      await sendTestSmsNotification()
      toast.success('Test SMS sent.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send a test SMS.')
    } finally {
      setSmsLoading(false)
    }
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex h-auto gap-1 overflow-x-auto bg-transparent px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsTrigger value="profile" className="shrink-0 gap-1.5 text-xs rounded-lg border border-border/60 bg-muted/30 px-3 py-2 data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground">
            <User className="w-3.5 h-3.5" /> Profile
          </TabsTrigger>
          <TabsTrigger value="goals" className="shrink-0 gap-1.5 text-xs rounded-lg border border-border/60 bg-muted/30 px-3 py-2 data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground">
            <Target className="w-3.5 h-3.5" /> Goals
          </TabsTrigger>
          <TabsTrigger value="appearance" className="shrink-0 gap-1.5 text-xs rounded-lg border border-border/60 bg-muted/30 px-3 py-2 data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground">
            <Monitor className="w-3.5 h-3.5" /> Display
          </TabsTrigger>
          <TabsTrigger value="data" className="shrink-0 gap-1.5 text-xs rounded-lg border border-border/60 bg-muted/30 px-3 py-2 data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground">
            <Download className="w-3.5 h-3.5" /> Data
          </TabsTrigger>
          <TabsTrigger value="friends" className="shrink-0 gap-1.5 text-xs rounded-lg border border-border/60 bg-muted/30 px-3 py-2 data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground">
            <Users className="w-3.5 h-3.5" /> Friends
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Full Name</Label>
                  <Input
                    value={profile.name}
                    onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Username</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none">@</span>
                    <Input
                      value={profile.username}
                      onChange={(e) => setProfile((p) => ({ ...p, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                      placeholder="yourname"
                      maxLength={20}
                      className="pl-7"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">3–20 characters: letters, numbers, underscores. Used by friends to find you.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Preferred Units</Label>
                  <Select value={profile.unit_system} onValueChange={(v) => handleUnitSystemChange(v as UnitSystem)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="imperial">US / Imperial (ft, in, lbs)</SelectItem>
                      <SelectItem value="metric">Metric (cm, kg)</SelectItem>
                    </SelectContent>
                  </Select>
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Height ({getHeightUnitLabel(profile.unit_system)})</Label>
                  <Input
                    type="text"
                    value={profile.height_input}
                    onChange={(e) => setProfile((p) => ({ ...p, height_input: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Weight ({getWeightUnitLabel(profile.unit_system)})</Label>
                  <Input
                    type="number"
                    value={profile.weight_input}
                    onChange={(e) => setProfile((p) => ({ ...p, weight_input: e.target.value }))}
                    step={profile.unit_system === 'metric' ? 0.1 : 1}
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
              <div className="bg-muted/40 rounded-xl p-4 grid grid-cols-1 gap-4 text-center sm:grid-cols-3">
                <div>
                  <p className="text-lg font-bold tabular-nums">{user.bmr}</p>
                  <p className="text-xs text-muted-foreground">BMR (kcal)</p>
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums">{user.tdee}</p>
                  <p className="text-xs text-muted-foreground">TDEE (kcal)</p>
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums text-emerald-500">{user.calorie_target}</p>
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Target change ({getWeightUnitLabel(profile.unit_system)})</Label>
                  <Input
                    type="number"
                    value={goals.goal_target_change_input}
                    onChange={(e) => setGoals((g) => ({ ...g, goal_target_change_input: e.target.value }))}
                    placeholder={profile.unit_system === 'metric' ? '6' : '12'}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Goal timeframe (weeks)</Label>
                  <Input
                    type="number"
                    value={goals.goal_timeframe_weeks_input}
                    onChange={(e) => setGoals((g) => ({ ...g, goal_timeframe_weeks_input: e.target.value }))}
                    min={1}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Preferred workout time</Label>
                <Select value={goals.preferred_workout_time} onValueChange={(v) => setGoals((g) => ({ ...g, preferred_workout_time: v as PreferredWorkoutTime }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="early_morning">Early Morning</SelectItem>
                    <SelectItem value="morning">Morning</SelectItem>
                    <SelectItem value="afternoon">Afternoon</SelectItem>
                    <SelectItem value="evening">Evening</SelectItem>
                    <SelectItem value="late_night">Late Night</SelectItem>
                    <SelectItem value="flexible">Flexible</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Foods you want more of</Label>
                  <Input
                    value={goals.preferred_foods_input}
                    onChange={(e) => setGoals((g) => ({ ...g, preferred_foods_input: e.target.value }))}
                    placeholder="e.g. chicken, eggs, fruit, rice"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Foods to avoid</Label>
                  <Input
                    value={goals.avoided_foods_input}
                    onChange={(e) => setGoals((g) => ({ ...g, avoided_foods_input: e.target.value }))}
                    placeholder="e.g. shellfish, mushrooms, peanuts"
                  />
                </div>
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
                    { label: 'Calories (kcal)', key: 'calorie_target' },
                    { label: 'Protein (g)', key: 'protein_target_g' },
                    { label: 'Carbs (g)', key: 'carb_target_g' },
                    { label: 'Fat (g)', key: 'fat_target_g' },
                  ].map((field) => (
                    <div key={field.key} className="space-y-1.5">
                      <Label className="text-xs">{field.label}</Label>
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
              <CardDescription>Configure your reminder preferences and how they get delivered</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Email reminders</p>
                    <p className="text-xs text-muted-foreground">
                      Send the same reminder flow to your account email address.
                    </p>
                  </div>
                  <Badge variant={emailEnabled ? 'success' : 'outline'}>
                    {emailEnabled ? 'Enabled' : 'Off'}
                  </Badge>
                </div>

                <div className="space-y-1.5">
                  <Label>Email address</Label>
                  <Input value={user.email} disabled />
                </div>

                <button
                  type="button"
                  aria-pressed={emailEnabled}
                  onClick={() => setEmailEnabled((value) => !value)}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition-colors ${
                    emailEnabled ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-border/60 bg-background'
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium">Email me reminders</p>
                    <p className="text-xs text-muted-foreground">
                      Receive transactional fitness reminders and weekly updates by email.
                    </p>
                  </div>
                  <div className={`h-5 w-10 rounded-full transition-colors ${emailEnabled ? 'bg-emerald-500' : 'bg-muted'}`}>
                    <div className={`mt-0.5 h-4 w-4 rounded-full bg-white transition-transform ${emailEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                </button>

                <div className="flex flex-wrap gap-2">
                  <Button variant="brand" size="sm" onClick={handleSaveEmailSettings} disabled={emailLoading}>
                    Save Email
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleSendTestEmail} disabled={emailLoading || !emailEnabled}>
                    Send Test Email
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">SMS reminders</p>
                    <p className="text-xs text-muted-foreground">
                      Send due reminders by text message. Use international format like +15551234567.
                    </p>
                  </div>
                  <Badge variant={smsEnabled ? 'success' : 'outline'}>
                    {smsEnabled ? 'Enabled' : 'Off'}
                  </Badge>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sms-phone">Phone number</Label>
                  <Input
                    id="sms-phone"
                    value={smsPhone}
                    onChange={(event) => setSmsPhone(event.target.value)}
                    placeholder="+15551234567"
                  />
                </div>

                <button
                  type="button"
                  aria-pressed={smsEnabled}
                  onClick={() => setSmsEnabled((value) => !value)}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition-colors ${
                    smsEnabled ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-border/60 bg-background'
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium">Text me reminders</p>
                    <p className="text-xs text-muted-foreground">
                      By enabling this, you are opting in to receive transactional fitness reminder texts from Rivora.
                    </p>
                  </div>
                  <div className={`h-5 w-10 rounded-full transition-colors ${smsEnabled ? 'bg-emerald-500' : 'bg-muted'}`}>
                    <div className={`mt-0.5 h-4 w-4 rounded-full bg-white transition-transform ${smsEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                </button>

                <div className="flex flex-wrap gap-2">
                  <Button variant="brand" size="sm" onClick={handleSaveSmsSettings} disabled={smsLoading}>
                    Save SMS
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleSendTestSms} disabled={smsLoading || !smsEnabled || !smsPhone.trim()}>
                    Send Test SMS
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Device notifications</p>
                    <p className="text-xs text-muted-foreground">
                      {pushSupported
                        ? pushEnabled
                          ? 'This browser is subscribed for push notifications.'
                          : pushPermission === 'denied'
                            ? 'Notifications are blocked in this browser. Re-enable them in browser settings to subscribe.'
                            : 'Enable push notifications so reminders can reach the device outside the app.'
                        : 'Push notifications are not supported in this browser.'}
                    </p>
                  </div>
                  <Badge variant={pushEnabled ? 'success' : 'outline'}>
                    {pushSupported ? (pushEnabled ? 'Enabled' : pushPermission === 'denied' ? 'Blocked' : 'Off') : 'Unsupported'}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-2">
                  {pushEnabled ? (
                    <>
                      <Button variant="outline" size="sm" onClick={handleDisablePush} disabled={pushLoading}>
                        Turn Off
                      </Button>
                      <Button variant="brand" size="sm" onClick={handleSendTestPush} disabled={pushLoading}>
                        Send Test
                      </Button>
                    </>
                  ) : (
                    <Button variant="brand" size="sm" onClick={handleEnablePush} disabled={pushLoading || !pushSupported}>
                      Enable Push
                    </Button>
                  )}
                </div>
              </div>

              {[
                { key: 'daily_workout_reminder', label: 'Daily workout reminder', sub: 'Get reminded when today still has no workout logged' },
                { key: 'meal_logging_reminder', label: 'Meal logging reminder', sub: 'Prompt you when today has no meals logged yet' },
                { key: 'weekly_progress_summary', label: 'Weekly progress summary', sub: 'Show a weekly snapshot based on workouts, meals, and streaks' },
                { key: 'goal_milestone_alerts', label: 'Goal milestone alerts', sub: 'Surface streak milestones and major goal progress updates' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.sub}</p>
                  </div>
                  <button
                    type="button"
                    aria-pressed={notificationPreferences[item.key as NotificationPreferenceKey]}
                    className={`w-10 h-5 rounded-full transition-colors ${notificationPreferences[item.key as NotificationPreferenceKey] ? 'bg-emerald-500' : 'bg-muted'}`}
                    onClick={() => handleToggleNotification(item.key as NotificationPreferenceKey)}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white mt-0.5 transition-transform duration-200 ${notificationPreferences[item.key as NotificationPreferenceKey] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
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
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-destructive/20 bg-background/50 p-4 text-sm">
                <p className="font-medium text-foreground">Delete account and personal data</p>
                <p className="mt-1 text-muted-foreground">
                  This removes your Rivora account, profile, logs, and connected app data. Export your data first if you want a copy.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handleExportJSON}>
                  Export JSON First
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Account & All Data
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Privacy, Terms, and Support</CardTitle>
              <CardDescription>Links reviewers and users expect to find in a production app</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Link href="/privacy" className="rounded-xl border border-border/60 bg-muted/20 p-4 transition-colors hover:border-border hover:bg-muted/30">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                      <Shield className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Privacy Policy</p>
                      <p className="mt-1 text-xs text-muted-foreground">Review how Rivora stores and uses account, workout, and meal data.</p>
                    </div>
                  </div>
                </Link>

                <Link href="/terms" className="rounded-xl border border-border/60 bg-muted/20 p-4 transition-colors hover:border-border hover:bg-muted/30">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/10 text-blue-400">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Terms of Service</p>
                      <p className="mt-1 text-xs text-muted-foreground">See the account, billing, and platform rules that apply to Rivora.</p>
                    </div>
                  </div>
                </Link>
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <p className="text-sm font-semibold">Need help?</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href="mailto:support@rivorafit.com"
                    className="inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    support@rivorafit.com
                  </a>
                  <a
                    href="mailto:privacy@rivorafit.com"
                    className="inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    privacy@rivorafit.com
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Friends tab */}
        <TabsContent value="friends" className="mt-4 space-y-4">
          <FriendsTab />
        </TabsContent>
      </Tabs>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Account</DialogTitle>
            <DialogDescription>
              This permanently removes your Rivora account and associated data. Type <span className="font-semibold text-foreground">DELETE</span> to confirm.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-muted-foreground">
              Your profile, meal logs, workout logs, journal entries, reminders, and connected app data will be removed. This cannot be undone.
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="delete-confirmation">Type DELETE</Label>
              <Input
                id="delete-confirmation"
                value={deleteConfirmText}
                onChange={(event) => setDeleteConfirmText(event.target.value)}
                placeholder="DELETE"
                autoCapitalize="characters"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleExportJSON}>
                Export My Data First
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={deleteLoading || deleteConfirmText.trim().toUpperCase() !== 'DELETE'}
              >
                Delete Permanently
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Friends Tab ──────────────────────────────────────────────────────────────

type FriendRow = {
  id: string
  requester_id: string
  addressee_id: string
  invited_email?: string
  status: 'pending' | 'accepted' | 'declined' | 'invited'
  other_user: { id: string; name: string; username?: string } | null
}

import { createClient } from '@/lib/supabase'

async function getAuthToken(): Promise<string | null> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

function FriendsTab() {
  const user = useAppStore((s) => s.user)
  const [friends, setFriends] = useState<FriendRow[]>([])
  const [loading, setLoading] = useState(true)
  const [addQuery, setAddQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; username?: string }[]>([])
  const [searching, setSearching] = useState(false)
  const [sending, setSending] = useState(false)

  const loadFriends = React.useCallback(async () => {
    const token = await getAuthToken()
    if (!token) { setLoading(false); return }
    const res = await fetch('/api/friends', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
    if (res.ok) setFriends(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { loadFriends() }, [loadFriends])

  useEffect(() => {
    if (!addQuery.trim()) { setSearchResults([]); return }
    const id = setTimeout(async () => {
      setSearching(true)
      const token = await getAuthToken()
      if (!token) { setSearching(false); return }
      const res = await fetch(`/api/friends/search?q=${encodeURIComponent(addQuery.trim())}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setSearchResults(await res.json())
      setSearching(false)
    }, 350)
    return () => clearTimeout(id)
  }, [addQuery])

  async function sendRequest(addresseeId?: string, email?: string) {
    setSending(true)
    const token = await getAuthToken()
    if (!token) { setSending(false); return }
    const body = addresseeId ? { addressee_id: addresseeId } : { email }
    const res = await fetch('/api/friends/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error === 'Request already exists' ? 'Request already sent.' : data.error ?? 'Could not send request.')
    } else {
      toast.success(data.type === 'invite_sent' ? `Invite sent to ${email}!` : 'Friend request sent!')
      setAddQuery('')
      setSearchResults([])
      await loadFriends()
    }
    setSending(false)
  }

  async function respond(friendshipId: string, action: 'accept' | 'decline') {
    const token = await getAuthToken()
    if (!token) return
    await fetch('/api/friends/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ friendship_id: friendshipId, action }),
    })
    toast.success(action === 'accept' ? 'Friend request accepted!' : 'Request declined.')
    await loadFriends()
  }

  async function removeFriend(friendshipId: string) {
    const token = await getAuthToken()
    if (!token) return
    await fetch(`/api/friends/${friendshipId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    toast.success('Removed.')
    await loadFriends()
  }

  const accepted = friends.filter((f) => f.status === 'accepted')
  const incomingPending = friends.filter((f) => f.status === 'pending' && f.addressee_id === user?.id)
  const outgoing = friends.filter((f) => (f.status === 'pending' || f.status === 'invited') && f.requester_id === user?.id)

  return (
    <div className="space-y-4">
      {/* Add friend */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><UserPlus className="w-4 h-4" />Add Friend</CardTitle>
          <CardDescription>Search by username (@handle) or email address</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="@username or email"
                value={addQuery}
                onChange={(e) => setAddQuery(e.target.value)}
                className="pl-8"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && addQuery.includes('@') && searchResults.length === 0 && !searching) {
                    sendRequest(undefined, addQuery.trim())
                  }
                }}
              />
            </div>
            {addQuery.includes('@') && !addQuery.startsWith('@') && searchResults.length === 0 && !searching && (
              <Button size="sm" className="self-stretch sm:self-auto" disabled={sending} onClick={() => sendRequest(undefined, addQuery.trim())}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Invite'}
              </Button>
            )}
          </div>
          {searching && <p className="text-xs text-muted-foreground">Searching…</p>}
          {searchResults.length > 0 && (
            <div className="space-y-1">
              {searchResults.map((r) => (
                <div key={r.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-border/50 bg-muted/20">
                  <span className="flex-1 text-sm font-medium truncate">{r.name}</span>
                  {r.username && <span className="text-xs text-muted-foreground">@{r.username}</span>}
                  <Button size="sm" className="h-7 px-2.5 text-xs" disabled={sending} onClick={() => sendRequest(r.id)}>
                    {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending received */}
      {incomingPending.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><UserCheck className="w-4 h-4" />Pending Requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {incomingPending.map((f) => (
              <div key={f.id} className="flex items-center gap-2">
                <span className="flex-1 text-sm truncate">{f.other_user?.name ?? 'Someone'}</span>
                <Button size="sm" className="h-7 px-2.5 text-xs" onClick={() => respond(f.id, 'accept')}>Accept</Button>
                <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={() => respond(f.id, 'decline')}>Decline</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Accepted friends */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" />Friends {accepted.length > 0 && <Badge variant="secondary">{accepted.length}</Badge>}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
          ) : accepted.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No friends yet. Add someone above!</p>
          ) : (
            <div className="space-y-2">
              {accepted.map((f) => (
                <div key={f.id} className="flex items-center gap-2">
                  <span className="flex-1 text-sm font-medium truncate">{f.other_user?.name}</span>
                  {f.other_user?.username && <span className="text-xs text-muted-foreground">@{f.other_user.username}</span>}
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeFriend(f.id)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Outgoing */}
      {outgoing.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><UserX className="w-4 h-4" />Sent Requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {outgoing.map((f) => (
              <div key={f.id} className="flex items-center gap-2">
                <span className="flex-1 text-sm truncate">
                  {f.other_user?.name ?? f.invited_email ?? 'Pending'}
                </span>
                <Badge variant="outline" className="text-[10px]">{f.status === 'invited' ? 'Invited' : 'Pending'}</Badge>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeFriend(f.id)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
