import { createClient } from '@/lib/supabase'
import type { UnitSystem, UserProfile } from '@/types'
import { buildDefaultSchedule } from '@/lib/split-schedule'

export type AuthResponse = {
  success: boolean
  error?: string
  user?: UserProfile
  pendingConfirmation?: boolean
  usedFallbackProfile?: boolean
}

type AuthBootstrapPayload = {
  user?: {
    id: string
    email?: string | null
    created_at?: string
    updated_at?: string
    user_metadata?: Record<string, unknown>
  } | null
  profile?: Partial<UserProfile> | null
  session?: {
    access_token: string
    refresh_token: string
  } | null
  error?: string
  pendingConfirmation?: boolean
}

const DEFAULT_NOTIFICATION_PREFERENCES = {
  daily_workout_reminder: true,
  meal_logging_reminder: true,
  weekly_progress_summary: false,
  goal_milestone_alerts: true,
} as const

function clearSupabaseBrowserSessionStorage() {
  if (typeof window === 'undefined') return

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const storageKeysToRemove = new Set<string>([
      'supabase.auth.token',
      'sb-auth-token',
    ])

    if (url) {
      const match = url.match(/^https:\/\/([^.]+)\.supabase\.co/i)
      const projectRef = match?.[1]
      if (projectRef) {
        storageKeysToRemove.add(`sb-${projectRef}-auth-token`)
        storageKeysToRemove.add(`sb-${projectRef}-auth-token-code-verifier`)
      }
    }

    const clearMatchingStorage = (storage: Storage) => {
      const keysToDelete: string[] = []
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index)
        if (!key) continue
        if (storageKeysToRemove.has(key) || (key.startsWith('sb-') && key.includes('-auth-token'))) {
          keysToDelete.push(key)
        }
      }
      keysToDelete.forEach((key) => storage.removeItem(key))
    }

    clearMatchingStorage(window.localStorage)
    clearMatchingStorage(window.sessionStorage)
  } catch (error) {
    console.warn('Unable to clear cached Supabase browser session state.', error)
  }
}

type SafeJsonResult<T> = {
  payload: T | null
  isHtml: boolean
  rawText: string | null
}

async function readJsonResponseSafely<T>(response: Response): Promise<SafeJsonResult<T>> {
  const rawText = await response.text().catch(() => '')
  const trimmed = rawText.trim()
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  const isHtml = contentType.includes('text/html') || trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')

  if (!trimmed || isHtml) {
    return {
      payload: null,
      isHtml,
      rawText,
    }
  }

  try {
    return {
      payload: JSON.parse(trimmed) as T,
      isHtml: false,
      rawText,
    }
  } catch {
    return {
      payload: null,
      isHtml: false,
      rawText,
    }
  }
}

function isCorruptedSessionStorageError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes("Unexpected token '<'") || message.includes('not valid JSON')
}

function normalizeProfile(profile: Partial<UserProfile> | null | undefined): UserProfile | null {
  if (!profile) return null

  const workoutSplit = profile.workout_split || 'ppl'
  const rawUsername = typeof profile.username === 'string' ? profile.username.trim().toLowerCase() : ''
  const fallbackUsername =
    rawUsername ||
    (typeof profile.name === 'string'
      ? profile.name.toLowerCase().replace(/[^a-z0-9_]+/g, '')
      : '')

  return {
    ...profile,
    username: fallbackUsername || undefined,
    workout_split: workoutSplit,
    split_schedule: profile.split_schedule ?? buildDefaultSchedule(workoutSplit),
    profile_visibility: profile.profile_visibility === 'private' ? 'private' : 'public',
  } as UserProfile
}

