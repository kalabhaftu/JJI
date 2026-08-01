'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useTheme } from 'next-themes'
import { Spinner } from '@/components/ui/spinner'
import { reportClientError } from '@/lib/observability/report-error'

interface TradeData {
  entryTime: Date
  exitTime: Date
  entryPrice: number
  exitPrice: number
  stopLoss?: number
  takeProfit?: number
  side: string
  pnl: number
  symbol: string
}

interface TradingViewAdvancedChartProps {
  tradeData?: TradeData
  height?: number
  className?: string
}

// TradingView Charting Library types
declare global {
  interface Window {
    TradingView: {
      widget: new (config: any) => any
    }
  }
}

export function TradingViewAdvancedChart({
  tradeData,
  height = 600,
  className = ''
}: TradingViewAdvancedChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetRef = useRef<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { resolvedTheme } = useTheme()

  // Initialize the TradingView Chart using iframe approach
  const initializeChart = useCallback(() => {
    if (!containerRef.current) {
      setError('Chart container not available')
      setIsLoading(false)
      return
    }

    try {
      const symbol = tradeData?.symbol || 'NASDAQ:AAPL'
      const isDark = resolvedTheme === 'dark'

      containerRef.current.innerHTML = ''

      // Create iframe-based TradingView widget
      const iframe = document.createElement('iframe')
      iframe.width = '100%'
      iframe.height = '100%'
      iframe.frameBorder = '0'
      iframe.scrolling = 'no'
      iframe.style.border = 'none'
      iframe.style.margin = '0'
      iframe.style.padding = '0'

      // Build TradingView embed URL with basic configuration
      const baseUrl = 'https://www.tradingview.com/widgetembed/'
      const params = new URLSearchParams({
        frameElementId: 'tradingview_advanced_chart',
        symbol: symbol,
        interval: '15',
        timezone: 'America/New_York',
        theme: isDark ? 'dark' : 'light',
        style: '1',
        locale: 'en',
        toolbar_bg: isDark ? '#2a2e39' : '#f1f3f6',
        enable_publishing: 'false',
        allow_symbol_change: 'false',
        hide_top_toolbar: 'false',
        hide_legend: 'false',
        save_image: 'true'
      })

      // Use TradingView's built-in theme handling
      // The theme parameter already handles all colors and styles

      if (tradeData) {
        const entryTime = tradeData.entryTime.getTime() / 1000
        const exitTime = tradeData.exitTime.getTime() / 1000
        const padding = Math.max((exitTime - entryTime) * 0.3, 3600)
        params.append('from', Math.floor(entryTime - padding).toString())
      }

      iframe.src = `${baseUrl}?${params.toString()}`
      iframe.title = `TradingView Chart for ${symbol}`

      iframe.onerror = () => {
        setError('Failed to load chart')
        setIsLoading(false)
      }

      iframe.onload = () => {
        setIsLoading(false)

      }

      containerRef.current.appendChild(iframe)
      widgetRef.current = iframe

      // The iframe approach is complete - no additional error handling needed
      // as the onload/onerror events handle the widget lifecycle

      } catch (error) {
      reportClientError(error, { operation: 'initialize-tradingview-chart', route: '/dashboard/journal' })
      setError('Failed to initialize chart')
      setIsLoading(false)
    }
  }, [tradeData, resolvedTheme])

  // Initialize the TradingView Chart using iframe
  useEffect(() => {
    // Capture current container ref for cleanup
    const container = containerRef.current
    
    const timer = setTimeout(() => {
      initializeChart()
    }, 100)

    return () => {
      clearTimeout(timer)
      if (widgetRef.current) {
        try {
          // If it's an iframe, just clear the container
          if (widgetRef.current.tagName === 'IFRAME' && container) {
            container.innerHTML = ''
          }
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }
  }, [initializeChart])

  if (error) {
    return (
      <div className={`w-full flex items-center justify-center bg-destructive/10 text-destructive ${className}`} style={{ height }}>
        <div className="text-center">
          <p className="font-semibold">Chart Error</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={className} style={{ height }}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
          <div className="text-center">
            <Spinner className="mx-auto mb-2 h-8 w-8 text-foreground" />
            <p className="text-muted-foreground">Loading advanced chart...</p>
          </div>
        </div>
      )}
      <div 
        ref={containerRef} 
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}

