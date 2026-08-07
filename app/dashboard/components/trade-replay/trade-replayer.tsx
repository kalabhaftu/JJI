'use client'

import React, { useEffect, useRef, useState } from 'react'
import { createChart, createSeriesMarkers, IChartApi, ISeriesApi, CandlestickSeries, type SeriesMarker, Time } from 'lightweight-charts'
import { ExtendedTrade } from '../tables/trade-table-review'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { Play, Pause, RotateCcw, FastForward } from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiStreamRequest } from '@/lib/api/stream-client'
import { reportClientError } from '@/lib/observability/report-error'

interface TradeReplayerProps {
  trade: ExtendedTrade
  className?: string
}

export function TradeReplayer({ trade, className }: TradeReplayerProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<"Candlestick", Time> | null>(null)
  const markersSeriesRef = useRef<ISeriesApi<"Line", Time> | null>(null)
  
  const [marketData, setMarketData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  

  const [isPlaying, setIsPlaying] = useState(false)
  const [replayIndex, setReplayIndex] = useState(0)
  const [speed, setSpeed] = useState(1000)

  const entryTime = new Date(trade.entryDate).getTime() / 1000
  const exitTime = new Date(trade.closeDate).getTime() / 1000

  useEffect(() => {
    async function fetchMarketData() {
      setIsLoading(true)
      setError(null)
      try {
        const symbol = trade.instrument || trade.symbol || 'ES'

        const padding = 3 * 60 * 60 * 1000 
        const period1 = new Date(trade.entryDate).getTime() - padding
        const period2 = new Date(trade.closeDate).getTime() + padding
        
        const response = await apiStreamRequest(`/api/v1/market-data?symbol=${encodeURIComponent(symbol)}&period1=${new Date(period1).toISOString()}&period2=${new Date(period2).toISOString()}&interval=1m`, {
          method: 'GET',
          operation: 'load-trade-replay-market-data',
        })

        const data = await response.json()
        setMarketData(data)
        setReplayIndex(0)
      } catch (err: any) {
        reportClientError(err, { operation: 'load-trade-replay-market-data', route: '/api/v1/market-data' })
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchMarketData()
  }, [trade.id, trade.instrument, trade.symbol, trade.entryDate, trade.closeDate])


  useEffect(() => {
    if (!chartContainerRef.current || marketData.length === 0) return

    const handleResize = () => {
      chartRef.current?.applyOptions({ width: chartContainerRef.current?.clientWidth ?? 0 })
    }

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: 'hsl(var(--muted-foreground))',
      },
      grid: {
        vertLines: { color: 'hsl(var(--border))' },
        horzLines: { color: 'hsl(var(--border))' },
      },
      crosshair: {
        mode: 0,
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    })
    
    chartRef.current = chart

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: 'hsl(var(--chart-bullish))',
      downColor: 'hsl(var(--chart-bearish))',
      borderVisible: false,
      wickUpColor: 'hsl(var(--chart-bullish))',
      wickDownColor: 'hsl(var(--chart-bearish))',
    })
    seriesRef.current = candlestickSeries
    

    const markers: SeriesMarker<Time>[] = []
    

    const entryCandle = marketData.find(d => d.time >= entryTime)
    if (entryCandle) {
        markers.push({
            time: entryCandle.time as Time,
            position: trade.side?.toUpperCase() === 'LONG' ? 'belowBar' as const : 'aboveBar' as const,
            color: trade.side?.toUpperCase() === 'LONG' ? 'hsl(var(--chart-bullish))' : 'hsl(var(--chart-bearish))',
            shape: trade.side?.toUpperCase() === 'LONG' ? 'arrowUp' as const : 'arrowDown' as const,
            text: `Entry @ ${trade.entryPrice}`
        })
    }
    
    const exitCandle = marketData.find(d => d.time >= exitTime)
    if (exitCandle) {
        markers.push({
            time: exitCandle.time as Time,
            position: trade.pnl >= 0 ? 'aboveBar' as const : 'belowBar' as const,
            color: trade.pnl >= 0 ? 'hsl(var(--chart-bullish))' : 'hsl(var(--chart-bearish))',
            shape: 'circle' as const,
            text: `Exit @ ${trade.closePrice}`
        })
    }
    

    const initialData = replayIndex > 0 ? marketData.slice(0, replayIndex) : marketData
    candlestickSeries.setData(initialData)
    createSeriesMarkers(candlestickSeries, markers)
    
    chart.timeScale().fitContent()

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketData, trade, entryTime, exitTime])
  

  useEffect(() => {
     let intervalId: NodeJS.Timeout
     
     if (isPlaying && marketData.length > 0) {
        intervalId = setInterval(() => {
           setReplayIndex(prev => {
              if (prev >= marketData.length) {
                 setIsPlaying(false)
                 return prev
              }
              const nextData = marketData.slice(0, prev + 1)
              seriesRef.current?.setData(nextData)
              return prev + 1
           })
        }, speed)
     }
     
     return () => clearInterval(intervalId)
  }, [isPlaying, marketData, speed])

  const togglePlay = () => {
      if (replayIndex >= marketData.length) {
          setReplayIndex(0)
          seriesRef.current?.setData([])
      }
      setIsPlaying(!isPlaying)
  }

  return (
    <div className={cn("relative flex flex-col h-full min-h-[400px]", className)}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10 backdrop-blur-sm">
          <div className="flex flex-col items-center">
            <Spinner className="h-8 w-8 mb-4 text-primary" />
            <p className="text-sm font-medium">Loading market data...</p>
          </div>
        </div>
      )}
      
      {error && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-destructive/10 z-10">
          <div className="text-center p-6 bg-background rounded-lg border border-destructive max-w-sm">
            <p className="text-destructive font-bold mb-2">Replay Unavailable</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between p-2 border-b bg-muted/20">
         <div className="flex items-center gap-2">
            <Button variant="secondary" size="icon" aria-label={isPlaying ? 'Pause replay' : 'Play replay'} onClick={togglePlay} disabled={isLoading || !!error}>
               {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
            </Button>
            <Button variant="tertiary" size="icon" aria-label="Restart replay" onClick={() => { setIsPlaying(false); setReplayIndex(0); seriesRef.current?.setData([]); }} disabled={isLoading || !!error}>
               <RotateCcw className="h-4 w-4" />
            </Button>
            <Button variant="tertiary" size="icon" aria-label="Change replay speed" onClick={() => setSpeed(prev => prev === 1000 ? 500 : prev === 500 ? 100 : 1000)} disabled={isLoading || !!error}>
               <FastForward className="h-4 w-4" />
               <span className="text-[10px] ml-1">{speed === 1000 ? '1x' : speed === 500 ? '2x' : '10x'}</span>
            </Button>
         </div>
         <div className="text-xs text-muted-foreground font-mono">
             {marketData.length > 0 ? `${replayIndex} / ${marketData.length} candles` : ''}
         </div>
      </div>

      <div ref={chartContainerRef} className="flex-1 w-full relative" />
    </div>
  )
}
