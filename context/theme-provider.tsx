'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import * as Sentry from '@sentry/nextjs'
import { toast } from 'sonner'
import { useUserStore } from '@/store/user-store'

type Theme = 'light' | 'dark' | 'system'
type AccentPack = 'classic' | 'reports' | 'violet' | 'slate'
type WidgetSurfaceStyle = 'default' | 'glass'
type ChartStyle = 'smooth' | 'sharp'

const THEMES = ['light', 'dark', 'system'] as const
const ACCENT_PACKS = ['classic', 'reports', 'violet', 'slate'] as const
const WIDGET_STYLES = ['default', 'glass'] as const
const CHART_STYLES = ['smooth', 'sharp'] as const

function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && THEMES.includes(value as Theme)
}

function isAccentPack(value: unknown): value is AccentPack {
  return typeof value === 'string' && ACCENT_PACKS.includes(value as AccentPack)
}

function isWidgetStyle(value: unknown): value is WidgetSurfaceStyle {
  return typeof value === 'string' && WIDGET_STYLES.includes(value as WidgetSurfaceStyle)
}

function isChartStyle(value: unknown): value is ChartStyle {
  return typeof value === 'string' && CHART_STYLES.includes(value as ChartStyle)
}

type ThemeContextType = {
  theme: Theme
  effectiveTheme: 'light' | 'dark'
  accentPack: AccentPack
  widgetStyle: WidgetSurfaceStyle
  chartStyle: ChartStyle
  setTheme: (theme: Theme) => void
  setAccentPack: (pack: AccentPack) => void
  setWidgetStyle: (style: WidgetSurfaceStyle) => void
  setChartStyle: (style: ChartStyle) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  effectiveTheme: 'dark',
  accentPack: 'classic',
  widgetStyle: 'default',
  chartStyle: 'smooth',
  setTheme: () => {},
  setAccentPack: () => {},
  setWidgetStyle: () => {},
  setChartStyle: () => {},
  toggleTheme: () => {},
})

