'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { VisuallyHidden } from '@/components/ui/visually-hidden'
import { useTags } from '@/context/tags-provider'
import { useData } from '@/context/data-provider'
import { useNewsEvents } from '@/hooks/use-news-events'
import { formatTimeInZone, getKillzoneBadge, getTradingSession } from '@/lib/time-utils'
import { cn } from '@/lib/utils'
import { formatNoteContent } from '@/lib/content/cleaning'
import {
  classifyTrade,
  formatCurrency,
} from '@/lib/trading/trade-formatting'
import { formatTradePrice } from '@/lib/trading/precision'
import { useUserStore } from '@/store/user-store'
import {
  ArrowLeft,
  BarChart3,
  Download,
  Play,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  PenLine,
  Zap
} from 'lucide-react'
import type { TradeType } from '@/lib/db/schema/trades';

import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'
import { toast } from 'sonner'
import { emitTourEvent } from '@/lib/tours/events'
import { getBreakEvenThreshold } from '@/lib/metrics/outcome'
import { stripTradePreviewImageConfig } from '@/lib/trade-preview-image'
import { getPnlDisplayLabel, getTradeGrossPnl, getTradeNetPnl, getTradePnlByMode, normalizePnlDisplayMode } from '@/lib/metrics/pnl'
import { parseTradeChartLinks } from '@/lib/trade-core'
import { reportClientError } from '@/lib/observability/report-error'
import { TradeWorkspace, type TradeWorkspaceProps } from '@/components/ui/trade-workspace'

interface TradeDetailPanelProps {
  trade: TradeType
  onClose: () => void
  basePath: string
  workspaceMode?: TradeWorkspaceProps['mode']
}

async function downloadImage(imageUrl: string, trade: TradeType, imageIndex: number) {
  try {
    const response = await fetch(imageUrl)
    if (!response.ok) throw new Error('Failed to fetch image')
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const date = new Date(trade.entryDate).toISOString().split('T')[0]
    a.download = `${trade.instrument}_${trade.side}_${date}_${imageIndex}.png`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
    toast.success('Image downloaded')
  } catch (error) {
    reportClientError(error, { operation: 'download-trade-image', route: '/dashboard/journal' })
    toast.error('Failed to download image')
  }
}

