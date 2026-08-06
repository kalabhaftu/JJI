'use client'

import { useEffect, useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Activity, Calendar, Eye, LockKeyhole, Share2, ShieldCheck, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { recordSharedReportView } from '@/lib/api/shared-report-client'
import { reportClientError } from '@/lib/observability/report-error'
import type { SharedReportState } from '@/lib/reports/shared-report'

interface Props {
  state: SharedReportState
}

function money(value: unknown) {
  const number = Number(value || 0)
  return `$${number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function percent(value: unknown) {
  if (value === undefined || value === null || value === '') return '-'
  return `${value}%`
}

function MetricRow({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-slate-200 py-2.5 last:border-b-0">
      <span className="text-[13px] font-semibold text-slate-600">{label}</span>
      <span className={cn("font-mono text-[13px] font-bold text-slate-950", tone === 'good' && 'text-emerald-700', tone === 'bad' && 'text-red-700')}>
        {value}
      </span>
    </div>
  )
}

function StateScreen({ title, message }: { title: string; message: string }) {
  return (
    <main id="main-content" className="mx-auto max-w-6xl px-5 py-16">
      <div className="rounded-sm border border-slate-200 bg-white px-6 py-16 text-center">
        <ShieldCheck className="mx-auto h-8 w-8 text-slate-300" />
        <h2 className="mt-4 text-sm font-extrabold uppercase tracking-[0.16em] text-slate-600">{title}</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">{message}</p>
      </div>
    </main>
  )
}

export function SharedReportView({ state }: Props) {
  const [viewCount, setViewCount] = useState(state.status === 'valid' ? state.report.viewCount : 0)
  const viewedRef = useRef(false)

  useEffect(() => {
    if (state.status !== 'valid' || viewedRef.current) return
    viewedRef.current = true

    const slug = state.report.slug
    let cancelled = false

    recordSharedReportView(slug)
      .then((result) => {
        if (!cancelled) setViewCount(result.viewCount)
      })
      .catch((error) => {
        reportClientError(error, {
          operation: 'record-shared-report-view',
          route: `/reports/shared/${slug}`,
        })
      })

    return () => {
      cancelled = true
    }
  }, [state])

  if (state.status === 'expired') {
    return (
      <div className="min-h-screen bg-[#f4f6fa] text-slate-950">
        <StateScreen
          title="Report expired"
          message="This shared report has expired and is no longer available."
        />
      </div>
    )
  }

  if (state.status === 'revoked') {
    return (
      <div className="min-h-screen bg-[#f4f6fa] text-slate-950">
        <StateScreen
          title="Report revoked"
          message="The owner has revoked access to this shared report."
        />
      </div>
    )
  }

  if (state.status === 'malformed') {
    return (
      <div className="min-h-screen bg-[#f4f6fa] text-slate-950">
        <StateScreen
          title="Report unavailable"
          message="This report could not be rendered."
        />
      </div>
    )
  }

  if (state.status === 'unavailable') {
    return (
      <div className="min-h-screen bg-[#f4f6fa] text-slate-950">
        <StateScreen
          title="Report data unavailable"
          message="The owner has not published a snapshot for this report yet."
        />
      </div>
    )
  }

  const report = state.report
  const psych = report.content.psych
  const activity = report.content.activity
  const sessions = report.content.sessions
  const rDataQuality = report.content.rDataQuality
  const dateRange = report.dateFrom && report.dateTo
    ? `${new Date(report.dateFrom).toLocaleDateString()} - ${new Date(report.dateTo).toLocaleDateString()}`
    : 'All Time'

  const netPnl = Number(psych.totalNetPnL || 0)
  const avgWin = Number(psych.avgWin || 0)
  const avgLoss = Number(psych.avgLoss || 0)

  return (
    <div className="min-h-screen bg-[#f4f6fa] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-slate-950 text-white">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight">{report.title}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span>{dateRange}</span>
                </div>
                <span className="text-slate-300 font-normal">|</span>
                <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 border border-slate-200/50">
                  <Eye className="h-3.5 w-3.5 text-slate-400" />
                  <span>{viewCount} views</span>
                </div>
              </div>
            </div>
          </div>
          <Badge variant="outline" className="h-8 rounded-sm border-slate-300 bg-white px-3 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-700">
            <Share2 className="mr-1.5 h-3.5 w-3.5" />
            Public Report
          </Badge>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-6xl px-5 py-8">
        <div className="overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm">
          <section className="border-b border-slate-200 px-6 py-6">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
              <div>
                <p className="text-[12px] font-extrabold uppercase tracking-[0.22em] text-slate-500">Performance Statement</p>
                <p className={cn("mt-5 font-mono text-5xl font-black tracking-tighter", netPnl >= 0 ? "text-emerald-700" : "text-red-700")}>
                  {netPnl >= 0 ? '+' : '-'}{money(Math.abs(netPnl))}
                </p>
                <p className="mt-2 max-w-md text-sm font-semibold text-slate-500">
                  Shared snapshot of trading activity, risk, execution quality, and account behavior.
                </p>
              </div>
              <div className="grid border-y border-slate-200 sm:grid-cols-3 sm:border-y-0">
                {[
                  ['Total Trades', String(activity.totalTrades || '-')],
                  ['Win Rate', percent(activity.winRate)],
                  ['Profit Factor', String(psych.profitFactor || '-')],
                ].map(([label, value], index) => (
                  <div key={label} className={cn("px-4 py-4 sm:border-l sm:border-slate-200", index === 0 && "sm:border-l-0")}>
                    <p className="text-[11px] font-bold text-slate-500">{label}</p>
                    <p className="mt-1 font-mono text-2xl font-black">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-8 px-6 py-5 lg:grid-cols-2">
            <div>
              <MetricRow label="Average Trade P&L" value={money(psych.expectancy)} tone={Number(psych.expectancy || 0) >= 0 ? 'good' : 'bad'} />
              <MetricRow label="Average Winning Trade" value={money(avgWin)} tone="good" />
              <MetricRow label="Average Losing Trade" value={money(avgLoss)} tone="bad" />
              <MetricRow label="Total Trading Days" value={String(activity.tradingDaysActive || '-')} />
              <MetricRow label="Most Traded Day" value={String(activity.mostTradedDay || '-')} />
              <MetricRow label="Most Profitable Day" value={String(activity.mostProfitableDay || '-')} tone="good" />
              <MetricRow label="Most Losing Day" value={String(activity.mostLosingDay || '-')} tone="bad" />
            </div>
            <div>
              <MetricRow label="Max Drawdown" value={money(psych.maxDrawdown)} tone="bad" />
              <MetricRow label="Recovery Factor" value={String(psych.recoveryFactor || '-')} />
              <MetricRow label="R:R Efficiency" value={String(psych.rrEfficiency || '-')} />
              <MetricRow label="Consistency Score" value={percent(psych.consistencyScore)} />
              <MetricRow label="Total R-Multiple" value={`${psych.totalRMultiple || '-'}R`} />
              <MetricRow label="Peak Equity" value={money(psych.peakEquity)} tone="good" />
              <MetricRow
                label="R Data Coverage"
                value={rDataQuality ? `${rDataQuality.tradesWithStopLoss}/${rDataQuality.totalTrades} (${rDataQuality.percentageComplete}%)` : '-'}
              />
            </div>
          </section>

          {sessions && (
            <section className="border-t border-slate-200 px-6 py-5">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-500">
                <Activity className="h-3.5 w-3.5" />
                Session Performance
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-300 text-left">
                      {['Session', 'Range', 'Trades', 'Wins', 'P&L', 'Max DD'].map((heading) => (
                        <th key={heading} className="px-2 py-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(sessions).map(([key, session]: [string, any]) => (
                      <tr key={key} className="border-b border-slate-100">
                        <td className="px-2 py-2 font-bold">{session.name}</td>
                        <td className="px-2 py-2 text-slate-500">{session.range}</td>
                        <td className="px-2 py-2 font-mono font-bold">{session.trades}</td>
                        <td className="px-2 py-2 font-mono font-bold">{session.wins}</td>
                        <td className={cn("px-2 py-2 font-mono font-bold", Number(session.pnl || 0) >= 0 ? "text-emerald-700" : "text-red-700")}>{money(session.pnl)}</td>
                        <td className="px-2 py-2 font-mono font-bold text-red-700">{money(session.maxDD)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <footer className="flex flex-col gap-2 border-t border-slate-200 px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 md:flex-row md:items-center md:justify-between">
            <span>Generated with JJI</span>
            <span className="flex items-center gap-1.5">
              <LockKeyhole className="h-3.5 w-3.5" />
              Read-only public snapshot
            </span>
          </footer>
        </div>
      </main>
    </div>
  )
}
