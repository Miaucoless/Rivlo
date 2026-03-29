import { Redis } from '@upstash/redis'

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
