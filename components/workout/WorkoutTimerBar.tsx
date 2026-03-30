'use client'

import { useEffect, useRef, useState } from 'react'

interface WorkoutTimerBarProps {
  durationSeconds: number
  restSeconds: number
  isTimerStarted: boolean
  onStartTimer: () => void
  onSkipRest: () => void
}

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function WorkoutTimerBar({ durationSeconds, restSeconds, isTimerStarted, onStartTimer, onSkipRest }: WorkoutTimerBarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const prevRestRef = useRef(0)
  const restActive = restSeconds > 0

  // Auto-expand whenever rest timer starts (restSeconds transitions from 0 → >0)
  useEffect(() => {
    if (prevRestRef.current === 0 && restSeconds > 0) {
      setCollapsed(false)
    }
    prevRestRef.current = restSeconds
  }, [restSeconds])

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className={`absolute bottom-2.5 right-2.5 z-50 flex items-center gap-1.5 rounded-full border bg-[#0b1a15] px-2.5 py-1.5 sm:hidden ${
          restActive ? 'border-amber-400/40' : 'border-border/40'
        }`}
      >
        {isTimerStarted ? (
          <span className="font-mono text-xs font-bold text-emerald-400">{formatTime(durationSeconds)}</span>
        ) : (
          <span className="text-[10px] font-semibold text-emerald-400/70">▶ Start</span>
        )}
        {restActive && (
          <>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className="font-mono text-xs font-bold text-amber-400">{formatTime(restSeconds)}</span>
          </>
        )}
        <span className="ml-0.5 text-[10px] text-muted-foreground">↑</span>
      </button>
    )
  }

  return (
    <div
      className={`absolute bottom-0 left-0 right-0 z-50 flex items-center justify-between bg-[#0b1a15] px-3 py-2 sm:hidden ${
        restActive ? 'border-t border-amber-400/30' : 'border-t border-border/40'
      }`}
    >
      <div className="flex items-center gap-3.5">
        {isTimerStarted ? (
          <>
            <div className="text-center">
              <p className="font-mono text-base font-bold leading-none text-emerald-400">{formatTime(durationSeconds)}</p>
              <p className="mt-0.5 text-[7px] uppercase tracking-[0.1em] text-muted-foreground">Duration</p>
            </div>
            <div className="h-7 w-px bg-border/40" />
            <div className="text-center">
              <p className={`font-mono text-base font-bold leading-none ${restActive ? 'text-amber-400' : 'text-muted-foreground'}`}>
                {restActive ? formatTime(restSeconds) : '—'}
              </p>
              <p className="mt-0.5 text-[7px] uppercase tracking-[0.1em] text-muted-foreground">Rest</p>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={onStartTimer}
            className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20"
          >
            ▶ Start Timer
          </button>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {restActive && (
          <button
            type="button"
            onClick={onSkipRest}
            className="rounded-lg border border-border/50 bg-muted/20 px-2 py-1 text-[9px] text-muted-foreground transition-colors hover:text-foreground"
          >
            Skip
          </button>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="rounded-lg border border-border/50 bg-muted/20 px-1.5 py-1 text-[11px] leading-none text-muted-foreground transition-colors hover:text-foreground"
        >
          ↓
        </button>
      </div>
    </div>
  )
}
