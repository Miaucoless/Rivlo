'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/useAppStore'
import { getTodayISO } from '@/lib/utils'
import type { WaterEntry } from '@/types'

interface WaterLogModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (entry: WaterEntry) => void
}

export function WaterLogModal({ open, onOpenChange, onAdd }: WaterLogModalProps) {
  const [amount, setAmount] = useState('')
  const { user, waterLogs, removeWaterEntry } = useAppStore()
  const today = getTodayISO()
  const todayEntries = waterLogs[today] || []

  const isValid = Number(amount) > 0 && !isNaN(Number(amount))

  const handleAdd = () => {
    if (!isValid || !user) return
    const entry: WaterEntry = {
      id: `water-${Date.now()}`,
      user_id: user.id,
      date: today,
      amount_ml: Number(amount),
      logged_at: new Date().toISOString(),
    }
    onAdd(entry)
    setAmount('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Log Water</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="e.g. 330"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="flex-1"
            />
            <span className="flex items-center text-sm text-muted-foreground">mL</span>
          </div>
          <Button className="w-full" disabled={!isValid} onClick={handleAdd}>
            Add
          </Button>

          {/* Today's log */}
          <div className="border-t border-border pt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Today's Log
            </p>
            {todayEntries.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">No entries yet today</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {[...todayEntries].reverse().map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground text-xs">
                      {format(new Date(entry.logged_at), 'h:mm a')}
                    </span>
                    <span className="font-medium text-xs">+{entry.amount_ml} mL</span>
                    <button
                      onClick={() => removeWaterEntry(today, entry.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Remove entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
