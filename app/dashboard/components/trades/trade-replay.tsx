'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
    AlertCircle as WarningCircle
} from "lucide-react"
import { createChart, ColorType, IChartApi, Time, CandlestickSeries, createSeriesMarkers, type SeriesMarker } from 'lightweight-charts'
import { getMarketData } from '@/app/actions/get-market-data'
import { getTimezoneOffset } from 'date-fns-tz'
import { Skeleton } from '@/components/ui/skeleton'

interface TradeReplayProps {
    trade: {
        id: string
        entryDate: string
        closeDate?: string | null
        instrument: string
        side?: string | null
        entryPrice: string | number
        closePrice?: string | number | null
        pnl: number
        quantity: number
    }
    onClose?: () => void
}

export default function TradeReplay({ trade, onClose }: TradeReplayProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null)
    const chartRef = useRef<IChartApi | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const isLong = trade.side?.toLowerCase() === 'long' || trade.side?.toLowerCase() === 'buy'

    const initChart = useCallback(async (force: boolean = false) => {
        if (!chartContainerRef.current) return

        setIsLoading(true)
        setError(null)

        try {
            // Fetch Real Data
            const { data, error: fetchError } = await getMarketData(
                trade.instrument,
                '5m',
                trade.entryDate ? new Date(trade.entryDate) : undefined,
                trade.closeDate ? new Date(trade.closeDate) : undefined,
                trade.id,
                force
            )

            if (fetchError || !data || data.length === 0) {
                setError(fetchError || 'No market data available for this period')
                setIsLoading(false)
                return
            }

            // Timezone adjustment for New York
            const nyTimezone = 'America/New_York'
            const adjustedData = data.map((d: any) => {
                const date = new Date(d.time * 1000)
                const offset = getTimezoneOffset(nyTimezone, date)
                return {
                    ...d,
                    time: (d.time + (offset / 1000)) as Time
                }
            })

            // Create Chart
            if (chartRef.current) {
                chartRef.current.remove();
                chartRef.current = null;
            }

            const chart = createChart(chartContainerRef.current, {
                layout: {
                    background: { type: ColorType.Solid, color: 'white' },
                    textColor: 'black',
                },
                grid: {
                    vertLines: { visible: false },
                    horzLines: { visible: false },
                },
                width: chartContainerRef.current.clientWidth,
                height: chartContainerRef.current.clientHeight,
                handleScale: true,
                handleScroll: true,
                timeScale: {
                    timeVisible: true,
                    secondsVisible: false,
                    borderColor: 'hsl(var(--border)/0.5)',
                },
                rightPriceScale: {
                    borderColor: 'hsl(var(--border)/0.5)',
                    scaleMargins: {
                        top: 0.1,
                        bottom: 0.1,
                    },
                }
            })

            const candleSeries = chart.addSeries(CandlestickSeries, {
                upColor: '#83b885',
                downColor: '#000000',
                borderVisible: true,
                borderColor: '#000000',
                wickVisible: true,
                wickUpColor: '#83b885',
                wickDownColor: '#000000',
                borderUpColor: '#83b885',
                borderDownColor: '#000000',
            })

            candleSeries.setData(adjustedData as any)

            // Plot Markers - CRITICAL: Use adjustedData to find times
            const markers: SeriesMarker<Time>[] = []

            const findNearestAdjustedTime = (targetTimeStr: string) => {
                const targetDate = new Date(targetTimeStr)
                const targetUnix = targetDate.getTime() / 1000
                const offset = getTimezoneOffset(nyTimezone, targetDate)
                const targetAdjusted = targetUnix + (offset / 1000)

                return adjustedData.reduce((prev: any, curr: any) =>
                    Math.abs(Number(curr.time) - targetAdjusted) < Math.abs(Number(prev.time) - targetAdjusted) ? curr : prev
                ).time
            }

            if (trade.entryDate) {
                try {
                    const entryTime = findNearestAdjustedTime(trade.entryDate)
                    markers.push({
                        time: entryTime,
                        position: isLong ? 'belowBar' : 'aboveBar',
                        color: 'hsl(var(--chart-1))', // Entry
                        shape: isLong ? 'arrowUp' : 'arrowDown',
                        text: `Entry: ${Number(trade.entryPrice).toFixed(2)}`,
                        size: 2
                    })
                } catch (e) { /* marker placement failed silently */ }
            }

            if (trade.closeDate && trade.closePrice) {
                try {
                    const exitTime = findNearestAdjustedTime(trade.closeDate)
                    markers.push({
                        time: exitTime,
                        position: isLong ? 'aboveBar' : 'belowBar',
                        color: 'hsl(var(--chart-loss))', // Exit
                        shape: isLong ? 'arrowDown' : 'arrowUp',
                        text: `Exit: ${Number(trade.closePrice).toFixed(2)}`,
                        size: 2
                    })
                } catch (e) { /* marker placement failed silently */ }
            }

            createSeriesMarkers(candleSeries, markers)
            chart.timeScale().fitContent()

            chartRef.current = chart
            setIsLoading(false)

        } catch (err) {
            // Error is surfaced to user via setError state
            setError('Failed to load chart')
            setIsLoading(false)
        }
    }, [trade.id, trade.instrument, trade.entryDate, trade.closeDate, trade.entryPrice, trade.closePrice, isLong])

    useEffect(() => {
        // Prevent race conditions with strict mode/fast unmounts
        let isMounted = true;

        const runInit = async () => {
            if (!chartContainerRef.current) return;

            // Cleanup existing chart if any
            if (chartRef.current) {
                chartRef.current.remove();
                chartRef.current = null;
            }

            await initChart();
        };

        runInit();

        // Robust ResizeObserver that handles exact container dimensions
        const resizeObserver = new ResizeObserver((entries) => {
            if (!isMounted || !entries[0]?.contentRect || !chartRef.current) return
            const { width, height } = entries[0].contentRect
            // Only resize if dimensions are valid and changed
            if (width > 0 && height > 0) {
                chartRef.current.applyOptions({ width, height })
            }
        })

        if (chartContainerRef.current) {
            resizeObserver.observe(chartContainerRef.current)
        }

        return () => {
            isMounted = false;
            resizeObserver.disconnect()
            if (chartRef.current) {
                chartRef.current.remove()
                chartRef.current = null
            }
        }
    }, [trade.id, trade.instrument, trade.entryDate, trade.closeDate, isLong, initChart])

    return (
        <div className="w-full h-full relative">
            <div ref={chartContainerRef} className="absolute inset-0 w-full h-full" />

            {isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-background z-20 transition-opacity duration-500">
                    <div className="w-full h-full p-4 space-y-2">
                        <Skeleton className="h-3 w-20 mb-4" />
                        <Skeleton className="h-full w-full rounded" />
                    </div>
                </div>
            )}

            {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/95 z-20 p-6 text-center">
                    <WarningCircle className="h-10 w-10 text-destructive mb-4" />
                    <h3 className="text-sm font-semibold mb-2">Market Data Error</h3>
                    <p className="text-xs text-muted-foreground mb-4">{error}</p>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => initChart(true)}
                    >
                        Try Force Refresh
                    </Button>
                </div>
            )}
        </div>
    )
}