function buildFallbackProfileFromAuthUser(authUser: {
  id: string
  email?: string | null
  created_at?: string
  updated_at?: string
  user_metadata?: Record<string, unknown>
}): UserProfile {
  const metadata = authUser.user_metadata ?? {}
  const email = authUser.email ?? ''
  const fallbackName = email ? email.split('@')[0] || 'Rivora User' : 'Rivora User'
  const rawName = typeof metadata.name === 'string' && metadata.name.trim() ? metadata.name.trim() : fallbackName
  const rawUsername =
    typeof metadata.username === 'string' && metadata.username.trim()
      ? metadata.username.trim().toLowerCase()
      : rawName.toLowerCase().replace(/[^a-z0-9_]+/g, '')
  const workoutSplit: UserProfile['workout_split'] =
    metadata.workout_split === 'upper_lower' ||
    metadata.workout_split === '3day_fullbody' ||
    metadata.workout_split === '4day' ||
    metadata.workout_split === '5day' ||
    metadata.workout_split === '6day' ||
    metadata.workout_split === 'cardio_focus' ||
    metadata.workout_split === 'custom'
      ? metadata.workout_split
      : 'ppl'
  const timestamp = authUser.updated_at ?? authUser.created_at ?? new Date().toISOString()

  return {
    id: authUser.id,
    email,
    name: rawName,
    username: rawUsername || undefined,
    avatar_url: typeof metadata.avatar_url === 'string' ? metadata.avatar_url : undefined,
    banner_url: typeof metadata.banner_url === 'string' ? metadata.banner_url : undefined,
    bio: typeof metadata.bio === 'string' ? metadata.bio : undefined,
    profile_visibility: metadata.profile_visibility === 'private' ? 'private' : 'public',
    height_cm: typeof metadata.height_cm === 'number' ? metadata.height_cm : 175,
    weight_kg: typeof metadata.weight_kg === 'number' ? metadata.weight_kg : 75,
    age: typeof metadata.age === 'number' ? metadata.age : 25,
    unit_system: metadata.unit_system === 'metric' ? 'metric' : 'imperial',
    gender: metadata.gender === 'female' || metadata.gender === 'other' ? metadata.gender : 'male',
    activity_level:
      metadata.activity_level === 'sedentary' ||
      metadata.activity_level === 'lightly_active' ||
      metadata.activity_level === 'very_active' ||
      metadata.activity_level === 'extra_active'
        ? metadata.activity_level
        : 'moderately_active',
    fitness_goal:
      metadata.fitness_goal === 'muscle_gain' ||
      metadata.fitness_goal === 'maintenance' ||
      metadata.fitness_goal === 'athletic_performance'
        ? metadata.fitness_goal
        : 'fat_loss',
    workout_split: workoutSplit,
    split_schedule: buildDefaultSchedule(workoutSplit),
    notification_preferences: DEFAULT_NOTIFICATION_PREFERENCES,
    bmr: typeof metadata.bmr === 'number' ? metadata.bmr : 0,
    tdee: typeof metadata.tdee === 'number' ? metadata.tdee : 0,
    calorie_target: typeof metadata.calorie_target === 'number' ? metadata.calorie_target : 2000,
    protein_target_g: typeof metadata.protein_target_g === 'number' ? metadata.protein_target_g : 150,
    carb_target_g: typeof metadata.carb_target_g === 'number' ? metadata.carb_target_g : 200,
    fat_target_g: typeof metadata.fat_target_g === 'number' ? metadata.fat_target_g : 70,
    water_goal_ml: typeof metadata.water_goal_ml === 'number' ? metadata.water_goal_ml : 0,
    onboarded: metadata.onboarded === false ? false : true,
    created_at: authUser.created_at ?? timestamp,
    updated_at: timestamp,
  }
}

function buildProfileFromBootstrapPayload(payload: AuthBootstrapPayload): UserProfile | null {
  if (!payload.user) return null
  const fallbackUser = buildFallbackProfileFromAuthUser(payload.user)
  return normalizeProfile(payload.profile) ?? fallbackUser
}

async function signInWithEmailDirect(
  email: string,
  password: string
): Promise<AuthResponse> {
  const supabase = createClient()

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (authError) {
    if (authError.message.toLowerCase().includes('email not confirmed')) {
      return {
        success: false,
        error: 'Check your inbox and confirm your email before signing in.',
        pendingConfirmation: true,
      }
    }

    return { success: false, error: authError.message }
  }

  if (!authData.user) {
    return { success: false, error: 'Failed to sign in' }
  }

  const fallbackUser = buildFallbackProfileFromAuthUser(authData.user)

  const profileResult = await Promise.race([
    supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single(),
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 1200)
    }),
  ])

  if (!profileResult) {
    return { success: true, user: fallbackUser, usedFallbackProfile: true }
  }

  if (profileResult.error || !profileResult.data) {
    console.warn('Profile fetch was unavailable during sign-in, continuing with fallback profile.', profileResult.error)
    return {
      success: true,
      user: fallbackUser,
      usedFallbackProfile: true,
    }
  }

  return { success: true, user: normalizeProfile(profileResult.data) ?? fallbackUser }
}

