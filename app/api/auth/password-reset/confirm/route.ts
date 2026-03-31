import { NextResponse } from 'next/server'
import { createAdminClient, createServerAuthClient } from '@/lib/server-supabase'

export async function POST(request: Request) {
  try {
    const { tokenHash, password } = await request.json().catch(() => ({ tokenHash: '', password: '' }))

    const normalizedTokenHash = typeof tokenHash === 'string' ? tokenHash.trim() : ''
    const normalizedPassword = typeof password === 'string' ? password : ''

    if (!normalizedTokenHash) {
      return NextResponse.json({ error: 'Reset token is missing.' }, { status: 400 })
    }

    if (normalizedPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
    }

    const authClient = createServerAuthClient()
    const { data, error } = await authClient.auth.verifyOtp({
      token_hash: normalizedTokenHash,
      type: 'recovery',
    })

    if (error || !data.user) {
      return NextResponse.json(
        { error: error?.message || 'This reset link is invalid or expired.' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()
    const { error: updateError } = await adminClient.auth.admin.updateUserById(data.user.id, {
      password: normalizedPassword,
    })

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || 'Failed to update password.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update password.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
