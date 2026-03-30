import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center text-center px-4">
      <p className="text-8xl font-bold text-emerald-500/20 select-none">404</p>
      <h1 className="mt-4 text-2xl font-semibold text-white">Page not found</h1>
      <p className="mt-2 text-zinc-500 max-w-xs text-sm">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/">
          <Button variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/10">
            Go home
          </Button>
        </Link>
        <Link href="/dashboard">
          <Button variant="brand">
            Dashboard
          </Button>
        </Link>
      </div>
    </div>
  )
}
