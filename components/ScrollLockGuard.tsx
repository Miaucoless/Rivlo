'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

function hasOpenDialog() {
  return Boolean(
    document.querySelector('[role="dialog"][data-state="open"], [data-radix-portal] [data-state="open"]')
  )
}

function clearStaleScrollLock() {
  if (hasOpenDialog()) return

  document
    .querySelectorAll('[data-radix-portal]')
    .forEach((portal) => {
      const hasOpenLayer = portal.querySelector('[data-state="open"]')
      if (hasOpenLayer) return

      portal.querySelectorAll<HTMLElement>('[data-state="closed"]').forEach((node) => {
        node.style.pointerEvents = 'none'
      })
    })

  document.body.style.overflow = ''
  document.body.style.pointerEvents = ''
  document.body.style.removeProperty('padding-right')
  document.body.removeAttribute('data-scroll-locked')

  document.documentElement.style.overflow = ''
  document.documentElement.style.pointerEvents = ''
  document.documentElement.style.removeProperty('padding-right')
  document.documentElement.removeAttribute('data-scroll-locked')
}

export function ScrollLockGuard() {
  const pathname = usePathname()

  useEffect(() => {
    clearStaleScrollLock()

    const observer = new MutationObserver(() => {
      clearStaleScrollLock()
    })

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['style', 'data-scroll-locked'],
      childList: true,
      subtree: true,
    })

    window.addEventListener('pageshow', clearStaleScrollLock)
    window.addEventListener('focus', clearStaleScrollLock)

    return () => {
      observer.disconnect()
      window.removeEventListener('pageshow', clearStaleScrollLock)
      window.removeEventListener('focus', clearStaleScrollLock)
    }
  }, [pathname])

  return null
}
