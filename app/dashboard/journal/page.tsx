'use client'

import React from 'react'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import {
  BookOpen, Plus, Edit2, Trash2, Tag, Search,
  X, Save, Heart, Battery, Dumbbell, Apple, Pill, Link2, PenLine,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useAppStore } from '@/store/useAppStore'
import type { JournalEntry, JournalTag, MoodLevel, EnergyLevel } from '@/types'
import { getTodayISO } from '@/lib/utils'
import { toast } from 'sonner'

const TAG_COLORS: Record<JournalTag, string> = {
  mood: 'bg-rose-500/15 text-rose-400 border-rose-500/20',
  energy: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  diet: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  workout: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  stress: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  sleep: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20',
  motivation: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
}

const PROMPTS = [
  "How did your workout feel today?",
  "What was your energy level like?",
  "How did your nutrition go today?",
  "What are you proud of today?",
  "Any obstacles you faced?",
  "What would you do differently tomorrow?",
]

const MOOD_EMOJIS: Record<MoodLevel, string> = {
  1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😄',
}

function MoodSelector({ value, onChange }: { value: MoodLevel; onChange: (v: MoodLevel) => void }) {
  return (
    <div className="flex gap-2">
      {([1, 2, 3, 4, 5] as MoodLevel[]).map((level) => (
        <button
          key={level}
          type="button"
          onClick={() => onChange(level)}
          className={`text-2xl transition-all duration-200 hover:opacity-80 ${
            value === level ? 'filter-none' : 'opacity-50'
          }`}
          title={`Mood: ${level}/5`}
        >
          {MOOD_EMOJIS[level]}
        </button>
      ))}
    </div>
  )
}

function EnergySelector({ value, onChange }: { value: EnergyLevel; onChange: (v: EnergyLevel) => void }) {
  return (
    <div className="flex gap-1">
      {([1, 2, 3, 4, 5] as EnergyLevel[]).map((level) => (
        <button
          key={level}
          type="button"
          onClick={() => onChange(level)}
          className={`w-8 h-8 rounded-lg text-xs font-bold transition-all duration-200 ${
            value >= level
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              : 'bg-muted text-muted-foreground'
          }`}
          title={`Energy: ${level}/5`}
        >
          {level}
        </button>
      ))}
    </div>
  )
}

type LinkedItem = { type: 'workout' | 'meal' | 'supplement' | 'other'; id?: string; label: string }

