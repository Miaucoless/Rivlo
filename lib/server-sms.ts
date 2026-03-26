import twilio from 'twilio'

let smsClient: ReturnType<typeof twilio> | null = null

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN

  if (!accountSid || !authToken) {
    throw new Error('Missing Twilio credentials. Add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.')
  }

  if (!smsClient) {
    smsClient = twilio(accountSid, authToken)
  }

  return smsClient
}

function getMessagingConfig() {
  const fromNumber = process.env.TWILIO_FROM_NUMBER
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID

  if (!fromNumber && !messagingServiceSid) {
    throw new Error('Add TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID to send SMS messages.')
  }

  return { fromNumber, messagingServiceSid }
}

export async function sendSmsMessage(args: {
  to: string
  body: string
}) {
  const client = getTwilioClient()
  const { fromNumber, messagingServiceSid } = getMessagingConfig()

  await client.messages.create({
    to: args.to,
    body: args.body,
    ...(messagingServiceSid ? { messagingServiceSid } : { from: fromNumber! }),
  })
}
