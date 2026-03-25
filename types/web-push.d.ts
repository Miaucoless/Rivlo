declare module 'web-push' {
  export type PushSubscription = {
    endpoint: string
    expirationTime?: number | null
    keys?: {
      p256dh?: string
      auth?: string
    }
  }

  const webpush: {
    setVapidDetails(subject: string, publicKey: string, privateKey: string): void
    sendNotification(subscription: PushSubscription, payload?: string): Promise<unknown>
  }

  export default webpush
}
