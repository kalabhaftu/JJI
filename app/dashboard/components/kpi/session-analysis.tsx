'use client'

import { WidgetCard } from '../widget-card'
import { useWidgetData } from "@/hooks/use-widget-data"
import { cn } from '@/lib/utils'
import { HugeiconsIcon, HugeiconsIconProps } from '@hugeicons/react'
import { Moon01Icon, Sun01Icon, SunriseIcon } from '@hugeicons/core-free-icons'
import { useDashboardDisplay } from '@/hooks/use-dashboard-display'
import { MarketSession } from '@/lib/time-utils'

interface SessionAnalysisProps {
  size?: string
}

const SESSION_META: Record<MarketSession, { name: string; icon: HugeiconsIconProps['icon']; color: string }> = {
  'New York': { name: 'New York', icon: Sun01Icon, color: 'text-amber-500' },
  London: { name: 'London', icon: SunriseIcon, color: 'text-blue-500' },
  Asia: { name: 'Asia', icon: Moon01Icon, color: 'text-sky-400' },
}

export default function SessionAnalysis({ size: _size }: SessionAnalysisProps) {
  const { formatValue } = useDashboardDisplay()
  const { data: sessionStats } = useWidgetData('sessionAnalysis')

  if (!sessionStats || Object.keys(sessionStats).length === 0) {
    return (
      <WidgetCard title="Session Analysis">
        <div className="flex items-center justify-center h-full">
          <p className="text-sm text-muted-foreground">No trade data available</p>
        </div>
      </WidgetCard>
    )
  }

  const sessions = [
    { key: 'New York', ...SESSION_META['New York'], ...sessionStats['New York'] },
    { key: 'London', ...SESSION_META['London'], ...sessionStats['London'] },
    { key: 'Asia', ...SESSION_META['Asia'], ...sessionStats['Asia'] },
  ]

  return (
    <WidgetCard title="Session Analysis">
      <div className="space-y-3 h-full">
        {sessions.map((session) => {
          const winRate = session.trades > 0 ? (session.wins / session.trades) * 100 : 0
          const isPositive = session.pnl >= 0

          return (
            <div
              key={session.key}
              className={cn(
                'flex items-center justify-between p-3 rounded-xl border',
                'bg-muted/20 border-border/30'
              )}
            >
              <div className="flex items-center gap-3">
                <HugeiconsIcon icon={session.icon} className={cn('h-5 w-5', session.color)} strokeWidth={2} color="currentColor" />
                <div>
                  <p className="font-bold text-sm">{session.name}</p>
                  <p className="text-[10px] text-muted-foreground/50 font-medium">
                    {session.trades} trades - {winRate.toFixed(0)}% win
                  </p>
                </div>
              </div>
              <div
                className={cn(
                  'text-right font-black font-mono text-sm tracking-tighter',
                  isPositive ? 'text-long' : 'text-short'
                )}
              >
                {formatValue(session.pnl, { kind: 'money', sensitive: true })}
              </div>
            </div>
          )
        })}
      </div>
    </WidgetCard>
  )
}