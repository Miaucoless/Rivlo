'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import {
  BookOpen, Plus, Edit2, Trash2, Tag, Smile, Zap, Search,
  ChevronRight, X, Save, Heart, Battery,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

const ENERGY_EMOJIS: Record<EnergyLevel, string> = {
  1: '🪫', 2: '😴', 3: '⚡', 4: '🔥', 5: '⚡⚡',
}

function MoodSelector({ value, onChange }: { value: MoodLevel; onChange: (v: MoodLevel) => void }) {
  return (
    <div className="flex gap-2">
      {([1, 2, 3, 4, 5] as MoodLevel[]).map((level) => (
        <button
          key={level}
          type="button"
          onClick={() => onChange(level)}
          className={`text-2xl transition-all duration-200 hover:scale-110 ${
            value === level ? 'scale-125 filter-none' : 'opacity-50'
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

// Journal editor dialog
function JournalEditorDialog({
  entry,
  onSave,
  onClose,
  children,
}: {
  entry?: JournalEntry
  onSave: (data: Partial<JournalEntry>) => void
  onClose?: () => void
  children?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(entry?.title || '')
  const [content, setContent] = useState(entry?.content || '')
  const [mood, setMood] = useState<MoodLevel>(entry?.mood || 4)
  const [energy, setEnergy] = useState<EnergyLevel>(entry?.energy || 3)
  const [tags, setTags] = useState<JournalTag[]>(entry?.tags || [])
  const [usedPrompt, setUsedPrompt] = useState(false)

  const toggleTag = (tag: JournalTag) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
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
    onSave({ title: title || undefined, content, mood, energy, tags })
    setOpen(false)
    setTitle('')
    setContent('')
    setMood(4)
    setEnergy(3)
    setTags([])
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
          <p className="text-muted-foreground text-sm">Daily reflections, mood, and energy tracking</p>
        </div>
        <JournalEditorDialog onSave={handleCreate} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Entries', value: journalEntries.length, icon: BookOpen, color: 'text-primary' },
          { label: 'Avg Mood', value: `${avgMood}/5`, icon: Heart, color: 'text-rose-400', sub: MOOD_EMOJIS[Math.round(avgMood) as MoodLevel] },
          { label: 'Avg Energy', value: `${avgEnergy}/5`, icon: Battery, color: 'text-amber-400' },
          { label: 'Top Tag', value: topTags[0]?.[0] || 'None', icon: Tag, color: 'text-purple-400', capitalize: true },
        ].map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label} className="hover-lift">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-1.5">
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <p className={`text-xl font-bold capitalize ${stat.color}`}>
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
              className="pl-9"
            />
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

          {/* Today's prompt */}
          <Card className="bg-gradient-to-br from-primary/5 to-teal-500/5 border-primary/20">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-primary mb-2">✨ Today's prompt</p>
              <p className="text-sm text-muted-foreground italic leading-relaxed">
                "{PROMPTS[new Date().getDay() % PROMPTS.length]}"
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
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground text-center">
              <BookOpen className="w-12 h-12 mb-4 opacity-20" />
              <p className="font-medium">
                {search || filterTag !== 'all' ? 'No matching entries' : 'No journal entries yet'}
              </p>
              <p className="text-sm mt-1">
                {search || filterTag !== 'all'
                  ? 'Try a different search or filter'
                  : 'Write your first entry to get started'}
              </p>
              {!search && filterTag === 'all' && (
                <JournalEditorDialog onSave={handleCreate}>
                  <Button variant="brand" className="mt-4" size="sm">
                    Write Your First Entry
                  </Button>
                </JournalEditorDialog>
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
            onClose={() => setEditEntry(null)}
          />
        </Dialog>
      )}
    </div>
  )
}
