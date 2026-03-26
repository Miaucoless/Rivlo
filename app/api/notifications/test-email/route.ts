import { NextResponse } from 'next/server'
import { createAdminClient, getUserFromBearerToken } from '@/lib/server-supabase'
import { sendEmailMessage } from '@/lib/server-email'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const user = await getUserFromBearerToken(request)
    const admin = createAdminClient()

    const { data: profile, error } = await admin
      .from('profiles')
      .select('email, email_notifications_enabled')
      .eq('id', user.id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!profile?.email) {
      return NextResponse.json({ error: 'No email is saved on your profile yet.' }, { status: 400 })
    }

    if (!profile.email_notifications_enabled) {
      return NextResponse.json({ error: 'Email reminders are not enabled for this account.' }, { status: 400 })
    }

    await sendEmailMessage({
      to: profile.email,
      subject: 'Rivora test email',
      text: 'Rivora test message: email reminders are set up and ready to send.',
      html: '<p><strong>Rivora test message:</strong> email reminders are set up and ready to send.</p>',
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    )
  }
}
