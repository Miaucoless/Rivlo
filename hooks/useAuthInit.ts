import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { getCurrentUser } from '@/lib/auth'

export function useAuthInit() {
  const { setUser, isAuthenticated } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    async function initAuth() {
      try {
        const user = await getCurrentUser()
        if (user) {
          setUser(user)
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error)
      } finally {
        setLoading(false)
        setInitialized(true)
      }
    }

    if (!initialized) {
      initAuth()
    }
  }, [initialized, setUser])

  return { loading, isAuthenticated }
}
