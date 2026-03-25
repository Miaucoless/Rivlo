import { NextResponse } from 'next/server'
import type { NotificationPreferences, SupplementEntry } from '@/types'
import { createAdminClient } from '@/lib/server-supabase'
import { buildReminderCandidates, getReminderDates } from '@/lib/push-reminders'
import { sendPushMessage, type StoredPushSubscription } from '@/lib/server-push'

export const runtime = 'nodejs'

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  daily_workout_reminder: true,
  meal_logging_reminder: true,
  weekly_progress_summary: false,
  goal_milestone_alerts: true,
}

function getCronSecret(request: Request) {
  const authHeader = request.headers.get('authorization')
  return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
}

function normalizeNotificationPreferences(value: unknown): NotificationPreferences {
  if (!value || typeof value !== 'object') return DEFAULT_NOTIFICATION_PREFERENCES

  const prefs = value as Partial<NotificationPreferences>
  return {
    daily_workout_reminder: prefs.daily_workout_reminder ?? DEFAULT_NOTIFICATION_PREFERENCES.daily_workout_reminder,
    meal_logging_reminder: prefs.meal_logging_reminder ?? DEFAULT_NOTIFICATION_PREFERENCES.meal_logging_reminder,
    weekly_progress_summary: prefs.weekly_progress_summary ?? DEFAULT_NOTIFICATION_PREFERENCES.weekly_progress_summary,
    goal_milestone_alerts: prefs.goal_milestone_alerts ?? DEFAULT_NOTIFICATION_PREFERENCES.goal_milestone_alerts,
  }
}

function normalizeSupplements(value: unknown) {
  return Array.isArray(value) ? (value as SupplementEntry[]) : []
}

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    return NextResponse.json({ error: 'Missing CRON_SECRET.' }, { status: 500 })
  }

  if (getCronSecret(request) !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized cron request.' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { todayIso, currentWeekStart, weekday } = getReminderDates()

  const { data: subscriptions, error: subscriptionError } = await admin
    .from('push_subscriptions')
    .select('id, user_id, endpoint, subscription')

  if (subscriptionError) {
    return NextResponse.json({ error: subscriptionError.message }, { status: 500 })
  }

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ success: true, sent: 0, skipped: 0, users: 0 })
  }

  const subscriptionsByUser = subscriptions.reduce<Record<string, StoredPushSubscription[]>>((acc, row) => {
    if (!acc[row.user_id]) acc[row.user_id] = []
    acc[row.user_id].push(row as StoredPushSubscription)
    return acc
  }, {})

  const userIds = Object.keys(subscriptionsByUser)
  const { data: profiles, error: profileError } = await admin
    .from('profiles')
    .select('id, name, preferred_workout_time, goal_target_change_kg, notification_preferences')
    .in('id', userIds)

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  let sent = 0
  let skipped = 0

  for (const profile of profiles ?? []) {
    const [mealsTodayResult, mealsWeekResult, workoutTodayResult, workoutsWeekResult, weightsResult, appStateResult] = await Promise.all([
      admin.from('meal_entries').select('date').eq('user_id', profile.id).eq('date', todayIso),
      admin.from('meal_entries').select('date').eq('user_id', profile.id).gte('date', currentWeekStart),
      admin.from('workout_logs').select('date').eq('user_id', profile.id).eq('date', todayIso),
      admin.from('workout_logs').select('date').eq('user_id', profile.id).gte('date', currentWeekStart),
      admin.from('weight_entries').select('date, weight_kg').eq('user_id', profile.id).order('date', { ascending: true }),
      admin.from('user_app_state').select('supplements').eq('user_id', profile.id).maybeSingle(),
    ])

    const mealDatesThisWeek = new Set((mealsWeekResult.data ?? []).map((row) => row.date))
    const supplements = normalizeSupplements(appStateResult.data?.supplements)
    const dueSupplements = supplements
      .filter((supplement) => !supplement.archived && supplement.notification_enabled)
      .filter((supplement) => !Array.isArray(supplement.taken_dates) || !supplement.taken_dates.includes(todayIso))

    const weights = weightsResult.data ?? []
    const firstWeight = weights[0]
    const latestWeight = weights[weights.length - 1]
    const goalTargetChangeKg = profile.goal_target_change_kg ? Math.abs(Number(profile.goal_target_change_kg)) : null
    const achievedChangeKg = firstWeight && latestWeight
      ? Math.abs(Number(latestWeight.weight_kg) - Number(firstWeight.weight_kg))
      : null

    const reminders = buildReminderCandidates({
      firstName: profile.name?.split(' ')[0] || 'there',
      preferredWorkoutTime: profile.preferred_workout_time,
      notificationPreferences: normalizeNotificationPreferences(profile.notification_preferences),
      todayIso,
      currentWeekStart,
      weekday,
      workoutLoggedToday: (workoutTodayResult.data?.length ?? 0) > 0,
      mealsLoggedToday: mealsTodayResult.data?.length ?? 0,
      workoutsThisWeek: workoutsWeekResult.data?.length ?? 0,
      mealDaysThisWeek: mealDatesThisWeek.size,
      supplementsDueToday: dueSupplements,
      goalTargetChangeKg,
      achievedChangeKg,
      latestWeightDate: latestWeight?.date ?? null,
    })

    for (const reminder of reminders) {
      const { error: deliveryError } = await admin
        .from('push_notification_deliveries')
        .insert({
          user_id: profile.id,
          kind: reminder.kind,
          dedupe_key: reminder.dedupeKey,
          payload: reminder,
        })

      if (deliveryError) {
        skipped += 1
        continue
      }

      const results = await Promise.all(
        (subscriptionsByUser[profile.id] || []).map((subscription) =>
          sendPushMessage(subscription, {
            title: reminder.title,
            body: reminder.body,
            actionUrl: reminder.actionUrl,
            tag: `${reminder.kind}-${reminder.dedupeKey}`,
          })
        )
      )

      sent += results.filter((result) => result.ok).length
    }
  }

  return NextResponse.json({
    success: true,
    sent,
    skipped,
    users: userIds.length,
  })
}
