import { NextResponse } from 'next/server'
import { createAdminClient, getUserFromBearerToken } from '@/lib/server-supabase'
import { sendSmsMessage } from '@/lib/server-sms'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const user = await getUserFromBearerToken(request)
    const admin = createAdminClient()

    const { data: profile, error } = await admin
      .from('profiles')
      .select('phone_number, sms_notifications_enabled')
      .eq('id', user.id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!profile?.phone_number) {
      return NextResponse.json({ error: 'No phone number is saved on your profile yet.' }, { status: 400 })
    }

    if (!profile.sms_notifications_enabled) {
      return NextResponse.json({ error: 'SMS reminders are not enabled for this account.' }, { status: 400 })
    }

    await sendSmsMessage({
      to: profile.phone_number,
      body: 'Rivlo test message: SMS reminders are set up and ready to send.',
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    )
  }
}
