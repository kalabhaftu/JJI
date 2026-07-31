'use client'

import { useMemo } from 'react'
import { cn, formatCurrency } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { getTradeNetPnl } from '@/lib/metrics/pnl'
import { classifyOutcome, DEFAULT_BREAK_EVEN_THRESHOLD } from '@/lib/metrics/outcome'

interface InstrumentBreakdownProps {
  trades: any[]
  breakEvenThreshold?: number
}

export function InstrumentBreakdown({ trades, breakEvenThreshold = DEFAULT_BREAK_EVEN_THRESHOLD }: InstrumentBreakdownProps) {
  const instruments = useMemo(() => {
    if (!trades || trades.length === 0) return []

    const map: Record<string, { pnl: number; trades: number; wins: number; losses: number; grossWin: number; grossLoss: number }> = {}

    trades.forEach((trade: any) => {
      const name = (trade.instrument || trade.symbol || '').trim()
      if (!name) return
      if (!map[name]) map[name] = { pnl: 0, trades: 0, wins: 0, losses: 0, grossWin: 0, grossLoss: 0 }

      const netPnl = getTradeNetPnl(trade)
      map[name].pnl += netPnl
      map[name].trades++

      const outcome = classifyOutcome(netPnl, breakEvenThreshold)
      if (outcome === 'win') {
        map[name].wins++
        map[name].grossWin += netPnl
      } else if (outcome === 'loss') {
        map[name].losses++
        map[name].grossLoss += Math.abs(netPnl)
      }
    })

    return Object.entries(map)
      .map(([name, stats]) => {
        const tradable = stats.wins + stats.losses
        return {
          name,
          ...stats,
          winRate: tradable > 0 ? (stats.wins / tradable) * 100 : 0,
          profitFactor: stats.grossLoss > 0 ? stats.grossWin / stats.grossLoss : stats.grossWin > 0 ? 99 : 0,
          avgPnl: stats.trades > 0 ? stats.pnl / stats.trades : 0
        }
      })
      .sort((a, b) => b.pnl - a.pnl)
  }, [trades, breakEvenThreshold])

  if (instruments.length === 0) return null

  return (
    <div className="bg-muted/10 border border-border/40 rounded-2xl p-6">
      <h3 className="text-[10px] uppercase font-black text-muted-foreground mb-4 tracking-[0.2em]">Instrument Performance</h3>
      <div className="overflow-x-auto rounded-xl border border-border/20">
        <Table>
          <TableHeader>
            <TableRow className="border-border/10 hover:bg-transparent">
              <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Instrument</TableHead>
              <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 text-right">Trades</TableHead>
              <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 text-right">W/L</TableHead>
              <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 text-right">Win Rate</TableHead>
              <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 text-right">PF</TableHead>
              <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 text-right">Avg P&L</TableHead>
              <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 text-right">Net P&L</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {instruments.slice(0, 15).map((inst) => (
              <TableRow key={inst.name} className="border-border/10 hover:bg-muted/10">
                <TableCell className="text-xs font-bold">{inst.name}</TableCell>
                <TableCell className="text-right text-xs font-mono">{inst.trades}</TableCell>
                <TableCell className="text-right text-xs font-mono">
                  <span className="text-long">{inst.wins}</span>/<span className="text-short">{inst.losses}</span>
                </TableCell>
                <TableCell className="text-right text-xs font-bold font-mono">
                  <span className={cn(inst.winRate >= 50 ? 'text-long' : 'text-short')}>
                    {inst.winRate.toFixed(1)}%
                  </span>
                </TableCell>
                <TableCell className="text-right text-xs font-bold font-mono">
                  {inst.profitFactor >= 99 ? '∞' : inst.profitFactor.toFixed(2)}
                </TableCell>
                <TableCell className="text-right text-xs font-bold font-mono">
                  <span className={cn(inst.avgPnl >= 0 ? 'text-long' : 'text-short')}>
                    {inst.avgPnl >= 0 ? '+' : ''}{formatCurrency(inst.avgPnl)}
                  </span>
                </TableCell>
                <TableCell className="text-right text-xs font-black font-mono">
                  <span className={cn(inst.pnl >= 0 ? 'text-long' : 'text-short')}>
                    {inst.pnl >= 0 ? '+' : ''}{formatCurrency(inst.pnl)}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
