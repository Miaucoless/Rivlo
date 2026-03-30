export interface Quote {
  quote: string
  author: string
  category: string
}

interface StoredQuote {
  date: string
  quote: Quote
}

const FALLBACK_QUOTES: Quote[] = [
  { quote: "The only way to do great work is to love what you do.", author: "Steve Jobs", category: "motivational" },
  { quote: "Success usually comes to those who are too busy to be looking for it.", author: "Henry David Thoreau", category: "motivational" },
  { quote: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson", category: "motivational" },
  { quote: "Take care of your body. It's the only place you have to live.", author: "Jim Rohn", category: "motivational" },
  { quote: "Motivation is what gets you started. Habit is what keeps you going.", author: "Jim Ryun", category: "motivational" },
  { quote: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar", category: "motivational" },
  { quote: "If it doesn't challenge you, it doesn't change you.", author: "Fred DeVito", category: "motivational" },
  { quote: "Strength does not come from physical capacity. It comes from an indomitable will.", author: "Mahatma Gandhi", category: "motivational" },
  { quote: "The secret of getting ahead is getting started.", author: "Mark Twain", category: "motivational" },
  { quote: "A year from now you may wish you had started today.", author: "Karen Lamb", category: "motivational" },
  { quote: "Energy and persistence conquer all things.", author: "Benjamin Franklin", category: "motivational" },
  { quote: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius", category: "motivational" },
  { quote: "What seems impossible today will one day become your warm-up.", author: "Elbert Hubbard", category: "motivational" },
  { quote: "The groundwork for all happiness is good health.", author: "Leigh Hunt", category: "motivational" },
  { quote: "To enjoy the glow of good health, you must exercise.", author: "Gene Tunney", category: "motivational" },
  { quote: "Physical fitness is not only one of the most important keys to a healthy body, it is the basis of dynamic and creative intellectual activity.", author: "John F. Kennedy", category: "motivational" },
  { quote: "He who has health has hope, and he who has hope has everything.", author: "Thomas Carlyle", category: "motivational" },
  { quote: "The first wealth is health.", author: "Ralph Waldo Emerson", category: "motivational" },
  { quote: "To keep the body in good health is a duty, otherwise we shall not be able to keep our mind strong and clear.", author: "Buddha", category: "motivational" },
  { quote: "Take care of your body with steadfast fidelity.", author: "Johann Wolfgang von Goethe", category: "motivational" },
]

const DAILY_QUOTE_STORAGE_KEY = 'rivora:daily-quote'
const RECENT_QUOTE_IDS_STORAGE_KEY = 'rivora:recent-quote-ids'
const MAX_RECENT_QUOTES = 8

function quoteId(quote: Quote): string {
  return `${quote.quote}::${quote.author}`
}

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function readStorage<T>(key: string): T | null {
  if (typeof window === 'undefined') return null

  try {
    const value = window.localStorage.getItem(key)
    return value ? (JSON.parse(value) as T) : null
  } catch {
    return null
  }
}

function writeStorage(key: string, value: unknown) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore storage errors so quotes still load normally.
  }
}

function getRecentQuoteIds(): string[] {
  return readStorage<string[]>(RECENT_QUOTE_IDS_STORAGE_KEY) ?? []
}

function rememberQuote(quote: Quote) {
  const nextIds = [quoteId(quote), ...getRecentQuoteIds().filter((id) => id !== quoteId(quote))]
  writeStorage(RECENT_QUOTE_IDS_STORAGE_KEY, nextIds.slice(0, MAX_RECENT_QUOTES))
}

function getStoredDailyQuote(): Quote | null {
  const stored = readStorage<StoredQuote>(DAILY_QUOTE_STORAGE_KEY)
  if (!stored || stored.date !== getTodayKey()) return null
  return stored.quote
}

function storeDailyQuote(quote: Quote) {
  writeStorage(DAILY_QUOTE_STORAGE_KEY, { date: getTodayKey(), quote })
}

function pickFallbackQuote(excludedIds: string[]): Quote {
  const availableQuotes = FALLBACK_QUOTES.filter((quote) => !excludedIds.includes(quoteId(quote)))
  const pool = availableQuotes.length > 0 ? availableQuotes : FALLBACK_QUOTES
  return pool[Math.floor(Math.random() * pool.length)]
}

async function fetchApiQuote(apiKey: string, excludedIds: string[]): Promise<Quote | null> {
  let lastQuote: Quote | null = null

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch('https://api.api-ninjas.com/v2/randomquotes?categories=motivational', {
      headers: { 'X-Api-Key': apiKey },
      cache: 'no-store',
    })

    if (!response.ok) throw new Error(`API error ${response.status}`)

    const data = await response.json()
    const raw = Array.isArray(data) ? data[0] : data
    if (!raw?.quote) throw new Error('No quote in response')

    const parsedQuote: Quote = {
      quote: raw.quote,
      author: raw.author || 'Unknown',
      category: Array.isArray(raw.categories) ? raw.categories[0] : (raw.category || 'motivational'),
    }

    lastQuote = parsedQuote

    if (!excludedIds.includes(quoteId(parsedQuote))) {
      return parsedQuote
    }
  }

  return lastQuote
}

export async function getDailyQuote(options?: { forceFresh?: boolean }): Promise<Quote> {
  const API_NINJA_KEY = process.env.NEXT_PUBLIC_API_NINJA_KEY
  const forceFresh = options?.forceFresh ?? false
  const storedDailyQuote = !forceFresh ? getStoredDailyQuote() : null

  if (storedDailyQuote) {
    return storedDailyQuote
  }

  const recentQuoteIds = getRecentQuoteIds()
  let nextQuote: Quote

  if (!API_NINJA_KEY) {
    nextQuote = pickFallbackQuote(recentQuoteIds)
  } else {
    try {
      nextQuote = (await fetchApiQuote(API_NINJA_KEY, recentQuoteIds)) ?? pickFallbackQuote(recentQuoteIds)
    } catch {
      nextQuote = pickFallbackQuote(recentQuoteIds)
    }
  }

  rememberQuote(nextQuote)
  storeDailyQuote(nextQuote)

  return nextQuote
}
