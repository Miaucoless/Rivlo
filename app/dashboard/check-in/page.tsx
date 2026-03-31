'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  CalendarRange,
  Droplets,
  Dumbbell,
  Share2,
  Sparkles,
  Target,
  TrendingUp,
  Utensils,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ShareModal } from '@/components/sharing/ShareModal'
import { buildWeeklyReview, getWeeklySharePayload } from '@/lib/weekly-review'
import { formatWeightDelta } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'

const STATUS_STYLES = {
  winning: {
    label: 'Winning week',
    badgeClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    panelClass: 'border-emerald-500/20 bg-emerald-500/[0.08]',
  },
  steady: {
    label: 'Steady week',
    badgeClass: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
    panelClass: 'border-sky-500/20 bg-sky-500/[0.08]',
  },
  needs_attention: {
    label: 'Reset week',
    badgeClass: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    panelClass: 'border-amber-500/20 bg-amber-500/[0.08]',
  },
} as const

function getRecoveryHref(type: string) {
  switch (type) {
    case 'shift_workouts':
      return '/dashboard/workouts?recovery=shift'
    case 'simplify_meals':
      return '/dashboard/meals?recovery=simplify'
    case 'lighter_targets':
      return '/dashboard/tracking?recovery=lighter'
    case 'focused_reminders':
      return '/dashboard/settings?tab=notifications'
    default:
      return '/dashboard/dashboard'
  }
}

export default function CheckInPage() {
  const router = useRouter()
  const [shareOpen, setShareOpen] = useState(false)
  const {
    user,
    workoutLogs,
    mealEntries,
    waterLogs,
    weightHistory,
    journalEntries,
    supplements,
    notificationPreferences,
  } = useAppStore()

  if (!user) return null

  const review = buildWeeklyReview({
    user,
    workoutLogs,
    mealEntries,
    waterLogs,
    weightHistory,
    journalEntries,
    supplements,
    notificationPreferences,
  })

  const status = STATUS_STYLES[review.status]
  const sharePayload = getWeeklySharePayload(review)
  const itemName = `Weekly recap · ${review.week_label}`

  const summaryCards = [
    {
      label: 'Workouts',
      value: `${review.summary.workouts_completed}/${review.summary.target_workout_days}`,
      subtext: 'planned days completed',
      icon: Dumbbell,
      iconClass: 'bg-emerald-500/10 text-emerald-300',
    },
    {
      label: 'Protein days',
      value: `${review.summary.protein_hit_days}/${review.days.length}`,
      subtext: 'days you hit target',
      icon: Utensils,
      iconClass: 'bg-sky-500/10 text-sky-300',
    },
    {
      label: 'Hydration days',
      value: `${review.summary.hydration_hit_days}/${review.days.length}`,
      subtext: 'days you hit water goal',
      icon: Droplets,
      iconClass: 'bg-cyan-500/10 text-cyan-300',
    },
    {
      label: 'Weight trend',
      value: typeof review.summary.weight_delta_kg === 'number'
        ? formatWeightDelta(review.summary.weight_delta_kg, user.unit_system, 1)
        : 'No change',
      subtext: review.summary.weight_trend === 'insufficient_data'
        ? 'not enough weigh-ins'
        : review.summary.weight_trend.replace('_', ' '),
      icon: TrendingUp,
      iconClass: 'bg-amber-500/10 text-amber-300',
    },
  ]

  return (
    <>
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-4"
        >
          <div className={`rounded-3xl border p-5 sm:p-6 ${status.panelClass}`}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={status.badgeClass}>
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    {status.label}
                  </Badge>
                  <Badge variant="outline" className="border-border/60 bg-background/60 text-xs">
                    <CalendarRange className="mr-1.5 h-3.5 w-3.5" />
                    {review.week_label}
                  </Badge>
                </div>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Weekly Check-In</h2>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                    Your week is strongest when workouts, meals, recovery, and reflection all point in the same direction.
                    This check-in turns that data into one clean next move.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="gap-2" onClick={() => router.push('/dashboard/dashboard')}>
                  Back to dashboard
                </Button>
                <Button variant="brand" className="gap-2" onClick={() => setShareOpen(true)}>
                  <Share2 className="h-4 w-4" />
                  Share recap
                </Button>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-border/60 bg-background/80 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Target className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Main adjustment</p>
                  <h3 className="text-lg font-semibold">{review.recommendation.title}</h3>
                  <p className="text-sm text-muted-foreground">{review.recommendation.detail}</p>
                  <p className="text-xs text-muted-foreground/80">{review.recommendation.reason}</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => {
            const Icon = card.icon
            return (
              <Card key={card.label} className="hover-lift">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{card.label}</p>
                      <p className="mt-3 text-2xl font-bold tabular-nums">{card.value}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{card.subtext}</p>
                    </div>
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${card.iconClass}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">What helped this week</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {review.wins.length > 0 ? review.wins.map((insight) => (
                <div key={insight.id} className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{insight.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{insight.detail}</p>
                    </div>
                    {insight.metric_value ? (
                      <Badge variant="outline" className="border-emerald-500/20 bg-background/70 font-data text-xs">
                        {insight.metric_value}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                  Not enough strong signals yet. Once the week has more logged activity, your check-in will call out what is clearly working.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">What needs attention</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {review.focus_areas.length > 0 ? review.focus_areas.map((insight) => (
                <div key={insight.id} className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{insight.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{insight.detail}</p>
                    </div>
                    {insight.metric_value ? (
                      <Badge variant="outline" className="border-amber-500/20 bg-background/70 font-data text-xs">
                        {insight.metric_value}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                  No major warning signs this week. The best move is to keep the plan stable and repeat what worked.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recovery actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {review.recovery_actions.length > 0 ? review.recovery_actions.map((action) => (
              <div key={action.id} className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-muted/20 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{action.title}</p>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-[0.18em]">
                      {action.priority}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{action.description}</p>
                  <p className="mt-2 text-xs text-muted-foreground/80">{action.reason}</p>
                </div>

                <Button
                  variant="outline"
                  className="gap-2 self-start lg:self-auto"
                  onClick={() => router.push(getRecoveryHref(action.type))}
                >
                  {action.cta_label}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )) : (
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                You do not need a reset plan this week. Keep your targets steady and review again after a few more days of training and logging.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Shareable recap</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1.5">
              <p className="text-sm font-medium">{sharePayload.headline}</p>
              <p className="text-sm text-muted-foreground">{sharePayload.highlight}</p>
              <p className="text-xs text-muted-foreground/80">{sharePayload.recommendation}</p>
            </div>
            <Button variant="brand" className="gap-2 self-start lg:self-auto" onClick={() => setShareOpen(true)}>
              <Share2 className="h-4 w-4" />
              Share this week
            </Button>
          </CardContent>
        </Card>
      </div>

      <ShareModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        itemType="weekly_recap"
        itemName={itemName}
        itemData={sharePayload as unknown as Record<string, unknown>}
      />
    </>
  )
}
