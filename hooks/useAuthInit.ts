import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { getCurrentUser } from '@/lib/auth'

export function useAuthInit() {
  const { setUser, restoreUserDataBackup, isAuthenticated, user } = useAppStore()
  const hasAuthenticatedUser = isAuthenticated && !!user
  const [loading, setLoading] = useState(() => !hasAuthenticatedUser)
  const [initialized, setInitialized] = useState(() => hasAuthenticatedUser)

  useEffect(() => {
    if (initialized) {
      return
    }

    if (hasAuthenticatedUser) {
      restoreUserDataBackup(user.id)
      setLoading(false)
      setInitialized(true)
      return
    }

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

    void initAuth()
  }, [hasAuthenticatedUser, initialized, restoreUserDataBackup, setUser, user])

  return { loading, isAuthenticated }
}
