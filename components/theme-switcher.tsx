'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/context/theme-provider'
import { Button } from '@/components/ui/button'
import { emitTourEvent } from '@/lib/tours/events'

export function ThemeSwitcher() {
  const { effectiveTheme, toggleTheme } = useTheme()

  return (
    <Button
      variant="tertiary"
      size="navIcon"
      className="text-muted-foreground"
      onClick={() => {
        toggleTheme()
        emitTourEvent('theme.changed')
      }}
      aria-label={effectiveTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      data-tour="theme-switcher-btn"
    >
      {effectiveTheme === 'dark' ? (
        <Moon aria-hidden />
      ) : (
        <Sun aria-hidden />
      )}
    </Button>
  )
}
