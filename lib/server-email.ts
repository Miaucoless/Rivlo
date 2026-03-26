type SendEmailArgs = {
  to: string
  subject: string
  text: string
  html: string
}

function getEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL || 'Rivlo <notifications@rivlo.fit>'

  if (!apiKey) {
    throw new Error('Missing RESEND_API_KEY. Add it to send email notifications.')
  }

  return { apiKey, from }
}

export async function sendEmailMessage(args: SendEmailArgs) {
  const { apiKey, from } = getEmailConfig()

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [args.to],
      subject: args.subject,
      text: args.text,
      html: args.html,
    }),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    const message = payload?.message || payload?.error || `Resend request failed with status ${response.status}.`
    throw new Error(message)
  }
}
