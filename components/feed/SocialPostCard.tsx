'use client'

import { forwardRef, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Bookmark, ChevronLeft, ChevronRight, Heart, MessageCircle, Send } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { XpBadge } from '@/components/ui/XpBadge'
import { AvatarWithBadge } from '@/components/ui/AvatarWithBadge'
import type { PostMediaItem, SocialPost } from '@/types'
import { formatCompactNumber, getSocialPostBadge, getSocialPostPreview } from '@/lib/social-feed'
import { buildSocialProfileHref } from '@/lib/social-connections'
import { cn } from '@/lib/utils'

const slideVariants = {
  enter: (dir: number) => ({ x: dir >= 0 ? '100%' : '-100%' }),
  center: { x: 0 },
  exit: (dir: number) => ({ x: dir >= 0 ? '-100%' : '100%' }),
}

export const SocialPostCard = forwardRef<HTMLDivElement, {
  post: SocialPost
  saved: boolean
  liked: boolean
  onOpen: (post: SocialPost) => void
  onToggleSave: (post: SocialPost) => void
  onToggleLike: (post: SocialPost) => void
  onAddComment?: (post: SocialPost, body: string) => void
}>(function SocialPostCard({
  post,
  saved,
  liked,
  onOpen,
  onToggleSave,
  onToggleLike,
  onAddComment,
}, ref) {
  const router = useRouter()
  const badge = getSocialPostBadge(post)
  const preview = getSocialPostPreview(post)
  const compactPreview = getNoMediaHighlights(post)

  const mediaItems: PostMediaItem[] =
    post.media && post.media.length > 0
      ? post.media
      : post.image
        ? [{ kind: 'image', url: post.image }]
        : []

  const [mediaIndex, setMediaIndex] = useState(0)
  const [slideDir, setSlideDir] = useState(1)
  const touchStartX = useRef(0)
  const touchDeltaX = useRef(0)
  const didSwipe = useRef(false)
  const lastTapAt = useRef(0)
  const suppressNextOpen = useRef(false)
  const [commentOpen, setCommentOpen] = useState(false)
  const [commentText, setCommentText] = useState('')

  const hasMultiple = mediaItems.length > 1
  const currentMedia = mediaItems[mediaIndex]

  const navigate = (next: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setSlideDir(next > mediaIndex ? 1 : -1)
    setMediaIndex(next)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchDeltaX.current = 0
    didSwipe.current = false
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current
  }

  const handleTouchEnd = () => {
    const delta = touchDeltaX.current
    if (Math.abs(delta) > 40 && hasMultiple) {
      didSwipe.current = true
      if (delta < 0 && mediaIndex < mediaItems.length - 1) {
        setSlideDir(1)
        setMediaIndex((i) => i + 1)
      } else if (delta > 0 && mediaIndex > 0) {
        setSlideDir(-1)
        setMediaIndex((i) => i - 1)
      }
    }
  }

  const handleOpen = () => {
    if (suppressNextOpen.current || didSwipe.current) {
      suppressNextOpen.current = false
      return
    }
    onOpen(post)
  }

  const handleCardTouchEnd = (event: React.TouchEvent) => {
    if (didSwipe.current) return
    const target = event.target as HTMLElement
    if (target.closest('button')) return

    const now = Date.now()
    if (now - lastTapAt.current < 280) {
      suppressNextOpen.current = true
      event.preventDefault()
      event.stopPropagation()
      onToggleLike(post)
    }
    lastTapAt.current = now
  }

  const handleCommentOpen = (event: React.MouseEvent) => {
    event.stopPropagation()
    setCommentOpen(true)
  }

  const handleCommentSubmit = () => {
    const value = commentText.trim()
    if (!value || !onAddComment) return
    onAddComment(post, value)
    setCommentText('')
    setCommentOpen(false)
  }

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.995 }}
      transition={{ duration: 0.18, ease: [0.22, 0.61, 0.36, 1] }}
      onClick={handleOpen}
      onTouchEnd={handleCardTouchEnd}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          handleOpen()
        }
      }}
      role="button"
      tabIndex={0}
      className="group w-full overflow-hidden rounded-[1.35rem] border border-border/70 bg-card text-left shadow-[0_14px_40px_rgba(15,23,42,0.08)] transition-shadow hover:shadow-[0_20px_46px_rgba(15,23,42,0.12)]"
    >
      {mediaItems.length > 0 ? (
        <div
          className="relative h-52 w-full overflow-hidden sm:h-60"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <AnimatePresence custom={slideDir} initial={false}>
            <motion.div
              key={mediaIndex}
              custom={slideDir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
              className="absolute inset-0"
            >
              {currentMedia.kind === 'video' ? (
                <video
                  src={currentMedia.url}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                  loop
                />
              ) : (
                <div
                  className="h-full w-full bg-cover bg-center"
                  style={{ backgroundImage: `linear-gradient(180deg, rgba(15,23,42,0.02), rgba(15,23,42,0.14)), url("${currentMedia.url}")` }}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {hasMultiple && mediaIndex > 0 ? (
            <button
              type="button"
              onClick={(e) => navigate(mediaIndex - 1, e)}
              className="absolute left-2 top-1/2 -translate-y-1/2 hidden h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 sm:flex"
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          ) : null}

          {hasMultiple && mediaIndex < mediaItems.length - 1 ? (
            <button
              type="button"
              onClick={(e) => navigate(mediaIndex + 1, e)}
              className="absolute right-2 top-1/2 -translate-y-1/2 hidden h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 sm:flex"
              aria-label="Next photo"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : null}

          {hasMultiple ? (
            <div className="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 gap-1.5">
              {mediaItems.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => navigate(i, e)}
                  aria-label={`Go to photo ${i + 1}`}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-200',
                    i === mediaIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/55'
                  )}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">{post.title}</h3>
            <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{post.caption}</p>
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onToggleSave(post)
            }}
            className={cn(
              'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors',
              saved
                ? 'border-primary/20 bg-primary/10 text-primary'
                : 'border-border/70 bg-background/90 text-muted-foreground'
            )}
            aria-label={saved ? 'Unsave post' : 'Save post'}
          >
            <Bookmark className={cn('h-4 w-4', saved ? 'fill-current' : '')} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              router.push(buildSocialProfileHref(post.user))
            }}
            className="flex min-w-0 items-center gap-2.5 rounded-2xl text-left transition-opacity hover:opacity-85"
          >
            <AvatarWithBadge
              src={post.user.avatar_url ?? undefined}
              name={post.user.name}
              size={32}
              hasCrown={post.user.has_crown}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-medium text-foreground">@{post.user.username}</p>
                {post.user.xp_total != null ? <XpBadge totalXp={post.user.xp_total} size="sm" /> : null}
              </div>
              <p className="text-xs text-muted-foreground">{post.user.name}</p>
            </div>
          </button>
          {badge ? <Badge variant="outline" className="ml-auto rounded-full px-2.5 py-1 text-[10px] font-medium">{badge}</Badge> : null}
        </div>

        {preview ? (
          <p className="text-sm font-medium text-muted-foreground">{preview}</p>
        ) : null}

        {mediaItems.length === 0 && compactPreview.length > 0 ? (
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Included</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {compactPreview.map((entry) => (
                <span key={entry} className="rounded-full border border-border/60 bg-background px-2.5 py-1 text-[11px] text-muted-foreground">
                  {entry}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onToggleLike(post)
            }}
            className={cn('inline-flex items-center gap-1 transition-colors hover:text-rose-400', liked ? 'text-rose-400' : '')}
            aria-label={liked ? 'Unlike post' : 'Like post'}
          >
            <Heart className={cn('h-3.5 w-3.5', liked ? 'fill-current' : '')} />
            {formatCompactNumber(post.stats.likes ?? 0)}
          </button>
          <span className="text-border">•</span>
          <button
            type="button"
            onClick={handleCommentOpen}
            className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
            aria-label="Comment on post"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {formatCompactNumber(post.stats.comments ?? 0)}
          </button>
        </div>

        {commentOpen && onAddComment ? (
          <div
            className="flex items-center gap-2 rounded-2xl border border-border/70 bg-background/80 px-3 py-2"
            onClick={(event) => event.stopPropagation()}
          >
            <input
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setCommentOpen(false)
                  setCommentText('')
                  return
                }
                if (event.key !== 'Enter') return
                event.preventDefault()
                handleCommentSubmit()
              }}
              placeholder="Write a comment..."
              className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              type="button"
              onClick={handleCommentSubmit}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background transition-colors hover:opacity-90"
              aria-label="Post comment"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
      </div>
    </motion.div>
  )
})

function getNoMediaHighlights(post: SocialPost): string[] {
  if (post.type === 'meal' && post.mealData) {
    const ingredients = post.mealData.ingredients
      .slice(0, 4)
      .map((ingredient) => ingredient.name)
    return ingredients
  }

  if (post.type === 'workout' && post.workoutData) {
    const exercises = post.workoutData.exercises
      .slice(0, 4)
      .map((exercise) => exercise.name)
    return exercises
  }

  if (post.type === 'day' && post.dayData) {
    const mealNames = post.dayData.meals.slice(0, 2).map((meal) => meal.name)
    const workoutNames = post.dayData.workouts.slice(0, 2).map((workout) => workout.name)
    const supplementNames = post.dayData.supplements.slice(0, 2).map((supplement) => supplement.name)
    return [...mealNames, ...workoutNames, ...supplementNames].slice(0, 5)
  }

  return []
}
