"use client"

import { HugeiconsIcon, HugeiconsIconProps } from '@hugeicons/react'
import {
  Activity01Icon,
  CheckmarkBadge01Icon,
  BarChartIcon,
  Building01Icon,
  JusticeScale01Icon,
  Shield01Icon,
  Target01Icon,
  ChartDecreaseIcon,
  ChartIncreaseIcon,
  Award01Icon,
  Wallet01Icon
} from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'
import { PropFirmWidgetShell } from './prop-firm-widget-shell'
import { useDashboardDisplay } from '@/hooks/use-dashboard-display'

type IconStatProps = {
  label: string
  value: string
  sublabel?: string | undefined
  icon: HugeiconsIconProps['icon']
  tone?: 'positive' | 'negative' | 'neutral'
}

function IconStat({ label, value, sublabel, icon: Icon, tone = 'neutral' }: IconStatProps) {
  return (
    <div className="rounded-xl border border-border/25 bg-card/55 p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
          {sublabel ? <p className="mt-1 text-[10px] text-muted-foreground/70">{sublabel}</p> : null}
        </div>
        <span className={cn('rounded-lg p-2', tone === 'positive' && 'bg-long/10 text-long', tone === 'negative' && 'bg-short/10 text-short', tone === 'neutral' && 'bg-primary/10 text-primary')}>
          <HugeiconsIcon icon={Icon} className="h-4 w-4" strokeWidth={2} color="currentColor" />
        </span>
      </div>
      <p className="font-mono text-xl font-black tracking-tight">{value}</p>
    </div>
  )
}

export function PropFirmAccountStatisticsWidget() {
  const { formatValue, isPrivacyMode } = useDashboardDisplay()
  const forcedMode = isPrivacyMode ? 'privacy' : 'dollars'
  
  return (
    <PropFirmWidgetShell title="Prop Firm Account Statistics">
      {({ data }) => {
        const account = data.account
        if (!account) return null
        const phase = account.currentPhase ?? {}
        const stats = data.statistics || {}
        const currentPhaseTrades = data.groupedTradeCount
        const winRate = currentPhaseTrades > 0 ? data.todayStats.winRate : Number(stats.winRate ?? 0)
        const netPnl = Number(account.currentNetPnL || 0)
        const grossPnl = Number(account.currentGrossPnL || 0)
        const currentBalance = Number(account.currentBalance ?? account.currentEquity ?? 0)
        const currentEquity = Number(account.currentEquity ?? 0)

        const items: IconStatProps[] = [
          { label: 'Current balance', value: formatValue(currentBalance, { kind: 'money', sensitive: true, forceMode: forcedMode }), icon: Wallet01Icon, tone: 'neutral' },
          { label: 'Current equity', value: formatValue(currentEquity, { kind: 'money', sensitive: true, forceMode: forcedMode }), icon: JusticeScale01Icon, tone: 'neutral' },
          { label: 'Net P&L', value: formatValue(netPnl, { kind: 'money', sensitive: true, forceMode: forcedMode }), icon: netPnl >= 0 ? ChartIncreaseIcon : ChartDecreaseIcon, tone: netPnl >= 0 ? 'positive' : 'negative' },
          { label: 'Gross P&L', value: formatValue(grossPnl, { kind: 'money', sensitive: true, forceMode: forcedMode }), icon: BarChartIcon, tone: grossPnl >= 0 ? 'positive' : 'negative' },
          { label: 'Trades', value: formatValue(currentPhaseTrades, { kind: 'count', sensitive: false, forceMode: forcedMode }), sublabel: 'Current phase · partials counted once', icon: Activity01Icon },
          { label: 'Win rate', value: formatValue(winRate, { kind: 'percent', sensitive: false, forceMode: forcedMode }), icon: Award01Icon, tone: winRate >= 50 ? 'positive' : 'negative' },
          { label: 'Winners', value: formatValue(Number(stats.wins ?? stats.winningTrades ?? 0), { kind: 'count', sensitive: false, forceMode: forcedMode }), icon: ChartIncreaseIcon, tone: 'positive' },
          { label: 'Losers', value: formatValue(Number(stats.losses ?? stats.losingTrades ?? 0), { kind: 'count', sensitive: false, forceMode: forcedMode }), icon: ChartDecreaseIcon, tone: 'negative' },
          { label: 'Profit target', value: formatValue(Number(account.profitTargetProgress ?? 0), { kind: 'percent', sensitive: false, forceMode: forcedMode }), icon: Target01Icon, tone: 'positive' },
          { label: 'Daily DD left', value: formatValue(Number(data.drawdown?.dailyDrawdownRemaining ?? account.dailyDrawdownRemaining ?? 0), { kind: 'money', sensitive: true, forceMode: forcedMode }), icon: Shield01Icon, tone: 'neutral' },
          { label: 'Max DD left', value: formatValue(Number(data.drawdown?.maxDrawdownRemaining ?? account.maxDrawdownRemaining ?? 0), { kind: 'money', sensitive: true, forceMode: forcedMode }), icon: Shield01Icon, tone: 'neutral' },
          { label: 'Peak equity', value: formatValue(data.peakEquity, { kind: 'money', sensitive: true, forceMode: forcedMode }), icon: CheckmarkBadge01Icon, tone: 'positive' },
          { label: 'Account size', value: formatValue(Number(account.accountSize ?? 0), { kind: 'money', sensitive: true, forceMode: forcedMode }), icon: Building01Icon },
          { label: 'Phase', value: `Phase ${phase.phaseNumber ?? account.currentPhaseNumber ?? '-'}`, sublabel: phase.status || account.status || undefined, icon: CheckmarkBadge01Icon },
        ]

        return <div className="grid h-auto xl:h-full content-start gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">{items.map((item) => <IconStat key={item.label} {...item} />)}</div>
      }}
    </PropFirmWidgetShell>
  )
}
