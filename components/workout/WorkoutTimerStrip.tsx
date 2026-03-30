'use client'

interface WorkoutTimerStripProps {
  durationSeconds: number
  restSeconds: number
  progress: number       // 0–100
  onSkipRest: () => void
}

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

const CIRCUMFERENCE = 2 * Math.PI * 24 // ≈ 150.796

export function WorkoutTimerStrip({ durationSeconds, restSeconds, progress, onSkipRest }: WorkoutTimerStripProps) {
  const restActive = restSeconds > 0
  const durationOffset = CIRCUMFERENCE * (1 - progress / 100)
  // Rest ring: half-filled when active (decorative indicator), empty when idle
  const restOffset = restActive ? CIRCUMFERENCE * 0.5 : CIRCUMFERENCE

  return (
    <div className="sticky top-0 hidden w-24 flex-shrink-0 flex-col items-center gap-4 self-start border-r border-border/40 bg-[#0b1a15] px-2 py-4 sm:flex">
      <p className="text-[8px] uppercase tracking-[0.12em] text-muted-foreground">Workout</p>

      {/* Duration ring */}
      <div className="flex flex-col items-center gap-1">
        <div className="relative flex h-[60px] w-[60px] items-center justify-center">
          <svg width="60" height="60" viewBox="0 0 60 60" className="-rotate-90">
            <circle cx="30" cy="30" r="24" fill="none" stroke="currentColor" strokeWidth="4" className="text-border/40" />
            <circle
              cx="30" cy="30" r="24" fill="none"
              stroke="currentColor" strokeWidth="4"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={durationOffset}
              strokeLinecap="round"
              className="text-emerald-500 transition-all duration-1000"
            />
          </svg>
          <span className="absolute font-mono text-[11px] font-bold text-emerald-400">
            {formatTime(durationSeconds)}
          </span>
        </div>
        <p className="text-[8px] uppercase tracking-[0.1em] text-muted-foreground">Duration</p>
      </div>

      <div className="h-px w-14 bg-border/40" />

      {/* Rest ring */}
      <div className="flex flex-col items-center gap-1">
        <div className="relative flex h-[60px] w-[60px] items-center justify-center">
          <svg width="60" height="60" viewBox="0 0 60 60" className="-rotate-90">
            <circle cx="30" cy="30" r="24" fill="none" stroke="currentColor" strokeWidth="4" className="text-border/40" />
            <circle
              cx="30" cy="30" r="24" fill="none"
              stroke="currentColor" strokeWidth="4"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={restOffset}
              strokeLinecap="round"
              className={restActive ? 'text-amber-400 transition-all duration-1000' : 'text-border/20'}
            />
          </svg>
          <span className={`absolute font-mono text-[11px] font-bold ${restActive ? 'text-amber-400' : 'text-muted-foreground'}`}>
            {restActive ? formatTime(restSeconds) : '—'}
          </span>
        </div>
        <p className="text-[8px] uppercase tracking-[0.1em] text-muted-foreground">Rest</p>
      </div>

      {restActive && (
        <button
          type="button"
          onClick={onSkipRest}
          className="rounded-md border border-border/60 bg-muted/20 px-2 py-1 text-[9px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Skip
        </button>
      )}

      <div className="flex-1" />

      <p className="px-1 text-center text-[9px] text-muted-foreground/70">
        {progress}%<br />done
      </p>
    </div>
  )
}
