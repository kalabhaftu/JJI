'use client'

import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { HugeiconsIcon } from '@hugeicons/react'
import { CheckmarkBadge01Icon, Clock01Icon, Tag01Icon } from '@hugeicons/core-free-icons'
import { useWidgetData } from '@/hooks/use-widget-data'
import { useDashboardDisplay } from '@/hooks/use-dashboard-display'
import { useTags } from '@/context/tags-provider'
import { cn } from '@/lib/utils'
import { ChartTooltip, WidgetCard } from '../widget-card'

import { useTheme } from '@/context/theme-provider'

type AccountCurvePoint = {
  date: string
  balance?: number | string | null
  change?: number | string | null
  cumulativePnL?: number | string | null
  dailyPnL?: number | string | null
  trades?: number | string | null
}

type AccountCurvePayload = {
  balance?: AccountCurvePoint[]
  cumulative?: AccountCurvePoint[]
  summary?: Record<string, number | string | null | undefined>
}

type TagPerformanceRow = {
  tag: string
  trades?: number | string | null
  winRate?: number | string | null
  pnl?: number | string | null
  profitFactor?: number | string | null
}

type TimeOfDayRow = {
  hour: number | string
  trades?: number | string | null
  pnl?: number | string | null
}

type DisciplinePayload = {
  ruleBrokenRate?: number | string | null
  ruleCoverage?: number | string | null
  avgRulesPerTaggedTrade?: number | string | null
  playbooks?: Array<{ model: string; broken?: number | string | null; trades?: number | string | null }>
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
}) {
  return (
    <div className="flex rounded-lg border border-border/40 bg-background/40 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'h-6 rounded-md px-2 text-[9px] font-black uppercase tracking-wider text-muted-foreground transition-colors',
            value === option.value && 'bg-foreground text-background shadow-sm'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function EmptyWidget({ label }: { label: string }) {
  return (
    <div className="flex min-h-[180px] items-center justify-center text-center text-xs font-semibold text-muted-foreground">
      {label}
    </div>
  )
}

function MetricPill({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="min-w-0 border-l border-border/30 pl-3">
      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">{label}</p>
      <p className={cn('mt-1 truncate font-mono text-sm font-black', tone === 'good' && 'text-long', tone === 'bad' && 'text-short')}>
        {value}
      </p>
    </div>
  )
}

export function AccountCurveWidget({ initialMode = 'cumulative' }: { initialMode?: 'cumulative' | 'balance' }) {
  const { data, isLoading } = useWidgetData('accountProgression')
  const { formatValue } = useDashboardDisplay()
  const { chartStyle } = useTheme()
  const [mode, setMode] = useState<'cumulative' | 'balance'>(initialMode)

  const chartData = useMemo(() => {
    const payload = data as AccountCurvePayload | null | undefined
    if (!payload) return []
    if (mode === 'balance') {
      return (payload.balance || []).map((item) => ({
        date: item.date,
        value: item.balance,
        dailyPnL: item.change,
        trades: item.trades,
      }))
    }
    return (payload.cumulative || []).map((item) => ({
      date: item.date,
      value: item.cumulativePnL,
      dailyPnL: item.dailyPnL,
      trades: item.trades,
    }))
  }, [data, mode])

  const summary = (data as AccountCurvePayload | null | undefined)?.summary || {}

  const isSharp = chartStyle === 'sharp'
  const strokeColor = 'hsl(var(--primary))'
  const gradientColor = 'hsl(var(--primary))'
  const curveType = isSharp ? 'linear' : 'monotone'

  return (
    <WidgetCard
      title="Account Curve"
      headerRight={<Segmented value={mode} onChange={setMode} options={[
        { value: 'cumulative', label: 'P&L' },
        { value: 'balance', label: 'Balance' },
      ]} />}
    >
      {isLoading ? <EmptyWidget label="Loading account curve..." /> : chartData.length === 0 ? <EmptyWidget label="No account curve data yet" /> : (
        <div className="flex min-h-[280px] flex-col gap-3 xl:flex-row">
          <div className="min-h-[240px] w-full flex-1 xl:min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -25 }}>
                <defs>
                  <linearGradient id="accountCurveFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={gradientColor} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={gradientColor} stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border)/0.2)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={40} />
                <Tooltip content={<ChartTooltip />} />
                <Area type={curveType} dataKey="value" name={mode === 'balance' ? 'Balance' : 'Cumulative P&L'} stroke={strokeColor} strokeWidth={2} fill="url(#accountCurveFill)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-4 gap-3 border-t border-border/25 pt-3 xl:w-40 xl:grid-cols-1 xl:border-l xl:border-t-0 xl:pl-3 xl:pt-0">
            <MetricPill label="Net" value={formatValue(Number(summary.net || 0), { kind: 'money' })} tone={Number(summary.net || 0) >= 0 ? 'good' : 'bad'} />
            <MetricPill label="Peak" value={formatValue(Number(summary.peak || 0), { kind: 'money' })} />
            <MetricPill label="Max DD" value={formatValue(Number(summary.maxDrawdown || 0) * -1, { kind: 'money' })} tone="bad" />
            <MetricPill label="Days" value={String(summary.days || 0)} />
          </div>
        </div>
      )}
    </WidgetCard>
  )
}

export function TagPerformanceWidget() {
  const { data = [], isLoading } = useWidgetData('tagPerformance')
  const { getTagById } = useTags()
  const { formatValue } = useDashboardDisplay()
  const rows = (data as TagPerformanceRow[]).slice(0, 8)
  return (
    <WidgetCard title="Tag Performance" headerRight={<HugeiconsIcon icon={Tag01Icon} className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} color="currentColor" />}>
      {isLoading ? <EmptyWidget label="Loading tags..." /> : rows.length === 0 ? <EmptyWidget label="No tag data yet" /> : (
        <div className="space-y-2">
          {rows.map((item) => {
            const tag = getTagById(item.tag)
            const pnl = Number(item.pnl ?? 0)
            return (
              <div key={item.tag} className="grid grid-cols-[minmax(0,1fr)_72px_52px] items-center gap-3 border-b border-border/20 pb-2 last:border-0">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold">{tag?.name || item.tag}</p>
                  <p className="text-[10px] font-semibold text-muted-foreground">{item.trades} trades / {Number(item.winRate || 0).toFixed(0)}% WR</p>
                </div>
                <p className={cn('text-right font-mono text-xs font-black', pnl >= 0 ? 'text-long' : 'text-short')}>{formatValue(pnl, { kind: 'money' })}</p>
                <p className="text-right font-mono text-xs text-muted-foreground">{Number(item.profitFactor || 0).toFixed(2)} PF</p>
              </div>
            )
          })}
        </div>
      )}
    </WidgetCard>
  )
}

export function TimeOfDayPerformanceWidget() {
  const { data = [], isLoading } = useWidgetData('timeOfDayPerformance')
  const rows = data as TimeOfDayRow[]
  const active = rows.filter((item) => Number(item.trades || 0) > 0)
  const maxAbs = Math.max(...active.map((item) => Math.abs(Number(item.pnl || 0))), 1)
  return (
    <WidgetCard title="Time of Day" headerRight={<HugeiconsIcon icon={Clock01Icon} className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} color="currentColor" />}>
      {isLoading ? <EmptyWidget label="Loading time of day..." /> : active.length === 0 ? <EmptyWidget label="No hourly data yet" /> : (
        <div>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">New York time · 24h</div>
          <div className="grid grid-cols-6 gap-2">
            {rows.map((item) => {
              const pnl = Number(item.pnl ?? 0)
              const intensity = Math.max(0.12, Math.abs(pnl) / maxAbs)
              return (
                <div key={item.hour} className={cn('rounded-md border border-border/25 px-2 py-2', pnl >= 0 ? 'bg-long/10' : 'bg-short/10')} style={{ opacity: Number(item.trades || 0) > 0 ? 0.55 + intensity * 0.45 : 0.35 }}>
                  <p className="font-mono text-[10px] font-black">{String(item.hour).padStart(2, '0')}:00</p>
                  <p className="mt-1 text-[9px] font-bold text-muted-foreground">{item.trades || 0}T</p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </WidgetCard>
  )
}

export function DisciplineAnalyticsWidget() {
  const { data, isLoading } = useWidgetData('disciplineAnalytics')
  const payload = data as DisciplinePayload | null | undefined
  return (
    <WidgetCard title="Discipline" headerRight={<HugeiconsIcon icon={CheckmarkBadge01Icon} className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} color="currentColor" />}>
      {isLoading ? <EmptyWidget label="Loading discipline..." /> : !payload ? <EmptyWidget label="No discipline data yet" /> : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            <MetricPill label="Broken" value={`${Number(payload.ruleBrokenRate || 0).toFixed(0)}%`} tone={Number(payload.ruleBrokenRate || 0) > 25 ? 'bad' : 'good'} />
            <MetricPill label="Coverage" value={`${Number(payload.ruleCoverage || 0).toFixed(0)}%`} />
            <MetricPill label="Avg Rules" value={Number(payload.avgRulesPerTaggedTrade || 0).toFixed(1)} />
          </div>
          <div className="space-y-2">
            {(payload?.playbooks || []).slice(0, 5).map((item) => (
              <div key={item.model} className="flex items-center justify-between gap-3 border-b border-border/20 pb-2 text-xs last:border-0">
                <span className="truncate font-bold">{item.model}</span>
                <span className="font-mono text-muted-foreground">{item.broken}/{item.trades} broken</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </WidgetCard>
  )
}