export function TradeDetailPanel({ trade, onClose, basePath, workspaceMode = 'route' }: TradeDetailPanelProps) {
  const { statistics } = useData()
  const { tags } = useTags()
  const { getNewsById } = useNewsEvents()
  const timezone = useUserStore((state) => state.timezone)
  const pnlDisplayMode = normalizePnlDisplayMode(
    useUserStore((state) => state.user?.pnlDisplayMode)
  )
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  const tradeData = trade as any
  const threshold = getBreakEvenThreshold(statistics?.breakEvenThreshold)
  const grossPnL = getTradeGrossPnl(trade)
  const netPnL = getTradeNetPnl(trade)
  const displayPnl = getTradePnlByMode(trade, pnlDisplayMode)
  const outcome = classifyTrade(netPnL, threshold)
  const isWin = outcome === 'win'
  const isLoss = outcome === 'loss'
  const isLong = trade.side?.toUpperCase() === 'BUY' || trade.side?.toLowerCase() === 'long'

  const images = [
    stripTradePreviewImageConfig(tradeData.cardPreviewImage),
    tradeData.imageOne,
    tradeData.imageTwo,
    tradeData.imageThree,
    tradeData.imageFour,
    tradeData.imageFive,
    tradeData.imageSix,
  ].filter((img: any) => img && String(img).trim() !== '')

  const selectedImage = selectedImageIndex === null ? null : images[selectedImageIndex]
  const selectedImageNumber = selectedImageIndex === null ? 0 : selectedImageIndex + 1
  const showImageNavigation = images.length > 1

  const goToPreviousImage = useCallback(() => {
    setSelectedImageIndex(current => {
      if (current === null || images.length === 0) return current
      return (current - 1 + images.length) % images.length
    })
  }, [images.length])

  const goToNextImage = useCallback(() => {
    setSelectedImageIndex(current => {
      if (current === null || images.length === 0) return current
      return (current + 1) % images.length
    })
  }, [images.length])

  useEffect(() => {
    if (selectedImageIndex === null) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goToPreviousImage()
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        goToNextImage()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goToNextImage, goToPreviousImage, selectedImageIndex])

    const chartLinks = parseTradeChartLinks(tradeData)

    const newsEventIds = tradeData.selectedNews
    ? tradeData.selectedNews.split(',').filter(Boolean)
    : []
  const newsEvents = newsEventIds.map((id: string) => getNewsById(id)).filter(Boolean)

  const tradeTags = Array.isArray(tradeData.tags)
    ? tradeData.tags.filter(Boolean).map((id: string) => tags.find(t => t.id === id)).filter(Boolean)
    : []
  const tradingModelName = tradeData.TradingModel?.name || tradeData.tradingModel || null

  const selectedRules = (() => {
    const rawRules = tradeData.selectedRules
    if (Array.isArray(rawRules)) return rawRules.map((rule: any) => String(rule)).filter(Boolean)

    if (typeof rawRules === 'string') {
      try {
        const parsed = JSON.parse(rawRules)
        if (Array.isArray(parsed)) return parsed.map((rule: any) => String(rule)).filter(Boolean)
      } catch {
        return rawRules.split(',').map((rule: string) => rule.trim()).filter(Boolean)
      }
    }

    return []
  })()

    const session = trade.entryTime ? getTradingSession(trade.entryTime) : null
    const killzone = trade.entryTime ? getKillzoneBadge(trade.entryTime) : null

  const handleEdit = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', 'edit')
    router.push(`${basePath}?${params.toString()}` as any)
  }

  const [copiedField, setCopiedField] = useState<string | null>(null)

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    toast.success(`${field} copied to clipboard`)
    setTimeout(() => setCopiedField(null), 2000)
  }

  return (
    <TradeWorkspace mode={workspaceMode} title={`${trade.instrument} trade details`} description="Review execution, strategy, journal, and trade evidence." onRequestClose={onClose}>
      <div className="flex flex-col h-full">
        {}
        <div className="px-4 sm:px-6 py-3 border-b border-border/40 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Button variant="tertiary" size="sm" onClick={() => { onClose(); emitTourEvent('trade.detail.closed') }} data-tour="close-trade-detail" className="h-8 px-2 text-xs hover:bg-accent/50 shrink-0">
                <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                <span className="hidden sm:inline">Back</span>
              </Button>
              <div className="h-4 w-px bg-border/40 shrink-0" />
              <h2 className="text-base sm:text-lg font-black tracking-tight truncate">{trade.instrument}</h2>
              <Badge variant={isLong ? 'default' : 'destructive'} className="text-[10px] px-1.5 py-0 h-5 uppercase font-bold shrink-0">
                {isLong ? 'Buy' : 'Sell'}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs font-mono font-bold px-2 py-0 h-5 shrink-0",
                  displayPnl >= 0 ? "border-long/40 text-long bg-long/5" : displayPnl < 0 ? "border-short/40 text-short bg-short/5" : "border-border text-muted-foreground"
                )}
              >
                {formatCurrency(displayPnl)}
              </Badge>
              {session && (
                <Badge variant="outline" className="text-[10px] border-primary/20 bg-primary/5 text-primary hidden md:inline-flex shrink-0">
                  {session}
                </Badge>
              )}
              {killzone && (
                <Badge variant="outline" className="text-[10px] border-warning/20 bg-warning/5 text-warning hidden md:inline-flex shrink-0">
                  {killzone}
                </Badge>
              )}
            </div>
            <Button variant="secondary" onClick={handleEdit} className="h-8 px-3 rounded-lg text-xs font-semibold shrink-0">
              <PenLine className="h-3.5 w-3.5 mr-1.5" />
              Edit
            </Button>
          </div>
        </div>

        {}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
          <div className="max-w-5xl mx-auto space-y-8">

            {}
            <section>
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/70 mb-4">Execution Details</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Entry Price', value: trade.entryPrice, field: 'entryPrice' },
                  { label: 'Exit Price', value: trade.closePrice ?? '-', field: 'closePrice' },
                  { label: 'Quantity', value: `${trade.quantity} lots`, field: 'quantity' },
                  { label: getPnlDisplayLabel(pnlDisplayMode), value: formatCurrency(displayPnl), color: displayPnl >= 0 ? 'text-long' : displayPnl < 0 ? 'text-short' : 'text-muted-foreground', field: 'pnl' },
                ].map(({ label, value, color, field }) => (
                  <div key={label} className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">{label}</span>
                    <div className="flex items-center gap-1.5 group">
                      <p className={cn("text-lg font-mono font-bold leading-none", color)}>
                        {field === 'entryPrice' || (field === 'closePrice' && value !== '-') 
                          ? formatTradePrice(value, trade.instrument) 
                          : value}
                      </p>
                      {(field === 'entryPrice' || (field === 'closePrice' && value !== '-')) && (
                        <button
                          onClick={() => copyToClipboard(formatTradePrice(value, trade.instrument), label)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-accent rounded-md"
                          title={`Copy ${label}`}
                        >
                          {copiedField === label ? <Check className="h-3 w-3 text-long" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {}
              <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 pt-3 border-t border-border/20 text-xs text-muted-foreground">
                {tradeData.stopLoss && (
                  <span className="flex items-center gap-1">
                    Stop Loss: 
                    <span className="font-mono font-semibold text-foreground">
                      {formatTradePrice(tradeData.stopLoss, trade.instrument)}
                    </span>
                    <button
                      type="button"
                      aria-label={copiedField === 'Stop Loss' ? 'Stop Loss copied' : 'Copy Stop Loss'}
                      onClick={() => copyToClipboard(formatTradePrice(tradeData.stopLoss, trade.instrument), 'Stop Loss')}
                      className="p-1 hover:bg-accent rounded-md"
                    >
                      {copiedField === 'Stop Loss' ? <Check className="h-2.5 w-2.5 text-long" /> : <Copy className="h-2.5 w-2.5" />}
                    </button>
                  </span>
                )}
                {tradeData.takeProfit && (
                  <span className="flex items-center gap-1">
                    Take Profit: 
                    <span className="font-mono font-semibold text-foreground">
                      {formatTradePrice(tradeData.takeProfit, trade.instrument)}
                    </span>
                    <button
                      type="button"
                      aria-label={copiedField === 'Take Profit' ? 'Take Profit copied' : 'Copy Take Profit'}
                      onClick={() => copyToClipboard(formatTradePrice(tradeData.takeProfit, trade.instrument), 'Take Profit')}
                      className="p-1 hover:bg-accent rounded-md"
                    >
                      {copiedField === 'Take Profit' ? <Check className="h-2.5 w-2.5 text-long" /> : <Copy className="h-2.5 w-2.5" />}
                    </button>
                  </span>
                )}
                {tradeData.closeReason && (
                  <span>Close Reason: <span className="font-semibold text-foreground">{tradeData.closeReason}</span></span>
                )}
                {trade.commission != null && trade.commission !== 0 && (
                  <span>Commission: <span className="font-mono font-semibold text-foreground">{formatCurrency(trade.commission)}</span></span>
                )}
                {trade.commission != null && trade.commission !== 0 && (
                  <span>Gross P&L: <span className="font-mono font-semibold text-foreground">{formatCurrency(grossPnL)}</span></span>
                )}
                {trade.commission != null && trade.commission !== 0 && (
                  <span>Net P&L: <span className="font-mono font-semibold text-foreground">{formatCurrency(netPnL)}</span></span>
                )}
                {tradeData.swap != null && tradeData.swap !== 0 && (
                  <span>Swap: <span className="font-mono font-semibold text-foreground">{formatCurrency(tradeData.swap)}</span></span>
                )}
                {(trade.timeInPosition || 0) > 0 && (
                  <span>Duration: <span className="font-mono font-semibold text-foreground">{Math.floor((trade.timeInPosition || 0) / 60)}m {Math.floor((trade.timeInPosition || 0) % 60)}s</span></span>
                )}
              </div>
            </section>

            {}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-border/20">
              {}
              <section>
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/70 mb-4">Timing & Context</h3>
                <div className="space-y-0">
                  {[
                    { label: 'Entry Time', value: formatTimeInZone(trade.entryDate, 'MMM dd, HH:mm', timezone) },
                    { label: 'Exit Time', value: formatTimeInZone(trade.closeDate, 'MMM dd, HH:mm', timezone) },
                    { label: 'Duration', value: `${Math.floor((trade.timeInPosition || 0) / 60)}m ${Math.floor((trade.timeInPosition || 0) % 60)}s` },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center py-2.5 border-b border-border/20 last:border-0">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <span className="text-xs font-mono font-semibold">{value}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center py-2.5">
                    <span className="text-xs text-muted-foreground">Session</span>
                    <div className="flex gap-1.5">
                      {session && <Badge variant="secondary" className="text-[10px] px-2 py-0 h-5 bg-muted/50">{session}</Badge>}
                      {killzone && <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 border-warning/30 bg-warning/5 text-warning">{killzone}</Badge>}
                    </div>
                  </div>
                </div>
              </section>

              {}
              <section>
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/70 mb-4">Strategy & Tags</h3>
                <div className="space-y-0">
                  {tradingModelName && (
                    <div className="flex justify-between items-center py-2.5 border-b border-border/20">
                      <span className="text-xs text-muted-foreground">Model</span>
                      <span className="text-xs font-semibold">{tradingModelName}</span>
                    </div>
                  )}
                  {tradeData.marketBias && (
                    <div className="flex justify-between items-center py-2.5 border-b border-border/20">
                      <span className="text-xs text-muted-foreground">Market Bias</span>
                      <Badge variant="outline" className={cn(
                        "text-[10px] px-2 py-0 h-5 capitalize",
                        tradeData.marketBias === 'BULLISH' && "text-long border-long/30 bg-long/5",
                        tradeData.marketBias === 'BEARISH' && "text-short border-short/30 bg-short/5",
                      )}>
                        {tradeData.marketBias.toLowerCase()}
                      </Badge>
                    </div>
                  )}
                  {tradeData.orderType && (
                    <div className="flex justify-between items-center py-2.5 border-b border-border/20">
                      <span className="text-xs text-muted-foreground">Execution</span>
                      <span className="text-xs font-semibold capitalize">{tradeData.orderType} Order</span>
                    </div>
                  )}
                  {tradeData.biasTimeframe && (
                    <div className="flex justify-between items-center py-2.5 border-b border-border/20">
                      <span className="text-xs text-muted-foreground">Bias TF</span>
                      <span className="text-xs font-semibold">{tradeData.biasTimeframe}</span>
                    </div>
                  )}
                  {tradeData.narrativeTimeframe && (
                    <div className="flex justify-between items-center py-2.5 border-b border-border/20">
                      <span className="text-xs text-muted-foreground">Narrative TF</span>
                      <span className="text-xs font-semibold">{tradeData.narrativeTimeframe}</span>
                    </div>
                  )}
                  {tradeData.entryTimeframe && (
                    <div className="flex justify-between items-center py-2.5 border-b border-border/20">
                      <span className="text-xs text-muted-foreground">Entry TF</span>
                      <span className="text-xs font-semibold">{tradeData.entryTimeframe}</span>
                    </div>
                  )}
                  {tradeData.structureTimeframe && (
                    <div className="flex justify-between items-center py-2.5 border-b border-border/20">
                      <span className="text-xs text-muted-foreground">Structure TF</span>
                      <span className="text-xs font-semibold">{tradeData.structureTimeframe}</span>
                    </div>
                  )}
                  {tradeData.outcome && (
                    <div className="flex justify-between items-center py-2.5 border-b border-border/20">
                      <span className="text-xs text-muted-foreground">Outcome</span>
                      <Badge variant="outline" className={cn(
                        "text-[10px] px-2 py-0 h-5 uppercase font-bold",
                        tradeData.outcome?.includes('GOOD') && "text-long border-long/30 bg-long/5",
                        tradeData.outcome?.includes('BAD') && "text-short border-short/30 bg-short/5",
                      )}>
                        {tradeData.outcome?.replace('_', ' ')}
                      </Badge>
                    </div>
                  )}
                  {tradeData.ruleBroken && (
                    <div className="flex justify-between items-center py-2.5 border-b border-border/20">
                      <span className="text-xs text-muted-foreground">Rule Broken</span>
                      <Badge variant="destructive" className="text-[10px] px-2 py-0 h-5">Yes</Badge>
                    </div>
                  )}
                  {tradeTags.length > 0 && (
                    <div className="py-3">
                      <span className="text-xs text-muted-foreground block mb-2">Tags</span>
                      <div className="flex flex-wrap gap-1.5">
                        {tradeTags.map((tag: any) => (
                          <div key={tag.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border" style={{ backgroundColor: tag.color + '15', borderColor: tag.color + '30', color: tag.color }}>
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                            {tag.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedRules.length > 0 && (
                    <div className="py-3 border-t border-border/20">
                      <span className="text-xs text-muted-foreground block mb-2">Rules Checklist</span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedRules.map((rule: string, index: number) => (
                          <Badge key={`${rule}-${index}`} variant="outline" className="text-[10px] font-medium bg-muted/20 border-border/50">
                            {rule}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>

            {}
            {(chartLinks.length > 0 || tradeData.newsDay) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-border/20">
                {chartLinks.length > 0 && (
                  <section>
                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/70 mb-3">Analysis Links</h3>
                    <div className="flex flex-wrap gap-2">
                      {chartLinks.map((link: string, index: number) => (
                        <a key={index} href={link} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 hover:border-border transition-all">
                          <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                          Chart {index + 1}
                        </a>
                      ))}
                    </div>
                  </section>
                )}

                {tradeData.newsDay && (
                  <section>
                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/70 mb-3">Economic Context</h3>
                    <div className="space-y-2">
                      {newsEvents.length > 0 ? (
                        <>
                          {newsEvents.map((event: any) => (
                            <div key={event.id} className="p-2.5 rounded-lg border border-border/40 bg-muted/10 space-y-0.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold">{event.name}</span>
                                <Badge variant="outline" className="text-[9px] px-1 py-0">{event.country}</Badge>
                              </div>
                              {event.description && <p className="text-[10px] text-muted-foreground line-clamp-1">{event.description}</p>}
                            </div>
                          ))}
                          {tradeData.newsTraded && (
                            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-warning/10 border border-warning/20 text-warning">
                              <Zap className="h-3.5 w-3.5 fill-warning text-warning" />
                              <span className="text-[10px] font-bold uppercase tracking-tight">Active News Trader</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="p-2.5 rounded-lg border border-dashed border-border/60 text-center">
                          <p className="text-[10px] text-muted-foreground italic">High impact news day, no events logged.</p>
                        </div>
                      )}
                    </div>
                  </section>
                )}
              </div>
            )}

            {}
            {trade.comment && (
              <section className="pt-2 border-t border-border/20">
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/70 mb-3">Trade Journal</h3>
                <div className="p-4 rounded-xl bg-muted/10 border border-border/40">
                  <div className="text-sm text-foreground/80 whitespace-pre-wrap break-words leading-relaxed">
                    {formatNoteContent(trade.comment)}
                  </div>
                </div>
              </section>
            )}

            {}
            {images.length > 0 && (
              <section className="pt-2 border-t border-border/20 pb-4">
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/70 mb-3">
                  Visual Evidence <span className="text-muted-foreground/40 ml-1">({images.length})</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {images.map((img: string, index: number) => (
                    <button
                      type="button"
                      key={index}
                      className="group relative aspect-video rounded-xl overflow-hidden border border-border/40 bg-muted/30 cursor-pointer hover:border-border/60 transition-all active:scale-[0.98]"
                      onClick={() => setSelectedImageIndex(index)}
                      aria-label={`Open screenshot ${index + 1}`}
                    >
                      <Image
                        src={img}
                        alt={`Screenshot ${index + 1}`}
                        fill
                        className="object-cover group-hover:scale-[1.02] transition-transform duration-300"
                        unoptimized
                        loading="lazy"
                      />
                      <div className="absolute inset-x-0 bottom-0 p-2.5 bg-background/90 translate-y-full group-hover:translate-y-0 transition-transform">
                        <span className="text-[9px] text-foreground font-bold uppercase tracking-widest">
                          {index === 0 ? 'Featured Preview' : `View #${index}`}
                        </span>
                      </div>
                      <Badge className="absolute top-2 right-2 bg-black/70 border-white/10 text-white text-[9px] pointer-events-none">
                        HD
                      </Badge>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>

        {}
        <div className="px-4 sm:px-6 py-3 border-t border-border/40 bg-muted/5 shrink-0 flex flex-col-reverse sm:flex-row items-center justify-between gap-2">
          <Link href={`/dashboard/table?view=replay&tradeId=${trade.id}&backUrl=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname + window.location.search : basePath)}`} className="w-full sm:w-auto">
            <Button variant="primary" className="gap-2 h-9 px-5 rounded-xl shadow-lg shadow-primary/10 font-semibold w-full sm:w-auto text-xs">
              <Play className="h-3.5 w-3.5" />
              Trade Replay
            </Button>
          </Link>
          <Button variant="tertiary" onClick={onClose} className="h-9 px-5 rounded-xl text-muted-foreground hover:text-foreground w-full sm:w-auto text-xs">
            Close
          </Button>
        </div>
      </div>

      {}
      {selectedImage && (
        <Dialog open={!!selectedImage} onOpenChange={(open) => { if (!open) setSelectedImageIndex(null) }} modal>
          <DialogContent
            className="max-w-[95vw] sm:max-w-[90vw] max-h-[95vh] p-0 gap-0 z-[100]"
            onInteractOutside={(e) => { e.preventDefault(); setSelectedImageIndex(null) }}
            onEscapeKeyDown={(e) => { e.preventDefault(); setSelectedImageIndex(null) }}
            onPointerDownOutside={(e) => { e.preventDefault(); setSelectedImageIndex(null) }}
          >
            <DialogHeader className="px-4 pt-4 pb-2">
              <DialogTitle>Screenshot {selectedImageNumber}</DialogTitle>
              <VisuallyHidden><DialogDescription>Full size image viewer</DialogDescription></VisuallyHidden>
            </DialogHeader>
            <div className="relative flex-1 bg-black">
              <TransformWrapper key={selectedImage} minScale={0.35} maxScale={5} limitToBounds={false} centerZoomedOut={false}>
                <TransformComponent wrapperClass="!w-full !h-[calc(95vh-8rem)]" contentClass="!w-full !h-full flex items-center justify-center">
                  <Image
                    src={selectedImage}
                    alt={`Screenshot ${selectedImageNumber}`}
                    width={1920}
                    height={1080}
                    className="max-w-full max-h-full object-contain"
                    unoptimized
                    loading="eager"
                  />
                </TransformComponent>
              </TransformWrapper>
              {showImageNavigation && (
                <>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute left-4 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full bg-background/80"
                    onClick={goToPreviousImage}
                    aria-label="Previous screenshot"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute right-4 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full bg-background/80"
                    onClick={goToNextImage}
                    aria-label="Next screenshot"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                  <div className="absolute bottom-4 left-4 rounded-full bg-background/80 px-3 py-1 text-xs font-bold text-foreground">
                    {selectedImageNumber} / {images.length}
                  </div>
                </>
              )}
              <Button
                variant="secondary"
                size="sm"
                className="absolute bottom-4 right-4"
                onClick={() => downloadImage(stripTradePreviewImageConfig(selectedImage) || selectedImage, trade, selectedImageNumber)}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </TradeWorkspace>
  )
}