export const useTheme = () => useContext(ThemeContext)

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyAccentClass(pack: AccentPack) {
  if (typeof window === 'undefined') return
  const root = window.document.documentElement
  root.classList.remove('accent-reports', 'accent-violet', 'accent-slate')
  if (pack === 'reports') {
    root.classList.add('accent-reports')
  } else if (pack === 'violet') {
    root.classList.add('accent-violet')
  } else if (pack === 'slate') {
    root.classList.add('accent-slate')
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')
  const [accentPack, setAccentPackState] = useState<AccentPack>('classic')
  const [widgetStyle, setWidgetStyleState] = useState<WidgetSurfaceStyle>('default')
  const [chartStyle, setChartStyleState] = useState<ChartStyle>('smooth')
  const [mounted, setMounted] = useState(false)
  const user = useUserStore(state => state.user)
  const preferenceRequestVersions = React.useRef<Record<string, number>>({})

  const resolveEffective = useCallback((t: Theme): 'light' | 'dark' => {
    if (t === 'system') return getSystemTheme()
    return t
  }, [])

  const applyTheme = useCallback((t: Theme) => {
    if (typeof window === 'undefined') return
    const effective = resolveEffective(t)
    const root = window.document.documentElement
    if (effective === 'light') {
      root.classList.remove('dark')
      root.classList.add('light')
      root.style.colorScheme = 'light'
    } else {
      root.classList.remove('light')
      root.classList.add('dark')
      root.style.colorScheme = 'dark'
    }
  }, [resolveEffective])

  useEffect(() => {
    setMounted(true)

    const savedTheme = localStorage.getItem('theme')
    const resolved = isTheme(savedTheme) ? savedTheme : 'dark'
    setThemeState(resolved)
    applyTheme(resolved)

    const savedAccent = localStorage.getItem('accentPack')
    const resolvedAccent = isAccentPack(savedAccent) ? savedAccent : 'classic'
    setAccentPackState(resolvedAccent)
    applyAccentClass(resolvedAccent)

    const savedWidget = localStorage.getItem('widgetStyle')
    const resolvedWidget = isWidgetStyle(savedWidget) ? savedWidget : 'default'
    setWidgetStyleState(resolvedWidget)

    const savedChart = localStorage.getItem('chartStyle')
    const resolvedChart = isChartStyle(savedChart) ? savedChart : 'smooth'
    setChartStyleState(resolvedChart)

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      const current = localStorage.getItem('theme') as Theme | null
      if (current === 'system') applyTheme('system')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [applyTheme])

  useEffect(() => {
    if (mounted && user) {
      if (user.theme) {
        const dbTheme = isTheme(user.theme) ? user.theme : null
        const currentTheme = localStorage.getItem('theme') as Theme | null
        if (dbTheme && dbTheme !== currentTheme) {
          setThemeState(dbTheme)
          applyTheme(dbTheme)
          localStorage.setItem('theme', dbTheme)
        }
      }
      
      if (user.accentPack) {
        const dbAccent = isAccentPack(user.accentPack) ? user.accentPack : null
        const currentAccent = localStorage.getItem('accentPack') as AccentPack | null
        if (dbAccent && dbAccent !== currentAccent) {
          setAccentPackState(dbAccent)
          applyAccentClass(dbAccent)
          localStorage.setItem('accentPack', dbAccent)
        }
      }

      if (user.widgetStyle) {
        const dbWidget = isWidgetStyle(user.widgetStyle) ? user.widgetStyle : null
        const currentWidget = localStorage.getItem('widgetStyle') as WidgetSurfaceStyle | null
        if (dbWidget && dbWidget !== currentWidget) {
          setWidgetStyleState(dbWidget)
          localStorage.setItem('widgetStyle', dbWidget)
        }
      }

      if (user.chartStyle) {
        const dbChart = isChartStyle(user.chartStyle) ? user.chartStyle : null
        const currentChart = localStorage.getItem('chartStyle') as ChartStyle | null
        if (dbChart && dbChart !== currentChart) {
          setChartStyleState(dbChart)
          localStorage.setItem('chartStyle', dbChart)
        }
      }
    }
  }, [user, mounted, applyTheme])

  useEffect(() => {
    if (mounted) {
      applyTheme(theme)
      localStorage.setItem('theme', theme)
    }
  }, [theme, mounted, applyTheme])

  useEffect(() => {
    if (mounted) {
      applyAccentClass(accentPack)
      localStorage.setItem('accentPack', accentPack)
    }
  }, [accentPack, mounted])

  useEffect(() => {
    if (mounted) {
      localStorage.setItem('widgetStyle', widgetStyle)
    }
  }, [widgetStyle, mounted])

  useEffect(() => {
    if (mounted) {
      localStorage.setItem('chartStyle', chartStyle)
    }
  }, [chartStyle, mounted])

  const persistPreference = useCallback(async (
    preference: string,
    value: string,
    rollback: () => void,
  ) => {
    const version = (preferenceRequestVersions.current[preference] ?? 0) + 1
    preferenceRequestVersions.current[preference] = version

    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [preference]: value }),
      })

      if (!response.ok) {
        throw new Error(`Failed to save ${preference} preference (${response.status})`)
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: { surface: 'theme-preferences' },
        extra: { preference },
      })

      if (preferenceRequestVersions.current[preference] === version) {
        rollback()
        toast.error('Could not save that display preference.')
      }
    }
  }, [])

  const setTheme = (newTheme: Theme) => {
    const previousTheme = theme
    setThemeState(newTheme)
    void persistPreference('theme', newTheme, () => setThemeState(previousTheme))
  }

  const setAccentPack = (pack: AccentPack) => {
    const previousAccentPack = accentPack
    setAccentPackState(pack)
    void persistPreference('accentPack', pack, () => setAccentPackState(previousAccentPack))
  }

  const setWidgetStyle = (style: WidgetSurfaceStyle) => {
    const previousWidgetStyle = widgetStyle
    setWidgetStyleState(style)
    void persistPreference('widgetStyle', style, () => setWidgetStyleState(previousWidgetStyle))
  }

  const setChartStyle = (style: ChartStyle) => {
    const previousChartStyle = chartStyle
    setChartStyleState(style)
    void persistPreference('chartStyle', style, () => setChartStyleState(previousChartStyle))
  }

  const toggleTheme = () => {
    const nextTheme = resolveEffective(theme) === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
  }

  const value = {
    theme,
    effectiveTheme: resolveEffective(theme),
    accentPack,
    widgetStyle,
    chartStyle,
    setTheme,
    setAccentPack,
    setWidgetStyle,
    setChartStyle,
    toggleTheme,
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}
