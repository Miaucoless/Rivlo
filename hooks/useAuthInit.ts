import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { clearAuthBootstrapUser, getCurrentUser, readAuthBootstrapUser } from '@/lib/auth'

export function useAuthInit() {
  const { setUser, restoreUserDataBackup, applyDashboardBootstrap, isAuthenticated, isDemoMode, user, logout } = useAppStore()
  const hasAuthenticatedUser = isAuthenticated && !!user
  const [loading, setLoading] = useState(() => !(hasAuthenticatedUser && isDemoMode))
  const [initialized, setInitialized] = useState(() => hasAuthenticatedUser && isDemoMode)

  useEffect(() => {
    let cancelled = false

    if (initialized) {
      return () => {
        cancelled = true
      }
    }

    if (hasAuthenticatedUser && isDemoMode && user) {
      restoreUserDataBackup(user.id)
      setLoading(false)
      setInitialized(true)
      return () => {
        cancelled = true
      }
    }

    const verifyPersistedSession = async () => {
      try {
        const currentUser = await getCurrentUser()
        if (cancelled) return

        if (currentUser) {
          setUser(currentUser)
        } else {
          logout()
        }
      } catch (error) {
        if (cancelled) return
        console.error('Failed to verify persisted auth session:', error)
        logout()
      }
    }

    if (hasAuthenticatedUser && user) {
      restoreUserDataBackup(user.id)
      setLoading(false)
      setInitialized(true)
      void verifyPersistedSession()
      return () => {
        cancelled = true
      }
    }

    async function initAuth() {
      try {
        const bootstrapUser = readAuthBootstrapUser()
        if (bootstrapUser) {
          setUser(bootstrapUser.user)
          restoreUserDataBackup(bootstrapUser.user.id)
          if (bootstrapUser.dashboardBootstrap) {
            applyDashboardBootstrap(bootstrapUser.user.id, bootstrapUser.dashboardBootstrap)
          }
          setLoading(false)
          setInitialized(true)
          clearAuthBootstrapUser()
          void verifyPersistedSession()
          return
        }

        const currentUser = await getCurrentUser()
        if (cancelled) return

        if (currentUser) {
          setUser(currentUser)
          restoreUserDataBackup(currentUser.id)
        }
      } catch (error) {
        if (cancelled) return
        console.error('Failed to initialize auth:', error)
      } finally {
        if (cancelled) return
        setLoading(false)
        setInitialized(true)
      }
    }

    void initAuth()

    return () => {
      cancelled = true
    }
  }, [applyDashboardBootstrap, hasAuthenticatedUser, initialized, isDemoMode, logout, restoreUserDataBackup, setUser, user])

  return { loading, isAuthenticated }
}
