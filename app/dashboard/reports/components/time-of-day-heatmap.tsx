'use client'

import { useMemo } from 'react'
import { cn, formatCurrency } from '@/lib/utils'
import { getTradeNetPnl } from '@/lib/metrics/pnl'
import { getNewYorkHour, getNewYorkWeekdayIndex } from '@/lib/time-utils'

interface TimeOfDayHeatmapProps {
  trades: any[]
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

function formatHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`
}

export function TimeOfDayHeatmap({ trades }: TimeOfDayHeatmapProps) {
  const { grid, maxAbsPnl, activeHours } = useMemo(() => {
    if (!trades || trades.length === 0) return { grid: {}, maxAbsPnl: 0, activeHours: new Set<number>() }

    // Build grid: day -> hour -> { pnl, trades, wins }
    const grid: Record<string, Record<number, { pnl: number; trades: number; wins: number }>> = {}
    const activeHours = new Set<number>()
    let maxAbs = 0

    DAYS.forEach(d => { grid[d] = {} })

    trades.forEach((trade: any) => {
      const rawDate = trade.entryDate || trade.entryTime
      if (!rawDate) return

      const dayIdx = getNewYorkWeekdayIndex(rawDate) // 0=Sun, 1=Mon, ...
      if (dayIdx == null || dayIdx < 1 || dayIdx > 5) return // Skip weekends

      const dayName = DAYS[dayIdx - 1]
      if (!dayName) return
      const hour = getNewYorkHour(rawDate)
      if (hour == null) return
      const pnl = getTradeNetPnl(trade)

      activeHours.add(hour)

      let cell = grid[dayName]?.[hour]
      if (!cell) {
        cell = { pnl: 0, trades: 0, wins: 0 }
        if (!grid[dayName]) grid[dayName] = {}
        grid[dayName][hour] = cell
      }
      cell.pnl += pnl
      cell.trades++
      if (pnl > 0) cell.wins++
    })

    // Find max absolute PnL for color scaling
    Object.values(grid).forEach(hours => {
      Object.values(hours).forEach(cell => {
        if (Math.abs(cell.pnl) > maxAbs) maxAbs = Math.abs(cell.pnl)
      })
    })

    return { grid, maxAbsPnl: maxAbs, activeHours }
  }, [trades])

  // Filter to only hours that have activity (±2 hours buffer)
  const filteredHours = useMemo(() => {
    if (activeHours.size === 0) return []
    const sorted = Array.from(activeHours).sort((a, b) => a - b)
    if (sorted.length === 0) return []
    const min = Math.max(0, (sorted[0] ?? 0) - 1)
    const max = Math.min(23, (sorted[sorted.length - 1] ?? 23) + 1)
    return HOURS.filter(h => h >= min && h <= max)
  }, [activeHours])

  if (filteredHours.length === 0) return null

  return (
    <div className="bg-muted/10 border border-border/40 rounded-2xl p-6">
      <h3 className="text-[10px] uppercase font-black text-muted-foreground mb-4 tracking-[0.2em]">Time of Day Performance</h3>
      <div className="mb-3 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">New York time · 24h</div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 pb-2 pr-2 w-12"></th>
              {filteredHours.map(h => (
                <th key={h} className="text-center text-[8px] font-bold text-muted-foreground/50 pb-2 px-0.5 min-w-[36px]">
                  {formatHour(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map(day => (
              <tr key={day}>
                <td className="text-[10px] font-black text-muted-foreground py-0.5 pr-2">{day}</td>
                {filteredHours.map(hour => {
                  const cell = grid[day]?.[hour]
                  if (!cell || cell.trades === 0) {
                    return (
                      <td key={hour} className="p-0.5">
                        <div className="w-full h-8 rounded bg-muted/10 border border-border/10" />
                      </td>
                    )
                  }

                  const intensity = maxAbsPnl > 0 ? Math.min(1, Math.abs(cell.pnl) / maxAbsPnl) : 0
                  const isPositive = cell.pnl >= 0

                  return (
                    <td key={hour} className="p-0.5 group relative">
                      <div
                        className="w-full h-8 rounded flex items-center justify-center cursor-default transition-transform hover:scale-110 hover:z-10"
                        style={{
                          backgroundColor: isPositive
                            ? `hsla(var(--chart-bullish) / ${0.15 + intensity * 0.55})`
                            : `hsla(var(--chart-bearish) / ${0.15 + intensity * 0.55})`
                        }}
                      >
                        <span className={cn(
                          "text-[8px] font-bold font-mono",
                          isPositive ? "text-long" : "text-short"
                        )}>
                          {cell.trades}
                        </span>
                      </div>
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                        <div className="bg-card border border-border rounded-lg shadow-lg p-2 min-w-[120px] text-center">
                          <p className="text-[9px] font-bold text-muted-foreground">{day} {formatHour(hour)}</p>
                          <p className={cn("text-xs font-black font-mono", cell.pnl >= 0 ? "text-long" : "text-short")}>
                            {cell.pnl >= 0 ? '+' : ''}{formatCurrency(cell.pnl)}
                          </p>
                          <p className="text-[9px] text-muted-foreground">{cell.trades} trades · {cell.wins}W</p>
                        </div>
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsla(var(--chart-bearish) / 0.5)' }} />
          <span className="text-[9px] font-bold text-muted-foreground">Loss</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-muted/30 border border-border/20" />
          <span className="text-[9px] font-bold text-muted-foreground">No Activity</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsla(var(--chart-bullish) / 0.5)' }} />
          <span className="text-[9px] font-bold text-muted-foreground">Profit</span>
        </div>
      </div>
    </div>
  )
}
