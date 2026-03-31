import { createClient } from '@/lib/supabase'
import type { UnitSystem, UserProfile } from '@/types'

export type AuthResponse = {
  success: boolean
  error?: string
  user?: UserProfile
  pendingConfirmation?: boolean
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

    return { success: true, user: profile as UserProfile }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<AuthResponse> {
  try {
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

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single()

    if (profileError) {
      return { success: false, error: profileError.message }
    }

    return { success: true, user: profile as UserProfile }
  } catch (error) {
    return { success: false, error: String(error) }
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

    const payload = await response.json().catch(() => null)

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

    const payload = await response.json().catch(() => null)

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
    const { error } = await supabase.auth.signOut()

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
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

    const payload = await response.json().catch(() => null)
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
    const supabase = createClient()

    const { data, error } = await supabase.auth.getUser()

    if (error || !data.user) {
      return null
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()

    if (profileError) {
      return null
    }

    return profile as UserProfile
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

    const { data: profile, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, user: profile as UserProfile }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}
