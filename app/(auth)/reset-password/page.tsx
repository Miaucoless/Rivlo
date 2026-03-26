'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Eye, EyeOff, Mail, ShieldCheck } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { finalizePasswordRecoverySession, requestPasswordReset, updatePassword } from '@/lib/auth'
import { toast } from 'sonner'

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const code = searchParams.get('code')
  const type = searchParams.get('type')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [recoveryReady, setRecoveryReady] = useState(false)
  const [recoveryChecked, setRecoveryChecked] = useState(false)

  const isRecoveryMode = useMemo(() => Boolean(code) || type === 'recovery', [code, type])

  useEffect(() => {
    document.documentElement.style.overflowY = 'auto'
    document.body.style.overflowY = 'auto'

    return () => {
      document.documentElement.style.overflowY = ''
      document.body.style.overflowY = ''
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      if (!isRecoveryMode) {
        setRecoveryChecked(true)
        return
      }

      const response = await finalizePasswordRecoverySession(code)
      if (cancelled) return

      if (!response.success) {
        toast.error(response.error || 'This password reset link is invalid or expired.')
        setRecoveryReady(false)
      } else {
        setRecoveryReady(true)
      }

      setRecoveryChecked(true)
    })()

    return () => {
      cancelled = true
    }
  }, [code, isRecoveryMode])

  const handleRequestReset = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!email.trim()) {
      toast.error('Enter your email address first.')
      return
    }

    setLoading(true)
    const response = await requestPasswordReset(email.trim())

    if (response.success) {
      toast.success('Password reset email sent. Check your inbox.')
    } else {
      toast.error(response.error || 'Failed to send password reset email.')
    }

    setLoading(false)
  }

  const handleUpdatePassword = async (event: React.FormEvent) => {
    event.preventDefault()

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match.')
      return
    }

    setLoading(true)
    const response = await updatePassword(password)

    if (response.success) {
      toast.success('Password updated. You can sign in now.')
      router.push('/login')
    } else {
      toast.error(response.error || 'Failed to update password.')
    }

    setLoading(false)
  }

  return (
    <div className="relative min-h-[100dvh] overflow-y-auto overflow-x-hidden bg-[#06100f] text-white" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_28%),radial-gradient(circle_at_80%_18%,_rgba(45,212,191,0.12),_transparent_25%),linear-gradient(140deg,_#06100f_0%,_#0b1715_55%,_#060908_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:88px_88px] opacity-[0.06]" />

      <div className="relative flex min-h-[100dvh] items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-md"
        >
          <div className="rounded-[2rem] border border-white/10 bg-[rgba(8,18,17,0.88)] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-7">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Link>

            <div className="mt-6 space-y-3">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/12 text-emerald-200">
                {isRecoveryMode ? <ShieldCheck className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                  Account recovery
                </p>
                <h1 className="mt-2 text-[1.9rem] font-black leading-[1.02] tracking-tight text-white">
                  {isRecoveryMode ? 'Set a new password' : 'Forgot your password?'}
                </h1>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  {isRecoveryMode
                    ? 'Choose a new password for your Rivlo account.'
                    : 'Enter your email and we will send you a password reset link.'}
                </p>
              </div>
            </div>

            {!isRecoveryMode ? (
              <form onSubmit={handleRequestReset} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="reset-email" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                    Email
                  </Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="name@domain.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-[3.25rem] rounded-2xl border-white/10 bg-white/[0.04] px-4 text-white placeholder:text-zinc-600 focus:border-emerald-400/40"
                    autoComplete="email"
                  />
                </div>

                <Button type="submit" variant="brand" size="lg" className="h-[3.25rem] w-full rounded-2xl text-base font-semibold" disabled={loading}>
                  {loading ? 'Sending reset link...' : 'Send reset email'}
                </Button>
              </form>
            ) : !recoveryChecked ? (
              <div className="mt-6 text-sm text-zinc-400">Verifying your reset link...</div>
            ) : !recoveryReady ? (
              <div className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-100">
                This reset link is invalid or expired. Request a new one from the form above.
              </div>
            ) : (
              <form onSubmit={handleUpdatePassword} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="new-password" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                    New password
                  </Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="h-[3.25rem] rounded-2xl border-white/10 bg-white/[0.04] px-4 pr-12 text-white placeholder:text-zinc-600 focus:border-emerald-400/40"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors hover:text-white"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                    Confirm password
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className="h-[3.25rem] rounded-2xl border-white/10 bg-white/[0.04] px-4 pr-12 text-white placeholder:text-zinc-600 focus:border-emerald-400/40"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors hover:text-white"
                      onClick={() => setShowConfirmPassword((value) => !value)}
                      aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" variant="brand" size="lg" className="h-[3.25rem] w-full rounded-2xl text-base font-semibold" disabled={loading}>
                  {loading ? 'Updating password...' : 'Update password'}
                </Button>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
