'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Pencil, Check } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/store/useAppStore'
import { getTodayISO } from '@/lib/utils'
import { WaterLogModal } from './WaterLogModal'
import { toast } from 'sonner'
import type { WaterEntry } from '@/types'

// ─── Unit helpers ────────────────────────────────────────────────────────────

type WaterUnit = 'ml' | 'oz' | 'l'

const UNIT_LABELS: Record<WaterUnit, string> = { ml: 'mL', oz: 'oz', l: 'L' }

function mlToUnit(ml: number, unit: WaterUnit): number {
  if (unit === 'oz') return Math.round(ml / 29.5735)
  if (unit === 'l') return Math.round((ml / 1000) * 100) / 100
  return Math.round(ml)
}

function unitToMl(val: number, unit: WaterUnit): number {
  if (unit === 'oz') return Math.round(val * 29.5735)
  if (unit === 'l') return Math.round(val * 1000)
  return Math.round(val)
}

function fmtUnit(ml: number, unit: WaterUnit): string {
  return `${mlToUnit(ml, unit).toLocaleString()} ${UNIT_LABELS[unit]}`
}

// ─── Quick-add presets per unit ──────────────────────────────────────────────

const QUICK_ADDS: Record<WaterUnit, Array<{ label: string; ml: number }>> = {
  ml: [
    { label: '+250', ml: 250 },
    { label: '+500', ml: 500 },
  ],
  oz: [
    { label: '+8 oz', ml: 237 },
    { label: '+16 oz', ml: 473 },
  ],
  l: [
    { label: '+0.25 L', ml: 250 },
    { label: '+0.5 L', ml: 500 },
  ],
}

// ─── Goal gallon presets ─────────────────────────────────────────────────────

const GOAL_PRESETS = [
  { label: '¼ Gal', ml: 946 },
  { label: '½ Gal', ml: 1893 },
  { label: '¾ Gal', ml: 2839 },
  { label: '1 Gal', ml: 3785 },
]

// ─── Bottle visual ───────────────────────────────────────────────────────────

