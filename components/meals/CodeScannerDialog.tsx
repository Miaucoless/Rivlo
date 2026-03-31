'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Loader2, RefreshCcw, ScanLine, Search, ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { BarcodeFoodLookupResult } from '@/lib/barcode-food'

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'drink'
type ScannerTarget = 'today' | 'saved'
type CameraState = 'idle' | 'starting' | 'ready' | 'paused' | 'unsupported' | 'error'

type CodeScannerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialTarget: ScannerTarget
  initialMealType: MealType
  lockTarget?: boolean
  onAddToToday: (item: BarcodeFoodLookupResult, mealType: MealType) => void
  onSaveMeal: (item: BarcodeFoodLookupResult, mealType: MealType) => void
}

type ScannerControls = {
  stop: () => void
}

const TARGET_LABELS: Record<ScannerTarget, string> = {
  today: "Add to Today",
  saved: 'Save Meal',
}

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
  drink: 'Drink',
}

function formatDisplayName(item: BarcodeFoodLookupResult) {
  if (item.brand && !item.name.toLowerCase().startsWith(item.brand.toLowerCase())) {
    return `${item.brand} ${item.name}`
  }
  return item.name
}

export function CodeScannerDialog({
  open,
  onOpenChange,
  initialTarget,
  initialMealType,
  lockTarget = false,
  onAddToToday,
  onSaveMeal,
}: CodeScannerDialogProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const controlsRef = useRef<ScannerControls | null>(null)
  const lastScannedCodeRef = useRef<string | null>(null)
  const lookupInFlightRef = useRef(false)

  const [target, setTarget] = useState<ScannerTarget>(initialTarget)
  const [mealType, setMealType] = useState<MealType>(initialMealType)
  const [manualCode, setManualCode] = useState('')
  const [cameraState, setCameraState] = useState<CameraState>('idle')
  const [cameraMessage, setCameraMessage] = useState('Point your camera at a barcode or QR code.')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const [product, setProduct] = useState<BarcodeFoodLookupResult | null>(null)
  const [scanSession, setScanSession] = useState(0)

  const displayName = useMemo(() => (product ? formatDisplayName(product) : ''), [product])

  const stopScanner = useCallback(() => {
    controlsRef.current?.stop()
    controlsRef.current = null
    if (videoRef.current) {
      try {
        videoRef.current.srcObject = null
      } catch {
        // ignore cleanup issues
      }
    }
  }, [])

  const lookupCode = useCallback(async (rawCode: string) => {
    const trimmed = rawCode.trim()
    if (!trimmed || lookupInFlightRef.current) return

    lookupInFlightRef.current = true
    setLookupLoading(true)
    setLookupError('')
    setCameraState((state) => (state === 'ready' ? 'paused' : state))
    setCameraMessage('Looking up nutrition info…')

    try {
      const response = await fetch(`/api/food/barcode?code=${encodeURIComponent(trimmed)}`)
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || 'Could not look up that code.')
      }

      if (!payload?.item) {
        setProduct(null)
        setLookupError('No food product matched that code yet. Try another barcode or enter it manually.')
        setCameraMessage('No match found. Try another package or code.')
        return
      }

      setProduct(payload.item as BarcodeFoodLookupResult)
      setCameraMessage('Food found. Review it and add it where you want.')
    } catch (error) {
      setProduct(null)
      setLookupError(error instanceof Error ? error.message : 'Could not look up that code.')
      setCameraMessage('Lookup failed. You can try again or enter the code manually.')
    } finally {
      lookupInFlightRef.current = false
      setLookupLoading(false)
    }
  }, [])

  const startScanner = useCallback(async () => {
    if (!open || !videoRef.current) return
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraState('unsupported')
      setCameraMessage('Camera scanning is not available here, but manual code entry still works.')
      return
    }

    stopScanner()
    setCameraState('starting')
    setCameraMessage('Starting camera…')

    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser')
      const reader = new BrowserMultiFormatReader()
      let cameraStream: MediaStream | null = null

      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        })
      } catch {
        cameraStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: true,
        })
      }

      const handleDecodeResult = (result: unknown, error: unknown, activeControls: ScannerControls) => {
        if (result && typeof result === 'object' && 'getText' in result && typeof result.getText === 'function') {
          const scannedText = result.getText().trim()
          if (!scannedText || scannedText === lastScannedCodeRef.current || lookupInFlightRef.current) return

          lastScannedCodeRef.current = scannedText
          activeControls.stop()
          controlsRef.current = null
          void lookupCode(scannedText)
          return
        }

        if (!error || typeof error !== 'object') return

        const errorName = (error as { name?: string }).name
        if (errorName === 'NotFoundException' || errorName === 'ChecksumException' || errorName === 'FormatException') {
          return
        }

        setCameraState('error')
        setCameraMessage('The camera started, but scanning hit an unexpected problem.')
      }

      const controls = await reader.decodeFromStream(
        cameraStream,
        videoRef.current,
        handleDecodeResult,
      ) as ScannerControls

      controlsRef.current = controls
      setCameraState('ready')
      setCameraMessage('Point your camera at a barcode or QR code.')
    } catch (error) {
      if (videoRef.current?.srcObject instanceof MediaStream) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop())
        try {
          videoRef.current.srcObject = null
        } catch {
          // ignore cleanup issues
        }
      }
      const message = error instanceof Error ? error.message : ''
      const permissionBlocked = /permission|notallowed|denied|dismissed/i.test(message)

      setCameraState(permissionBlocked ? 'error' : 'unsupported')
      setCameraMessage(
        permissionBlocked
          ? 'Camera permission is blocked. Allow access or use manual code entry.'
          : 'Camera scanning is not available here, but manual code entry still works.'
      )
    }
  }, [lookupCode, open, stopScanner])

  useEffect(() => {
    if (!open) {
      stopScanner()
      return
    }

    setTarget(initialTarget)
    setMealType(initialMealType)
    setManualCode('')
    setLookupError('')
    setProduct(null)
    setCameraState('idle')
    setCameraMessage('Point your camera at a barcode or QR code.')
    lastScannedCodeRef.current = null
    setScanSession((value) => value + 1)
  }, [initialMealType, initialTarget, open, stopScanner])

  useEffect(() => {
    if (!open || product) return
    void startScanner()
    return () => stopScanner()
  }, [open, product, scanSession, startScanner, stopScanner])

  function handleManualLookup() {
    stopScanner()
    void lookupCode(manualCode)
  }

  function handleScanAgain() {
    setProduct(null)
    setLookupError('')
    setManualCode('')
    lastScannedCodeRef.current = null
    setScanSession((value) => value + 1)
  }

  function handlePrimaryAction() {
    if (!product) return
    if (target === 'today') {
      onAddToToday(product, mealType)
    } else {
      onSaveMeal(product, mealType)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ScanLine className="h-5 w-5 text-primary" />
            Scan Food Code
          </DialogTitle>
          <DialogDescription>
            Scan a package barcode or QR code, then send it straight to today&apos;s meals or your saved meals.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 p-5">
          {!lockTarget && (
            <div className="flex flex-wrap gap-2">
              {(['today', 'saved'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTarget(value)}
                  aria-pressed={target === value}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    target === value
                      ? 'border-primary/50 bg-primary/10 text-primary'
                      : 'border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {TARGET_LABELS[value]}
                </button>
              ))}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-muted/20">
                <div className="aspect-[4/3] bg-gradient-to-br from-muted/40 via-muted/10 to-background">
                  <video
                    ref={videoRef}
                    className="h-full w-full object-cover"
                    muted
                    autoPlay
                    playsInline
                  />
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent px-4 py-3 text-white">
                  <div className="flex items-center gap-2 text-xs font-medium">
                    {lookupLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                    <span>{cameraMessage}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={handleScanAgain}>
                  <RefreshCcw className="h-3.5 w-3.5" />
                  Scan Again
                </Button>
                {(cameraState === 'unsupported' || cameraState === 'error') && (
                  <Badge variant="outline" className="gap-1 border-amber-500/30 bg-amber-500/10 text-amber-300">
                    <ShieldAlert className="h-3 w-3" />
                    Manual code entry ready
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="scanner-meal-type">Meal type</Label>
                <Select value={mealType} onValueChange={(value) => setMealType(value as MealType)}>
                  <SelectTrigger id="scanner-meal-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(MEAL_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="manual-barcode">Manual barcode or QR text</Label>
                <div className="flex gap-2">
                  <Input
                    id="manual-barcode"
                    value={manualCode}
                    onChange={(event) => setManualCode(event.target.value)}
                    placeholder="012345678905 or QR text"
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                  <Button type="button" variant="outline" onClick={handleManualLookup} disabled={!manualCode.trim() || lookupLoading}>
                    {lookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {lookupError ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive/80">
                  {lookupError}
                </div>
              ) : null}

              {product ? (
                <div className="rounded-2xl border border-border/60 bg-card p-4">
                  <div className="flex items-start gap-3">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={displayName}
                        className="h-16 w-16 rounded-xl border border-border/50 object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-border/50 bg-muted/20">
                        <ScanLine className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{displayName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {product.serving_label} · {product.barcode}
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {[
                          { label: 'Calories', value: `${product.macros.calories}` },
                          { label: 'Protein', value: `${product.macros.protein_g}g` },
                          { label: 'Carbs', value: `${product.macros.carbs_g}g` },
                          { label: 'Fat', value: `${product.macros.fat_g}g` },
                        ].map((macro) => (
                          <div key={macro.label} className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
                            <p className="font-data text-sm font-semibold">{macro.value}</p>
                            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{macro.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/60 bg-muted/15 p-4 text-sm text-muted-foreground">
                  Scan a package or paste its code to pull the serving and macros into Rivora.
                </div>
              )}

              <Button type="button" className="w-full" onClick={handlePrimaryAction} disabled={!product}>
                {target === 'today'
                  ? `Add to ${MEAL_TYPE_LABELS[mealType]}`
                  : `Save as ${MEAL_TYPE_LABELS[mealType]} Meal`}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
