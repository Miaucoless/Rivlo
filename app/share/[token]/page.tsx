'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dumbbell, UtensilsCrossed, BookOpen, CheckCircle, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

type SharedItem = {
  share_id: string
  item_type: 'workout' | 'saved_meal' | 'recipe'
  item_name: string
  item_data: Record<string, unknown>
  owner_name: string
  message?: string
  created_at: string
}

const TYPE_LABELS: Record<string, string> = {
  workout: 'Workout',
  saved_meal: 'Saved Meal',
  recipe: 'Recipe',
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  workout: <Dumbbell className="w-5 h-5" />,
  saved_meal: <UtensilsCrossed className="w-5 h-5" />,
  recipe: <BookOpen className="w-5 h-5" />,
}

export default function SharePage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [item, setItem] = useState<SharedItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState(false)
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session)
    })
  }, [])

  useEffect(() => {
    fetch(`/api/share/${token}`)
      .then(async (res) => {
        if (res.status === 404) { setNotFound(true); return }
        const data = await res.json()
        setItem(data)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [token])

  async function handleImport() {
    if (!authed) return
    setImporting(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push(`/login?redirect=/share/${token}`); return }

      const res = await fetch(`/api/share/${token}/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error('Import failed')
      setImported(true)
      toast.success(`${item?.item_name} added to your account!`)
    } catch {
      toast.error('Import failed. Please try again.')
    } finally {
      setImporting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (notFound || !item) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-10 pb-8 space-y-3">
            <AlertCircle className="w-10 h-10 mx-auto text-muted-foreground" />
            <p className="font-semibold text-foreground">This link is invalid or has expired.</p>
            <p className="text-sm text-muted-foreground">The item may have been deleted or the link is incorrect.</p>
            <Button variant="outline" onClick={() => router.push('/')} className="mt-2">Go home</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const macros = item.item_data?.macros as Record<string, number> | undefined

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            {TYPE_ICONS[item.item_type]}
            <span>{TYPE_LABELS[item.item_type] ?? item.item_type}</span>
          </div>
          <CardTitle className="text-xl">{item.item_name}</CardTitle>
          <p className="text-sm text-muted-foreground">Shared by <span className="text-foreground font-medium">{item.owner_name}</span></p>
        </CardHeader>

        <CardContent className="space-y-4">
          {item.message && (
            <p className="text-sm italic text-muted-foreground border-l-2 border-border pl-3">&ldquo;{item.message}&rdquo;</p>
          )}

          {macros && (
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Calories', value: Math.round(macros.calories ?? 0), unit: 'kcal' },
                { label: 'Protein', value: Math.round(macros.protein_g ?? 0), unit: 'g' },
                { label: 'Carbs', value: Math.round(macros.carbs_g ?? 0), unit: 'g' },
                { label: 'Fat', value: Math.round(macros.fat_g ?? 0), unit: 'g' },
              ].map(({ label, value, unit }) => (
                <div key={label} className="rounded-lg bg-muted/40 p-2 text-center">
                  <p className="font-data text-base font-semibold tabular-nums">{value}<span className="text-xs text-muted-foreground ml-0.5">{unit}</span></p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
                </div>
              ))}
            </div>
          )}

          {item.item_type === 'workout' && (item.item_data?.exercises as unknown[])?.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Exercises</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {(item.item_data.exercises as { name: string; sets?: unknown[] }[]).slice(0, 8).map((ex, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="truncate">{ex.name}</span>
                    {ex.sets && <Badge variant="secondary" className="text-xs shrink-0 ml-2">{ex.sets.length} sets</Badge>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {imported ? (
            <div className="flex items-center gap-2 justify-center py-2 text-emerald-500 font-medium text-sm">
              <CheckCircle className="w-4 h-4" />
              Added to your account
            </div>
          ) : authed === true ? (
            <Button onClick={handleImport} disabled={importing} className="w-full">
              {importing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing…</> : `Add ${TYPE_LABELS[item.item_type] ?? 'item'} to my account`}
            </Button>
          ) : authed === false ? (
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => router.push(`/signup?redirect=/share/${token}`)}>Sign up to import</Button>
              <Button variant="outline" className="flex-1" onClick={() => router.push(`/login?redirect=/share/${token}`)}>Log in</Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
