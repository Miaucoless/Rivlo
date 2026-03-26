'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { createClient } from '@/lib/supabase'

export function ExposeStore() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    ;(window as any).useAppStore = useAppStore
    ;(window as any).supabase = createClient()
    ;(window as any).rivoraSyncFromCloud = async () => {
      const store = (window as any).useAppStore?.getState?.()
      if (!store?.user?.id) throw new Error('No user in store. Log in first.')
      await store.hydrateFromCloud(store.user.id)
    }
  }, [])

  return null
}
