'use client'

import React, { useMemo } from 'react'
import { subDays, format, startOfWeek, addDays, isAfter, getMonth } from 'date-fns'
import { useWidgetData } from '@/hooks/use-widget-data'
import { CalendarData } from '@/app/dashboard/types/calendar'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/trading/trade-formatting'
import { WidgetCard } from '../widget-card'
import { classifyOutcome, getBreakEvenThreshold } from '@/lib/metrics/outcome'
import { useData } from '@/context/data-provider'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface CalendarHeatmapProps {
  size?: any
}

export default function CalendarHeatmapWidget({ size }: CalendarHeatmapProps) {
  const { data: calendarData, isLoading } = useWidgetData('calendarData')
  const { statistics } = useData()
  const breakEvenThreshold = getBreakEvenThreshold(statistics?.breakEvenThreshold)
  
  const heatmapData = useMemo(() => {
    if (!calendarData) return { grid: [], maxAbsPnl: 0, weeks: [] }
    
    // We want the last 365 days (52 weeks)
    // Exactly 52 weeks ago starting on Sunday
    const today = new Date()
    // 51 weeks ago + current week = 52 weeks
    const startDate = startOfWeek(subDays(today, 51 * 7), { weekStartsOn: 0 })
    
    const weeks: { date: Date, days: Date[] }[] = []
    let currentDay = startDate
    let maxAbs = 0
    
    for (let col = 0; col < 52; col++) {
      const weekDays: Date[] = []
      for (let row = 0; row < 7; row++) {
        weekDays.push(currentDay)
        
        const dateKey = format(currentDay, 'yyyy-MM-dd')
        const dayData = (calendarData as CalendarData)[dateKey]
        if (dayData && dayData.tradeNumber > 0) {
            maxAbs = Math.max(maxAbs, Math.abs(dayData.pnl))
        }
        
        currentDay = addDays(currentDay, 1)
      }
      if (weekDays[0]) {
        weeks.push({ date: weekDays[0], days: weekDays })
      }
    }
    
    return { weeks, maxAbsPnl: maxAbs }
  }, [calendarData])
  
  if (isLoading) {
    return (
      <WidgetCard title="PnL Heatmap" className="flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </WidgetCard>
    )
  }
  
  const { weeks, maxAbsPnl } = heatmapData
  
  // Calculate month label positions
  const monthLabels: { label: string, col: number }[] = []
  let lastMonth = -1
  weeks.forEach((week, i) => {
      const month = getMonth(week.date)
      if (month !== lastMonth) {
          if (i > 0) { // Don't label the very first week if it's a partial month, but for simplicity let's just label all month changes
              monthLabels.push({ label: format(week.date, 'MMM'), col: i })
          }
          lastMonth = month
      }
  })

  return (
    <WidgetCard title="PnL Calendar Heatmap" className="overflow-hidden">
      <div className="w-full h-full overflow-x-auto pb-2 scrollbar-thin">
        <div className="min-w-max h-full flex flex-col pt-2">
            
          {/* Months header */}
          <div className="flex relative mb-1 h-4 w-full ml-6">
              {monthLabels.map((m, i) => (
                  <div key={i} className="absolute text-[10px] font-bold text-muted-foreground" style={{ left: `${(m.col / 52) * 100}%` }}>
                      {m.label}
                  </div>
              ))}
          </div>

          <div className="flex flex-1 gap-1 relative">
            {/* Weekdays sidebar */}
            <div className="flex flex-col justify-between text-[9px] font-bold text-muted-foreground mr-2 py-0.5">
                <span className="invisible">Sun</span>
                <span>Mon</span>
                <span className="invisible">Tue</span>
                <span>Wed</span>
                <span className="invisible">Thu</span>
                <span>Fri</span>
                <span className="invisible">Sat</span>
            </div>

            <TooltipProvider>
                <div className="flex flex-1 gap-[3px]">
                {weeks.map((week, colIdx) => (
                    <div key={colIdx} className="flex flex-col gap-[3px] flex-1">
                        {week.days.map((day, rowIdx) => {
                            const dateKey = format(day, 'yyyy-MM-dd')
                            const dayData = (calendarData as CalendarData)[dateKey]
                            const hasTrades = dayData && dayData.tradeNumber > 0
                            const isFuture = isAfter(day, new Date())
                            
                            let bgClass = "bg-muted/20 border-border/20"
                            if (hasTrades) {
                                const outcome = classifyOutcome(dayData.pnl, breakEvenThreshold)
                                if (outcome === 'win') bgClass = "bg-long/30 border-long/40"
                                else if (outcome === 'loss') bgClass = "bg-short/30 border-short/40"
                                else bgClass = "bg-muted/60 border-muted-foreground/30"
                            }
                            
                            // Adjust intensity if needed, for simplicity we just use standard classes
                            
                            return (
                                <Tooltip key={dateKey}>
                                    <TooltipTrigger asChild>
                                        <div 
                                            className={cn(
                                                "w-3 h-3 rounded-[2px] border",
                                                bgClass,
                                                isFuture && "opacity-20 pointer-events-none"
                                            )} 
                                        />
                                    </TooltipTrigger>
                                    {!isFuture && (
                                        <TooltipContent side="top" className="text-xs py-1.5 px-2.5">
                                            <div className="font-bold mb-1">{format(day, 'MMM d, yyyy')}</div>
                                            {hasTrades ? (
                                                <>
                                                    <div className={cn("font-black", classifyOutcome(dayData.pnl, breakEvenThreshold) === 'win' ? "text-long" : classifyOutcome(dayData.pnl, breakEvenThreshold) === 'loss' ? "text-short" : "")}>
                                                        {formatCurrency(dayData.pnl)}
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground mt-0.5">
                                                        {dayData.tradeNumber} trades
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-muted-foreground">No trades</div>
                                            )}
                                        </TooltipContent>
                                    )}
                                </Tooltip>
                            )
                        })}
                    </div>
                ))}
                </div>
            </TooltipProvider>
          </div>
          
          {/* Legend */}
          <div className="flex items-center justify-end gap-2 mt-4 text-[10px] font-medium text-muted-foreground">
             <span>Less</span>
             <div className="w-3 h-3 rounded-[2px] bg-muted/20 border border-border/20" />
             <div className="w-3 h-3 rounded-[2px] bg-short/30 border border-short/40" />
             <div className="w-3 h-3 rounded-[2px] bg-long/30 border border-long/40" />
             <span>More</span>
          </div>
          
        </div>
      </div>
    </WidgetCard>
  )
}
