'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Zap, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAppStore } from '@/store/useAppStore'
import { signInWithEmail } from '@/lib/auth'
import { toast } from 'sonner'

export default function LoginPage() {
  const router = useRouter()
  const { loginDemo, setUser } = useAppStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleDemoLogin = () => {
    loginDemo()
    toast.success('Welcome to the demo! 🎉')
    router.push('/dashboard')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Please fill in all fields')
      return
    }
    setLoading(true)
    
    const response = await signInWithEmail(email, password)
    
    if (response.success && response.user) {
      setUser(response.user)
      toast.success('Welcome back! 👋')
      router.push(response.user.onboarded ? '/dashboard' : '/onboarding')
    } else {
      toast.error(response.error || 'Failed to sign in')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Left panel — form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-8">
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
            <span className="text-xl font-bold text-white">Rivlo</span>
          </div>

          {/* Heading */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="space-y-2"
          >
            <h1 className="text-2xl font-bold text-white">Welcome back</h1>
            <p className="text-zinc-400 text-sm">Sign in to your account to continue.</p>
            <p className="text-xs text-zinc-500">If you just signed up, confirm your email first.</p>
          </motion.div>

          {/* Demo banner */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4"
          >
            <p className="text-emerald-400 text-sm font-medium mb-2">Try without signing up</p>
            <p className="text-zinc-400 text-xs mb-3">Explore all features with pre-loaded demo data.</p>
            <Button
              variant="brand"
              size="sm"
              className="w-full"
              onClick={handleDemoLogin}
            >
              Launch Demo →
            </Button>
          </motion.div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-zinc-600 text-xs">or sign in with email</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Form */}
          <motion.form
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.15 }}
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-300">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="alex@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-zinc-900 border-white/10 text-white placeholder:text-zinc-600 focus:border-emerald-500/50"
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-zinc-300">Password</Label>
                <Link href="#" className="text-xs text-zinc-500 hover:text-emerald-400 transition-colors">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-zinc-900 border-white/10 text-white placeholder:text-zinc-600 pr-10 focus:border-emerald-500/50"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="brand"
              size="lg"
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </motion.form>

          {/* Sign up link */}
          <p className="text-center text-sm text-zinc-500">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
              Create one free
            </Link>
          </p>
        </div>
      </div>

      {/* Right panel — visual */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-emerald-950/40 to-zinc-900 items-center justify-center p-12 border-l border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-mesh opacity-40" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />

        <div className="relative text-center space-y-6 max-w-sm">
          <div className="text-6xl">🏋️</div>
          <h2 className="text-3xl font-bold text-white">Track. Train. Transform.</h2>
          <p className="text-zinc-400 leading-relaxed">
            Join thousands of athletes who&apos;ve taken control of their fitness with precision tracking and smart automation.
          </p>
          <div className="flex justify-center gap-6 pt-4">
            {[
              { value: '12', label: 'Day Streak' },
              { value: '-5kg', label: 'This Month' },
              { value: '98%', label: 'Goal Rate' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-bold text-emerald-400">{stat.value}</div>
                <div className="text-xs text-zinc-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
