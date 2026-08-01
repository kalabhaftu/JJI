'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Toaster as SonnerToaster } from 'sonner'

export function SafeToaster() {
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100)
    return () => clearTimeout(timer)
  }, [pathname])

  if (!mounted) return null

  return (
    <SonnerToaster
      position="bottom-right"
      expand={false}
      richColors
      closeButton
      theme="light"
      duration={3000}
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          closeButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:border-border',
        },
      }}
    />
  )
}
