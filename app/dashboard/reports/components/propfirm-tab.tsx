'use client'

import { HugeiconsIcon } from '@hugeicons/react'
import {
  Building02Icon,
  CircleCheckIcon,
  Clock03Icon,
  Dollar01Icon,
  Target01Icon,
  Award01Icon,
  CircleXIcon,
} from '@hugeicons/core-free-icons'
import { usePropFirmStats } from '@/hooks/use-propfirm-stats'
import type { PropFirmAccountDTO, PropFirmSummaryDTO } from '@/lib/statistics/propfirm-statistics'
import { cn } from '@/lib/utils'
import { PropFirmReportsSkeleton } from './reports-page-skeleton'

function formatCurrency(value: number) {
  return `${value >= 0 ? '+' : '-'}$${Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function lifecycleMeta(status: PropFirmAccountDTO['lifecycleStatus']) {
  switch (status) {
    case 'funded':
      return { label: 'Funded', className: 'border-primary/25 bg-primary/10 text-primary' }
    case 'active':
      return { label: 'Active', className: 'border-blue-400/25 bg-blue-400/10 text-blue-300' }
    case 'failed':
      return { label: 'Failed', className: 'border-short/25 bg-short/10 text-short' }
    case 'pending_approval':
      return { label: 'Pending Approval', className: 'border-amber-400/25 bg-amber-400/10 text-amber-300' }
    default:
      return { label: 'Passed', className: 'border-long/25 bg-long/10 text-long' }
  }
}

function SummaryMetric({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: string | number
  icon: import('@hugeicons/react').HugeiconsIconProps['icon']
  color: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/12 py-3 last:border-b-0">
      <div className="flex items-center gap-2.5">
        <HugeiconsIcon icon={Icon} className={cn('h-4 w-4 shrink-0', color)} strokeWidth={1.5} color="currentColor" />
        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground/70">{label}</span>
      </div>
      <span className={cn('font-mono text-xl font-black', color)}>{value}</span>
    </div>
  )
}

function InlineMetric({
  label,
  value,
  tone,
}: {
  label: string
  value: string | number
  tone?: 'positive' | 'negative' | 'neutral'
}) {
  const color =
    tone === 'positive'
      ? 'text-long'
      : tone === 'negative'
        ? 'text-short'
        : 'text-foreground'

  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/10 py-2.5 last:border-b-0">
      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground/65">{label}</span>
      <span className={cn('font-mono text-sm font-black', color)}>{value}</span>
    </div>
  )
}

function AccountPanel({ account }: { account: PropFirmAccountDTO }) {
  const status = lifecycleMeta(account.lifecycleStatus)

  return (
    <article className="overflow-hidden rounded-2xl border border-border/24 bg-card/30">
      <div className="border-b border-border/14 px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-primary/80">
              <HugeiconsIcon icon={Building02Icon} className="h-3.5 w-3.5 text-primary/70" />
              <span className="truncate">{account.propFirmName}</span>
            </div>
            <h3 className="mt-2 text-sm font-black uppercase tracking-tight text-foreground">{account.accountName}</h3>
            <p className="mt-1 text-[11px] font-semibold text-muted-foreground/65">
              {account.isFundedStage ? 'Funded Stage' : `Phase ${account.currentPhaseNumber ?? '-'}`} · $
              {account.accountSize.toLocaleString()}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground/60">Net P&L</p>
              <p className={cn('mt-1 font-mono text-3xl font-black tracking-tighter', account.netPnL >= 0 ? 'text-long' : 'text-short')}>
                {formatCurrency(account.netPnL)}
              </p>
            </div>
            <span className={cn('shrink-0 rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-widest', status.className)}>
              {status.label}
            </span>
          </div>
        </div>

        {account.profitTargetAmount > 0 && !account.isFundedStage && (
          <div className="mt-4 border-t border-border/12 pt-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground/60">Profit Target Progress</span>
              <span className="font-mono text-xs font-black">{account.profitTargetProgressPct.toFixed(1)}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/30">
              <div
                className={cn('h-full rounded-full transition-all', account.grossPnL >= 0 ? 'bg-long' : 'bg-short')}
                style={{ width: `${Math.min(100, Math.max(0, account.profitTargetProgressPct))}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] font-semibold text-muted-foreground/55">
              <span>{formatCurrency(account.grossPnL)} gross</span>
              <span>${account.profitTargetAmount.toLocaleString()} target</span>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-0 border-b border-border/12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="px-5 py-4 lg:border-r lg:border-border/12">
          <div className="grid gap-x-6 sm:grid-cols-2">
            <InlineMetric label="Trades" value={account.tradeCount} />
            <InlineMetric label="Active Days" value={account.activeDays} />
            <InlineMetric label="Duration" value={`${account.durationDays}d`} />
            <InlineMetric label="Win Rate" value={`${account.winRate}%`} tone={parseFloat(account.winRate) >= 50 ? 'positive' : 'negative'} />
            <InlineMetric label="Profit Factor" value={account.profitFactor} tone={parseFloat(account.profitFactor) >= 1 ? 'positive' : 'negative'} />
            <InlineMetric label="Expectancy" value={`$${account.expectancy}`} tone={parseFloat(account.expectancy) >= 0 ? 'positive' : 'negative'} />
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="grid gap-x-6 sm:grid-cols-2">
            <InlineMetric
              label="Peak Profit"
              value={`$${account.peakProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              tone="positive"
            />
            <InlineMetric
              label="Max DD"
              value={`$${account.maxDrawdown.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              tone="negative"
            />
            <InlineMetric label="Max DD %" value={`${account.maxDrawdownPct}%`} tone="negative" />
            <InlineMetric label="Stage" value={account.isFundedStage ? 'Funded' : `Phase ${account.currentPhaseNumber ?? '-'}`} />
          </div>
        </div>
      </div>

      {(account.totalPayouts > 0 || account.breachCount > 0 || account.phaseHistory.length > 1) && (
        <div className="px-5 py-4">
          {(account.totalPayouts > 0 || account.breachCount > 0) && (
            <div className="mb-3 flex flex-wrap items-center gap-3">
              {account.totalPayouts > 0 && (
                <div className="flex items-center gap-1.5 text-[10px] font-black text-primary">
                  <HugeiconsIcon icon={Dollar01Icon} className="h-3.5 w-3.5" />
                  ${account.totalPayouts.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} payouts
                </div>
              )}
              {account.breachCount > 0 && (
                <div className="text-[10px] font-black text-amber-300">
                  {account.breachCount} breach{account.breachCount === 1 ? '' : 'es'}
                </div>
              )}
            </div>
          )}

          {account.phaseHistory.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {account.phaseHistory.map((phase) => (
                <span
                  key={phase.id}
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                    phase.status === 'passed' && 'border-long/25 bg-long/10 text-long',
                    phase.status === 'failed' && 'border-short/25 bg-short/10 text-short',
                    phase.status === 'active' && 'border-blue-400/20 bg-blue-400/10 text-blue-300',
                    phase.status === 'pending_approval' && 'border-amber-400/20 bg-amber-400/10 text-amber-300',
                    !['passed', 'failed', 'active', 'pending_approval'].includes(phase.status) &&
                      'border-border/40 bg-muted/20 text-muted-foreground'
                  )}
                >
                  {phase.isFundedStage ? 'Funded' : `P${phase.phaseNumber}`} · {phase.status.replace('_', ' ')}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  )
}

interface PropFirmTabProps {
  initialData?: PropFirmSummaryDTO
}

export function PropFirmTab({ initialData }: PropFirmTabProps) {
  const { data, isLoading } = usePropFirmStats(initialData)

  if (isLoading) {
    return <PropFirmReportsSkeleton />
  }

  if (!data || data.accounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/5 py-24">
        <HugeiconsIcon icon={Building02Icon} className="mb-4 h-10 w-10 text-muted-foreground/30" />
        <h3 className="mb-2 text-sm font-bold uppercase tracking-widest text-muted-foreground/50">No Prop Firm Accounts</h3>
        <p className="text-xs font-medium text-muted-foreground">Import prop firm trades to see account analysis here.</p>
      </div>
    )
  }

  const accountStats = [
    { label: 'Total Accounts', value: data.totalAccounts, icon: Building02Icon, color: 'text-foreground' },
    { label: 'Active', value: data.activeAccounts, icon: Clock03Icon, color: 'text-blue-300' },
    { label: 'Funded', value: data.fundedAccounts, icon: CircleCheckIcon, color: 'text-primary' },
    { label: 'Failed', value: data.failedAccounts, icon: CircleXIcon, color: 'text-short' },
    { label: 'Passed Phases', value: data.passedPhases, icon: Award01Icon, color: 'text-long' },
    { label: 'Breaches', value: data.totalBreaches, icon: Target01Icon, color: 'text-amber-300' },
  ]

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-2xl border border-border/24 bg-card/30">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div className="border-b border-border/14 px-5 py-5 lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              <HugeiconsIcon icon={Building02Icon} className="h-3.5 w-3.5" />
              Funded Overview
            </div>
            <p className={cn('mt-5 font-mono text-4xl font-black tracking-tighter sm:text-5xl', data.totalNetPnL >= 0 ? 'text-long' : 'text-short')}>
              {formatCurrency(data.totalNetPnL)}
            </p>
            <p className="mt-2 max-w-sm text-sm font-semibold text-muted-foreground">
              Combined master-account performance, lifecycle status, and challenge health across funded tracking.
            </p>
            <div className="mt-6 grid grid-cols-2 border-y border-border/14 text-sm">
              <div className="border-r border-border/14 py-3 pr-4">
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground/60">Gross Challenge P&L</p>
                <p className={cn('mt-1 font-mono text-xl font-black', data.totalGrossPnL >= 0 ? 'text-long' : 'text-short')}>
                  {formatCurrency(data.totalGrossPnL)}
                </p>
              </div>
              <div className="py-3 pl-4">
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground/60">Paid Payouts</p>
                <p className="mt-1 font-mono text-xl font-black text-primary">
                  ${data.totalPayoutsReceived.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          <div className="grid divide-y divide-border/14 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            <div className="px-5 py-3">
              {accountStats.slice(0, 3).map((metric) => (
                <SummaryMetric key={metric.label} {...metric} />
              ))}
            </div>
            <div className="px-5 py-3">
              {accountStats.slice(3).map((metric) => (
                <SummaryMetric key={metric.label} {...metric} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Master Accounts</h2>
        <div className="space-y-4">
          {data.accounts.map((account) => (
            <AccountPanel key={account.id} account={account} />
          ))}
        </div>
      </section>
    </div>
  )
}
