import { NextRequest, NextResponse } from 'next/server'
import { getRedisJson, hasRedisClient, normalizeRedisKeyPart, setRedisJson, withRedisCacheHeader } from '@/lib/redis'

export interface YouTubeVideo {
  id: string
  title: string
  channelTitle: string
  thumbnailUrl: string
  viewCount: string
  durationSec: number
}

function parseIsoDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  const h = parseInt(match[1] ?? '0')
  const m = parseInt(match[2] ?? '0')
  const s = parseInt(match[3] ?? '0')
  return h * 3600 + m * 60 + s
}

function formatViewCount(n: string): string {
  const num = parseInt(n, 10)
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M views`
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K views`
  return `${num} views`
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q') ?? ''
  if (!query.trim()) return NextResponse.json([])

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'YouTube API key not configured' }, { status: 500 })

  const cacheEnabled = hasRedisClient()
  const cacheKey = `youtube:v1:${normalizeRedisKeyPart(query)}`

  if (cacheEnabled) {
    const cached = await getRedisJson<YouTubeVideo[]>(cacheKey)
    if (cached !== null) {
      return withRedisCacheHeader(NextResponse.json(cached), 'hit')
    }
  }

  // Step 1: search for short tutorial videos sorted by view count
  const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search')
  searchUrl.searchParams.set('part', 'snippet')
  searchUrl.searchParams.set('q', `"${query}" how to exercise tutorial form`)
  searchUrl.searchParams.set('type', 'video')
  searchUrl.searchParams.set('videoDuration', 'short') // under 4 min
  searchUrl.searchParams.set('order', 'viewCount')
  searchUrl.searchParams.set('maxResults', '15')
  searchUrl.searchParams.set('key', apiKey)

  const searchRes = await fetch(searchUrl.toString(), { next: { revalidate: 86400 } })
  if (!searchRes.ok) {
    return withRedisCacheHeader(NextResponse.json([], { status: searchRes.status }), cacheEnabled ? 'miss' : 'skip')
  }

  const searchData = await searchRes.json()
  const items: { id: { videoId: string }; snippet: { title: string; channelTitle: string; thumbnails: { medium: { url: string } } } }[] =
    searchData.items ?? []

  if (items.length === 0) {
    return withRedisCacheHeader(NextResponse.json([]), cacheEnabled ? 'miss' : 'skip')
  }

  const videoIds = items.map((item) => item.id.videoId).join(',')

  // Step 2: fetch duration + view count for each video
  const detailsUrl = new URL('https://www.googleapis.com/youtube/v3/videos')
  detailsUrl.searchParams.set('part', 'contentDetails,statistics')
  detailsUrl.searchParams.set('id', videoIds)
  detailsUrl.searchParams.set('key', apiKey)

  const detailsRes = await fetch(detailsUrl.toString(), { next: { revalidate: 86400 } })
  if (!detailsRes.ok) {
    return withRedisCacheHeader(NextResponse.json([], { status: detailsRes.status }), cacheEnabled ? 'miss' : 'skip')
  }

  const detailsData = await detailsRes.json()
  const details: Record<string, { durationSec: number; viewCount: string }> = {}
  for (const item of detailsData.items ?? []) {
    details[item.id] = {
      durationSec: parseIsoDuration(item.contentDetails.duration),
      viewCount: item.statistics?.viewCount ?? '0',
    }
  }

  // Title relevance: at least one word from the exercise name must appear in the title
  const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  const isTitleRelevant = (title: string) => {
    const lower = title.toLowerCase()
    return queryWords.some((w) => lower.includes(w))
  }

  // Tutorial keywords that strongly indicate instructional content
  const TUTORIAL_WORDS = ['how to', 'tutorial', 'form', 'technique', 'guide', 'proper', 'correct', 'beginner', 'exercise', 'workout']
  const isTutorial = (title: string) => {
    const lower = title.toLowerCase()
    return TUTORIAL_WORDS.some((w) => lower.includes(w))
  }

  const toVideo = (item: typeof items[number]): YouTubeVideo | null => {
    const d = details[item.id.videoId]
    if (!d) return null
    return {
      id: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      thumbnailUrl: item.snippet.thumbnails.medium.url,
      viewCount: formatViewCount(d.viewCount),
      durationSec: d.durationSec,
    }
  }

  // Step 3: filter to ≤90 sec + relevant + tutorial, sort by views, return top 3
  const results: YouTubeVideo[] = items
    .map(toVideo)
    .filter((v): v is YouTubeVideo =>
      v !== null && v.durationSec > 0 && v.durationSec <= 90 &&
      isTitleRelevant(v.title) && isTutorial(v.title)
    )
    .slice(0, 3)

  if (results.length > 0) {
    if (cacheEnabled) {
      await setRedisJson(cacheKey, results, 60 * 60 * 24)
    }
    return withRedisCacheHeader(NextResponse.json(results), cacheEnabled ? 'miss' : 'skip')
  }

  // Fallback 1: relax duration (≤4 min) but keep relevance + tutorial filters
  const fallback1: YouTubeVideo[] = items
    .map(toVideo)
    .filter((v): v is YouTubeVideo =>
      v !== null && v.durationSec > 0 &&
      isTitleRelevant(v.title) && isTutorial(v.title)
    )
    .slice(0, 3)

  if (fallback1.length > 0) {
    if (cacheEnabled) {
      await setRedisJson(cacheKey, fallback1, 60 * 60 * 24)
    }
    return withRedisCacheHeader(NextResponse.json(fallback1), cacheEnabled ? 'miss' : 'skip')
  }

  // Fallback 2: relevance only (no tutorial keyword requirement)
  const fallback2: YouTubeVideo[] = items
    .map(toVideo)
    .filter((v): v is YouTubeVideo => v !== null && v.durationSec > 0 && isTitleRelevant(v.title))
    .slice(0, 3)

  if (fallback2.length > 0) {
    if (cacheEnabled) {
      await setRedisJson(cacheKey, fallback2, 60 * 60 * 24)
    }
    return withRedisCacheHeader(NextResponse.json(fallback2), cacheEnabled ? 'miss' : 'skip')
  }

  // Last resort: return top 3 regardless
  const payload = items.map(toVideo).filter((v): v is YouTubeVideo => v !== null && v.durationSec > 0).slice(0, 3)
  if (cacheEnabled) {
    await setRedisJson(cacheKey, payload, 60 * 60 * 24)
  }
  return withRedisCacheHeader(NextResponse.json(payload), cacheEnabled ? 'miss' : 'skip')
}
