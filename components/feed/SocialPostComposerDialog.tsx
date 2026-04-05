'use client'

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Camera, ImagePlus, Minus, Play, Plus, X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SocialPostCard } from '@/components/feed/SocialPostCard'
import { buildSocialDraftFromRecipe, buildSocialDraftFromSavedMeal, buildSocialDraftFromWorkout } from '@/lib/social-feed'
import type { MealData, PostMediaItem, Recipe, SavedMealTemplate, SocialPost, SocialPostDraft, SocialPostType, SocialPostUser, UnitSystem, Workout, WorkoutData } from '@/types'
import { getWeightUnitLabel, kgToLbs, lbsToKg } from '@/lib/utils'

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

export function SocialPostComposerDialog({
  open,
  unitSystem,
  initialDraft,
  currentUser,
  availablePeople,
  savedMeals,
  recipes,
  workouts,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  unitSystem: UnitSystem
  initialDraft?: SocialPostDraft | null
  currentUser: SocialPostUser
  availablePeople: SocialPostUser[]
  savedMeals: SavedMealTemplate[]
  recipes: Recipe[]
  workouts: Workout[]
  onOpenChange: (open: boolean) => void
  onSubmit: (draft: SocialPostDraft) => void
}) {
  const [type, setType] = useState<SocialPostType>('general')
  const [audience, setAudience] = useState<'followers' | 'public'>('public')
  const [media, setMedia] = useState<PostMediaItem[]>([])
  const [mediaUrlInput, setMediaUrlInput] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const [caption, setCaption] = useState('')
  const [tags, setTags] = useState('')
  const [tagPeopleQuery, setTagPeopleQuery] = useState('')
  const [taggedUsers, setTaggedUsers] = useState<SocialPostUser[]>([])
  const [mealData, setMealData] = useState<MealData>(emptyMealData)
  const [workoutData, setWorkoutData] = useState<WorkoutData>(emptyWorkoutData)
  const [linkedSource, setLinkedSource] = useState<SocialPostDraft['linkedSource']>()
  const [linkKind, setLinkKind] = useState<'none' | 'saved_meal' | 'recipe' | 'workout'>('none')
  const [linkedItemId, setLinkedItemId] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const weightUnitLabel = getWeightUnitLabel(unitSystem)
  const creationMode = (type === 'general' ? 'simple' : 'structured') as const

  useEffect(() => {
    if (!open) return
    if (initialDraft) {
      setType(initialDraft.type)
      setAudience(initialDraft.audience)
      const draftMedia = initialDraft.media && initialDraft.media.length > 0
        ? initialDraft.media
        : initialDraft.image ? [{ kind: 'image' as const, url: initialDraft.image }] : []
      setMedia(draftMedia)
      setMediaUrlInput('')
      setTitle(initialDraft.title)
      setCaption(initialDraft.caption)
      setTags(initialDraft.tags.join(', '))
      setTaggedUsers(initialDraft.taggedUsers ?? [])
      setTagPeopleQuery('')
      setMealData(initialDraft.mealData ? structuredClone(initialDraft.mealData) : emptyMealData())
      setWorkoutData(initialDraft.workoutData ? structuredClone(initialDraft.workoutData) : emptyWorkoutData())
      setLinkedSource(initialDraft.linkedSource)
      setLinkKind(initialDraft.linkedSource?.kind ?? 'none')
      setLinkedItemId(initialDraft.linkedSource?.id ?? '')
      setPreviewOpen(false)
      return
    }

    setType('general')
    setAudience('public')
    setMedia([])
    setMediaUrlInput('')
    setTitle('')
    setCaption('')
    setTags('')
    setTaggedUsers([])
    setTagPeopleQuery('')
    setMealData(emptyMealData())
    setWorkoutData(emptyWorkoutData())
    setLinkedSource(undefined)
    setLinkKind('none')
    setLinkedItemId('')
    setPreviewOpen(false)
  }, [initialDraft, open])

  const isLinkedStructured = !!linkedSource
  const allowLinkExistingContent = !isLinkedStructured

  const linkedMealOptions = useMemo(() => (
    linkKind === 'saved_meal' ? savedMeals : linkKind === 'recipe' ? recipes : []
  ), [linkKind, recipes, savedMeals])

  const taggablePeople = useMemo(
    () => availablePeople.filter((person) => person.id !== currentUser.id),
    [availablePeople, currentUser.id]
  )

  const filteredTaggablePeople = useMemo(() => {
    const query = tagPeopleQuery.trim().toLowerCase()
    return taggablePeople
      .filter((person) => !taggedUsers.some((taggedUser) => taggedUser.id === person.id))
      .filter((person) => {
        if (!query) return true
        return (
          person.name.toLowerCase().includes(query)
          || person.username.toLowerCase().includes(query)
        )
      })
      .slice(0, 6)
  }, [tagPeopleQuery, taggablePeople, taggedUsers])

  useEffect(() => {
    if (!open) return
    if (linkKind === 'none') {
      if (!initialDraft?.linkedSource) {
        setLinkedSource(undefined)
      }
      setLinkedItemId('')
      return
    }

    if (!linkedItemId) return

    if (linkKind === 'saved_meal') {
      const meal = savedMeals.find((item) => item.id === linkedItemId)
      if (!meal) return
      const nextDraft = buildSocialDraftFromSavedMeal(meal)
      setType(nextDraft.type)
      const mealMedia = nextDraft.image ? [{ kind: 'image' as const, url: nextDraft.image }] : []
      setMedia(mealMedia)
      setTitle(nextDraft.title)
      setCaption(nextDraft.caption)
      setTags(nextDraft.tags.join(', '))
      setMealData(structuredClone(nextDraft.mealData ?? emptyMealData()))
      setLinkedSource(nextDraft.linkedSource)
      return
    }

    if (linkKind === 'recipe') {
      const recipe = recipes.find((item) => item.id === linkedItemId)
      if (!recipe) return
      const nextDraft = buildSocialDraftFromRecipe(recipe)
      setType(nextDraft.type)
      const recipeMedia = nextDraft.image ? [{ kind: 'image' as const, url: nextDraft.image }] : []
      setMedia(recipeMedia)
      setTitle(nextDraft.title)
      setCaption(nextDraft.caption)
      setTags(nextDraft.tags.join(', '))
      setMealData(structuredClone(nextDraft.mealData ?? emptyMealData()))
      setLinkedSource(nextDraft.linkedSource)
      return
    }

    const workout = workouts.find((item) => item.id === linkedItemId)
    if (!workout) return
    const nextDraft = buildSocialDraftFromWorkout(workout)
    setType(nextDraft.type)
    const workoutMedia = nextDraft.image ? [{ kind: 'image' as const, url: nextDraft.image }] : []
    setMedia(workoutMedia)
    setTitle(nextDraft.title)
    setCaption(nextDraft.caption)
    setTags(nextDraft.tags.join(', '))
    setWorkoutData(structuredClone(nextDraft.workoutData ?? emptyWorkoutData()))
    setLinkedSource(nextDraft.linkedSource)
  }, [initialDraft?.linkedSource, linkKind, linkedItemId, open, recipes, savedMeals, workouts])

  const previewPost = useMemo<SocialPost>(() => ({
    id: 'composer-preview',
    type,
    user: currentUser,
    image: media.find((m) => m.kind === 'image')?.url,
    media: media.length > 0 ? media : undefined,
    title: title.trim() || (type === 'meal' ? 'Untitled meal post' : type === 'workout' ? 'Untitled workout post' : 'Untitled post'),
    caption: caption.trim() || 'Add a caption to preview how this post will read in the feed.',
    stats: { completed: 0, used: 0, saved: 0, remixed: 0 },
    createdAt: new Date().toISOString(),
    tags: tags.split(',').map((value) => value.trim().toLowerCase()).filter(Boolean),
    taggedUsers,
    audience,
    creationMode,
    mealData: type === 'meal' ? mealData : undefined,
    workoutData: type === 'workout' ? workoutData : undefined,
  }), [audience, caption, creationMode, currentUser, media, mealData, taggedUsers, tags, title, type, workoutData])

  const submit = () => {
    if (!title.trim() || !caption.trim()) return

    onSubmit({
      type,
      image: media.find((m) => m.kind === 'image')?.url,
      media: media.length > 0 ? media : undefined,
      title: title.trim(),
      caption: caption.trim(),
      tags: tags.split(',').map((value) => value.trim().toLowerCase()).filter(Boolean),
      taggedUsers,
      audience,
      creationMode,
      mealData: type === 'meal' ? mealData : undefined,
      workoutData: type === 'workout' ? workoutData : undefined,
      linkedSource,
    })
  }

  const addTaggedUser = (person: SocialPostUser) => {
    setTaggedUsers((current) => {
      if (current.some((item) => item.id === person.id)) return current
      return [...current, person]
    })
    setTagPeopleQuery('')
  }

  const removeTaggedUser = (personId: string) => {
    setTaggedUsers((current) => current.filter((person) => person.id !== personId))
  }

  const handleMediaFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) return
    files.forEach((file) => {
      const kind = file.type.startsWith('video/') ? 'video' as const : 'image' as const
      const reader = new FileReader()
      reader.onload = () => {
        const url = typeof reader.result === 'string' ? reader.result : ''
        setMedia((current) => [...current, { kind, url }])
      }
      reader.readAsDataURL(file)
    })
    event.target.value = ''
  }

  const addMediaUrl = () => {
    const url = mediaUrlInput.trim()
    if (!url) return
    setMedia((current) => [...current, { kind: 'image', url }])
    setMediaUrlInput('')
  }

  const removeMediaItem = (index: number) => {
    setMedia((current) => current.filter((_, i) => i !== index))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!left-1/2 !top-auto !bottom-0 !h-[92dvh] !w-[calc(100vw-0.5rem)] !max-w-4xl !translate-x-[-50%] !translate-y-0 overflow-hidden rounded-t-[1.75rem] border-border/80 p-0 sm:!top-1/2 sm:!bottom-auto sm:!h-[90dvh] sm:!max-h-[90dvh] sm:!w-[calc(100vw-2rem)] sm:!translate-y-[-50%] sm:rounded-[1.75rem]">
        <div className="flex h-full min-h-0 max-h-[92dvh] flex-col overflow-hidden sm:max-h-[90dvh]">
          <div className="flex justify-center py-2 sm:hidden">
            <span className="h-1.5 w-12 rounded-full bg-border/80" />
          </div>
          <DialogHeader className="border-b border-border/70 px-4 py-4 text-left sm:px-6">
            <DialogTitle>Create Post</DialogTitle>
            <DialogDescription>
              {isLinkedStructured
                ? 'This post is already populated from the item you selected, so you can just add a photo, caption, and audience.'
                : 'Create a post, or link one of your meals, recipes, or workouts so the post is already fully usable.'}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-y-contain px-4 py-4 sm:px-6">
            {isLinkedStructured ? (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
                Posting from <span className="font-medium text-foreground">{linkedSource?.label}</span>. The structured details are already included.
              </div>
            ) : null}

            {allowLinkExistingContent ? (
              <div className="space-y-3 rounded-3xl border border-border/70 bg-muted/10 p-4">
                <div>
                  <Label className="text-sm">Link Existing Content</Label>
                  <p className="mt-1 text-sm text-muted-foreground">Optional. Attach a saved meal, recipe, or workout so the post is already fully usable.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Content Type</Label>
                    <Select
                      value={linkKind}
                      onValueChange={(value) => {
                        const nextValue = value as typeof linkKind
                        setLinkKind(nextValue)
                        setLinkedItemId('')
                        if (nextValue === 'none') {
                          setLinkedSource(undefined)
                        }
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No linked content</SelectItem>
                        <SelectItem value="saved_meal">Saved Meal</SelectItem>
                        <SelectItem value="recipe">Recipe</SelectItem>
                        <SelectItem value="workout">Workout</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {linkKind !== 'none' ? (
                    <div className="space-y-1.5">
                      <Label>{linkKind === 'workout' ? 'Workout' : linkKind === 'recipe' ? 'Recipe' : 'Saved Meal'}</Label>
                      <Select value={linkedItemId} onValueChange={setLinkedItemId}>
                        <SelectTrigger><SelectValue placeholder={`Select ${linkKind.replace('_', ' ')}`} /></SelectTrigger>
                        <SelectContent>
                          {(linkKind === 'workout' ? workouts : linkedMealOptions).map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={type}
                  onValueChange={(value) => setType(value as SocialPostType)}
                  disabled={isLinkedStructured}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="meal">Meal</SelectItem>
                    <SelectItem value="workout">Workout</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Audience</Label>
                <Select value={audience} onValueChange={(value) => setAudience(value as 'followers' | 'public')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="followers">Followers</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tags</Label>
                <Input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="high-protein, plan, progress" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={
                  type === 'meal'
                    ? 'Late lunch chicken bowl'
                    : type === 'workout'
                      ? 'Upper day with back focus'
                      : 'Quick update from this week'
                }
              />
            </div>

            <div className="space-y-3 rounded-3xl border border-border/70 bg-muted/10 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Label className="text-sm">Photos & Videos (optional)</Label>
                  <p className="mt-1 text-sm text-muted-foreground">Add up to 10 photos or videos. The first image will be used as the post cover.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border/70 bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/40">
                    <Camera className="h-4 w-4" />
                    Camera
                    <input
                      type="file"
                      accept="image/*,video/*"
                      capture="environment"
                      className="hidden"
                      onChange={handleMediaFileChange}
                    />
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border/70 bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/40">
                    <ImagePlus className="h-4 w-4" />
                    Add Files
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      className="hidden"
                      onChange={handleMediaFileChange}
                    />
                  </label>
                </div>
              </div>

              <div className="flex gap-2">
                <Input
                  value={mediaUrlInput}
                  onChange={(event) => setMediaUrlInput(event.target.value)}
                  placeholder="Paste an image URL and press Add"
                  onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addMediaUrl() } }}
                />
                <Button type="button" variant="outline" className="shrink-0 rounded-full" onClick={addMediaUrl} disabled={!mediaUrlInput.trim()}>
                  Add
                </Button>
              </div>

              {media.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {media.map((item, index) => (
                    <div key={`media-${index}`} className="group relative overflow-hidden rounded-xl border border-border/70 bg-background">
                      {item.kind === 'video' ? (
                        <div className="relative h-24 w-full bg-black/80">
                          <video
                            src={item.url}
                            className="h-full w-full object-cover opacity-80"
                            muted
                            playsInline
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Play className="h-6 w-6 fill-white text-white drop-shadow" />
                          </div>
                        </div>
                      ) : (
                        <div
                          className="h-24 w-full bg-cover bg-center"
                          style={{ backgroundImage: `url("${item.url}")` }}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => removeMediaItem(index)}
                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                        aria-label="Remove"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      {index === 0 ? (
                        <div className="absolute bottom-1 left-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-medium text-white">Cover</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-background/70 px-4 py-6 text-center text-sm text-muted-foreground">
                  No media attached. If you publish without any, the post will stay clean and text-only.
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Caption</Label>
              <Textarea value={caption} onChange={(event) => setCaption(event.target.value)} className="min-h-[96px]" placeholder="Keep it short, clear, and useful." />
            </div>

            <div className="space-y-3 rounded-3xl border border-border/70 bg-muted/10 p-4">
              <div>
                <Label className="text-sm">Tag People</Label>
                <p className="mt-1 text-sm text-muted-foreground">Tag people so the post also appears on their tagged profile tab.</p>
              </div>

              <Input
                value={tagPeopleQuery}
                onChange={(event) => setTagPeopleQuery(event.target.value)}
                placeholder="Search by name or username"
              />

              {taggedUsers.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {taggedUsers.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => removeTaggedUser(person.id)}
                      className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted/40"
                    >
                      <span>@{person.username}</span>
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              ) : null}

              {filteredTaggablePeople.length > 0 ? (
                <div className="space-y-2">
                  {filteredTaggablePeople.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => addTaggedUser(person)}
                      className="flex w-full items-center justify-between rounded-2xl border border-border/70 bg-background px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{person.name}</p>
                        <p className="truncate text-xs text-muted-foreground">@{person.username}</p>
                      </div>
                      <span className="rounded-full border border-border/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                        Add
                      </span>
                    </button>
                  ))}
                </div>
              ) : tagPeopleQuery.trim() ? (
                <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 px-4 py-3 text-sm text-muted-foreground">
                  No matching people found.
                </div>
              ) : null}
            </div>

            {previewOpen ? (
              <div className="space-y-3 rounded-3xl border border-border/70 bg-muted/10 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label className="text-sm">Feed Preview</Label>
                    <p className="mt-1 text-sm text-muted-foreground">This is how the post card will look before someone opens it.</p>
                  </div>
                  <Button type="button" variant="outline" className="rounded-full" onClick={() => setPreviewOpen(false)}>
                    Hide Preview
                  </Button>
                </div>
                <div className="mx-auto max-w-xl">
                  <SocialPostCard
                    post={previewPost}
                    saved={false}
                    liked={false}
                    onOpen={() => {}}
                    onToggleSave={() => {}}
                    onToggleLike={() => {}}
                    onAddComment={() => {}}
                  />
                </div>
              </div>
            ) : null}

            {type === 'meal' ? (
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
                  <div className="space-y-3 rounded-3xl border border-border/70 bg-muted/10 p-4">
                    <div className="flex items-center justify-between">
                      <Label>Ingredients</Label>
                      <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => setMealData((current) => ({
                        ...current,
                        ingredients: [...current.ingredients, { name: '', amount: 1, unit: 'serving' }],
                      }))}>
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Add
                      </Button>
                    </div>
                    {mealData.ingredients.map((ingredient, index) => (
                      <div key={`composer-ingredient-${index}`} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_88px_88px_auto]">
                        <Input value={ingredient.name} onChange={(event) => setMealData((current) => ({
                          ...current,
                          ingredients: current.ingredients.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item),
                        }))} placeholder="Ingredient" />
                        <Input type="number" value={ingredient.amount} onChange={(event) => setMealData((current) => ({
                          ...current,
                          ingredients: current.ingredients.map((item, itemIndex) => itemIndex === index ? { ...item, amount: Number(event.target.value) || 0 } : item),
                        }))} placeholder="Amount" />
                        <Input value={ingredient.unit} onChange={(event) => setMealData((current) => ({
                          ...current,
                          ingredients: current.ingredients.map((item, itemIndex) => itemIndex === index ? { ...item, unit: event.target.value } : item),
                        }))} placeholder="Unit" />
                        <Button type="button" size="icon-sm" variant="ghost" onClick={() => setMealData((current) => ({
                          ...current,
                          ingredients: current.ingredients.filter((_, itemIndex) => itemIndex !== index),
                        }))}>
                          <Minus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3 rounded-3xl border border-border/70 bg-muted/10 p-4">
                    <div className="flex items-center justify-between">
                      <Label>Instructions</Label>
                      <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => setMealData((current) => ({
                        ...current,
                        instructions: [...current.instructions, ''],
                      }))}>
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Add
                      </Button>
                    </div>
                    {mealData.instructions.map((instruction, index) => (
                      <div key={`composer-instruction-${index}`} className="flex gap-2">
                        <Textarea value={instruction} onChange={(event) => setMealData((current) => ({
                          ...current,
                          instructions: current.instructions.map((item, itemIndex) => itemIndex === index ? event.target.value : item),
                        }))} className="min-h-[88px]" />
                        <Button type="button" size="icon-sm" variant="ghost" onClick={() => setMealData((current) => ({
                          ...current,
                          instructions: current.instructions.filter((_, itemIndex) => itemIndex !== index),
                        }))}>
                          <Minus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : null}

            {type === 'workout' ? (
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
                    <Input value={workoutData.equipment.join(', ')} onChange={(event) => setWorkoutData((current) => ({ ...current, equipment: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) }))} placeholder="Barbell, cable, bench" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Focus</Label>
                  <Input value={workoutData.focus.join(', ')} onChange={(event) => setWorkoutData((current) => ({ ...current, focus: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) }))} placeholder="Back, biceps, pull" />
                </div>

                <div className="space-y-3 rounded-3xl border border-border/70 bg-muted/10 p-4">
                  <div className="flex items-center justify-between">
                    <Label>Exercises</Label>
                    <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => setWorkoutData((current) => ({
                      ...current,
                      exercises: [...current.exercises, { name: '', sets: 3, reps: '10', weight: undefined, rest: 75, notes: '' }],
                    }))}>
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Add
                    </Button>
                  </div>
                  {workoutData.exercises.map((exercise, index) => (
                    <div key={`composer-exercise-${index}`} className="rounded-2xl border border-border/70 bg-background/80 p-3">
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_72px_88px_88px_88px_auto]">
                        <Input value={exercise.name} onChange={(event) => setWorkoutData((current) => ({
                          ...current,
                          exercises: current.exercises.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item),
                        }))} placeholder="Exercise" />
                        <div className="space-y-1">
                          <p className="px-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Sets</p>
                          <Input type="number" value={exercise.sets} onChange={(event) => setWorkoutData((current) => ({
                            ...current,
                            exercises: current.exercises.map((item, itemIndex) => itemIndex === index ? { ...item, sets: Number(event.target.value) || 0 } : item),
                          }))} placeholder="Sets" />
                        </div>
                        <div className="space-y-1">
                          <p className="px-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Reps</p>
                          <Input value={exercise.reps} onChange={(event) => setWorkoutData((current) => ({
                            ...current,
                            exercises: current.exercises.map((item, itemIndex) => itemIndex === index ? { ...item, reps: event.target.value } : item),
                          }))} placeholder="Reps" />
                        </div>
                        <div className="space-y-1">
                          <p className="px-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Weight ({weightUnitLabel})</p>
                          <Input inputMode="decimal" value={formatWorkoutWeightInput(exercise.weight, unitSystem)} onChange={(event) => setWorkoutData((current) => ({
                            ...current,
                            exercises: current.exercises.map((item, itemIndex) => itemIndex === index ? { ...item, weight: parseWorkoutWeightInput(event.target.value, unitSystem) } : item),
                          }))} placeholder={`Weight (${weightUnitLabel})`} />
                        </div>
                        <div className="space-y-1">
                          <p className="px-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Rest (sec)</p>
                          <Input type="number" value={exercise.rest ?? ''} onChange={(event) => setWorkoutData((current) => ({
                            ...current,
                            exercises: current.exercises.map((item, itemIndex) => itemIndex === index ? { ...item, rest: event.target.value === '' ? undefined : Number(event.target.value) || 0 } : item),
                          }))} placeholder="Rest" />
                        </div>
                        <Button type="button" size="icon-sm" variant="ghost" onClick={() => setWorkoutData((current) => ({
                          ...current,
                          exercises: current.exercises.filter((_, itemIndex) => itemIndex !== index),
                        }))}>
                          <Minus className="h-4 w-4" />
                        </Button>
                      </div>
                      <Textarea value={exercise.notes || ''} onChange={(event) => setWorkoutData((current) => ({
                        ...current,
                        exercises: current.exercises.map((item, itemIndex) => itemIndex === index ? { ...item, notes: event.target.value } : item),
                      }))} className="mt-2 min-h-[72px]" placeholder="Optional notes" />
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <Label>Notes</Label>
                  <Textarea value={workoutData.notes || ''} onChange={(event) => setWorkoutData((current) => ({ ...current, notes: event.target.value }))} className="min-h-[96px]" />
                </div>
              </>
            ) : null}
          </div>

          <DialogFooter className="shrink-0 border-t border-border/70 px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-4">
            <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="outline" className="rounded-full" onClick={() => setPreviewOpen((current) => !current)} disabled={!title.trim()}>
              {previewOpen ? 'Hide Preview' : 'Preview Post'}
            </Button>
            <Button className="rounded-full" onClick={submit} disabled={!title.trim() || !caption.trim()}>
              Publish Post
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
