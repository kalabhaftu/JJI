'use client'

import { HugeiconsIcon } from '@hugeicons/react'
import { Moon01Icon, Sun01Icon } from '@hugeicons/core-free-icons'
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
        <HugeiconsIcon icon={Moon01Icon} aria-hidden strokeWidth={2} color="currentColor" />
      ) : (
        <HugeiconsIcon icon={Sun01Icon} aria-hidden strokeWidth={2} color="currentColor" />
      )}
    </Button>
  )
}
