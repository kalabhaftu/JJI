'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'

interface MonthlyReturnsMatrixProps {
  equityCurve: Array<{ date: string; equity: number; netPnL: number }>
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function MonthlyReturnsMatrix({ equityCurve }: MonthlyReturnsMatrixProps) {
  const { matrix, years, maxAbsPnl } = useMemo(() => {
    if (!equityCurve || equityCurve.length === 0) return { matrix: {}, years: [], maxAbsPnl: 0 }

    // Group PnL by year-month
    const monthlyPnl: Record<string, Record<number, number>> = {}

    equityCurve.forEach(point => {
      if (!point.date) return
      const d = new Date(point.date)
      const year = d.getFullYear().toString()
      const month = d.getMonth()

      if (!monthlyPnl[year]) monthlyPnl[year] = {}
      if (!monthlyPnl[year][month]) monthlyPnl[year][month] = 0
      monthlyPnl[year][month] += point.netPnL || 0
    })

    // Calculate yearly totals
    const matrix: Record<string, { months: Record<number, number>; total: number }> = {}
    let maxAbs = 0

    Object.entries(monthlyPnl).forEach(([year, months]) => {
      let yearTotal = 0
      Object.entries(months).forEach(([_m, pnl]) => {
        yearTotal += pnl
        if (Math.abs(pnl) > maxAbs) maxAbs = Math.abs(pnl)
      })
      matrix[year] = { months, total: yearTotal }
    })

    const years = Object.keys(matrix).sort()

    return { matrix, years, maxAbsPnl: maxAbs }
  }, [equityCurve])

  if (years.length === 0) return null

  const getIntensity = (pnl: number) => {
    if (maxAbsPnl === 0) return 0
    return Math.min(1, Math.abs(pnl) / maxAbsPnl)
  }

  return (
    <div className="bg-muted/10 border border-border/40 rounded-2xl p-6">
      <h3 className="text-[10px] uppercase font-black text-muted-foreground mb-4 tracking-[0.2em]">Monthly Returns Matrix</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 pb-3 pr-3">Year</th>
              {MONTHS.map(m => (
                <th key={m} className="text-center text-[9px] font-black uppercase tracking-wider text-muted-foreground/50 pb-3 px-1 min-w-[60px]">{m}</th>
              ))}
              <th className="text-center text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 pb-3 pl-3 min-w-[70px]">Total</th>
            </tr>
          </thead>
          <tbody>
            {years.map(year => (
              <tr key={year} className="border-t border-border/10">
                <td className="text-[11px] font-black text-foreground py-2 pr-3">{year}</td>
                {Array.from({ length: 12 }, (_, i) => {
                  const pnl = matrix[year]?.months[i]
                  if (pnl === undefined) {
                    return <td key={i} className="text-center py-2 px-1"><span className="text-muted-foreground/20">-</span></td>
                  }
                  const intensity = getIntensity(pnl)
                  const isPositive = pnl >= 0
                  return (
                    <td key={i} className="text-center py-2 px-1">
                      <div
                        className={cn(
                          "rounded-lg px-1.5 py-1.5 text-[10px] font-bold font-mono transition-colors",
                          isPositive
                            ? "text-long"
                            : "text-short"
                        )}
                        style={{
                          backgroundColor: isPositive
                            ? `hsla(var(--chart-bullish) / ${0.08 + intensity * 0.22})`
                            : `hsla(var(--chart-bearish) / ${0.08 + intensity * 0.22})`
                        }}
                      >
                        {isPositive ? '+' : ''}{formatCurrency(pnl)}
                      </div>
                    </td>
                  )
                })}
                <td className="text-center py-2 pl-3">
                  <div className={cn(
                    "rounded-lg px-2 py-1.5 text-[11px] font-black font-mono border",
                    (matrix[year]?.total ?? 0) >= 0
                      ? "text-long bg-long/10 border-long/20"
                      : "text-short bg-short/10 border-short/20"
                  )}>
                    {(matrix[year]?.total ?? 0) >= 0 ? '+' : ''}{formatCurrency(matrix[year]?.total ?? 0)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
