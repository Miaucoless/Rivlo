import { createBrowserClient } from '@supabase/ssr'

// Browser (client-side) Supabase client
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Type helper for auth response
export type AuthError = {
  message: string
  status?: number
}