const LINK_TYPE_CONFIG = {
  workout: { icon: Dumbbell, label: 'Workout', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  meal: { icon: Apple, label: 'Meal', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  supplement: { icon: Pill, label: 'Supplement', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' },
  other: { icon: PenLine, label: 'Other', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
}

// Journal editor dialog
function JournalEditorDialog({
  entry,
  onSave,
  children,
}: {
  entry?: JournalEntry
  onSave: (data: Partial<JournalEntry>) => void
  children?: React.ReactNode
}) {
  const { workoutLogs, getDailyMeals, supplements } = useAppStore()
  const today = getTodayISO()
  const todayWorkouts = workoutLogs.filter((w) => w.date === today)
  const todayMeals = getDailyMeals(today)
  const todaySupplements = supplements.filter((s) => !s.archived && s.taken_dates.includes(today))

  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(entry?.title || '')
  const [content, setContent] = useState(entry?.content || '')
  const [mood, setMood] = useState<MoodLevel>(entry?.mood || 4)
  const [energy, setEnergy] = useState<EnergyLevel>(entry?.energy || 3)
  const [tags, setTags] = useState<JournalTag[]>(entry?.tags || [])
  const [usedPrompt, setUsedPrompt] = useState(false)
  const [linkedItem, setLinkedItem] = useState<LinkedItem | null>(entry?.linked_item || null)
  const [linkStep, setLinkStep] = useState<'type' | 'pick' | null>(null)
  const [otherText, setOtherText] = useState('')

  const toggleTag = (tag: JournalTag) => {
    setTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag])
  }

  const handlePrompt = (prompt: string) => {
    setContent((prev) => prev + (prev ? '\n\n' : '') + prompt + '\n')
    setUsedPrompt(true)
  }

  const handleSave = () => {
    if (!content.trim()) {
      toast.error('Please write something before saving')
      return
    }
    onSave({
      title: title || undefined,
      content,
      mood,
      energy,
      tags,
      linked_item: linkedItem || undefined,
      workout_id: linkedItem?.type === 'workout' ? linkedItem.id : undefined,
    })
    setOpen(false)
    setTitle('')
    setContent('')
    setMood(4)
    setEnergy(3)
    setTags([])
    setLinkedItem(null)
    setLinkStep(null)
  }

  const pickType = (type: LinkedItem['type']) => {
    if (type === 'other') {
      setLinkStep('pick')
    } else {
      setLinkStep('pick')
    }
    setLinkedItem({ type, label: '' })
  }

  const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setLinkStep(null) }}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="brand" size="sm" className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            New Entry
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{entry ? 'Edit Journal Entry' : 'New Journal Entry'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label>Title (optional)</Label>
            <Input
              placeholder="Give this entry a title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Link to activity */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-muted-foreground" /> Link to activity (optional)
            </Label>

            {linkedItem?.label ? (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium ${LINK_TYPE_CONFIG[linkedItem.type].color}`}>
                {(() => { const Icon = LINK_TYPE_CONFIG[linkedItem.type].icon; return <Icon className="w-3.5 h-3.5 shrink-0" /> })()}
                <span className="flex-1 capitalize">{linkedItem.label}</span>
                <button type="button" onClick={() => { setLinkedItem(null); setLinkStep(null) }}>
                  <X className="w-3.5 h-3.5 opacity-60 hover:opacity-100" />
                </button>
              </div>
            ) : linkStep === null ? (
              <button
                type="button"
                onClick={() => setLinkStep('type')}
                className="w-full text-left text-xs px-3 py-2.5 rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors flex items-center gap-2"
              >
                <Link2 className="w-3.5 h-3.5" /> Link a workout, meal, supplement, or note...
              </button>
            ) : linkStep === 'type' ? (
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="px-3 py-2 bg-muted/30 border-b border-border/50 flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">What are you journaling about?</p>
                  <button type="button" onClick={() => setLinkStep(null)} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
                </div>
                <div className="grid grid-cols-2 gap-0 divide-x divide-border/50">
                  {(Object.entries(LINK_TYPE_CONFIG) as [LinkedItem['type'], typeof LINK_TYPE_CONFIG[keyof typeof LINK_TYPE_CONFIG]][]).map(([type, cfg]) => {
                    const Icon = cfg.icon
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => pickType(type)}
                        className="flex items-center gap-2.5 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
                      >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${cfg.color}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-sm font-medium">{cfg.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : linkStep === 'pick' && linkedItem ? (
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="px-3 py-2 bg-muted/30 border-b border-border/50 flex items-center justify-between">
                  <button type="button" onClick={() => setLinkStep('type')} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                    ← Back
                  </button>
                  <p className="text-xs font-medium text-muted-foreground capitalize">{linkedItem.type}</p>
                  <button type="button" onClick={() => { setLinkedItem(null); setLinkStep(null) }} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
                </div>
                <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
                  {linkedItem.type === 'workout' && (
                    todayWorkouts.length > 0
                      ? todayWorkouts.map((w) => (
                          <button key={w.id} type="button" onClick={() => { setLinkedItem({ type: 'workout', id: w.id, label: w.workout.name }); setLinkStep(null) }}
                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-sm">
                            <span className="font-medium">{w.workout.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">{w.exercises.length} exercises · {w.duration_min || 0}m</span>
                          </button>
                        ))
                      : <p className="text-xs text-muted-foreground px-3 py-2">No workouts logged today</p>
                  )}
                  {linkedItem.type === 'meal' && (
                    MEAL_TYPES.map((mt) => {
                      const meals = todayMeals.filter((m) => m.meal_type === mt)
                      if (meals.length === 0) return null
                      return (
                        <button key={mt} type="button" onClick={() => { setLinkedItem({ type: 'meal', label: `${mt.charAt(0).toUpperCase() + mt.slice(1)} (${meals.length} item${meals.length > 1 ? 's' : ''})` }); setLinkStep(null) }}
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-sm capitalize">
                          <span className="font-medium">{mt}</span>
                          <span className="text-xs text-muted-foreground ml-2">{meals.length} item{meals.length > 1 ? 's' : ''} · {meals.reduce((s, m) => s + m.macros.calories, 0)} kcal</span>
                        </button>
                      )
                    })
                  )}
                  {linkedItem.type === 'supplement' && (
                    todaySupplements.length > 0
                      ? todaySupplements.map((s) => (
                          <button key={s.id} type="button" onClick={() => { setLinkedItem({ type: 'supplement', id: s.id, label: s.name }); setLinkStep(null) }}
                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-sm">
                            <span className="font-medium">{s.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">{s.amount} {s.unit}</span>
                          </button>
                        ))
                      : <p className="text-xs text-muted-foreground px-3 py-2">No supplements taken today</p>
                  )}
                  {linkedItem.type === 'other' && (
                    <div className="px-2 py-1">
                      <Input
                        autoFocus
                        placeholder="e.g. Morning run, sleep quality..."
                        value={otherText}
                        onChange={(e) => setOtherText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && otherText.trim()) {
                            setLinkedItem({ type: 'other', label: otherText.trim() })
                            setLinkStep(null)
                            setOtherText('')
                          }
                        }}
                        className="h-8 text-sm"
                      />
                      <Button size="sm" variant="brand" className="mt-2 w-full h-7 text-xs" disabled={!otherText.trim()}
                        onClick={() => { setLinkedItem({ type: 'other', label: otherText.trim() }); setLinkStep(null); setOtherText('') }}>
                        Link this
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {/* Mood + Energy */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-rose-400" /> Mood
              </Label>
              <MoodSelector value={mood} onChange={setMood} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Battery className="w-3.5 h-3.5 text-amber-400" /> Energy Level
              </Label>
              <EnergySelector value={energy} onChange={setEnergy} />
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-muted-foreground" /> Tags
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(TAG_COLORS) as JournalTag[]).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all duration-150 capitalize ${
                    tags.includes(tag) ? TAG_COLORS[tag] : 'border-border text-muted-foreground hover:border-foreground/50'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Prompts */}
          {!usedPrompt && (
            <div className="space-y-2">
              <Label>Writing prompts</Label>
              <div className="flex flex-wrap gap-2">
                {PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handlePrompt(prompt)}
                    className="text-xs text-left bg-muted hover:bg-accent px-3 py-1.5 rounded-lg border border-border hover:border-foreground/20 transition-all text-muted-foreground hover:text-foreground"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Content */}
          <div className="space-y-1.5">
            <Label>Your thoughts</Label>
            <Textarea
              placeholder="Write freely... how are you feeling? What happened today? Any reflections?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[150px]"
            />
            <p className="text-xs text-muted-foreground text-right">{content.length} characters</p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="brand" className="flex-1 gap-1.5" onClick={handleSave}>
              <Save className="w-3.5 h-3.5" />
              Save Entry
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function JournalEntryCard({ entry, onEdit, onDelete }: {
  entry: JournalEntry
  onEdit: () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="hover-lift">
        <CardContent className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <p className="text-xs text-muted-foreground">{format(new Date(entry.date), 'EEEE, MMM d')}</p>
                <span className="text-lg">{MOOD_EMOJIS[entry.mood]}</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`w-1.5 h-3 rounded-full ${i <= entry.energy ? 'bg-amber-400' : 'bg-muted'}`}
                    />
                  ))}
                </div>
              </div>
              {entry.title && (
                <h3 className="font-semibold">{entry.title}</h3>
              )}
            </div>
            <div className="flex gap-1 ml-2">
              <Button variant="ghost" size="icon-sm" onClick={onEdit} className="text-muted-foreground hover:text-foreground">
                <Edit2 className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={onDelete} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Linked item */}
          {entry.linked_item && (
            <div className="mb-3">
              {(() => {
                const cfg = LINK_TYPE_CONFIG[entry.linked_item.type]
                const Icon = cfg.icon
                return (
                  <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${cfg.color}`}>
                    <Icon className="w-3 h-3" />
                    {entry.linked_item.label}
                  </span>
                )
              })()}
            </div>
          )}

          {/* Tags */}
          {entry.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {entry.tags.map((tag) => (
                <span key={tag} className={`text-xs px-2 py-0.5 rounded-full border capitalize ${TAG_COLORS[tag]}`}>
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Content */}
          <div>
            <p className={`text-sm text-muted-foreground leading-relaxed ${!expanded ? 'line-clamp-3' : ''}`}>
              {entry.content}
            </p>
            {entry.content.length > 200 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-primary hover:underline mt-1"
              >
                {expanded ? 'Show less' : 'Read more'}
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export default function JournalPage() {
  const { journalEntries, addJournalEntry, updateJournalEntry, deleteJournalEntry, user } = useAppStore()
  const [search, setSearch] = useState('')
  const [filterTag, setFilterTag] = useState<JournalTag | 'all'>('all')
  const [editEntry, setEditEntry] = useState<JournalEntry | null>(null)

  const filtered = journalEntries.filter((entry) => {
    const matchesSearch =
      !search ||
      entry.content.toLowerCase().includes(search.toLowerCase()) ||
      entry.title?.toLowerCase().includes(search.toLowerCase())
    const matchesTag = filterTag === 'all' || entry.tags.includes(filterTag)
    return matchesSearch && matchesTag
  })

  const handleCreate = (data: Partial<JournalEntry>) => {
    addJournalEntry({
      id: `j-${Date.now()}`,
      user_id: user!.id,
      date: getTodayISO(),
      content: data.content!,
      title: data.title,
      mood: data.mood!,
      energy: data.energy!,
      tags: data.tags || [],
      workout_id: data.workout_id,
      linked_item: data.linked_item,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    toast.success('Journal entry saved!')
  }

  const handleUpdate = (id: string, data: Partial<JournalEntry>) => {
    updateJournalEntry(id, data)
    setEditEntry(null)
    toast.success('Entry updated!')
  }

  const handleDelete = (id: string) => {
    deleteJournalEntry(id)
    toast.success('Entry deleted')
  }

  // Stats
  const avgMood = journalEntries.length
    ? Math.round(journalEntries.reduce((acc, e) => acc + e.mood, 0) / journalEntries.length * 10) / 10
    : 0

  const avgEnergy = journalEntries.length
    ? Math.round(journalEntries.reduce((acc, e) => acc + e.energy, 0) / journalEntries.length * 10) / 10
    : 0

  // Tag counts
  const tagCounts: Partial<Record<JournalTag, number>> = {}
  journalEntries.forEach((e) => e.tags.forEach((t) => { tagCounts[t] = (tagCounts[t] || 0) + 1 }))
  const topTags = Object.entries(tagCounts).sort(([, a], [, b]) => b - a).slice(0, 3)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Journal</h2>
          <p className="text-muted-foreground text-sm hidden sm:block">Daily reflections, mood, and energy tracking</p>
        </div>
        <JournalEditorDialog onSave={handleCreate} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Entries', value: journalEntries.length, icon: BookOpen, sub: undefined, capitalize: false },
          { label: 'Avg Mood', value: `${avgMood}/5`, icon: Heart, sub: MOOD_EMOJIS[Math.round(avgMood) as MoodLevel], capitalize: false },
          { label: 'Avg Energy', value: `${avgEnergy}/5`, icon: Battery, sub: undefined, capitalize: false },
          { label: 'Top Tag', value: topTags[0]?.[0] || 'None', icon: Tag, sub: undefined, capitalize: true },
        ].map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label} className="hover-lift">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-1.5">
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Icon className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                </div>
                <p className={`text-xl font-bold tabular-nums ${stat.capitalize ? 'capitalize' : ''}`}>
                  {stat.sub && <span className="mr-1">{stat.sub}</span>}
                  {stat.value}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Sidebar filters */}
        <div className="lg:col-span-1 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search entries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoCapitalize="none"
              autoCorrect="off"
              className="pl-9 pr-8"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Tag filter */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs">Filter by tag</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <button
                onClick={() => setFilterTag('all')}
                className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg transition-all ${
                  filterTag === 'all' ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                All entries ({journalEntries.length})
              </button>
              {(Object.keys(TAG_COLORS) as JournalTag[]).map((tag) => (
                <button
                  key={tag}
                  onClick={() => setFilterTag(tag === filterTag ? 'all' : tag)}
                  className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg capitalize transition-all flex items-center justify-between ${
                    filterTag === tag
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {tag}
                  <span className="text-muted-foreground">
                    {journalEntries.filter((e) => e.tags.includes(tag)).length}
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Today&apos;s prompt */}
          <Card className="bg-gradient-to-br from-primary/5 to-teal-500/5 border-primary/20">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-primary mb-2">✨ Today&apos;s prompt</p>
              <p className="text-sm text-muted-foreground italic leading-relaxed">
                &quot;{PROMPTS[new Date().getDay() % PROMPTS.length]}&quot;
              </p>
              <JournalEditorDialog onSave={handleCreate}>
                <Button variant="outline" size="sm" className="mt-3 w-full text-xs">
                  Write about this
                </Button>
              </JournalEditorDialog>
            </CardContent>
          </Card>
        </div>

        {/* Entries list */}
        <div className="lg:col-span-3 space-y-3">
          {filtered.length > 0 ? (
            <AnimatePresence>
              {filtered.map((entry) => (
                <JournalEntryCard
                  key={entry.id}
                  entry={entry}
                  onEdit={() => setEditEntry(entry)}
                  onDelete={() => handleDelete(entry.id)}
                />
              ))}
            </AnimatePresence>
          ) : (
            <div className="rounded-[1.75rem] border border-dashed border-border/70 bg-muted/20 px-6 py-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-background/80">
                <BookOpen className="h-6 w-6 text-muted-foreground/60" />
              </div>
              <p className="mt-5 font-medium text-foreground">
                {search || filterTag !== 'all' ? 'No matching entries' : 'No journal entries yet'}
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                {search || filterTag !== 'all'
                  ? 'Try a different search term or clear your filters.'
                  : 'Start with one quick reflection. Your journal becomes much more useful once Rivora can connect mood, energy, meals, and workouts over time.'}
              </p>
              {!search && filterTag === 'all' && (
                <>
                  <div className="mx-auto mt-5 max-w-lg rounded-2xl border border-border/60 bg-background/70 p-4 text-left">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Starter prompts</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {PROMPTS.slice(0, 4).map((prompt) => (
                        <div key={prompt} className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
                          {prompt}
                        </div>
                      ))}
                    </div>
                  </div>
                  <JournalEditorDialog onSave={handleCreate}>
                    <Button variant="brand" className="mt-5" size="sm">
                      Write Your First Entry
                    </Button>
                  </JournalEditorDialog>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit dialog */}
      {editEntry && (
        <Dialog open={!!editEntry} onOpenChange={() => setEditEntry(null)}>
          <JournalEditorDialog
            entry={editEntry}
            onSave={(data) => handleUpdate(editEntry.id, data)}
          />
        </Dialog>
      )}
    </div>
  )
}
