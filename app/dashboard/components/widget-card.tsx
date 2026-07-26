'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { useDashboardDisplay } from '@/hooks/use-dashboard-display'
import { inferMetricKind } from '@/lib/dashboard/display-mode'
import { useTheme } from '@/context/theme-provider'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

function getWidgetDescription(title: string): string | null {
  const t = title.toUpperCase().trim()
  if (t.includes('BALANCE')) return 'Historical cumulative account balance over time, showing overall capital growth.'
  if (t.includes('RECENT TRADES')) return 'A list of your most recent trades including date, symbol, and net P&L.'
  if (t.includes('TAG PERFORMANCE')) return 'Visualizes trading performance grouped by user tags to identify profitable behaviors.'
  if (t.includes('TIME OF DAY') || t.includes('TIME-OF-DAY')) return 'Performance analysis grouped by hour of the day to identify peak trading windows.'
  if (t.includes('DISCIPLINE')) return 'Tracks trading execution discipline based on playbook and rule compliance.'
  if (t.includes('CUMULATIVE P') || t.includes('CUMULATIVE EQUITY') || t.includes('EQUITY CURVE')) {
    return 'Cumulative net P&L plotted chronologically to visualize equity curve progress.'
  }
  if (t.includes('DAY OF WEEK') || t.includes('WEEKDAY')) return 'Weekday-specific trading performance breakdown.'
  if (t.includes('DRAWDOWN')) return 'Visualizes equity drawdown percentages over time to monitor risk and capital preservation.'
  if (t.includes('NET DAILY')) return 'Shows daily net profits and losses chronologically.'
  if (t.includes('OUTCOME DISTRIBUTION')) return 'Histogram showing the distribution of winning vs losing trade sizes.'
  if (t.includes('PERFORMANCE SCORE')) return 'A rating metric analyzing trading consistency, risk management, and profit factor.'
  if (t.includes('PERFORMANCE')) return 'High-level dashboard overview of profit factor, win rates, and averages.'
  if (t.includes('INSTRUMENT')) return 'Performance analysis grouped by instrument or ticker symbol.'
  if (t.includes('STRATEGY')) return 'Net P&L performance broken down by individual strategies to evaluate strategy edge.'
  if (t.includes('DURATION')) return 'Compares holding times (minutes/hours) to trade outcomes to improve trade duration.'
  if (t.includes('SESSION')) return 'Analyzes trade metrics grouped by market sessions (Asia, London, New York).'
  if (t.includes('ACCOUNT STATISTICS') || t.includes('PROP FIRM ACCOUNT')) return 'Shows detailed prop-firm account statistics, active phase, start date, and overall duration.'
  if (t.includes('PROP FIRM GROWTH') || t.includes('GROWTH CURVE')) return 'Visualizes your equity and balance growth curve for the active prop-firm challenge phase.'
  if (t.includes('OBJECTIVES') || t.includes('TRADING OBJECTIVES')) {
    return 'Tracks your active prop-firm trading objectives (profit target, max daily loss, max overall loss, minimum trading days) alongside today\'s current performance.'
  }
  if (t.includes('CALENDAR')) return 'Displays daily and weekly trade performance statistics, net P&L, traded days, win rate, and R-Multiple.'

  return null
}

interface WidgetCardProps {
  children: React.ReactNode
  /** Widget title shown in the header */
  title?: string
  headerRight?: React.ReactNode
  /** Whether this is a KPI card (compact, no border-radius padding) */
  isKpi?: boolean
  className?: string
  noPadding?: boolean
}

/**
 * Shared widget wrapper - applies the reports page design language
 * to all dashboard widgets for visual consistency.
 *
 * MOBILE: renders with GPU-safe flat styles (no glass, no blur, no isolation).
 * DESKTOP: renders with full glass/shadow effects.
 */