export async function signUpWithEmail(
  email: string,
  password: string,
  name: string,
  unitSystem: UnitSystem
): Promise<AuthResponse> {
  try {
    const supabase = createClient()

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, unit_system: unitSystem },
      },
    })

    if (authError) {
      return { success: false, error: authError.message }
    }

    if (!authData.user) {
      return { success: false, error: 'Failed to create user' }
    }

    if (!authData.session) {
      return {
        success: true,
        pendingConfirmation: true,
      }
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single()

    if (profileError) {
      return { success: false, error: profileError.message }
    }

    return { success: true, user: normalizeProfile(profile) ?? undefined }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<AuthResponse> {
  try {
    const response = await fetch('/api/auth/sign-in', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
      }),
    })

    const { payload, isHtml } = await readJsonResponseSafely<AuthBootstrapPayload>(response)

    if (isHtml) {
      throw new Error('The sign-in endpoint returned HTML instead of JSON.')
    }

    if (!response.ok) {
      return {
        success: false,
        error: payload?.error || 'Failed to sign in',
        pendingConfirmation: payload?.pendingConfirmation,
      }
    }

    if (!payload?.session?.access_token || !payload.session.refresh_token || !payload.user) {
      return { success: false, error: 'Failed to sign in' }
    }

    let sessionError: { message: string } | null = null

    try {
      const supabase = createClient()
      const result = await supabase.auth.setSession({
        access_token: payload.session.access_token,
        refresh_token: payload.session.refresh_token,
      })
      sessionError = result.error
    } catch (error) {
      if (!isCorruptedSessionStorageError(error)) {
        throw error
      }

      console.warn('Cached browser auth state was corrupted during sign-in. Clearing it and retrying once.', error)
      clearSupabaseBrowserSessionStorage()

      const supabase = createClient()
      const result = await supabase.auth.setSession({
        access_token: payload.session.access_token,
        refresh_token: payload.session.refresh_token,
      })
      sessionError = result.error
    }

    if (sessionError) {
      return { success: false, error: sessionError.message }
    }

    const user = buildProfileFromBootstrapPayload(payload)
    if (!user) {
      return { success: false, error: 'Failed to sign in' }
    }

    return {
      success: true,
      user,
      usedFallbackProfile: !payload.profile,
    }
  } catch (error) {
    console.warn('Server-side sign-in path failed, retrying with the direct browser auth flow.', error)
    try {
      if (isCorruptedSessionStorageError(error)) {
        clearSupabaseBrowserSessionStorage()
      }
      return await signInWithEmailDirect(email, password)
    } catch (directError) {
      if (isCorruptedSessionStorageError(directError)) {
        clearSupabaseBrowserSessionStorage()
        return {
          success: false,
          error: 'Your saved sign-in session was corrupted. Please try signing in again.',
        }
      }
      return { success: false, error: String(directError) }
    }
  }
}

