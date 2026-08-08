"use client"

import { HugeiconsIcon, HugeiconsIconProps } from '@hugeicons/react'
import { Target01Icon, Shield01Icon, CalendarClockIcon, Award01Icon, ChartDecreaseIcon, Activity01Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'
import { PropFirmWidgetShell } from './prop-firm-widget-shell'
import { clampPercent, formatInteger, formatPercent, getObjectiveTone } from './prop-firm-widget-utils'
import { useDashboardDisplay } from '@/hooks/use-dashboard-display'

type ObjectiveRow = {
  label: string
  value: string
  rawValue?: number
  tone?: 'positive' | 'negative' | 'remaining' | undefined
}

function ObjectiveCard({
  title,
  icon: Icon,
  rows,
  progress,
  danger = false,
}: {
  title: string
  icon: HugeiconsIconProps['icon']
  rows: ObjectiveRow[]
  progress: number
  danger?: boolean
}) {
  const { formatValue } = useDashboardDisplay()
  const remainingRow = rows.find((row) => row.tone === 'remaining')
  const remaining = Number(remainingRow?.rawValue ?? 0)
  const tone = danger || getObjectiveTone(remaining) === 'short' ? 'short' : 'long'
  return (
    <div className="rounded-xl border border-border/25 bg-card/55 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={cn('rounded-lg p-2', tone === 'long' ? 'bg-long/10 text-long' : 'bg-short/10 text-short')}>
            <HugeiconsIcon icon={Icon} className="h-4 w-4" strokeWidth={2} color="currentColor" />
          </span>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
        </div>
        <span className="font-mono text-xs font-bold text-muted-foreground">{formatPercent(progress)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted/35">
        <div className={cn('h-full rounded-full', tone === 'long' ? 'bg-long' : 'bg-short')} style={{ width: `${clampPercent(progress)}%` }} />
      </div>
      <div className="mt-4 divide-y divide-border/20 rounded-lg border border-border/20 bg-background/20">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
            <span className="text-muted-foreground">{row.label}</span>
            <span className={cn('font-mono font-bold', row.tone === 'positive' && 'text-long', row.tone === 'negative' && 'text-short', row.tone === 'remaining' && (remaining <= 0 ? 'text-short' : 'text-long'))}>
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatTile({
  label,
  value,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string
  value: string
  icon: HugeiconsIconProps['icon']
  tone?: 'positive' | 'negative' | 'neutral'
}) {
  return (
    <div className="rounded-xl border border-border/25 bg-muted/10 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
        <HugeiconsIcon icon={Icon} className={cn('h-4 w-4', tone === 'positive' && 'text-long', tone === 'negative' && 'text-short', tone === 'neutral' && 'text-muted-foreground')} strokeWidth={2} color="currentColor" />
      </div>
      <p className="font-mono text-lg font-black tracking-tight">{value}</p>
    </div>
  )
}

export function PropFirmObjectivesTodayWidget() {
  const { formatValue, isPrivacyMode } = useDashboardDisplay()
  const forcedMode = isPrivacyMode ? 'privacy' : 'dollars'
  
  return (
    <PropFirmWidgetShell title="Trading Objectives + Today">
      {({ data }) => {
        const account = data.account
        if (!account) return null
        const phase = account.currentPhase ?? {}
        const accountSize = Number(account.accountSize || 0)
        const targetAmount = accountSize * (Number(phase.profitTargetPercent || 0) / 100)
        const maxLossLimit = accountSize * (Number(phase.maxDrawdownPercent || 0) / 100)
        const dailyLossLimit = data.dailyDrawdown.dailyLimit
        const grossPnl = Number(account.currentGrossPnL || 0)
        const maxRemaining = Number(data.drawdown?.maxDrawdownRemaining ?? account.maxDrawdownRemaining ?? 0)
        const dailyRemaining = data.dailyDrawdown.dailyDrawdownRemaining
        const maxUsed = Math.max(0, maxLossLimit - maxRemaining)
        const dailyUsed = data.dailyDrawdown.dailyDrawdownUsed
        const resetLabel = data.resetTimezone === 'UTC' ? 'UTC' : data.resetTimezone

        return (
          <div className="grid h-auto xl:h-full gap-4 xl:grid-cols-[1.35fr_0.85fr]">
            <div className="grid gap-3 lg:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
              <ObjectiveCard
                title="Profit target"
                icon={Target01Icon}
                progress={targetAmount > 0 ? (grossPnl / targetAmount) * 100 : 0}
                rows={[
                  { label: 'Current result', value: formatValue(grossPnl, { kind: 'money', sensitive: true, forceMode: forcedMode }), tone: grossPnl >= 0 ? 'positive' : 'negative' },
                  { label: 'Total profits target', value: formatValue(targetAmount, { kind: 'money', sensitive: false, forceMode: forcedMode }) },
                  { label: 'Remaining', value: formatValue(Math.max(0, targetAmount - grossPnl), { kind: 'money', sensitive: true, forceMode: forcedMode }), rawValue: Math.max(0, targetAmount - grossPnl), tone: 'remaining' },
                ]}
              />
              <ObjectiveCard
                title="Maximum loss limit"
                icon={Shield01Icon}
                progress={maxLossLimit > 0 ? (maxUsed / maxLossLimit) * 100 : 0}
                danger={maxRemaining <= maxLossLimit * 0.25}
                rows={[
                  { label: 'Current drawdown used', value: formatValue(maxUsed, { kind: 'money', sensitive: true, forceMode: forcedMode }), tone: maxUsed > 0 ? 'negative' : undefined },
                  { label: 'Drawdown limit', value: formatValue(maxLossLimit, { kind: 'money', sensitive: false, forceMode: forcedMode }) },
                  { label: 'Remaining', value: formatValue(maxRemaining, { kind: 'money', sensitive: true, forceMode: forcedMode }), rawValue: maxRemaining, tone: 'remaining' },
                ]}
              />
              <ObjectiveCard
                title="Daily loss limit"
                icon={CalendarClockIcon}
                progress={dailyLossLimit > 0 ? (dailyUsed / dailyLossLimit) * 100 : 0}
                danger={dailyRemaining <= dailyLossLimit * 0.25}
                rows={[
                  { label: `Drawdown used (${resetLabel})`, value: formatValue(dailyUsed, { kind: 'money', sensitive: true, forceMode: forcedMode }), tone: dailyUsed > 0 ? 'negative' : undefined },
                  { label: 'Daily drawdown limit', value: formatValue(dailyLossLimit, { kind: 'money', sensitive: false, forceMode: forcedMode }) },
                  { label: `Remaining this ${resetLabel} day`, value: formatValue(dailyRemaining, { kind: 'money', sensitive: true, forceMode: forcedMode }), rawValue: dailyRemaining, tone: 'remaining' },
                ]}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <StatTile label={`Today P&L (${resetLabel})`} icon={Activity01Icon} value={formatValue(data.todayStats.pnl, { kind: 'money', sensitive: true, forceMode: forcedMode })} tone={data.todayStats.pnl >= 0 ? 'positive' : 'negative'} />
              <StatTile label={`Today trades (${resetLabel})`} icon={CalendarClockIcon} value={formatValue(data.todayStats.trades, { kind: 'count', sensitive: false, forceMode: forcedMode })} />
              <StatTile label="Today win rate" icon={Award01Icon} value={formatValue(data.todayStats.winRate, { kind: 'percent', forceMode: forcedMode })} tone="positive" />
              <StatTile label="Today W / L" icon={ChartDecreaseIcon} value={`${data.todayStats.wins} / ${data.todayStats.losses}`} />
              <StatTile label="Best phase trade" icon={Award01Icon} value={formatValue(data.accountExtremes.bestTrade, { kind: 'money', sensitive: true, forceMode: forcedMode })} tone="positive" />
              <StatTile label="Worst phase trade" icon={ChartDecreaseIcon} value={formatValue(data.accountExtremes.worstTrade, { kind: 'money', sensitive: true, forceMode: forcedMode })} tone="negative" />
            </div>
          </div>
        )
      }}
    </PropFirmWidgetShell>
  )
}