function WaterBottle({ fillPct }: { fillPct: number }) {
  const clampedPct = Math.min(fillPct, 100)
  return (
    <div className="relative flex-shrink-0">
      {/* Cap */}
      <div className="w-5 h-2.5 bg-muted rounded-t-sm mx-auto" />
      {/* Neck */}
      <div className="w-6 h-3 bg-background border border-border mx-auto" />
      {/* Body */}
      <div className="relative w-9 h-[72px] rounded-lg border border-border overflow-hidden bg-background">
        <motion.div
          className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-sky-600 to-sky-400"
          animate={{ height: `${clampedPct}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 18 }}
        >
          {/* Wave */}
          <div className="absolute -top-1.5 -left-1 w-[calc(100%+8px)] h-3 bg-sky-400 rounded-full opacity-80" />
          {/* Bubbles */}
          <div className="absolute left-2 bottom-[20%] w-1 h-1 rounded-full bg-white/25" />
          <div className="absolute left-4 bottom-[40%] w-0.5 h-0.5 rounded-full bg-white/20" />
        </motion.div>
      </div>
    </div>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export function WaterIntakeCard() {
  const { user, getWaterTotal, addWaterEntry, updateProfile, waterUnit, setWaterUnit } = useAppStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalInput, setGoalInput] = useState('')
  const today = getTodayISO()

  const waterGoal = user
    ? (user.water_goal_ml ?? Math.round(((user.weight_kg ?? 70) * 35) / 50) * 50)
    : 2450
  const todayTotal = getWaterTotal(today)
  const fillPct = waterGoal > 0 ? (todayTotal / waterGoal) * 100 : 0

  // Celebration — must be before any early return (Rules of Hooks)
  useEffect(() => {
    if (!user || todayTotal < waterGoal || waterGoal <= 0) return
    const celebratedDate = localStorage.getItem('rivora-water-celebrated')
    if (celebratedDate !== today) {
      localStorage.setItem('rivora-water-celebrated', today)
      toast.success('Hydration goal reached! 🎉')
    }
  }, [todayTotal, waterGoal, today, user])

  if (!user) return null

  const handleQuickAdd = (ml: number) => {
    const entry: WaterEntry = {
      id: `water-${Date.now()}`,
      user_id: user.id,
      date: today,
      amount_ml: ml,
      logged_at: new Date().toISOString(),
    }
    addWaterEntry(entry)
  }

  const handleGoalSave = () => {
    const val = Number(goalInput)
    if (!isNaN(val) && val > 0) {
      const ml = unitToMl(val, waterUnit)
      const clamped = Math.min(10000, Math.max(500, ml))
      updateProfile({ water_goal_ml: clamped })
    }
    setEditingGoal(false)
    setGoalInput('')
  }

  const handleGoalPreset = (ml: number) => {
    updateProfile({ water_goal_ml: ml })
    setEditingGoal(false)
  }

  const quickAdds = QUICK_ADDS[waterUnit]

  return (
    <>
      <Card className="hover-lift col-span-2 lg:col-span-1">
        <CardContent className="p-3 sm:p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground font-medium">Water</p>

            {/* Unit toggle */}
            <div className="flex items-center rounded-md border border-border overflow-hidden">
              {(['ml', 'oz', 'l'] as WaterUnit[]).map((u) => (
                <button
                  key={u}
                  onClick={() => setWaterUnit(u)}
                  className={`px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                    waterUnit === u
                      ? 'bg-sky-600 text-white'
                      : 'text-muted-foreground hover:text-foreground bg-card'
                  }`}
                >
                  {UNIT_LABELS[u]}
                </button>
              ))}
            </div>
          </div>

          {/* Goal row */}
          <div className="mb-3">
            {editingGoal ? (
              <div className="space-y-2">
                {/* Gallon presets */}
                <div className="grid grid-cols-4 gap-1">
                  {GOAL_PRESETS.map(({ label, ml }) => (
                    <button
                      key={label}
                      onMouseDown={(e) => { e.preventDefault(); handleGoalPreset(ml) }}
                      className={`flex flex-col items-center py-1.5 rounded-md border transition-colors ${
                        waterGoal === ml
                          ? 'border-sky-500 bg-sky-600/10 text-sky-400'
                          : 'border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                    >
                      <span className="text-[10px] font-semibold">{label}</span>
                      <span className="text-[9px] opacity-70">{fmtUnit(ml, waterUnit)}</span>
                    </button>
                  ))}
                </div>
                {/* Custom mL input */}
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={goalInput}
                    placeholder={`Custom (${UNIT_LABELS[waterUnit]})`}
                    onChange={(e) => setGoalInput(e.target.value)}
                    onBlur={handleGoalSave}
                    onKeyDown={(e) => e.key === 'Enter' && handleGoalSave()}
                    className="h-6 text-xs px-1.5 flex-1"
                    autoFocus
                  />
                  <button onClick={handleGoalSave} className="text-muted-foreground hover:text-foreground">
                    <Check className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => { setGoalInput(String(mlToUnit(waterGoal, waterUnit))); setEditingGoal(true) }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <span>Goal: {fmtUnit(waterGoal, waterUnit)}</span>
                <Pencil className="w-2.5 h-2.5" />
              </button>
            )}
          </div>

          {/* Bottle + stats */}
          <div className="flex items-center gap-3 mb-3">
            <WaterBottle fillPct={fillPct} />
            <div className="flex-1 min-w-0">
              <p className="text-xl sm:text-2xl font-bold tabular-nums text-sky-400">
                {mlToUnit(todayTotal, waterUnit).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                of {mlToUnit(waterGoal, waterUnit).toLocaleString()} {UNIT_LABELS[waterUnit]}
              </p>
              <p className="text-xs text-muted-foreground">
                {Math.round(fillPct)}% · {fmtUnit(Math.max(0, waterGoal - todayTotal), waterUnit)} left
              </p>
            </div>
          </div>

          {/* Quick-add buttons */}
          <div className="flex gap-1.5">
            {quickAdds.map(({ label, ml }) => (
              <button
                key={label}
                onClick={() => handleQuickAdd(ml)}
                className="flex-1 text-xs py-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => setModalOpen(true)}
              className="flex-1 text-xs py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium transition-colors"
            >
              + Custom
            </button>
          </div>
        </CardContent>
      </Card>

      <WaterLogModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onAdd={(entry) => { addWaterEntry(entry); setModalOpen(false) }}
      />
    </>
  )
}
