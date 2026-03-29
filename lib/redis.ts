import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

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
