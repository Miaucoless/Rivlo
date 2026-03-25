import { createClient } from '@supabase/supabase-js'

function getEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    throw new Error('Missing Supabase server environment. Add NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.')
  }

  return { supabaseUrl, supabaseAnonKey, serviceRoleKey }
}

export function createAdminClient() {
  const { supabaseUrl, serviceRoleKey } = getEnv()

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export function createServerAuthClient() {
  const { supabaseUrl, supabaseAnonKey } = getEnv()
  return createClient(supabaseUrl, supabaseAnonKey)
}

export async function getUserFromBearerToken(request: Request) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    throw new Error('Missing authorization token.')
  }

  const authClient = createServerAuthClient()
  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(token)

  if (error || !user) {
    throw new Error('Unable to verify your account.')
  }

  return user
}
