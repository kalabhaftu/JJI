'use client'

import React, { useState, useMemo, useCallback, useRef } from "react"
import { format, addMonths, subMonths } from "date-fns"
import { ChevronLeft, ChevronRight, Camera, ImageIcon, Sparkles } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { reportClientError } from '@/lib/observability/report-error'
import { WidgetCard } from '../widget-card'
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { CalendarData } from "@/app/dashboard/types/calendar"
import { useData } from "@/context/data-provider"
import { useDashboardDisplay } from "@/hooks/use-dashboard-display"
import MonthlyView from "./monthly-view"
import {
  type CalendarGradientPresetId,
  clipCalendarCardSurface,
  drawCalendarGradientBackground,
  resolveCalendarGradientPreset,
} from "./screenshot-gradients"

const formatCompact = (value: number) => {
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}k`
  return `$${value.toFixed(0)}`
}

interface MiniCalendarProps {
  calendarData: CalendarData;
}

function MiniCalendar({ calendarData }: MiniCalendarProps) {
  const { isLoading } = useData()
  const { formatValue } = useDashboardDisplay()
  const [currentDate, setCurrentDate] = useState(new Date())
  const calendarRef = useRef<HTMLDivElement>(null)

  const handleScreenshot = useCallback(async (variant: 'basic' | 'random' | CalendarGradientPresetId) => {
    if (!calendarRef.current) return
    try {
      toast.info("Capturing screenshot...")

      const rect = calendarRef.current.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const scale = Math.max(dpr, 2)

      const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--background').trim()
      const resolvedBg = bgColor ? `hsl(${bgColor})` : '#0d0d0d'


      const logoImg = new Image()
      logoImg.crossOrigin = 'anonymous'
      await new Promise<void>((resolve, reject) => {
        logoImg.onload = () => resolve()
        logoImg.onerror = () => reject(new Error('Failed to load logo'))
        logoImg.src = '/android-chrome-512x512.png'
      })

      const html2canvas = (await import('html2canvas')).default

      const cardCanvas = await html2canvas(calendarRef.current, {
        backgroundColor: resolvedBg,
        scale,
        logging: false,
        useCORS: true,
        windowWidth: Math.round(rect.width),
        windowHeight: Math.round(rect.height),
        onclone: (_clonedDoc: Document, clonedElem: HTMLElement) => {
          clonedElem.style.width = `${rect.width}px`
          clonedElem.style.height = `${rect.height}px`
          clonedElem.style.overflow = 'hidden'
          clonedElem.querySelectorAll('.screenshot-btn').forEach((el: Element) => {
            (el as HTMLElement).style.display = 'none'
          })
        },
      })


      const logoBarHeight = 60
      const cardW = cardCanvas.width
      const cardH = cardCanvas.height

      const withGradient = variant !== 'basic'
      const selectedGradient = withGradient ? resolveCalendarGradientPreset(variant) : null
      const padding = withGradient ? Math.round(28 * scale) : 0
      const totalW = cardW + padding * 2

      const totalH = cardH + Math.round(logoBarHeight * scale) + (withGradient ? padding * 2 : 0)

      const out = document.createElement('canvas')
      out.width = totalW
      out.height = totalH
      const ctx = out.getContext('2d')!


      const combinedCardH = cardH + Math.round(logoBarHeight * scale)
      
      if (withGradient && selectedGradient) {
        drawCalendarGradientBackground(ctx, selectedGradient.id, totalW, totalH)

        ctx.save()
        ctx.shadowColor = 'rgba(0,0,0,0.55)'
        ctx.shadowBlur = 45 * scale
        ctx.shadowOffsetY = 12 * scale
        const r = 16 * scale
        clipCalendarCardSurface(ctx, padding, padding, cardW, combinedCardH, r, resolvedBg)

        ctx.drawImage(cardCanvas, padding, padding)
        ctx.restore()
      } else {

        ctx.fillStyle = resolvedBg
        ctx.fillRect(0, 0, totalW, totalH)
        ctx.drawImage(cardCanvas, 0, 0)
      }


      const barY = (withGradient ? padding : 0) + cardH
      const logoYPos = barY + Math.round((logoBarHeight / 2) * scale)
      

      const logoSize = Math.round(20 * scale)
      const logoX = totalW / 2 - Math.round(35 * scale)
      ctx.drawImage(logoImg, logoX, logoYPos - logoSize / 2, logoSize, logoSize)
      

      const fontSize = Math.round(14 * scale)
      ctx.font = `800 ${fontSize}px "DM Sans", -apple-system, BlinkMacSystemFont, sans-serif`
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText('JJI', logoX + logoSize + Math.round(10 * scale), logoYPos)

      out.toBlob((blob) => {
        if (!blob) { toast.error("Failed to capture screenshot"); return }
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `mini-calendar-${format(currentDate, 'yyyy-MM')}${selectedGradient ? `-${selectedGradient.id}` : ''}.png`
        link.style.display = 'none'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        toast.success("Screenshot saved!")
      }, 'image/png')
    } catch (error) {
      reportClientError(error, { operation: 'capture-mini-calendar-screenshot', route: '/dashboard' })
      toast.error("Failed to capture screenshot")
    }
  }, [currentDate])

  const handlePrev = useCallback(() => setCurrentDate(prev => subMonths(prev, 1)), [])
  const handleNext = useCallback(() => setCurrentDate(prev => addMonths(prev, 1)), [])

  const displayTotal = useMemo(() => {
    let total = 0
    const prefix = format(currentDate, 'yyyy-MM')
    Object.entries(calendarData).forEach(([key, data]) => {
      if (key.startsWith(prefix)) total += data.pnl
    })
    return total
  }, [calendarData, currentDate])

  const isPositive = displayTotal >= 0

  const tradedDaysCount = useMemo(() => {
    let count = 0
    const prefix = format(currentDate, 'yyyy-MM')
    Object.entries(calendarData).forEach(([key, data]) => {
      if (key.startsWith(prefix) && data.tradeNumber > 0) count++
    })
    return count
  }, [calendarData, currentDate])

  return (

    <div ref={calendarRef} className="relative h-full w-full max-[767px]:h-auto max-[767px]:min-h-full">
      <WidgetCard noPadding data-widget-card="true" className="flex h-full flex-col overflow-hidden max-[767px]:h-auto max-[767px]:min-h-full max-[767px]:overflow-visible">

        {}
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/20 bg-muted/5 flex-shrink-0 min-w-0">

          {}
          <div className="flex items-center gap-1 shrink-0">
            <div className="flex items-center gap-0.5 bg-muted/30 rounded-lg p-0.5 border border-border/30">
              <Button variant="icon-only" size="icon" onClick={handlePrev} className="h-11 w-11 hover:bg-background" aria-label="Previous month">
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-[11px] font-black tracking-tight px-2 min-w-[80px] text-center">
                {format(currentDate, 'MMM yyyy')}
              </span>
              <Button variant="icon-only" size="icon" onClick={handleNext} className="h-11 w-11 hover:bg-background" aria-label="Next month">
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Button
              onClick={() => setCurrentDate(new Date())}
              variant="secondary"
              size="sm"
              className="h-6 px-2 text-[9px] font-black hidden sm:inline-flex"
            >
              Today
            </Button>
          </div>

          {}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className={cn(
              "px-1.5 py-0.5 rounded border text-[10px] font-black",
              isPositive 
                ? "bg-long/10 text-long border-long/20 dark:bg-long/20 dark:text-long dark:border-long/30" 
                : "bg-short/10 text-short border-short/20 dark:bg-short/20 dark:text-short dark:border-short/30"
            )}>
              {formatValue(displayTotal, { kind: 'money', compact: true, emptyLabel: '$0' })}
            </div>
            <div className="px-1.5 py-0.5 rounded text-[10px] font-black bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/20">
              {tradedDaysCount}d
            </div>
            {}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className="h-6 w-6 p-0 screenshot-btn"
                  variant="tertiary"
                  size="icon"
                  aria-label="Take screenshot"
                >
                  <Camera className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                <DropdownMenuItem onClick={() => handleScreenshot('basic')} className="gap-2 text-xs font-medium">
                  <ImageIcon className="h-3.5 w-3.5" />
                  Basic
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleScreenshot('random')} className="gap-2 text-xs font-medium">
                  <Sparkles className="h-3.5 w-3.5" />
                  Random Gradient
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {}
        <div className="flex-1 min-h-0 overflow-hidden max-[767px]:overflow-visible">
          <MonthlyView
            hideWeekends
            currentDate={currentDate}
            calendarData={calendarData}
            isMiniCalendar={true}
          />
        </div>

      </WidgetCard>

    </div>
  )
}

export default React.memo(MiniCalendar, (prevProps, nextProps) => {
  return JSON.stringify(prevProps.calendarData) === JSON.stringify(nextProps.calendarData)
})
