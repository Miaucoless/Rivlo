import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/server-supabase'
import { sendEmailMessage } from '@/lib/server-email'

const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://rivorafit.com').replace(/\/$/, '')

function buildResetEmail(link: string) {
  const subject = 'Reset your Rivora password'
  const text = [
    'Reset your Rivora password',
    '',
    'We received a request to reset your password.',
    `Use this link to choose a new one: ${link}`,
    '',
    'If you did not request this, you can safely ignore this email.',
  ].join('\n')

  const html = `
    <div style="background:#06100f;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#e5e7eb;">
      <div style="max-width:560px;margin:0 auto;background:#0b1715;border:1px solid rgba(255,255,255,0.08);border-radius:24px;padding:32px;">
        <div style="font-size:12px;letter-spacing:0.24em;text-transform:uppercase;color:#94a3b8;font-weight:700;">Account recovery</div>
        <h1 style="margin:16px 0 12px;font-size:36px;line-height:1.05;color:#ffffff;">Reset your password</h1>
        <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#cbd5e1;">
          We received a request to reset your Rivora password. Use the button below to choose a new one.
        </p>
        <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#10b981,#2dd4bf);color:#041311;text-decoration:none;font-weight:700;padding:14px 24px;border-radius:16px;">
          Reset password
        </a>
        <p style="margin:24px 0 8px;font-size:14px;line-height:1.6;color:#94a3b8;">
          If the button does not work, copy and paste this link into your browser:
        </p>
        <p style="margin:0;word-break:break-all;font-size:14px;line-height:1.6;color:#e2e8f0;">
          <a href="${link}" style="color:#7dd3fc;text-decoration:underline;">${link}</a>
        </p>
        <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#94a3b8;">
          If you did not request this, you can safely ignore this email.
        </p>
      </div>
    </div>
  `

  return { subject, text, html }
}

export async function POST(request: Request) {
  try {
    const { email } = await request.json().catch(() => ({ email: '' }))
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''

    if (!normalizedEmail) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: normalizedEmail,
      options: {
        redirectTo: `${APP_ORIGIN}/auth/recovery`,
      },
    })

    if (error) {
      const message = error.message.toLowerCase()

      if (message.includes('user not found') || message.includes('email not found')) {
        return NextResponse.json({ success: true })
      }

      throw error
    }

    const tokenHash = data?.properties?.hashed_token

    if (!tokenHash) {
      throw new Error('Missing recovery token.')
    }

    const recoveryLink = `${APP_ORIGIN}/auth/recovery?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`
    const emailPayload = buildResetEmail(recoveryLink)

    await sendEmailMessage({
      to: normalizedEmail,
      subject: emailPayload.subject,
      text: emailPayload.text,
      html: emailPayload.html,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send password reset email.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
