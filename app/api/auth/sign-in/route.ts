import { NextResponse } from 'next/server'
import { fetchDashboardBootstrapState } from '@/lib/dashboard-bootstrap'
import { createAdminClient, createServerAuthClient } from '@/lib/server-supabase'

async function fetchDashboardBootstrapWithTimeout(userId: string, admin: ReturnType<typeof createAdminClient>, timeoutMs = 1500) {
  try {
    return await Promise.race([
      fetchDashboardBootstrapState(userId, admin),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), timeoutMs)
      }),
    ])
  } catch (error) {
    console.warn('Unable to prepare dashboard bootstrap during sign-in.', error)
    return null
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
    }

    const authClient = createServerAuthClient()
    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      const pendingConfirmation = authError.message.toLowerCase().includes('email not confirmed')
      return NextResponse.json(
        {
          error: pendingConfirmation
            ? 'Check your inbox and confirm your email before signing in.'
            : authError.message,
          pendingConfirmation,
        },
        { status: 401 }
      )
    }

    if (!authData.user || !authData.session) {
      return NextResponse.json({ error: 'Failed to sign in.' }, { status: 500 })
    }

    const admin = createAdminClient()
    const [{ data: profile }, dashboardBootstrap] = await Promise.all([
      admin
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle(),
      fetchDashboardBootstrapWithTimeout(authData.user.id, admin),
    ])

    return NextResponse.json({
      success: true,
      user: authData.user,
      session: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
      },
      profile,
      dashboardBootstrap,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to sign in.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
