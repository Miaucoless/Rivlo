'use client'

import React from 'react'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Bell,
  CheckCircle2,
  Edit2,
  Pill,
  PillBottle,
  Plus,
  Shield,
  Trash2,
} from 'lucide-react'
import type { SupplementCategory, SupplementEntry, SupplementFrequency } from '@/types'
import { useAppStore } from '@/store/useAppStore'
import { getTodayISO } from '@/lib/utils'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const CATEGORY_OPTIONS: Array<{ value: SupplementCategory; label: string }> = [
  { value: 'vitamin', label: 'Vitamin' },
  { value: 'mineral', label: 'Mineral' },
  { value: 'herbal', label: 'Herbal' },
  { value: 'supplement', label: 'Supplement' },
  { value: 'medicine', label: 'Medicine' },
  { value: 'other', label: 'Other' },
]

const FREQUENCY_OPTIONS: Array<{ value: SupplementFrequency; label: string }> = [
  { value: 'daily', label: 'Daily' },
  { value: 'twice_daily', label: 'Twice daily' },
  { value: 'three_times_daily', label: 'Three times daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'as_needed', label: 'As needed' },
]

function categoryBadgeVariant(category: SupplementCategory) {
  switch (category) {
    case 'vitamin':
      return 'success'
    case 'mineral':
      return 'info'
    case 'herbal':
      return 'warning'
    case 'medicine':
      return 'destructive'
    default:
      return 'outline'
  }
}

function formatFrequency(frequency: SupplementFrequency) {
  return FREQUENCY_OPTIONS.find((option) => option.value === frequency)?.label || frequency.replaceAll('_', ' ')
}

function SupplementEditor({
  supplement,
  children,
}: {
  supplement?: SupplementEntry
  children?: React.ReactNode
}) {
  const { addSupplement, updateSupplement } = useAppStore()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(supplement?.name || '')
  const [category, setCategory] = useState<SupplementCategory>(supplement?.category || 'supplement')
  const [amount, setAmount] = useState(supplement ? String(supplement.amount) : '')
  const [unit, setUnit] = useState(supplement?.unit || 'mg')
  const [frequency, setFrequency] = useState<SupplementFrequency>(supplement?.frequency || 'daily')
  const [notes, setNotes] = useState(supplement?.notes || '')
  const [notificationEnabled, setNotificationEnabled] = useState(supplement?.notification_enabled ?? true)

  const reset = () => {
    setName(supplement?.name || '')
    setCategory(supplement?.category || 'supplement')
    setAmount(supplement ? String(supplement.amount) : '')
    setUnit(supplement?.unit || 'mg')
    setFrequency(supplement?.frequency || 'daily')
    setNotes(supplement?.notes || '')
    setNotificationEnabled(supplement?.notification_enabled ?? true)
  }

  const handleSave = () => {
    const parsedAmount = Number(amount)

    if (!name.trim()) {
      toast.error('Add a supplement name first.')
      return
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error('Enter a valid amount greater than 0.')
      return
    }

    if (!unit.trim()) {
      toast.error('Add a unit like mg, IU, ml, or tablet.')
      return
    }

    if (supplement) {
      updateSupplement(supplement.id, {
        name: name.trim(),
        category,
        amount: parsedAmount,
        unit: unit.trim(),
        frequency,
        notes: notes.trim() || undefined,
        notification_enabled: notificationEnabled,
      })
      toast.success('Supplement updated.')
    } else {
      const now = new Date().toISOString()
      addSupplement({
        id: `supplement-${Date.now()}`,
        name: name.trim(),
        category,
        amount: parsedAmount,
        unit: unit.trim(),
        frequency,
        notes: notes.trim() || undefined,
        notification_enabled: notificationEnabled,
        taken_dates: [],
        created_at: now,
        updated_at: now,
      })
      toast.success('Supplement added.')
    }

    setOpen(false)
    if (!supplement) reset()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) reset()
      }}
    >
      <DialogTrigger asChild>
        {children || (
          <Button variant="brand" className="gap-2">
            <Plus className="h-4 w-4" />
            Add supplement
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{supplement ? 'Edit supplement' : 'Add supplement'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Name</Label>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Magnesium glycinate" />
            </div>

            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={(value) => setCategory(value as SupplementCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>How often</Label>
              <Select value={frequency} onValueChange={(value) => setFrequency(value as SupplementFrequency)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="e.g. 500" />
            </div>

            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="mg, IU, capsules, ml" />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional notes, like with food, evening only, or refill reminders." />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setNotificationEnabled((value) => !value)}
            className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
              notificationEnabled ? 'border-emerald-500/30 bg-emerald-500/8' : 'border-border bg-background'
            }`}
          >
            <div>
              <p className="text-sm font-medium">Supplement reminders</p>
              <p className="text-xs text-muted-foreground">Show this item in the notification bell when it is due.</p>
            </div>
            <div className={`h-5 w-10 rounded-full transition-colors ${notificationEnabled ? 'bg-emerald-500' : 'bg-muted'}`}>
              <div className={`mt-0.5 h-4 w-4 rounded-full bg-white transition-transform ${notificationEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
          </button>

          <Button variant="brand" className="w-full" onClick={handleSave}>
            {supplement ? 'Save changes' : 'Add supplement'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function SupplementsPage() {
  const today = getTodayISO()
  const { supplements, toggleSupplementTaken, updateSupplement, removeSupplement } = useAppStore()

  const activeSupplements = useMemo(
    () => supplements.filter((supplement) => !supplement.archived).sort((a, b) => a.name.localeCompare(b.name)),
    [supplements]
  )

  const takenToday = activeSupplements.filter((supplement) => supplement.taken_dates.includes(today))
  const dueToday = activeSupplements.filter((supplement) => !supplement.taken_dates.includes(today) && supplement.notification_enabled)
  const remindersEnabled = activeSupplements.filter((supplement) => supplement.notification_enabled)

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
        className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
      >
        <div>
          <h2 className="text-2xl font-bold">Supplements</h2>
          <p className="mt-1 text-sm text-muted-foreground hidden sm:block">
            Keep vitamins, herbals, medications, and other daily support items in one schedule.
          </p>
        </div>
        <SupplementEditor />
      </motion.div>

      <div className="grid gap-3 md:grid-cols-3">
        {[
          {
            label: 'Active items',
            value: activeSupplements.length,
            sub: 'Current stack',
            icon: PillBottle,
            color: 'text-emerald-400',
          },
          {
            label: 'Taken today',
            value: takenToday.length,
            sub: `${Math.max(activeSupplements.length - takenToday.length, 0)} left`,
            icon: CheckCircle2,
          },
          {
            label: 'Reminders on',
            value: remindersEnabled.length,
            sub: `${dueToday.length} due`,
            icon: Bell,
          },
        ].map((item) => (
          <Card key={item.label}>
            <CardHeader className="pb-1 px-4 pt-4">
              <CardTitle className="flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {item.label}
                <item.icon className="h-3.5 w-3.5 text-emerald-500" />
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <div className="flex items-end justify-between gap-3">
                <p className="text-2xl font-bold tabular-nums leading-none">{item.value}</p>
                <p className="text-[11px] text-right text-muted-foreground">{item.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {activeSupplements.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <Shield className="mb-4 h-10 w-10 text-muted-foreground/40" />
            <p className="text-lg font-semibold">No supplements added yet</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Add vitamins, medicines, herbals, or other supplements and choose whether they should show up in your reminders.
            </p>
            <div className="mt-5">
              <SupplementEditor />
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {activeSupplements.map((supplement) => {
            const isTakenToday = supplement.taken_dates.includes(today)

            return (
              <motion.div
                key={supplement.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
              >
                <Card className={isTakenToday ? 'border-emerald-500/25 bg-emerald-500/[0.03]' : ''}>
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-semibold">{supplement.name}</p>
                          <Badge variant={categoryBadgeVariant(supplement.category)}>{supplement.category}</Badge>
                          <Badge variant={supplement.notification_enabled ? 'info' : 'outline'}>
                            {supplement.notification_enabled ? 'Reminder on' : 'Reminder off'}
                          </Badge>
                          <Badge variant={isTakenToday ? 'success' : 'warning'}>
                            {isTakenToday ? 'Taken today' : 'Due today'}
                          </Badge>
                        </div>

                        <p className="mt-2 text-sm text-muted-foreground">
                          {supplement.amount} {supplement.unit} • {formatFrequency(supplement.frequency)}
                        </p>

                        {supplement.notes && (
                          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{supplement.notes}</p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant={isTakenToday ? 'outline' : 'brand'}
                          size="sm"
                          className="gap-1.5"
                          onClick={() => {
                            toggleSupplementTaken(supplement.id)
                            toast.success(isTakenToday ? `${supplement.name} marked as not taken today.` : `${supplement.name} marked taken for today.`)
                          }}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {isTakenToday ? 'Undo today' : 'Mark taken'}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => {
                            updateSupplement(supplement.id, {
                              notification_enabled: !supplement.notification_enabled,
                            })
                            toast.success(supplement.notification_enabled ? 'Reminder turned off.' : 'Reminder turned on.')
                          }}
                        >
                          <Bell className="h-4 w-4" />
                          {supplement.notification_enabled ? 'Mute reminder' : 'Enable reminder'}
                        </Button>

                        <SupplementEditor supplement={supplement}>
                          <Button variant="outline" size="sm" className="gap-1.5">
                            <Edit2 className="h-4 w-4" />
                            Edit
                          </Button>
                        </SupplementEditor>

                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-destructive hover:text-destructive"
                          onClick={() => {
                            removeSupplement(supplement.id)
                            toast.success('Supplement removed.')
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1">
                        <Pill className="h-3.5 w-3.5" />
                        {supplement.taken_dates.length} day{supplement.taken_dates.length === 1 ? '' : 's'} logged
                      </span>
                      {supplement.taken_dates[0] && (
                        <span className="inline-flex items-center rounded-full bg-muted px-3 py-1">
                          Last taken: {supplement.taken_dates[0]}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
