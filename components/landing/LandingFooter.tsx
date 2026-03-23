import Link from 'next/link'
import { Zap } from 'lucide-react'

export function LandingFooter() {
  return (
    <footer className="border-t border-white/10 py-12 px-6 bg-black/30">
      <div className="max-w-7xl mx-auto">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-xl font-bold">Rivlo</span>
            </Link>
            <p className="text-zinc-500 text-sm max-w-xs leading-relaxed">
              The all-in-one fitness platform for serious athletes. Track, plan, and optimize everything.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">Product</h4>
            <ul className="space-y-2.5 text-sm text-zinc-500">
              {['Features', 'Pricing', 'Changelog', 'Roadmap'].map((item) => (
                <li key={item}>
                  <a href="#" className="hover:text-white transition-colors">{item}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">Company</h4>
            <ul className="space-y-2.5 text-sm text-zinc-500">
              {['About', 'Blog', 'Privacy Policy', 'Terms of Service'].map((item) => (
                <li key={item}>
                  <a href="#" className="hover:text-white transition-colors">{item}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-zinc-600 text-sm">© 2026 Rivlo. All rights reserved.</p>
          <p className="text-zinc-600 text-sm">Built with 💚 for athletes who never settle</p>
        </div>
      </div>
    </footer>
  )
}
