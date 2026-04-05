'use client'

import { useMemo, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Apple, Bookmark, ChevronLeft, ChevronRight, Dumbbell, Heart, MessageCircle, Pill, Send, Share2, Trash2 } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ShareModal } from '@/components/sharing/ShareModal'
import type { SocialPost, SocialPostComment, UnitSystem } from '@/types'
import { formatCompactNumber } from '@/lib/social-feed'
import { buildSocialProfileHref } from '@/lib/social-connections'
import { formatWeightValue } from '@/lib/utils'
import { cn } from '@/lib/utils'

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
      {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
    </div>
  )
}

function formatExerciseLoad(weightKg: number | undefined, unitSystem: UnitSystem) {
  if (weightKg == null) return 'Bodyweight'
  return formatWeightValue(weightKg, unitSystem, 0)
}

function formatLoggedTimeRange(startedAt?: string, completedAt?: string) {
  const formatTime = (value?: string) => {
    if (!value) return null
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }

  const start = formatTime(startedAt)
  const end = formatTime(completedAt)
  if (start && end) return `${start} - ${end}`
  return start || end || null
}

export function SocialPostDetailDialog({
  post,
  open,
  saved,
  liked,
  comments,
  unitSystem,
  readOnly = false,
  canDelete = false,
  onOpenChange,
  onToggleSave,
  onToggleLike,
  onAddComment,
  onUse,
  onDelete,
}: {
  post: SocialPost | null
  open: boolean
  saved: boolean
  liked: boolean
  comments: SocialPostComment[]
  unitSystem: UnitSystem
  readOnly?: boolean
  canDelete?: boolean
  onOpenChange: (open: boolean) => void
  onToggleSave: () => void
  onToggleLike: () => void
  onAddComment: (body: string) => void
  onUse: () => void
  onDelete?: () => void
}) {
  const [shareOpen, setShareOpen] = useState(false)
  const [mediaIndex, setMediaIndex] = useState(0)
  const [commentInput, setCommentInput] = useState('')
  const router = useRouter()

  const mediaItems = useMemo(() => {
    if (post?.media && post.media.length > 0) return post.media
    if (post?.image) return [{ kind: 'image' as const, url: post.image }]
    return []
  }, [post?.media, post?.image])

  useEffect(() => {
    setMediaIndex(0)
  }, [post?.id])

  useEffect(() => {
    if (!open) setCommentInput('')
  }, [open])

  if (!post) return null

  const currentMedia = mediaItems[mediaIndex]
  const hasMultipleMedia = mediaItems.length > 1

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="!left-1/2 !top-auto !bottom-0 !h-[92dvh] !w-[calc(100vw-0.5rem)] !max-w-5xl !translate-x-[-50%] !translate-y-0 overflow-hidden rounded-t-[1.75rem] border-border/80 p-0 sm:!top-1/2 sm:!bottom-auto sm:!h-[90dvh] sm:!max-h-[90dvh] sm:!w-[calc(100vw-2rem)] sm:!translate-y-[-50%] sm:rounded-[1.75rem]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
          className="flex h-full min-h-0 max-h-[92dvh] flex-col overflow-hidden sm:max-h-[90dvh]"
        >
          <div className="flex justify-center py-2 sm:hidden">
            <span className="h-1.5 w-12 rounded-full bg-border/80" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
            {mediaItems.length > 0 ? (
              <div className="relative h-64 w-full overflow-hidden bg-black sm:h-80">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={mediaIndex}
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
                    className="h-full w-full"
                  >
                    {currentMedia.kind === 'video' ? (
                      <video
                        src={currentMedia.url}
                        className="h-full w-full object-cover"
                        controls
                        playsInline
                      />
                    ) : (
                      <div
                        className="h-full w-full bg-cover bg-center"
                        style={{ backgroundImage: `linear-gradient(180deg, rgba(15,23,42,0.06), rgba(15,23,42,0.28)), url("${currentMedia.url}")` }}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>

                {hasMultipleMedia ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setMediaIndex((i) => Math.max(0, i - 1))}
                      disabled={mediaIndex === 0}
                      className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-opacity disabled:opacity-30"
                      aria-label="Previous"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setMediaIndex((i) => Math.min(mediaItems.length - 1, i + 1))}
                      disabled={mediaIndex === mediaItems.length - 1}
                      className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-opacity disabled:opacity-30"
                      aria-label="Next"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {mediaItems.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setMediaIndex(i)}
                          className={`h-1.5 rounded-full transition-all ${i === mediaIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`}
                          aria-label={`Go to media ${i + 1}`}
                        />
                      ))}
                    </div>
                    <div className="absolute right-3 top-3 rounded-full bg-black/55 px-2 py-1 text-[11px] font-medium text-white">
                      {mediaIndex + 1} / {mediaItems.length}
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}

            <div className={`space-y-8 p-4 sm:p-6 ${mediaItems.length > 0 ? '' : 'pt-6 sm:pt-7'}`}>
              <section className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="max-w-3xl">
                    <button
                      type="button"
                      onClick={() => {
                        onOpenChange(false)
                        router.push(buildSocialProfileHref(post.user))
                      }}
                      className="flex items-center gap-3 rounded-2xl transition-opacity hover:opacity-85"
                    >
                      <div
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground',
                          post.user.avatar_url ? 'bg-cover bg-center bg-no-repeat' : ''
                        )}
                        style={post.user.avatar_url ? { backgroundImage: `url(${post.user.avatar_url})` } : undefined}
                      >
                        {!post.user.avatar_url ? post.user.name.charAt(0).toUpperCase() : null}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-foreground">@{post.user.username}</p>
                        <p className="text-xs text-muted-foreground">{post.user.name}</p>
                      </div>
                    </button>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{post.title}</h2>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">{post.caption}</p>
                    {post.taggedUsers && post.taggedUsers.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {post.taggedUsers.map((taggedUser) => (
                          <button
                            key={taggedUser.id}
                            type="button"
                            onClick={() => {
                              onOpenChange(false)
                              router.push(buildSocialProfileHref(taggedUser))
                            }}
                            className="rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                          >
                            @{taggedUser.username}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {readOnly ? null : (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={onToggleLike}
                        className={cn(
                          'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                          liked
                            ? 'border-rose-500/25 bg-rose-500/10 text-rose-400'
                            : 'border-border/70 bg-background text-muted-foreground hover:text-foreground'
                        )}
                      >
                        <Heart className={cn('h-4 w-4', liked ? 'fill-current' : '')} />
                        Like
                      </button>
                      <button
                        type="button"
                        onClick={onToggleSave}
                        className={cn(
                          'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                          saved
                            ? 'border-primary/20 bg-primary/10 text-primary'
                            : 'border-border/70 bg-background text-muted-foreground hover:text-foreground'
                        )}
                      >
                        <Bookmark className={cn('h-4 w-4', saved ? 'fill-current' : '')} />
                        Save
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-4">
                  {[
                    { label: 'Completed', value: formatCompactNumber(post.stats.completed) },
                    { label: 'Used', value: formatCompactNumber(post.stats.used) },
                    { label: 'Saved', value: formatCompactNumber(post.stats.saved) },
                    { label: 'Remixed', value: formatCompactNumber(post.stats.remixed) },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-2xl border border-border/70 bg-muted/15 px-4 py-3">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{stat.label}</p>
                      <p className="mt-1 text-lg font-semibold">{stat.value}</p>
                    </div>
                  ))}
                </div>
              </section>

              {post.type === 'meal' ? (
                <section className="space-y-6">
                  <SectionHeading title="Nutrition" subtitle="Structured nutrition only appears when the creator included it." />
                  {post.mealData ? (
                    <>
                      <div className="grid gap-3 sm:grid-cols-5">
                        {[
                          { label: 'Calories', value: `${post.mealData.calories}` },
                          { label: 'Protein', value: `${post.mealData.protein}g` },
                          { label: 'Carbs', value: `${post.mealData.carbs}g` },
                          { label: 'Fat', value: `${post.mealData.fat}g` },
                          { label: 'Serving', value: post.mealData.serving_size || `${post.mealData.servings} servings` },
                        ].map((stat) => (
                          <div key={stat.label} className="rounded-2xl border border-border/70 bg-muted/15 px-4 py-3">
                            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{stat.label}</p>
                            <p className="mt-1 text-sm font-semibold">{stat.value}</p>
                          </div>
                        ))}
                      </div>

                      <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
                        <div className="space-y-3">
                          <SectionHeading title="Ingredients" />
                          <div className="rounded-3xl border border-border/70 bg-background/70 p-4">
                            <div className="space-y-3">
                              {post.mealData.ingredients.map((ingredient) => (
                                <div key={`${ingredient.name}-${ingredient.amount}-${ingredient.unit}`} className="flex items-center justify-between gap-4 border-b border-border/50 pb-3 last:border-b-0 last:pb-0">
                                  <p className="text-sm font-medium text-foreground">{ingredient.name}</p>
                                  <p className="text-sm text-muted-foreground">{ingredient.amount} {ingredient.unit}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <SectionHeading title="Instructions" />
                          <div className="rounded-3xl border border-border/70 bg-background/70 p-4">
                            <ol className="space-y-3">
                              {post.mealData.instructions.map((step, index) => (
                                <li key={`${post.id}-step-${index}`} className="flex gap-3">
                                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                                    {index + 1}
                                  </span>
                                  <p className="pt-0.5 text-sm leading-6 text-muted-foreground">{step}</p>
                                </li>
                              ))}
                            </ol>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-3xl border border-dashed border-border/70 bg-muted/10 px-5 py-8 text-sm text-muted-foreground">
                      This post is inspiration-first. Use Remix to turn it into a structured meal you can save or plan.
                    </div>
                  )}
                </section>
              ) : post.type === 'workout' ? (
                <section className="space-y-6">
                  <SectionHeading title="Workout Overview" subtitle="Structured routines appear here when the creator shares the full lift list." />
                  {post.workoutData ? (
                    <>
                      <div className="grid gap-3 sm:grid-cols-4">
                        <div className="rounded-2xl border border-border/70 bg-muted/15 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Duration</p>
                          <p className="mt-1 text-sm font-semibold">{post.workoutData.duration} min</p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-muted/15 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Level</p>
                          <p className="mt-1 text-sm font-semibold">{post.workoutData.level}</p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-muted/15 px-4 py-3 sm:col-span-2">
                          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Equipment</p>
                          <p className="mt-1 text-sm font-semibold">{post.workoutData.equipment.join(' • ') || 'Bodyweight'}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {post.workoutData.focus.map((focus) => (
                          <Badge key={focus} variant="outline" className="rounded-full px-3 py-1 text-[11px] capitalize">
                            {focus}
                          </Badge>
                        ))}
                      </div>

                      <div className="space-y-3">
                        <SectionHeading title="Workout List" />
                        <div className="space-y-3">
                          {post.workoutData.exercises.map((exercise) => (
                            <div key={`${post.id}-${exercise.name}`} className="rounded-3xl border border-border/70 bg-background/70 p-4">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <p className="text-sm font-semibold text-foreground">{exercise.name}</p>
                                  {exercise.notes ? <p className="mt-1 text-sm text-muted-foreground">{exercise.notes}</p> : null}
                                </div>
                                <div className="grid grid-cols-2 gap-2 sm:min-w-[14rem]">
                                  <div className="rounded-2xl border border-border/70 bg-muted/20 px-3 py-2">
                                    <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Sets × reps</p>
                                    <p className="mt-1 text-sm font-semibold">{exercise.sets} × {exercise.reps}</p>
                                  </div>
                                  <div className="rounded-2xl border border-border/70 bg-muted/20 px-3 py-2">
                                    <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Load</p>
                                    <p className="mt-1 text-sm font-semibold">
                                      {formatExerciseLoad(exercise.weight, unitSystem)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              <p className="mt-3 text-xs text-muted-foreground">Rest {exercise.rest ?? 75}s</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {post.workoutData.notes ? (
                        <div className="rounded-3xl border border-border/70 bg-muted/10 p-4">
                          <SectionHeading title="Notes" />
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">{post.workoutData.notes}</p>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="rounded-3xl border border-dashed border-border/70 bg-muted/10 px-5 py-8 text-sm text-muted-foreground">
                      This post is more concept than template right now. Remix it to turn it into a workout you can actually run.
                    </div>
                  )}
                </section>
              ) : post.type === 'day' ? (
                <section className="space-y-6">
                  <SectionHeading title="Day Snapshot" subtitle="This post captures what was actually logged that day, including meals, workouts, and supplements." />

                  {post.dayData ? (
                    <>
                      <div className="grid gap-3 sm:grid-cols-4">
                        <div className="rounded-2xl border border-border/70 bg-muted/15 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Date</p>
                          <p className="mt-1 text-sm font-semibold">{post.dayData.date}</p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-muted/15 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Meals</p>
                          <p className="mt-1 text-sm font-semibold">{post.dayData.meals.length}</p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-muted/15 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Workouts</p>
                          <p className="mt-1 text-sm font-semibold">{post.dayData.workouts.length}</p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-muted/15 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Supplements</p>
                          <p className="mt-1 text-sm font-semibold">{post.dayData.supplements.length}</p>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-border/70 bg-muted/15 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Calories</p>
                          <p className="mt-1 text-lg font-semibold">{post.dayData.totalCalories}</p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-muted/15 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Protein</p>
                          <p className="mt-1 text-lg font-semibold">{post.dayData.totalProtein}g</p>
                        </div>
                      </div>

                      {post.dayData.meals.length > 0 ? (
                        <div className="space-y-3">
                          <SectionHeading title="Meals" />
                          <div className="space-y-3">
                            {post.dayData.meals.map((meal) => (
                              <div key={meal.id} className="rounded-3xl border border-border/70 bg-background/70 p-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                        <Apple className="h-4 w-4" />
                                      </div>
                                      <div>
                                        <p className="text-sm font-semibold text-foreground">{meal.name}</p>
                                        <p className="text-xs capitalize text-muted-foreground">{meal.mealType.replace('_', ' ')}</p>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-left sm:text-right">
                                    {meal.time ? <p className="text-sm font-medium text-foreground">{meal.time}</p> : null}
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {meal.macros.calories} kcal • {meal.macros.protein_g}g protein
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {post.dayData.workouts.length > 0 ? (
                        <div className="space-y-3">
                          <SectionHeading title="Workouts" />
                          <div className="space-y-4">
                            {post.dayData.workouts.map((workout) => (
                              <div key={workout.id} className="rounded-3xl border border-border/70 bg-background/70 p-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                        <Dumbbell className="h-4 w-4" />
                                      </div>
                                      <div>
                                        <p className="text-sm font-semibold text-foreground">{workout.name}</p>
                                        {workout.focus.length > 0 ? (
                                          <p className="text-xs capitalize text-muted-foreground">{workout.focus.join(' • ')}</p>
                                        ) : null}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-left sm:text-right">
                                    {formatLoggedTimeRange(workout.startedAt, workout.completedAt) ? (
                                      <p className="text-sm font-medium text-foreground">{formatLoggedTimeRange(workout.startedAt, workout.completedAt)}</p>
                                    ) : null}
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {workout.durationMin ? `${workout.durationMin} min` : 'Logged workout'}
                                      {typeof workout.caloriesBurnedKcal === 'number' ? ` • ${workout.caloriesBurnedKcal} kcal` : ''}
                                    </p>
                                  </div>
                                </div>

                                <div className="mt-4 space-y-3">
                                  {workout.exercises.map((exercise) => (
                                    <div key={`${workout.id}-${exercise.name}`} className="rounded-2xl border border-border/70 bg-muted/10 p-3">
                                      <p className="text-sm font-semibold text-foreground">{exercise.name}</p>
                                      <div className="mt-3 space-y-2">
                                        {exercise.sets.map((set) => (
                                          <div key={`${exercise.name}-${set.label}`} className="grid grid-cols-[96px_1fr_auto] items-center gap-3 rounded-xl border border-border/60 bg-background/75 px-3 py-2 text-xs">
                                            <span className="font-medium text-muted-foreground">{set.label}</span>
                                            <span className="font-semibold text-foreground">{set.reps} reps</span>
                                            <span className="text-muted-foreground">
                                              {set.weightKg != null ? formatWeightValue(set.weightKg, unitSystem, 0) : 'BW'}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {post.dayData.supplements.length > 0 ? (
                        <div className="space-y-3">
                          <SectionHeading title="Supplements" />
                          <div className="space-y-3">
                            {post.dayData.supplements.map((supplement) => (
                              <div key={supplement.id} className="rounded-3xl border border-border/70 bg-background/70 p-4">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                    <Pill className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-foreground">{supplement.name}</p>
                                    <p className="text-xs capitalize text-muted-foreground">
                                      {supplement.amount} {supplement.unit} • {supplement.category}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="rounded-3xl border border-dashed border-border/70 bg-muted/10 px-5 py-8 text-sm text-muted-foreground">
                      This day post doesn&apos;t include structured details yet.
                    </div>
                  )}
                </section>
              ) : (
                <section className="space-y-6">
                  <SectionHeading title="Post" subtitle="This is a general update post, so it doesn&apos;t include a linked meal or workout template." />

                  <div className="rounded-3xl border border-border/70 bg-muted/10 p-5">
                    <p className="text-sm leading-7 text-muted-foreground">
                      {post.caption}
                    </p>
                  </div>

                  {post.tags.length > 0 ? (
                    <div className="space-y-3">
                      <SectionHeading title="Tags" />
                      <div className="flex flex-wrap gap-2">
                        {post.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="rounded-full px-3 py-1 text-[11px]">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </section>
              )}

              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-muted-foreground" />
                  <SectionHeading
                    title="Comments"
                    subtitle={`${comments.length} comment${comments.length === 1 ? '' : 's'}`}
                  />
                </div>

                {readOnly ? null : (
                  <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-background/80 px-3 py-2">
                    <input
                      value={commentInput}
                      onChange={(event) => setCommentInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter') return
                        const value = commentInput.trim()
                        if (!value) return
                        onAddComment(value)
                        setCommentInput('')
                      }}
                      placeholder="Write a comment..."
                      className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 rounded-full"
                      onClick={() => {
                        const value = commentInput.trim()
                        if (!value) return
                        onAddComment(value)
                        setCommentInput('')
                      }}
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}

                {comments.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-6 text-center text-sm text-muted-foreground">
                    No comments yet.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {comments.map((comment) => (
                      <div key={comment.id} className="rounded-2xl border border-border/60 bg-muted/15 px-4 py-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">@{comment.userUsername}</span>
                          <span>•</span>
                          <span>{new Date(comment.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                        </div>
                        <p className="mt-1.5 text-sm leading-6 text-foreground/90">{comment.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>

          <div className="shrink-0 border-t border-border/70 bg-background/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur sm:px-6 sm:pb-4">
            {post.type === 'day' || post.type === 'general' || readOnly ? (
              <div className="flex flex-wrap justify-end gap-2">
                {canDelete && onDelete ? (
                  <Button variant="outline" className="h-11 rounded-full px-5 text-destructive hover:text-destructive" onClick={onDelete}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                ) : null}
                <Button variant="ghost" className="h-11 rounded-full px-5" onClick={() => setShareOpen(true)}>
                  <Share2 className="mr-2 h-4 w-4" />
                  Share
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button className="h-11 flex-1 rounded-full" onClick={onUse}>
                  Use This
                </Button>
                {canDelete && onDelete ? (
                  <Button variant="outline" className="h-11 rounded-full px-5 text-destructive hover:text-destructive" onClick={onDelete}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                ) : null}
                <Button variant="ghost" className="h-11 rounded-full px-5" onClick={() => setShareOpen(true)}>
                  <Share2 className="mr-2 h-4 w-4" />
                  Share
                </Button>
              </div>
            )}
          </div>
        </motion.div>
        </DialogContent>
      </Dialog>

      <ShareModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        itemType="social_post"
        itemName={post.title}
        itemData={post as unknown as Record<string, unknown>}
      />
    </>
  )
}
