import { createBrowserClient } from '@supabase/ssr'

let browserClient: ReturnType<typeof createBrowserClient> | null = null

function extractSupabaseProjectRef(url: string): string | null {
  try {
    const u = new URL(url)
    // expected: https://<ref>.supabase.co
    const hostParts = u.hostname.split('.')
    if (hostParts.length < 3) return null
    if (hostParts.slice(-2).join('.') !== 'supabase.co') return null
    return hostParts[0] || null
  } catch {
    return null
  }
}

// Browser (client-side) Supabase client
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  // Optional guardrail: prevent accidentally pointing at the wrong Supabase project.
  const expectedRef = process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF
  if (expectedRef) {
    const actualRef = extractSupabaseProjectRef(url)
    if (!actualRef) {
      throw new Error(`Invalid NEXT_PUBLIC_SUPABASE_URL: ${url}`)
    }
    if (actualRef !== expectedRef) {
      throw new Error(
        `Supabase project mismatch. Expected ${expectedRef} but got ${actualRef}. ` +
        'Check Vercel environment variables.'
      )
    }
  }

  if (browserClient) {
    return browserClient
  }

  browserClient = createBrowserClient(
    url,
    key,
    {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: true,
      },
    }
  )

  return browserClient
}

// Type helper for auth response
export type AuthError = {
  message: string
  status?: number
}
