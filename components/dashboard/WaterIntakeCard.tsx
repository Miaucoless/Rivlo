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

export function WaterIntakeCard() {
  const { user, getWaterTotal, addWaterEntry, updateProfile } = useAppStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalInput, setGoalInput] = useState('')
  const today = getTodayISO()

  const waterGoal = user
    ? (user.water_goal_ml ?? Math.round(((user.weight_kg ?? 70) * 35) / 50) * 50)
    : 2450
  const todayTotal = getWaterTotal(today)
  const fillPct = waterGoal > 0 ? (todayTotal / waterGoal) * 100 : 0

  // Celebration effect — must be before any early return (Rules of Hooks)
  useEffect(() => {
    if (!user || todayTotal < waterGoal || waterGoal <= 0) return
    const celebratedDate = localStorage.getItem('rivlo-water-celebrated')
    if (celebratedDate !== today) {
      localStorage.setItem('rivlo-water-celebrated', today)
      toast.success('Hydration goal reached! 🎉')
    }
  }, [todayTotal, waterGoal, today, user])

  if (!user) return null

  const handleQuickAdd = (amount: number) => {
    const entry: WaterEntry = {
      id: `water-${Date.now()}`,
      user_id: user.id,
      date: today,
      amount_ml: amount,
      logged_at: new Date().toISOString(),
    }
    addWaterEntry(entry)
  }

  const handleGoalSave = () => {
    const val = Number(goalInput)
    if (!isNaN(val) && val >= 500 && val <= 10000) {
      updateProfile({ water_goal_ml: val })
    }
    setEditingGoal(false)
    setGoalInput('')
  }

  return (
    <>
      <Card className="hover-lift col-span-2 lg:col-span-1">
        <CardContent className="p-3 sm:p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs text-muted-foreground font-medium">Water</p>
            {/* Goal edit */}
            <div className="flex items-center gap-1">
              {editingGoal ? (
                <>
                  <Input
                    type="number"
                    value={goalInput}
                    onChange={(e) => setGoalInput(e.target.value)}
                    onBlur={handleGoalSave}
                    onKeyDown={(e) => e.key === 'Enter' && handleGoalSave()}
                    className="w-20 h-6 text-xs px-1.5"
                    autoFocus
                  />
                  <button onClick={handleGoalSave} className="text-muted-foreground hover:text-foreground">
                    <Check className="w-3 h-3" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => { setGoalInput(String(waterGoal)); setEditingGoal(true) }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <span>{waterGoal} mL</span>
                  <Pencil className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          </div>

          {/* Bottle + stats */}
          <div className="flex items-center gap-3 mb-3">
            <WaterBottle fillPct={fillPct} />
            <div className="flex-1 min-w-0">
              <p className="text-xl sm:text-2xl font-bold tabular-nums text-sky-400">
                {todayTotal.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                of {waterGoal.toLocaleString()} mL
              </p>
              <p className="text-xs text-muted-foreground">
                {Math.round(fillPct)}% · {Math.max(0, waterGoal - todayTotal).toLocaleString()} mL left
              </p>
            </div>
          </div>

          {/* Quick-add buttons */}
          <div className="flex gap-1.5">
            <button
              onClick={() => handleQuickAdd(250)}
              className="flex-1 text-xs py-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              +250
            </button>
            <button
              onClick={() => handleQuickAdd(500)}
              className="flex-1 text-xs py-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              +500
            </button>
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
