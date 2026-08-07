'use client'

import { useTheme } from '@/context/theme-provider'
import { toast } from 'sonner'

export function useSettingsPreferences() {
  const {
    setTheme,
    setAccentPack,
    setWidgetStyle,
    setChartStyle,
  } = useTheme()

  const handleThemeChange = (value: string) => {
    setTheme(value as 'light' | 'dark' | 'system' | 'black')
    toast.success('Theme updated', {
      description: `Theme changed to ${value === 'system' ? 'system default' : value} mode.`,
      duration: 2000,
    })
  }

  const handleWidgetStyleChange = (value: 'default' | 'glass') => {
    setWidgetStyle(value)
    toast.success('Widget style updated', {
      description: `Widget style changed to ${value === 'glass' ? 'Glassmorphism' : 'Standard'}.`,
      duration: 2000,
    })
  }

  const handleAccentChange = (value: 'classic' | 'reports' | 'violet' | 'slate') => {
    setAccentPack(value)
    toast.success('Color accent updated', {
      description: `Accent changed to ${value === 'reports' ? 'Forest' : value === 'violet' ? 'Orchid' : value === 'slate' ? 'Graphite' : 'Classic'}.`,
      duration: 2000,
    })
  }

  const handleChartStyleChange = (value: 'smooth' | 'sharp') => {
    setChartStyle(value)
    toast.success('Chart style updated', {
      description: value === 'sharp' ? 'Charts now use sharp angular lines.' : 'Charts now use smooth curved lines.',
      duration: 2000,
    })
  }

  return {
    handleThemeChange,
    handleWidgetStyleChange,
    handleAccentChange,
    handleChartStyleChange,
  }
}
