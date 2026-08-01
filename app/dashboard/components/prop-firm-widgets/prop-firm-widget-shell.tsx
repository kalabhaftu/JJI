"use client"

import { ReactNode } from 'react'
import { WidgetCard } from '../widget-card'
import { PropFirmWidgetAccountSelector, PropFirmWidgetTimezoneSelector } from './prop-firm-widget-account-selector'
import { usePropFirmDashboardWidgetData } from '@/hooks/use-prop-firm-dashboard-widget-data'

type Props = {
  title: string
  children: (state: ReturnType<typeof usePropFirmDashboardWidgetData>) => ReactNode
}

export function PropFirmWidgetShell({ title, children }: Props) {
  const state = usePropFirmDashboardWidgetData()
  const { accounts, selectedMasterAccountId, setSelectedMasterAccountId, resetTimezone, setResetTimezone, isLoading, error, data } = state

  return (
    <WidgetCard
      title={title}
      headerRight={
        <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end">
          {data?.dailyDrawdown?.isBreached && (
            <div
              title={data.dailyDrawdown.notes || undefined}
              className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-destructive cursor-help shadow-sm transition-all hover:bg-destructive/15"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
              <span>
                {data.dailyDrawdown.breachType === 'daily_drawdown'
                  ? 'Daily DD Breached'
                  : data.dailyDrawdown.breachType === 'max_drawdown'
                  ? 'Max DD Breached'
                  : 'Account Breached'}
              </span>
            </div>
          )}
          <PropFirmWidgetTimezoneSelector value={resetTimezone} onChange={setResetTimezone} />
          <PropFirmWidgetAccountSelector
            accounts={accounts}
            selectedMasterAccountId={selectedMasterAccountId}
            onChange={setSelectedMasterAccountId}
            isLoading={isLoading && accounts.length === 0}
          />
        </div>
      }
    >
      {error ? (
        <div className="flex min-h-24 items-center justify-center rounded-xl border border-border/30 bg-muted/10 p-6 text-center text-sm text-muted-foreground">
          {error}
        </div>
      ) : accounts.length === 0 && !isLoading ? (
        <div className="flex min-h-24 items-center justify-center rounded-xl border border-border/30 bg-muted/10 p-6 text-center text-sm text-muted-foreground">
          Create a prop-firm account to use this widget.
        </div>
      ) : !data.account && !isLoading ? (
        <div className="flex h-full items-center justify-center rounded-xl border border-border/30 bg-muted/10 p-6 text-center text-sm text-muted-foreground">
          Select a prop-firm challenge to view this widget.
        </div>
      ) : isLoading ? (
        <div className="grid min-h-24 gap-3 md:grid-cols-3">
          <div className="animate-pulse rounded-xl bg-muted/25" />
          <div className="animate-pulse rounded-xl bg-muted/25" />
          <div className="animate-pulse rounded-xl bg-muted/25" />
        </div>
      ) : data.account?.currentPhase ? (
        children(state)
      ) : (
        <div className="flex min-h-24 items-center justify-center rounded-xl border border-border/30 bg-muted/10 p-6 text-center text-sm text-muted-foreground">
          This prop-firm account has no current challenge phase configured.
        </div>
      )}
    </WidgetCard>
  )
}