export async function requestPasswordReset(email: string): Promise<AuthResponse> {
  try {
    const response = await fetch('/api/auth/password-reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
      }),
    })

    const { payload } = await readJsonResponseSafely<{ error?: string }>(response)

    if (!response.ok) {
      return { success: false, error: payload?.error || 'Failed to send password reset email.' }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function finalizePasswordRecoverySession(args?: {
  code?: string | null
  tokenHash?: string | null
  type?: string | null
}): Promise<AuthResponse> {
  try {
    const supabase = createClient()
    const code = args?.code
    const tokenHash = args?.tokenHash
    const type = args?.type

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        return { success: false, error: error.message }
      }
      return { success: true }
    }

    if (tokenHash && type === 'recovery') {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'recovery',
      })

      if (error) {
        return { success: false, error: error.message }
      }

      if (typeof window !== 'undefined') {
        window.history.replaceState({}, document.title, window.location.pathname)
      }

      return { success: true }
    }

    if (typeof window !== 'undefined' && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      const type = hashParams.get('type')

      if (accessToken && refreshToken && type === 'recovery') {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        if (error) {
          return { success: false, error: error.message }
        }

        window.history.replaceState({}, document.title, window.location.pathname)
      }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function updatePassword(password: string): Promise<AuthResponse> {
  try {
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      if (error.message.includes('profiles_workout_split_check')) {
        return {
          success: false,
          error: 'Your database needs the latest workout split migration before the Custom split can be saved.',
        }
      }

      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function confirmPasswordReset(
  tokenHash: string,
  password: string
): Promise<AuthResponse> {
  try {
    const response = await fetch('/api/auth/password-reset/confirm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tokenHash,
        password,
      }),
    })

    const { payload } = await readJsonResponseSafely<{ error?: string }>(response)

    if (!response.ok) {
      return { success: false, error: payload?.error || 'Failed to update password.' }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function signOut(): Promise<AuthResponse> {
  try {
    const supabase = createClient()
    await Promise.race([
      supabase.auth.signOut({ scope: 'local' }),
      new Promise<{ error: null }>((resolve) => {
        setTimeout(() => resolve({ error: null }), 1200)
      }),
    ])

    clearSupabaseBrowserSessionStorage()

    return { success: true }
  } catch (error) {
    clearSupabaseBrowserSessionStorage()
    return { success: true }
  }
}

export async function deleteAccount(): Promise<AuthResponse> {
  try {
    const supabase = createClient()
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

    if (sessionError || !sessionData.session?.access_token) {
      return { success: false, error: 'You need to be signed in to delete your account.' }
    }

    const response = await fetch('/api/account/delete', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
    })

    const { payload } = await readJsonResponseSafely<{ error?: string }>(response)
    if (!response.ok) {
      return { success: false, error: payload?.error || 'Failed to delete your account.' }
    }

    await supabase.auth.signOut()
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function getCurrentUser(): Promise<UserProfile | null> {
  try {
    let supabase = createClient()

    let authLookup
    try {
      authLookup = await supabase.auth.getUser()
    } catch (error) {
      if (!isCorruptedSessionStorageError(error)) {
        throw error
      }

      console.warn('Cached browser auth state was corrupted during auth bootstrap. Clearing it before retry.', error)
      clearSupabaseBrowserSessionStorage()
      supabase = createClient()
      authLookup = await supabase.auth.getUser()
    }

    const { data, error } = authLookup
    if (!error && data.user) {
      const fallbackUser = buildFallbackProfileFromAuthUser(data.user)

      const profileResult = await Promise.race([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single(),
        new Promise<null>((resolve) => {
          setTimeout(() => resolve(null), 1200)
        }),
      ])

      if (!profileResult) {
        return fallbackUser
      }

      if (profileResult.error || !profileResult.data) {
        console.warn('Profile fetch was unavailable during auth bootstrap, continuing with fallback profile.', profileResult.error)
        return fallbackUser
      }

      return normalizeProfile(profileResult.data) ?? fallbackUser
    }

    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token
    if (!accessToken) {
      return null
    }

    const response = await fetch('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return null
    }

    const { payload } = await readJsonResponseSafely<AuthBootstrapPayload>(response)
    return buildProfileFromBootstrapPayload(payload ?? {})
  } catch (error) {
    return null
  }
}

export async function updateProfile(
  userId: string,
  updates: Partial<UserProfile>
): Promise<AuthResponse> {
  try {
    const supabase = createClient()
    const performUpdate = async (payload: Partial<UserProfile>) => {
      return supabase
        .from('profiles')
        .update(payload)
        .eq('id', userId)
        .select()
        .single()
    }

    let { data: profile, error } = await performUpdate(updates)

    const splitScheduleMissing =
      updates.split_schedule !== undefined &&
      !!error &&
      error.message.includes('split_schedule')

    if (splitScheduleMissing) {
      const { split_schedule: _splitSchedule, ...fallbackUpdates } = updates
      const retry = await performUpdate(fallbackUpdates)
      profile = retry.data
      error = retry.error
    }

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, user: normalizeProfile(profile) ?? undefined }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}
