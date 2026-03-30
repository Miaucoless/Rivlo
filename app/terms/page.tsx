import type { Metadata } from 'next'
import Link from 'next/link'
import { Zap } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms and conditions governing your use of Rivora.',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 mb-12">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-xl font-bold tracking-tight">Rivora</span>
        </Link>

        <h1 className="text-4xl font-bold mb-2">Terms of Service</h1>
        <p className="text-zinc-500 text-sm mb-10">Last updated: March 29, 2026</p>

        <div className="space-y-8 text-zinc-300 text-sm leading-7">
          <section>
            <h2 className="text-white text-lg font-semibold mb-3">1. Acceptance of Terms</h2>
            <p>By creating an account or using Rivora, you agree to these Terms of Service. If you do not agree, do not use the service. We may update these terms from time to time — continued use of Rivora after changes are posted constitutes acceptance of the updated terms.</p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">2. Use of the Service</h2>
            <p>Rivora is a personal fitness and nutrition tracking tool. You must be at least 13 years old to use it. You are responsible for maintaining the security of your account and for all activity that occurs under your account. You agree not to misuse the service or attempt to access it in unauthorized ways.</p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">3. Health Disclaimer</h2>
            <p>Rivora provides fitness and nutrition tracking tools for informational purposes only. The calorie targets, macro recommendations, and workout suggestions are general estimates and are not medical advice. Always consult a qualified healthcare professional before making significant changes to your diet or exercise routine, especially if you have a medical condition.</p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">4. Your Content</h2>
            <p>You retain ownership of the data you enter into Rivora (your logs, journal entries, custom workouts, etc.). By using the service, you grant Rivora a limited license to store and process that data for the purpose of providing the service to you. We do not use your personal fitness data for advertising.</p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">5. Account Termination</h2>
            <p>You may delete your account at any time from Settings. We reserve the right to suspend or terminate accounts that violate these terms. Upon termination, your data will be deleted in accordance with our Privacy Policy.</p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">6. Availability</h2>
            <p>We aim to keep Rivora available at all times but do not guarantee uninterrupted access. We are not liable for any downtime, data loss, or damages resulting from service interruptions. We recommend exporting your data periodically from Settings.</p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">7. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, Rivora is provided &ldquo;as is&rdquo; without warranties of any kind. We are not liable for indirect, incidental, or consequential damages arising from your use of the service.</p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">8. Contact</h2>
            <p>Questions about these terms? Contact us at <a href="mailto:legal@rivorafit.com" className="text-emerald-400 hover:underline">legal@rivorafit.com</a>.</p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10">
          <Link href="/" className="text-sm text-zinc-500 hover:text-white transition-colors">← Back to Rivora</Link>
        </div>
      </div>
    </div>
  )
}
