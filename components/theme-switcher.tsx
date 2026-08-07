'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/context/theme-provider'
import { Button } from '@/components/ui/button'
import { emitTourEvent } from '@/lib/tours/events'

export function ThemeSwitcher() {
  const { effectiveTheme, toggleTheme } = useTheme()
  const isDark = effectiveTheme === 'dark' || effectiveTheme === 'black'

  return (
    <Button
      variant="tertiary"
      size="navIcon"
      className="text-muted-foreground"
      onClick={() => {
        toggleTheme()
        emitTourEvent('theme.changed')
      }}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      data-tour="theme-switcher-btn"
    >
      {isDark ? (
        <Moon aria-hidden />
      ) : (
        <Sun aria-hidden />
      )}
    </Button>
  )
}
