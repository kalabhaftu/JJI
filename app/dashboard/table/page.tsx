'use client'

import dynamic from 'next/dynamic'
import { useSearchParams, useRouter } from 'next/navigation'
import { useData } from '@/context/data-provider'
import { useDashboardDisplay } from '@/hooks/use-dashboard-display'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { Suspense } from 'react'
import { cn, classifyTrade, ensureExtendedTrade } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { TablePageSkeleton } from './components/table-page-skeleton'
import { getBreakEvenThreshold } from '@/lib/metrics/outcome'

const TradeReplay = dynamic(() => import('../components/trades/trade-replay'), { ssr: false })
const TradeDetailPanel = dynamic(
  () => import('../components/tables/trade-detail-panel').then((mod) => mod.TradeDetailPanel),
  { ssr: false },
)
const TradeEditPanel = dynamic(
  () => import('../components/tables/trade-edit-panel').then((mod) => mod.TradeEditPanel),
  { ssr: false },
)
const TradeTableReview = dynamic(
  () => import('../components/tables/trade-table-review').then((mod) => ({ default: mod.TradeTableReview })),
  { ssr: false }
)

function TableView() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { formattedTrades = [], updateTrades, statistics } = useData()
  const { formatValue, getTradeRMultipleInfo } = useDashboardDisplay()
  const breakEvenThreshold = getBreakEvenThreshold(statistics?.breakEvenThreshold)

  const view = searchParams.get('view')
  const tradeId = searchParams.get('tradeId')
  const backUrl = searchParams.get('backUrl')

  if (view === 'replay' && tradeId) {
    const trade = formattedTrades.find((t: any) => t.id === tradeId)

    if (trade) {
      const isLong = trade.side?.toLowerCase() === 'long' || trade.side?.toLowerCase() === 'buy'
      const outcome = classifyTrade(trade.pnl, breakEvenThreshold)
      const isProfit = outcome === 'win'
      const tradeRInfo = getTradeRMultipleInfo(trade)

      return (
        <div className="flex h-[calc(100vh-120px)] flex-col overflow-hidden rounded-xl border border-border/40 bg-background shadow-sm">
          <div className="flex flex-col justify-between gap-2 border-b bg-muted px-3 py-2 shrink-0 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (backUrl) {
                    router.push(backUrl)
                  } else {
                    router.back()
                  }
                }}
                className="h-8 px-2 text-xs hover:bg-accent/50"
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                <span className="hidden sm:inline">Back</span>
              </Button>
              <div className="hidden h-4 w-px bg-border/60 sm:block" />
              <h1 className="mr-2 text-xs font-bold uppercase tracking-tight text-muted-foreground">
                {trade.instrument}
              </h1>
              <Badge
                variant={isLong ? 'default' : 'destructive'}
                className="h-4 px-1.5 py-0 text-[10px] font-bold uppercase"
              >
                {isLong ? 'Buy' : 'Sell'}
              </Badge>
            </div>

            <div className="flex items-center gap-3 overflow-x-auto text-[10px] sm:gap-6 sm:text-xs">
              <div className="flex shrink-0 flex-col items-start sm:items-end">
                <span className="mb-0.5 text-[9px] font-bold uppercase leading-none text-muted-foreground">
                  Entry/Exit
                </span>
                <span className="font-mono font-medium leading-none">
                  ${Number(trade.entryPrice).toFixed(2)} -&gt; {trade.closePrice ? `$${Number(trade.closePrice).toFixed(2)}` : 'OPEN'}
                </span>
              </div>
              <div className="hidden shrink-0 flex-col items-start xs:flex sm:items-end">
                <span className="mb-0.5 text-[9px] font-bold uppercase leading-none text-muted-foreground">
                  Size
                </span>
                <span className="font-mono font-medium leading-none">{trade.quantity}</span>
              </div>
              <div className="flex shrink-0 flex-col items-start sm:items-end">
                <span className="mb-0.5 text-[9px] font-bold uppercase leading-none text-muted-foreground">
                  P&amp;L
                </span>
                <span
                  className={cn(
                    'font-mono font-bold leading-none',
                    isProfit ? 'text-profit' : 'text-loss'
                  )}
                >
                  {formatValue(trade.pnl, { kind: 'money', rValue: tradeRInfo.value })}
                </span>
              </div>
            </div>
          </div>
          <div className="relative flex-1 overflow-hidden bg-card">
            <TradeReplay trade={{ ...trade, quantity: trade.quantity || 0 }} />
          </div>
        </div>
      )
    }
  }

  if (view === 'details' && tradeId) {
    const trade = formattedTrades.find((t: any) => t.id === tradeId)
    if (trade) {
      return (
        <div className="fixed inset-0 z-50 bg-background">
          <TradeDetailPanel
            trade={trade}
            onClose={() => router.replace('/dashboard/table')}
            basePath="/dashboard/table"
          />
        </div>
      )
    }
  }

  if (view === 'edit' && tradeId) {
    const trade = formattedTrades.find((t: any) => t.id === tradeId)
    if (trade) {
      return (
        <div className="fixed inset-0 z-50 bg-background">
          <TradeEditPanel
            trade={ensureExtendedTrade(trade as any)}
            onClose={() => router.replace('/dashboard/table')}
            onSave={async (data: any) => {
              await updateTrades([tradeId], data)
            }}
          />
        </div>
      )
    }
  }

  return <TradeTableReview />
}

export default function TablePage() {
  return (
    <div className="w-full px-3 py-4 sm:px-4 md:px-6">
      <Suspense fallback={<TablePageSkeleton />}>
        <TableView />
      </Suspense>
    </div>
  )
}
