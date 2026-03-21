'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Zap, ArrowLeft, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAppStore } from '@/store/useAppStore'
import { toast } from 'sonner'

export default function SignupPage() {
  const router = useRouter()
  const { loginDemo } = useAppStore()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.password) {
      toast.error('Please fill in all fields')
      return
    }
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    setLoading(true)
    await new Promise((r) => setTimeout(r, 800))
    toast.info('Connect Supabase for real auth. Using demo mode with your name.')
    loginDemo()
    router.push('/onboarding')
    setLoading(false)
  }

  const passwordStrength = (() => {
    const p = form.password
    if (!p) return 0
    let strength = 0
    if (p.length >= 8) strength++
    if (/[A-Z]/.test(p)) strength++
    if (/[0-9]/.test(p)) strength++
    if (/[^A-Za-z0-9]/.test(p)) strength++
    return strength
  })()

  const strengthColors = ['', 'bg-red-500', 'bg-amber-500', 'bg-blue-500', 'bg-emerald-500']
  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong']

  const perks = [
    'Personalized workout plans',
    'Precision macro tracking',
    'Weekly meal prep system',
    'Progress analytics dashboard',
  ]

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      {/* Left panel — visual */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-teal-950/40 to-zinc-900 items-center justify-center p-12 border-r border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-mesh opacity-40" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl" />

        <div className="relative space-y-8 max-w-sm">
          <div>
            <h2 className="text-3xl font-bold text-white mb-3">Start your transformation today</h2>
            <p className="text-zinc-400 leading-relaxed">
              Everything you need to build the body you want — all in one app.
            </p>
          </div>

          <div className="space-y-4">
            {perks.map((perk) => (
              <div key={perk} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-emerald-400" />
                </div>
                <span className="text-zinc-300 text-sm">{perk}</span>
              </div>
            ))}
          </div>

          <div className="bg-zinc-900/60 border border-white/10 rounded-2xl p-5">
            <div className="flex gap-1 mb-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-4 h-4 text-amber-400">⭐</div>
              ))}
            </div>
            <p className="text-zinc-300 text-sm italic">"Lost 12kg in 4 months. The meal planning system is incredibly convenient."</p>
            <p className="text-zinc-500 text-xs mt-2">— Sarah C., Software Engineer</p>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-7">
          {/* Back link */}
          <Link href="/" className="inline-flex items-center gap-2 text-zinc-500 hover:text-white text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>

          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-xl font-bold text-white">Grays</span>
          </div>

          {/* Heading */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="space-y-1"
          >
            <h1 className="text-2xl font-bold text-white">Create your account</h1>
            <p className="text-zinc-400 text-sm">Free forever. No credit card required.</p>
          </motion.div>

          {/* Form */}
          <motion.form
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="name" className="text-zinc-300">Full Name</Label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="Alex Morgan"
                value={form.name}
                onChange={handleChange}
                className="bg-zinc-900 border-white/10 text-white placeholder:text-zinc-600 focus:border-emerald-500/50"
                autoComplete="name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-300">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="alex@example.com"
                value={form.email}
                onChange={handleChange}
                className="bg-zinc-900 border-white/10 text-white placeholder:text-zinc-600 focus:border-emerald-500/50"
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-zinc-300">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min. 8 characters"
                  value={form.password}
                  onChange={handleChange}
                  className="bg-zinc-900 border-white/10 text-white placeholder:text-zinc-600 pr-10 focus:border-emerald-500/50"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password strength */}
              {form.password && (
                <div className="space-y-1.5">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                          level <= passwordStrength ? strengthColors[passwordStrength] : 'bg-zinc-700'
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs ${strengthColors[passwordStrength].replace('bg-', 'text-')}`}>
                    {strengthLabels[passwordStrength]}
                  </p>
                </div>
              )}
            </div>

            <Button
              type="submit"
              variant="brand"
              size="lg"
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Creating account...' : 'Create Free Account'}
            </Button>

            <p className="text-xs text-zinc-600 text-center">
              By creating an account you agree to our{' '}
              <a href="#" className="text-zinc-400 hover:text-white underline">Terms</a>
              {' '}and{' '}
              <a href="#" className="text-zinc-400 hover:text-white underline">Privacy Policy</a>
            </p>
          </motion.form>

          {/* Sign in link */}
          <p className="text-center text-sm text-zinc-500">
            Already have an account?{' '}
            <Link href="/login" className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
