import type { Metadata } from 'next'
import Link from 'next/link'
import { Zap } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Rivora collects, uses, and protects your personal data.',
}

export default function PrivacyPage() {
  return (
    <div
      className="min-h-[100dvh] overflow-y-auto bg-[#0a0a0a] text-white touch-pan-y"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <div className="max-w-3xl mx-auto px-6 py-16 pb-24">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 mb-12">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-xl font-bold tracking-tight">Rivora</span>
        </Link>

        <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-zinc-500 text-sm mb-10">Last updated: March 29, 2026</p>

        <div className="space-y-8 text-zinc-300 text-sm leading-7">
          <section>
            <h2 className="text-white text-lg font-semibold mb-3">1. Information We Collect</h2>
            <p>When you create an account, we collect your name, email address, and the fitness and nutrition data you choose to enter — including weight logs, workout history, meal entries, and journal notes. We also collect basic usage data (pages visited, features used) to improve the product.</p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">2. How We Use Your Information</h2>
            <p>We use your data solely to provide and improve Rivora. This includes syncing your data across devices, sending notifications you have opted into (email, SMS, push), and calculating personalized nutrition and fitness targets. We do not sell your personal data to third parties.</p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">3. Data Storage</h2>
            <p>Your data is stored securely using Supabase (hosted on AWS). All data is encrypted in transit via TLS and at rest. We retain your data for as long as your account is active. You may delete your account and all associated data at any time from Settings.</p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">4. Notifications</h2>
            <p>We send emails for account-related events (password reset, account confirmation). We only send marketing emails, SMS, or push notifications if you have explicitly opted in. You can manage or revoke these permissions at any time in Settings → Notifications.</p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">5. Cookies</h2>
            <p>We use essential cookies only — specifically an authentication session cookie required to keep you logged in. We do not use advertising or tracking cookies.</p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">6. Third-Party Services</h2>
            <p>Rivora uses the following third-party services to operate: Supabase (database and auth), Upstash (caching), and Resend (transactional email). Each of these services processes only the data necessary to fulfill their function and operates under their own privacy policies.</p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">7. Your Rights</h2>
            <p>You have the right to access, correct, or delete your personal data at any time. You can export your data from Settings or contact us to request a full data export or deletion. For users in the EU/EEA, you have additional rights under GDPR including the right to data portability and to lodge a complaint with your local supervisory authority.</p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">8. Contact</h2>
            <p>If you have any questions about this policy or how your data is handled, please contact us at <a href="mailto:privacy@rivorafit.com" className="text-emerald-400 hover:underline">privacy@rivorafit.com</a>.</p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10">
          <Link href="/" className="text-sm text-zinc-500 hover:text-white transition-colors">← Back to Rivora</Link>
        </div>
      </div>
    </div>
  )
}
