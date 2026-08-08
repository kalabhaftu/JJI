'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/trading/trade-formatting'
import { getTradeNetPnl } from '@/lib/metrics/pnl'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { HugeiconsIcon } from '@hugeicons/react'
import { Download01Icon } from '@hugeicons/core-free-icons'

interface StatementViewProps {
  trades: any[]
  dateRange?: { from?: Date; to?: Date } | null
}

type StatementRow = {
  label: string
  value: string
  tone?: 'positive' | 'negative'
}

function ThemeStatementMetric({ label, value, tone }: StatementRow) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-border/16 py-2.5 last:border-b-0">
      <span className="text-[13px] font-semibold text-muted-foreground">{label}</span>
      <span
        className={cn(
          'font-mono text-[13px] font-bold text-foreground',
          tone === 'positive' && 'text-long',
          tone === 'negative' && 'text-short'
        )}
      >
        {value}
      </span>
    </div>
  )
}

export function StatementView({ trades, dateRange }: StatementViewProps) {
  const { sortedTrades, summary } = useMemo(() => {
    if (!trades || trades.length === 0) return { sortedTrades: [], summary: null }

    const sorted = [...trades].sort((a: any, b: any) => {
      const dateA = new Date(a.closeDate || a.entryDate || 0).getTime()
      const dateB = new Date(b.closeDate || b.entryDate || 0).getTime()
      return dateA - dateB
    })

    let grossProfit = 0
    let grossLoss = 0
    let totalCommission = 0
    let totalNet = 0
    let wins = 0
    let losses = 0
    let breakEven = 0
    let largestProfit = Number.NEGATIVE_INFINITY
    let largestLoss = Number.POSITIVE_INFINITY
    let cumulative = 0
    let peak = 0
    let maxDrawdown = 0

    sorted.forEach((trade: any) => {
      const pnl = Number(trade.pnl || 0)
      const commission = Math.abs(Number(trade.commission || 0))
      const net = getTradeNetPnl(trade)

      totalCommission += commission
      totalNet += net
      cumulative += net
      peak = Math.max(peak, cumulative)
      maxDrawdown = Math.max(maxDrawdown, peak - cumulative)
      largestProfit = Math.max(largestProfit, net)
      largestLoss = Math.min(largestLoss, net)

      if (pnl > 0) {
        grossProfit += pnl
        wins++
      } else if (pnl < 0) {
        grossLoss += Math.abs(pnl)
        losses++
      } else {
        breakEven++
      }
    })

    return {
      sortedTrades: sorted,
      summary: {
        totalTrades: sorted.length,
        grossProfit,
        grossLoss,
        totalCommission,
        totalNet,
        wins,
        losses,
        breakEven,
        winRate: sorted.length > 0 ? (wins / sorted.length) * 100 : 0,
        profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
        averageTrade: sorted.length > 0 ? totalNet / sorted.length : 0,
        largestProfit: largestProfit === Number.NEGATIVE_INFINITY ? 0 : largestProfit,
        largestLoss: largestLoss === Number.POSITIVE_INFINITY ? 0 : largestLoss,
        maxDrawdown,
      },
    }
  }, [trades])

  const handleExportPdf = async () => {
    const [{ jsPDF }, autoTableModule] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ])
    const autoTable = (autoTableModule.default || autoTableModule) as any
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()

    doc.setFillColor(255, 255, 255)
    doc.rect(0, 0, pageWidth, doc.internal.pageSize.getHeight(), 'F')
    doc.setTextColor(15, 23, 42)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text('Trading Statement', 40, 44)
    doc.setFontSize(9)
    doc.setTextColor(100, 116, 139)
    doc.text(`From ${period}`, 40, 62)

    const summaryRows = [
      ...leftRows.map((row) => [row.label, row.value]),
      ...rightRows.map((row) => [row.label, row.value]),
    ]

    autoTable(doc, {
      startY: 82,
      body: summaryRows,
      theme: 'plain',
      tableWidth: 340,
      styles: { fontSize: 8, cellPadding: 3, lineColor: [226, 232, 240], lineWidth: 0.4 },
      columnStyles: {
        0: { textColor: [71, 85, 105], fontStyle: 'bold' },
        1: { halign: 'right', textColor: [15, 23, 42], fontStyle: 'bold' },
      },
    })

    let cumulative = 0
    const tableRows = sortedTrades.map((trade: any, index: number) => {
      const netPnl = getTradeNetPnl(trade)
      cumulative += netPnl
      const tradeDate = trade.closeDate || trade.entryDate
      const grossPnl = Number(trade.pnl || 0)
      const commission = Math.abs(Number(trade.commission || 0))
      return [
        index + 1,
        tradeDate ? format(new Date(tradeDate), 'MM/dd/yy HH:mm') : '-',
        trade.instrument || trade.symbol || '-',
        trade.side || '-',
        trade.quantity || '-',
        trade.entryPrice ? Number(trade.entryPrice).toFixed(2) : '-',
        trade.closePrice ? Number(trade.closePrice).toFixed(2) : '-',
        grossPnl.toFixed(2),
        commission > 0 ? commission.toFixed(2) : '-',
        netPnl.toFixed(2),
        cumulative.toFixed(2),
      ]
    })

    autoTable(doc, {
      startY: 82,
      margin: { left: 400, right: 28 },
      head: [['#', 'Date', 'Instrument', 'Side', 'Qty', 'Entry', 'Exit', 'Gross', 'Fees', 'Net', 'Cumulative']],
      body: tableRows,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 3, lineColor: [226, 232, 240], lineWidth: 0.35 },
      headStyles: { fillColor: [248, 250, 252], textColor: [71, 85, 105], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
    })

    doc.setFontSize(8)
    doc.setTextColor(148, 163, 184)
    doc.text(`Generated by JJI on ${format(new Date(), 'MMM dd, yyyy HH:mm')}`, 40, doc.internal.pageSize.getHeight() - 24)
    doc.save(`jji-statement-${format(new Date(), 'yyyy-MM-dd')}.pdf`)
  }

  if (!summary || sortedTrades.length === 0) return null

  const firstDate = dateRange?.from || sortedTrades[0]?.closeDate || sortedTrades[0]?.entryDate
  const lastDate = dateRange?.to || sortedTrades[sortedTrades.length - 1]?.closeDate || sortedTrades[sortedTrades.length - 1]?.entryDate
  const period = firstDate && lastDate
    ? `${format(new Date(firstDate), 'MMM dd, yyyy')} - ${format(new Date(lastDate), 'MMM dd, yyyy')}`
    : 'All Time'
  const grossNet = summary.grossProfit - summary.grossLoss

  const leftRows: StatementRow[] = [
    { label: 'Total P&L', value: formatCurrency(summary.totalNet), tone: summary.totalNet >= 0 ? 'positive' : 'negative' },
    { label: 'Average Trade P&L', value: formatCurrency(summary.averageTrade), tone: summary.averageTrade >= 0 ? 'positive' : 'negative' },
    { label: 'Average Winning Trade', value: summary.wins ? formatCurrency(summary.grossProfit / summary.wins) : 'N/A', tone: 'positive' },
    { label: 'Average Losing Trade', value: summary.losses ? `-${formatCurrency(summary.grossLoss / summary.losses)}` : 'N/A', tone: 'negative' },
    { label: 'Total Number of Trades', value: String(summary.totalTrades) },
    { label: 'Number of Winning Trades', value: String(summary.wins), tone: 'positive' },
    { label: 'Number of Losing Trades', value: String(summary.losses), tone: 'negative' },
    { label: 'Number of Break Even Trades', value: String(summary.breakEven) },
    { label: 'Total Commissions', value: formatCurrency(summary.totalCommission), tone: 'negative' },
    { label: 'Largest Profit', value: formatCurrency(summary.largestProfit), tone: 'positive' },
    { label: 'Largest Loss', value: formatCurrency(summary.largestLoss), tone: 'negative' },
  ]

  const rightRows: StatementRow[] = [
    { label: 'Win Rate', value: `${summary.winRate.toFixed(1)}%` },
    { label: 'Profit Factor', value: summary.profitFactor === Infinity ? 'Infinity' : summary.profitFactor.toFixed(2) },
    { label: 'Open Trades', value: '0' },
    { label: 'Total Trading Days', value: String(new Set(sortedTrades.map((trade: any) => (trade.closeDate || trade.entryDate || '').slice(0, 10)).filter(Boolean)).size) },
    { label: 'Winning Trades', value: String(summary.wins), tone: 'positive' },
    { label: 'Losing Trades', value: String(summary.losses), tone: 'negative' },
    { label: 'Breakeven Trades', value: String(summary.breakEven) },
    { label: 'Gross Profit', value: formatCurrency(summary.grossProfit), tone: 'positive' },
    { label: 'Gross Loss', value: `-${formatCurrency(summary.grossLoss)}`, tone: 'negative' },
    { label: 'Gross Net', value: formatCurrency(grossNet), tone: grossNet >= 0 ? 'positive' : 'negative' },
    { label: 'Max Drawdown', value: formatCurrency(summary.maxDrawdown), tone: 'negative' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground">Statement View</h3>
        <Button variant="secondary" size="sm" onClick={handleExportPdf} className="gap-1.5 text-xs font-bold">
          <HugeiconsIcon icon={Download01Icon} className="h-3.5 w-3.5" />
          Export PDF
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/22 bg-card/30 shadow-sm">
        <div className="border-b border-border/14 px-5 py-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">Statement Preview</p>
              <h2 className="mt-2 text-xl font-extrabold tracking-tight text-foreground">Trading Statement</h2>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground/65">From {period}</p>
            </div>
            <div className="grid grid-cols-3 gap-6 text-left">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/60">Best Trade</p>
                <p className="mt-1 font-mono text-sm font-extrabold text-long">{formatCurrency(summary.largestProfit)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/60">Worst Trade</p>
                <p className="mt-1 font-mono text-sm font-extrabold text-short">{formatCurrency(summary.largestLoss)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/60">Average</p>
                <p className="mt-1 font-mono text-sm font-extrabold text-foreground">{formatCurrency(summary.averageTrade)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-8 px-5 py-4 lg:grid-cols-2">
          <div>{leftRows.map((row) => <ThemeStatementMetric key={row.label} {...row} />)}</div>
          <div>{rightRows.map((row) => <ThemeStatementMetric key={row.label} {...row} />)}</div>
        </div>

        <div className="border-t border-border/14 px-5 py-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-border/18 text-left">
                  {['#', 'Date', 'Instrument', 'Side', 'Qty', 'Entry', 'Exit', 'Gross P&L', 'Fees', 'Net P&L', 'Cumulative'].map((heading) => (
                    <th key={heading} className="px-2 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground/65 last:text-right">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let cumulative = 0
                  return sortedTrades.map((trade: any, index: number) => {
                    const netPnl = getTradeNetPnl(trade)
                    cumulative += netPnl
                    const tradeDate = trade.closeDate || trade.entryDate
                    const grossPnl = Number(trade.pnl || 0)
                    const commission = Math.abs(Number(trade.commission || 0))

                    return (
                      <tr key={trade.id || index} className="border-b border-border/10">
                        <td className="px-2 py-2 font-mono text-muted-foreground/45">{index + 1}</td>
                        <td className="px-2 py-2 font-mono text-muted-foreground">{tradeDate ? format(new Date(tradeDate), 'MM/dd/yy HH:mm') : '-'}</td>
                        <td className="px-2 py-2 font-bold text-foreground">{trade.instrument || trade.symbol || '-'}</td>
                        <td className="px-2 py-2 font-bold uppercase text-foreground">{trade.side || '-'}</td>
                        <td className="px-2 py-2 text-right font-mono text-foreground">{trade.quantity || '-'}</td>
                        <td className="px-2 py-2 text-right font-mono text-foreground">{trade.entryPrice ? Number(trade.entryPrice).toFixed(2) : '-'}</td>
                        <td className="px-2 py-2 text-right font-mono text-foreground">{trade.closePrice ? Number(trade.closePrice).toFixed(2) : '-'}</td>
                        <td className={cn('px-2 py-2 text-right font-mono font-bold', grossPnl >= 0 ? 'text-long' : 'text-short')}>
                          {grossPnl >= 0 ? '+' : ''}{grossPnl.toFixed(2)}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-muted-foreground">{commission > 0 ? commission.toFixed(2) : '-'}</td>
                        <td className={cn('px-2 py-2 text-right font-mono font-bold', netPnl >= 0 ? 'text-long' : 'text-short')}>
                          {netPnl >= 0 ? '+' : ''}{netPnl.toFixed(2)}
                        </td>
                        <td className={cn('px-2 py-2 text-right font-mono font-bold', cumulative >= 0 ? 'text-long' : 'text-short')}>
                          {cumulative >= 0 ? '+' : ''}{cumulative.toFixed(2)}
                        </td>
                      </tr>
                    )
                  })
                })()}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  )
}
