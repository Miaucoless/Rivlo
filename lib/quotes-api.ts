export interface Quote {
  quote: string
  author: string
  category: string
}

const FALLBACK_QUOTES: Quote[] = [
  { quote: "The only way to do great work is to love what you do.", author: "Steve Jobs", category: "motivational" },
  { quote: "Push yourself, because no one else is going to do it for you.", author: "Unknown", category: "motivational" },
  { quote: "Success usually comes to those who are too busy to be looking for it.", author: "Henry David Thoreau", category: "motivational" },
  { quote: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson", category: "motivational" },
  { quote: "The body achieves what the mind believes.", author: "Unknown", category: "motivational" },
  { quote: "Take care of your body. It's the only place you have to live.", author: "Jim Rohn", category: "motivational" },
  { quote: "It never gets easier, you just get better.", author: "Unknown", category: "motivational" },
  { quote: "Strength does not come from the body. It comes from the will.", author: "Unknown", category: "motivational" },
  { quote: "Your only limit is you.", author: "Unknown", category: "motivational" },
  { quote: "The secret of getting ahead is getting started.", author: "Mark Twain", category: "motivational" },
  { quote: "Do something today that your future self will thank you for.", author: "Sean Patrick Flanery", category: "motivational" },
  { quote: "Wake up with determination. Go to bed with satisfaction.", author: "Unknown", category: "motivational" },
  { quote: "If it doesn't challenge you, it won't change you.", author: "Fred DeVito", category: "motivational" },
  { quote: "Motivation is what gets you started. Habit is what keeps you going.", author: "Jim Ryun", category: "motivational" },
  { quote: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar", category: "motivational" },
  { quote: "Sweat is just fat crying.", author: "Unknown", category: "motivational" },
  { quote: "No pain, no gain. Shut up and train.", author: "Unknown", category: "motivational" },
  { quote: "Once you see results, it becomes an addiction.", author: "Unknown", category: "motivational" },
  { quote: "Fitness is not about being better than someone else. It's about being better than you used to be.", author: "Unknown", category: "motivational" },
  { quote: "You are one workout away from a good mood.", author: "Unknown", category: "motivational" },
]

function randomFallback(): Quote {
  return FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)]
}

export async function getDailyQuote(): Promise<Quote> {
  const API_NINJA_KEY = process.env.NEXT_PUBLIC_API_NINJA_KEY

  if (!API_NINJA_KEY) {
    return randomFallback()
  }

  try {
    const response = await fetch('https://api.api-ninjas.com/v1/quotes?category=motivational', {
      headers: {
        'X-Api-Key': API_NINJA_KEY,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) throw new Error(`API error ${response.status}`)

    const quotes = await response.json()
    if (!Array.isArray(quotes) || quotes.length === 0) throw new Error('Empty response')

    return quotes[0]
  } catch {
    return randomFallback()
  }
}
