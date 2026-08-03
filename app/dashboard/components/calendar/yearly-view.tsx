'use client'

import React, { useMemo } from "react"
import {
  format,
  eachMonthOfInterval,
  startOfYear,
  endOfYear,
  getMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  startOfMonth,
  endOfMonth,
  isToday,
} from "date-fns"
import { cn } from "@/lib/utils"
import { useDashboardDisplay } from "@/hooks/use-dashboard-display"
import { CalendarData } from "@/app/dashboard/types/calendar"
import { useData } from "@/context/data-provider"
import { classifyOutcome, getBreakEvenThreshold } from "@/lib/metrics/outcome"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

function MiniMonth({
  monthDate,
  calendarData,
  year,
  breakEvenThreshold,
}: {
  monthDate: Date
  calendarData: CalendarData
  year: number
  breakEvenThreshold: number
}) {
  const { formatValue } = useDashboardDisplay()
  const stats = useMemo(() => {
    let pnl = 0
    let trades = 0
    Object.entries(calendarData).forEach(([key, data]) => {
      const [kYear, kMonth] = key.split('-').map(Number)
      if (kYear === year && kMonth !== undefined && kMonth - 1 === getMonth(monthDate)) {
        pnl += data.pnl
        trades += data.tradeNumber
      }
    })
    return { pnl, trades }
  }, [calendarData, monthDate, year])


  const gridDays = useMemo(() => {
    const monthStart = startOfMonth(monthDate)
    const monthEnd = endOfMonth(monthDate)
    const start = startOfWeek(monthStart, { weekStartsOn: 0 })
    const end = endOfWeek(monthEnd, { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }, [monthDate])

  return (
    <div className="flex flex-col gap-1.5 p-2.5 md:p-3 rounded-xl border border-border/50 dark:border-border/30 bg-muted/10 dark:bg-card/30 hover:bg-muted/20 dark:hover:bg-card/50 transition-all group">
      {}
      <div className="flex items-center justify-between">
        <span className="text-sm font-black tracking-tight text-muted-foreground/70 group-hover:text-foreground transition-colors italic">
          {format(monthDate, 'MMMM')}
        </span>
        {stats.trades > 0 && (
          <span
            className={cn(
              "text-[10px] font-black px-2 py-0.5 rounded-full border shadow-sm",
              classifyOutcome(stats.pnl, breakEvenThreshold) === 'win'
                ? "bg-long/10 border-long/20 text-long dark:bg-long/20 dark:text-long dark:border-long/30"
                : classifyOutcome(stats.pnl, breakEvenThreshold) === 'loss'
                  ? "bg-short/10 border-short/20 text-short dark:bg-short/20 dark:text-short dark:border-short/30"
                  : "bg-muted/35 border-border/30 text-muted-foreground",
            )}
          >
            {formatValue(stats.pnl, { kind: 'money', compact: true, precision: 0, emptyLabel: '$0' })}
          </span>
        )}
      </div>

      {}
      <div className="grid grid-cols-7 gap-[1px]">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="text-[8px] font-bold text-center text-muted-foreground/30 uppercase"
          >
            {day}
          </div>
        ))}
      </div>

      {}
      <TooltipProvider>
        <div className="grid grid-cols-7 gap-[1px]">
          {gridDays.map((day) => {
            const isCurrentMonth = isSameMonth(day, monthDate)
            const isTodayDate = isToday(day)
            const key = format(day, 'yyyy-MM-dd')
            const data = calendarData[key]
            const hasTrades = data && data.tradeNumber > 0

            return (
              <Tooltip key={key}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "aspect-square w-full rounded-[3px] border flex items-center justify-center transition-all text-[8px] font-bold",
                      !isCurrentMonth && "opacity-0 pointer-events-none",


                      isCurrentMonth &&
                        !hasTrades &&
                        "bg-muted/30 dark:bg-[#0c0e12]/40 border-border/20 dark:border-transparent text-muted-foreground/40 dark:text-muted-foreground/20",


                      hasTrades &&
                        classifyOutcome(data.pnl, breakEvenThreshold) === 'win' &&
                        "bg-long/10 border-long/20 dark:bg-long/20 dark:border-long/35 text-long dark:text-slate-200",


                      hasTrades &&
                        classifyOutcome(data.pnl, breakEvenThreshold) === 'loss' &&
                        "bg-short/10 border-short/20 dark:bg-short/20 dark:border-short/35 text-short dark:text-slate-200",

                      hasTrades &&
                        classifyOutcome(data.pnl, breakEvenThreshold) === 'breakeven' &&
                        "bg-muted/40 border border-muted/50 text-foreground",

                      isTodayDate &&
                        isCurrentMonth &&
                        "ring-1 ring-primary/60 ring-offset-1 ring-offset-background text-primary",
                    )}
                  >
                    {isCurrentMonth && format(day, 'd')}
                  </div>
                </TooltipTrigger>
                {isCurrentMonth && (
                  <TooltipContent
                    side="top"
                    className="text-[10px] py-1.5 px-2.5 bg-popover/95 backdrop-blur-sm border-border/40 shadow-xl"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-bold text-muted-foreground">
                          {format(day, 'MMM d, yyyy')}
                        </span>
                        {hasTrades && (
                          <span className="bg-muted/50 px-1 rounded text-[9px] font-bold">
                            {data.tradeNumber} trades
                          </span>
                        )}
                      </div>
                      <div
                        className={cn(
                          "font-black text-xs tracking-tight",
                          !hasTrades
                            ? "text-muted-foreground/50"
                            : classifyOutcome(data.pnl, breakEvenThreshold) === 'win'
                              ? "text-long"
                              : classifyOutcome(data.pnl, breakEvenThreshold) === 'loss'
                                ? "text-short"
                                : "text-muted-foreground",
                        )}
                      >
                        {data ? formatValue(data.pnl, { kind: 'money', rValue: data.dailyRMultiple ?? null, emptyLabel: '$0.00' }) : '$0.00'}
                      </div>
                    </div>
                  </TooltipContent>
                )}
              </Tooltip>
            )
          })}
        </div>
      </TooltipProvider>
    </div>
  )
}

export default function YearlyView({
  year,
  calendarData,
}: {
  year: number
  calendarData: CalendarData
}) {
  const { statistics } = useData()
  const breakEvenThreshold = getBreakEvenThreshold(statistics?.breakEvenThreshold)
  const months = useMemo(
    () =>
      eachMonthOfInterval({
        start: startOfYear(new Date(year, 0, 1)),
        end: endOfYear(new Date(year, 0, 1)),
      }),
    [year],
  )

  return (
    <div className="h-full overflow-y-auto p-2.5 md:p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-3 max-w-[1600px] mx-auto">
        {months.map((month) => (
          <MiniMonth
            key={month.toISOString()}
            monthDate={month}
            calendarData={calendarData}
            year={year}
            breakEvenThreshold={breakEvenThreshold}
          />
        ))}
      </div>
    </div>
  )
}
