import { NextRequest, NextResponse } from 'next/server'
import { getRedisJson, hasRedisClient, normalizeRedisKeyPart, rateLimit, setRedisJson, withRedisCacheHeader } from '@/lib/redis'
import { lookupBarcodeFood, normalizeBarcodeCandidate, type BarcodeFoodLookupResult } from '@/lib/barcode-food'

type BarcodeLookupResponse = {
  item: BarcodeFoodLookupResult | null
}

export async function GET(req: NextRequest) {
  const limited = await rateLimit(req, { limit: 30, windowSec: 60, prefix: 'barcode-food' })
  if (limited) return limited

  const rawCode = req.nextUrl.searchParams.get('code')?.trim() ?? ''
  const barcode = normalizeBarcodeCandidate(rawCode)

  if (!barcode) {
    return NextResponse.json({ error: 'Enter a valid barcode or QR code.' }, { status: 400 })
  }

  const cacheEnabled = hasRedisClient()
  const cacheKey = `barcode-food:v1:${normalizeRedisKeyPart(barcode)}`

  if (cacheEnabled) {
    const cached = await getRedisJson<BarcodeLookupResponse>(cacheKey)
    if (cached) {
      return withRedisCacheHeader(NextResponse.json(cached), 'hit')
    }
  }

  try {
    const item = await lookupBarcodeFood(barcode)
    const payload: BarcodeLookupResponse = { item }

    if (cacheEnabled) {
      await setRedisJson(cacheKey, payload, item ? 60 * 60 * 12 : 60 * 15)
    }

    return withRedisCacheHeader(NextResponse.json(payload), cacheEnabled ? 'miss' : 'skip')
  } catch {
    return withRedisCacheHeader(NextResponse.json({ item: null }), cacheEnabled ? 'miss' : 'skip')
  }
}
