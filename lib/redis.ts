import { Redis } from '@upstash/redis'
import { type NextRequest, NextResponse } from 'next/server'

let redisClient: Redis | null | undefined

function createRedisClient() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN

  if (!url || !token) return null

  return new Redis({ url, token })
}

export function getRedisClient() {
  if (redisClient === undefined) {
    redisClient = createRedisClient()
  }

  return redisClient
}

export function hasRedisClient() {
  return Boolean(getRedisClient())
}

export function normalizeRedisKeyPart(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 256)
}

export function withRedisCacheHeader(response: NextResponse, status: 'hit' | 'miss' | 'skip') {
  response.headers.set('x-rivora-cache', status)
  return response
}

export async function getRedisJson<T>(key: string): Promise<T | null> {
  const redis = getRedisClient()
  if (!redis) return null

  try {
    const value = await redis.get<T>(key)
    return value ?? null
  } catch {
    return null
  }
}

export async function setRedisJson(key: string, value: unknown, ttlSeconds: number) {
  const redis = getRedisClient()
  if (!redis) return

  try {
    await redis.set(key, value, { ex: ttlSeconds })
  } catch {
    // Swallow cache write failures so search still works without Redis.
  }
}

export async function deleteRedisKeys(keys: string[]) {
  const redis = getRedisClient()
  if (!redis || keys.length === 0) return

  try {
    await redis.del(...keys)
  } catch {
    // Swallow cache delete failures so writes still succeed without Redis.
  }
}

// ─── Rate Limiting ────────────────────────────────────────────────────────────

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  return forwarded ? forwarded.split(',')[0].trim() : 'unknown'
}

/**
 * Sliding-window rate limiter backed by Redis INCR + EXPIRE.
 * Returns a 429 NextResponse if the client is over the limit, otherwise null.
 * Fails open (returns null) when Redis is unavailable so the app keeps working.
 */
export async function rateLimit(
  req: NextRequest,
  { limit, windowSec, prefix }: { limit: number; windowSec: number; prefix: string }
): Promise<NextResponse | null> {
  const redis = getRedisClient()
  if (!redis) return null

  const clientId = getClientIp(req)
  const window = Math.floor(Date.now() / (windowSec * 1000))
  const key = `rl:${prefix}:${clientId}:${window}`

  try {
    const count = await redis.incr(key)
    if (count === 1) await redis.expire(key, windowSec)
    if (count > limit) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(windowSec),
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': '0',
          },
        }
      )
    }
  } catch {
    // Swallow Redis errors — rate limiting is best-effort.
  }

  return null
}
