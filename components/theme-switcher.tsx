'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/context/theme-provider'
import { Button } from '@/components/ui/button'
import { emitTourEvent } from '@/lib/tours/events'

export function ThemeSwitcher() {
  const { effectiveTheme, toggleTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => {
        toggleTheme()
        emitTourEvent('theme.changed')
      }}
      aria-label={effectiveTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      data-tour="theme-switcher-btn"
    >
      {effectiveTheme === 'dark' ? (
        <Moon className="h-4 w-4 text-muted-foreground" />
      ) : (
        <Sun className="h-4 w-4 text-muted-foreground" />
      )}
    </Button>
  )
}
