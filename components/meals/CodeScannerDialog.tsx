'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Camera, ImagePlus, Loader2, RefreshCcw, ScanLine, Search, ShieldAlert, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { BarcodeFoodLookupResult } from '@/lib/barcode-food'
import { parseNutritionLabelText } from '@/lib/nutrition-label'

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'drink'
type ScannerTarget = 'today' | 'saved'
type ScannerMode = 'barcode' | 'label'
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

const NON_FATAL_SCAN_ERROR_NAMES = new Set([
  'NotFoundException',
  'ChecksumException',
  'FormatException',
  'ReaderException',
  'DecodeHintTypeException',
  'IllegalArgumentException',
  'TypeError',
])

const TARGET_LABELS: Record<ScannerTarget, string> = {
  today: 'Add to Today',
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

function formatSourceMeta(item: BarcodeFoodLookupResult) {
  const detail = item.barcode ? `${item.serving_label} · ${item.barcode}` : item.serving_label
  return item.source === 'nutrition_label_ocr' ? `${detail} · Nutrition label` : detail
}

function formatMacroInput(value: number) {
  return Number.isFinite(value) ? String(value) : ''
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
  const streamRef = useRef<MediaStream | null>(null)
  const lastScannedCodeRef = useRef<string | null>(null)
  const lookupInFlightRef = useRef(false)
  const cameraCaptureInputRef = useRef<HTMLInputElement | null>(null)
  const imageUploadInputRef = useRef<HTMLInputElement | null>(null)

  const [target, setTarget] = useState<ScannerTarget>(initialTarget)
  const [mealType, setMealType] = useState<MealType>(initialMealType)
  const [mode, setMode] = useState<ScannerMode>('barcode')
  const [manualCode, setManualCode] = useState('')
  const [cameraState, setCameraState] = useState<CameraState>('idle')
  const [cameraMessage, setCameraMessage] = useState('Point your camera at a barcode or QR code.')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [labelLoading, setLabelLoading] = useState(false)
  const [labelStatus, setLabelStatus] = useState('Take a clear photo of the nutrition facts panel.')
  const [lookupError, setLookupError] = useState('')
  const [product, setProduct] = useState<BarcodeFoodLookupResult | null>(null)
  const [scanSession, setScanSession] = useState(0)
  const [labelPreviewUrl, setLabelPreviewUrl] = useState<string | null>(null)

  const displayName = useMemo(() => (product ? formatDisplayName(product) : ''), [product])
  const isBusy = lookupLoading || labelLoading

  const clearLabelPreview = useCallback(() => {
    setLabelPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current)
      }
      return null
    })
  }, [])

  const stopScanner = useCallback(() => {
    controlsRef.current?.stop()
    controlsRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) {
      try {
        videoRef.current.srcObject = null
      } catch {
        // ignore cleanup issues
      }
    }
  }, [])

  const resetResultState = useCallback(() => {
    setLookupError('')
    setProduct(null)
    setManualCode('')
    lastScannedCodeRef.current = null
  }, [])

  const lookupCode = useCallback(async (rawCode: string) => {
    const trimmed = rawCode.trim()
    if (!trimmed || lookupInFlightRef.current) return

    lookupInFlightRef.current = true
    setLookupLoading(true)
    setLookupError('')
    setProduct(null)
    setCameraState((state) => (state === 'ready' ? 'paused' : state))
    setCameraMessage('Looking up nutrition info…')

    try {
      const response = await fetch(`/api/food/barcode?code=${encodeURIComponent(trimmed)}`)
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || 'Could not look up that code.')
      }

      if (!payload?.item) {
        setLookupError('No food product matched that code yet. Try another barcode or scan the nutrition label instead.')
        setCameraMessage('No match found. Try another package or code.')
        return
      }

      setProduct(payload.item as BarcodeFoodLookupResult)
      setCameraMessage('Food found. Review it and add it where you want.')
    } catch (error) {
      setLookupError(error instanceof Error ? error.message : 'Could not look up that code.')
      setCameraMessage('Lookup failed. You can try again or enter the code manually.')
    } finally {
      lookupInFlightRef.current = false
      setLookupLoading(false)
    }
  }, [])

  const startScanner = useCallback(async () => {
    if (!open || !videoRef.current || mode !== 'barcode') return
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

      streamRef.current = cameraStream

      const videoElement = videoRef.current
      if (!videoElement) {
        throw new Error('Camera preview element is missing.')
      }

      videoElement.srcObject = cameraStream
      videoElement.muted = true
      videoElement.playsInline = true
      videoElement.autoplay = true

      await new Promise<void>((resolve, reject) => {
        const handleLoaded = async () => {
          try {
            await videoElement.play()
            resolve()
          } catch (playError) {
            reject(playError)
          }
        }

        if (videoElement.readyState >= 2) {
          void handleLoaded()
          return
        }

        const handleError = () => reject(new Error('Could not start the camera preview.'))

        videoElement.addEventListener('loadedmetadata', handleLoaded, { once: true })
        videoElement.addEventListener('error', handleError, { once: true })
      })

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
        if (!errorName || NON_FATAL_SCAN_ERROR_NAMES.has(errorName)) {
          return
        }

        const streamStillActive = streamRef.current?.getVideoTracks().some((track) => track.readyState === 'live')
        if (streamStillActive) {
          setCameraState('ready')
          setCameraMessage('Camera is on. Hold the barcode steady and move a little closer if needed.')
          return
        }

        setCameraState('error')
        setCameraMessage('Camera preview stopped. Tap Turn On Camera to restart it.')
      }

      const controls = await reader.decodeFromVideoElement(
        videoElement,
        handleDecodeResult,
      ) as ScannerControls

      controlsRef.current = controls
      setCameraState('ready')
      setCameraMessage('Point your camera at a barcode or QR code.')
    } catch (error) {
      stopScanner()
      const message = error instanceof Error ? error.message : ''
      const permissionBlocked = /permission|notallowed|denied|dismissed/i.test(message)

      setCameraState(permissionBlocked ? 'error' : 'unsupported')
      setCameraMessage(
        permissionBlocked
          ? 'Camera permission is blocked. Allow access or use manual code entry.'
          : 'Camera scanning is not available here, but manual code entry still works.'
      )
    }
  }, [lookupCode, mode, open, stopScanner])

  const processLabelImage = useCallback(async (file: File) => {
    stopScanner()
    resetResultState()
    clearLabelPreview()

    const previewUrl = URL.createObjectURL(file)
    setLabelPreviewUrl(previewUrl)
    setLabelLoading(true)
    setLabelStatus('Reading the nutrition label…')

    try {
      const { recognize } = await import('tesseract.js')
      const result = await recognize(file, 'eng', {
        logger: (message) => {
          if (message.status === 'recognizing text' && typeof message.progress === 'number') {
            setLabelStatus(`Reading the nutrition label… ${Math.round(message.progress * 100)}%`)
          }
        },
      })

      const parsed = parseNutritionLabelText(result.data.text)
      if (!parsed) {
        setLookupError('I could not pull clear calories or macros from that label. Try a straighter photo with the nutrition panel fully visible.')
        setLabelStatus('Could not read enough of the label to fill the macros.')
        return
      }

      setProduct({
        ...parsed,
        image_url: previewUrl,
      })
      setLabelStatus('Nutrition label captured. Review the numbers before adding it.')
    } catch (error) {
      setLookupError(error instanceof Error ? error.message : 'Could not read that nutrition label.')
      setLabelStatus('Nutrition label scan failed. Try another photo or enter the details manually.')
    } finally {
      setLabelLoading(false)
    }
  }, [clearLabelPreview, resetResultState, stopScanner])

  useEffect(() => {
    if (!open) {
      stopScanner()
      clearLabelPreview()
      return
    }

    setTarget(initialTarget)
    setMealType(initialMealType)
    setMode('barcode')
    setManualCode('')
    setLookupError('')
    setProduct(null)
    setCameraState('idle')
    setCameraMessage('Point your camera at a barcode or QR code.')
    setLabelStatus('Take a clear photo of the nutrition facts panel.')
    lastScannedCodeRef.current = null
    setScanSession((value) => value + 1)
  }, [clearLabelPreview, initialMealType, initialTarget, open, stopScanner])

  useEffect(() => {
    if (!open || product || mode !== 'barcode') return
    void startScanner()
    return () => stopScanner()
  }, [mode, open, product, scanSession, startScanner, stopScanner])

  useEffect(() => {
    if (mode !== 'barcode') {
      stopScanner()
    }
  }, [mode, stopScanner])

  function handleManualLookup() {
    stopScanner()
    void lookupCode(manualCode)
  }

  function handleScanAgain() {
    resetResultState()
    setLookupError('')
    setCameraState(mode === 'barcode' ? 'idle' : 'paused')
    setCameraMessage('Point your camera at a barcode or QR code.')
    setLabelStatus('Take a clear photo of the nutrition facts panel.')
    setScanSession((value) => value + 1)
    if (mode === 'label') {
      clearLabelPreview()
    }
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

  function updateProductName(name: string) {
    setProduct((current) => (current ? { ...current, name } : current))
  }

  function updateMacroField(
    key: keyof BarcodeFoodLookupResult['macros'],
    value: string
  ) {
    const parsed = Number(value)
    setProduct((current) => {
      if (!current) return current
      return {
        ...current,
        macros: {
          ...current.macros,
          [key]: Number.isFinite(parsed) ? parsed : 0,
        },
      }
    })
  }

  function handleModeChange(nextMode: ScannerMode) {
    if (nextMode === mode) return
    setMode(nextMode)
    resetResultState()
    setLookupError('')
    setLabelStatus('Take a clear photo of the nutrition facts panel.')
    if (nextMode === 'label') {
      stopScanner()
      setCameraState('paused')
    } else {
      clearLabelPreview()
      setCameraState('idle')
      setCameraMessage('Point your camera at a barcode or QR code.')
      setScanSession((value) => value + 1)
    }
  }

  async function handleFilePick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    await processLabelImage(file)
  }

  const previewPanel = mode === 'barcode' ? (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-muted/20">
        <div className="relative aspect-[4/3] bg-gradient-to-br from-muted/40 via-muted/10 to-background">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            muted
            autoPlay
            playsInline
          />
          {cameraState !== 'ready' && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-background/80 px-6 text-center backdrop-blur-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/60 bg-muted/30 text-primary">
                {cameraState === 'starting' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold">
                  {cameraState === 'starting' ? 'Starting camera…' : 'Camera preview is off'}
                </p>
                <p className="text-xs leading-5 text-muted-foreground">
                  {cameraState === 'unsupported'
                    ? 'This browser is not exposing a camera preview here yet.'
                    : cameraState === 'error'
                      ? 'Camera access may be blocked or the preview failed to start.'
                      : 'Turn on the camera to scan a barcode or QR code.'}
                </p>
              </div>
              {cameraState !== 'starting' && (
                <Button type="button" size="sm" className="gap-2" onClick={() => void startScanner()}>
                  <Camera className="h-4 w-4" />
                  Turn On Camera
                </Button>
              )}
            </div>
          )}
        </div>
        <div className="border-t border-border/60 bg-background/80 px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
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
  ) : (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-muted/20">
        <div className="relative aspect-[4/3] bg-gradient-to-br from-muted/40 via-muted/10 to-background">
          {labelPreviewUrl ? (
            <img
              src={labelPreviewUrl}
              alt="Nutrition label preview"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/60 bg-muted/30 text-primary">
                {labelLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold">Nutrition label scan</p>
                <p className="text-xs leading-5 text-muted-foreground">
                  Take a straight-on photo of the nutrition facts panel and Rivora will prefill the macros.
                </p>
              </div>
            </div>
          )}

          {labelLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/75 px-6 text-center backdrop-blur-sm">
              <div className="space-y-2">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                <p className="text-sm font-medium">{labelStatus}</p>
              </div>
            </div>
          )}
        </div>
        <div className="border-t border-border/60 bg-background/80 px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            {labelLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
            <span>{labelStatus}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" className="gap-2" onClick={() => cameraCaptureInputRef.current?.click()} disabled={labelLoading}>
          <Camera className="h-4 w-4" />
          Take Label Photo
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => imageUploadInputRef.current?.click()} disabled={labelLoading}>
          <ImagePlus className="h-4 w-4" />
          Upload Label
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={handleScanAgain} disabled={labelLoading}>
          <RefreshCcw className="h-3.5 w-3.5" />
          Use Another Photo
        </Button>
      </div>

      <input
        ref={cameraCaptureInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFilePick}
      />
      <input
        ref={imageUploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFilePick}
      />
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ScanLine className="h-5 w-5 text-primary" />
            Scan Food
          </DialogTitle>
          <DialogDescription>
            Scan a package barcode or upload a nutrition label photo, then send it straight to today&apos;s meals or your saved meals.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain p-5 touch-pan-y">
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

          <div className="flex flex-wrap gap-2">
            {([
              { value: 'barcode', label: 'Barcode / QR' },
              { value: 'label', label: 'Nutrition Label' },
            ] as const).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleModeChange(option.value)}
                aria-pressed={mode === option.value}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === option.value
                    ? 'border-primary/50 bg-primary/10 text-primary'
                    : 'border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            {previewPanel}

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

              {mode === 'barcode' && (
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
                    <Button type="button" variant="outline" onClick={handleManualLookup} disabled={!manualCode.trim() || isBusy}>
                      {lookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}

              {lookupError ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive/80">
                  {lookupError}
                </div>
              ) : null}

              {product ? (
                <div className="space-y-4 rounded-2xl border border-border/60 bg-card p-4">
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
                        {formatSourceMeta(product)}
                      </p>
                    </div>
                  </div>

                  {product.source === 'nutrition_label_ocr' && (
                    <div className="space-y-3 rounded-xl border border-border/50 bg-muted/15 p-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="scanned-food-name">Food name</Label>
                        <Input
                          id="scanned-food-name"
                          value={product.name}
                          onChange={(event) => updateProductName(event.target.value)}
                          placeholder="Scanned Nutrition Label"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Review the OCR result before saving. The macros below are editable.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Calories</p>
                      {product.source === 'nutrition_label_ocr' ? (
                        <Input
                          type="number"
                          value={formatMacroInput(product.macros.calories)}
                          onChange={(event) => updateMacroField('calories', event.target.value)}
                          className="mt-2 h-9 border-border/50 bg-background/70"
                        />
                      ) : (
                        <p className="mt-2 font-data text-sm font-semibold">{product.macros.calories}</p>
                      )}
                    </div>
                    <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Protein</p>
                      {product.source === 'nutrition_label_ocr' ? (
                        <Input
                          type="number"
                          value={formatMacroInput(product.macros.protein_g)}
                          onChange={(event) => updateMacroField('protein_g', event.target.value)}
                          className="mt-2 h-9 border-border/50 bg-background/70"
                        />
                      ) : (
                        <p className="mt-2 font-data text-sm font-semibold">{product.macros.protein_g}g</p>
                      )}
                    </div>
                    <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Carbs</p>
                      {product.source === 'nutrition_label_ocr' ? (
                        <Input
                          type="number"
                          value={formatMacroInput(product.macros.carbs_g)}
                          onChange={(event) => updateMacroField('carbs_g', event.target.value)}
                          className="mt-2 h-9 border-border/50 bg-background/70"
                        />
                      ) : (
                        <p className="mt-2 font-data text-sm font-semibold">{product.macros.carbs_g}g</p>
                      )}
                    </div>
                    <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Fat</p>
                      {product.source === 'nutrition_label_ocr' ? (
                        <Input
                          type="number"
                          value={formatMacroInput(product.macros.fat_g)}
                          onChange={(event) => updateMacroField('fat_g', event.target.value)}
                          className="mt-2 h-9 border-border/50 bg-background/70"
                        />
                      ) : (
                        <p className="mt-2 font-data text-sm font-semibold">{product.macros.fat_g}g</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/60 bg-muted/15 p-4 text-sm text-muted-foreground">
                  {mode === 'barcode'
                    ? 'Scan a package or paste its code to pull the serving and macros into Rivora.'
                    : 'Take a photo of the nutrition facts panel and Rivora will try to fill calories, protein, carbs, and fat for you.'}
                </div>
              )}

              <Button
                type="button"
                className="w-full"
                onClick={handlePrimaryAction}
                disabled={!product || isBusy || !product.name.trim()}
              >
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
