import { NextResponse } from 'next/server'
import { createAdminClient, getUserFromBearerToken } from '@/lib/server-supabase'

export async function GET(request: Request) {
  try {
    const user = await getUserFromBearerToken(request)
    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      user,
      profile,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to verify your account.'
    return NextResponse.json({ error: message }, { status: 401 })
  }
}