export function WidgetCard({
  children,
  title,
  headerRight,
  isKpi = false,
  className,
  noPadding = false,
}: WidgetCardProps) {
  const { widgetStyle } = useTheme()
  const isMobile = useIsMobile()
  const isGlass = widgetStyle === 'glass'

  /* ── MOBILE: flat, GPU-safe rendering ─────────────────────────── */
  /* No isolation, no z-index, no backdrop-blur, fully opaque bg,
   * no box-shadow, no group hover effects.
   * This eliminates ALL GPU compositing layer sources. */
  if (isMobile) {
    if (isKpi) {
      return (
        <div
          className={cn(
            'w-full h-full overflow-hidden widget-card',
            'bg-card border border-border/60 dark:border-border/30 rounded-xl',
            'p-3',
            className
          )}
        >
          {children}
        </div>
      )
    }

    const description = title ? getWidgetDescription(title) : null

    return (
      <div
        className={cn(
          'w-full h-full overflow-hidden flex flex-col widget-card',
          'bg-card border border-border/60 dark:border-border/30 rounded-xl',
          !noPadding && 'p-3',
          className
        )}
      >
        {title && (
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className="text-[9px] uppercase font-black tracking-widest text-muted-foreground truncate">
                {title}
              </h3>
              {description && (
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="cursor-help flex items-center justify-center shrink-0">
                        <Info className="h-3 w-3 text-muted-foreground/60" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={5} className="max-w-[240px] text-xs py-1.5 px-2.5 bg-popover border border-border/30 shadow-md">
                      <p className="font-medium text-foreground">{description}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            {headerRight}
          </div>
        )}
        <div className="flex-1 min-h-0 w-full flex flex-col">
          {children}
        </div>
      </div>
    )
  }

  /* ── DESKTOP: full glass/shadow rendering ──────────────────────── */
  if (isKpi) {
    return (
      <div
        className={cn(
          'w-full h-full overflow-hidden widget-card group isolate relative z-0',
          isGlass
            ? 'bg-card/95 dark:bg-card/80 border border-border/60 dark:border-border/30 rounded-2xl shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]'
            : 'bg-card border border-border/60 dark:border-border/30 shadow-sm rounded-xl min-[1440px]:rounded-2xl',
          'p-3 min-[1440px]:p-4',
          className
        )}
      >
        {children}
      </div>
    )
  }

  const description = title ? getWidgetDescription(title) : null

  return (
    <div
      className={cn(
        'w-full h-full overflow-hidden flex flex-col widget-card group isolate relative z-0',
        isGlass
          ? 'bg-card/95 dark:bg-card/80 border border-border/60 dark:border-border/30 rounded-2xl shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]'
          : 'bg-card border border-border/60 dark:border-border/30 shadow-sm rounded-xl sm:rounded-2xl',
        !noPadding && 'p-3 sm:p-5',
        className
      )}
    >
      {title && (
        <div className="flex items-center justify-between mb-3 sm:mb-4 flex-shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="text-[9px] sm:text-[10px] uppercase font-black tracking-widest text-muted-foreground truncate">
              {title}
            </h3>
            {description && (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-help flex items-center justify-center shrink-0">
                      <Info className="h-3 w-3 text-muted-foreground/60 hover:text-muted-foreground transition-colors" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={5} className="max-w-[240px] text-xs py-1.5 px-2.5 bg-popover/95 backdrop-blur-sm border border-border/30 shadow-md">
                    <p className="font-medium text-foreground">{description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {headerRight}
        </div>
      )}
      <div className="flex-1 min-h-0 w-full flex flex-col">
        {children}
      </div>
    </div>
  )
}

export function ChartTooltip({ active, payload, label }: any) {
  const { formatValue, mode, startingBalance } = useDashboardDisplay()

  if (!active || !payload || !payload.length) return null

  return (
    <div className="bg-card border border-border p-3 rounded-lg shadow-md">
      <p className="text-[10px] uppercase font-bold text-muted-foreground/70 mb-2">
        {label}
      </p>
      {payload.map((entry: any, index: number) => (
        <div
          key={index}
          className="flex items-center justify-between gap-4 mb-1 border-b border-border/20 pb-1 last:border-0 last:pb-0 last:mb-0"
        >
          <span
            className="text-xs font-medium text-foreground capitalize"
            style={{ color: entry.color }}
          >
            {entry.name}:
          </span>
          <span className="text-xs font-mono font-bold">
            {typeof entry.value === 'number'
              ? formatValue(entry.value, {
                  kind: inferMetricKind(entry.dataKey, entry.name),
                  basis: startingBalance,
                  precision: mode === 'percentage' ? 2 : 2,
                  sensitive: inferMetricKind(entry.dataKey, entry.name) !== 'count',
                })
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * Standard chart color constants matching reports page.
 * CSS var strings for stylesheet usage.
 */
export const CHART_COLORS = {
  bullish: 'hsl(var(--chart-bullish))',
  bearish: 'hsl(var(--chart-bearish))',
  muted: 'hsl(220, 15%, 55%)',
} as const

/**
 * Resolved color values for Recharts SVG contexts where CSS variables
 * don't reliably work in fill/stroke attributes.
 * These match the CSS vars in globals.css.
 */
const RECHARTS_COLORS = {
  light: {
    bullish: '#83b885',   // --chart-bullish: 123 27% 62%
    bearish: '#c4572a',   // --chart-bearish: 25 70% 45%
    muted: '#7b8494',     // neutral muted
  },
  dark: {
    bullish: '#83b885',   // same in dark
    bearish: '#c4572a',   // same in dark
    muted: '#7b8494',
  },
} as const
