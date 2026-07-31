'use client'

import React, { memo, useMemo } from "react"
import {
  format,
  isSameMonth,
  isToday,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  getISOWeek,
} from "date-fns"
import { cn } from "@/lib/utils"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useDashboardDisplay } from "@/hooks/use-dashboard-display"

import { CalendarData } from "@/app/dashboard/types/calendar"
import { useCalendarViewStore } from "@/store/calendar-view-store"
import { useUserStore } from "@/store/user-store"
import { calculateDailyStats } from "./calendar-utils"
import { useData } from '@/context/data-provider'
import { classifyOutcome, getBreakEvenThreshold } from '@/lib/metrics/outcome'
import { getTradeNetPnl } from '@/lib/metrics/pnl'
import { Calendar as CalendarIcon } from "lucide-react"
import { useJournalData } from "@/app/dashboard/hooks/use-journal-data"

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

const formatCompact = (value: number) => {
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(2)}K`
  return `$${value.toFixed(0)}`
}

const DayCell = memo(function DayCell({
  date,
  dayData,
  isCurrentMonth,
  hideWeekends,
  isMiniCalendar,
  hasJournal,
  onClick,
}: {
  date: Date
  dayData: CalendarData[string] | undefined
  isCurrentMonth: boolean
  hideWeekends?: boolean
  isMiniCalendar?: boolean
  hasJournal?: boolean
  onClick?: () => void
}) {
  const { visibleStats } = useCalendarViewStore()
  const { formatValue } = useDashboardDisplay()
  const isTodayDate = isToday(date)
  const { statistics } = useData()
  const breakEvenThreshold = getBreakEvenThreshold(statistics?.breakEvenThreshold)

  const hasTrades = !!dayData && dayData.tradeNumber > 0
  const dayOutcome = dayData ? classifyOutcome(Number(dayData.pnl || 0), breakEvenThreshold) : 'breakeven'
  const isProfit = dayData?.isProfit ?? (dayOutcome === 'win')
  const isLoss = dayData?.isLoss ?? (dayOutcome === 'loss')
  const isBreakEven = dayData?.isBreakEven ?? (!isProfit && !isLoss && hasTrades)

  const winRateValue = useMemo(() => {
    if (!dayData?.trades || dayData.trades.length === 0) return 0
    const winners = dayData.trades.filter(t => classifyOutcome(getTradeNetPnl(t), breakEvenThreshold) === 'win').length
    return (winners / dayData.trades.length) * 100
  }, [dayData, breakEvenThreshold])

  return (
    <button
      type="button"
      onClick={!isMiniCalendar && onClick ? onClick : undefined}
      disabled={isMiniCalendar || !onClick}
      aria-label={`Open ${format(date, 'MMMM d, yyyy')}${hasTrades ? `, ${dayData.tradeNumber} trades` : ''}`}
      className={cn(
        "relative flex flex-col items-center justify-center rounded-[4px] md:rounded-[6px] border transition-all duration-150 select-none group h-full",
        // Mini calendar: taller cells so they are properly rectangular not square
        // Advanced calendar: cells fill grid space with minimum height
        isMiniCalendar 
          ? "min-h-[68px] sm:min-h-[76px] lg:min-h-[84px]" 
          : "min-h-[48px] md:min-h-[60px] lg:min-h-[68px] cursor-pointer",
        isMiniCalendar && "disabled:cursor-default",

        // No trades - uses theme tokens so it works in any color scheme
        !hasTrades && isCurrentMonth && "bg-muted/30 dark:bg-[#0c0e12]/40 border-border/40 dark:border-border/20 hover:border-border/60 dark:hover:border-border/40",

        hasTrades && isProfit && "bg-long/10 border-long/20 hover:bg-long/20 hover:border-long/30 dark:bg-long/20 dark:border-long/35 dark:hover:bg-long/30 dark:hover:border-long/50",

        hasTrades && isLoss && "bg-short/10 border-short/20 hover:bg-short/20 hover:border-short/30 dark:bg-short/20 dark:border-short/35 dark:hover:bg-short/30 dark:hover:border-short/50",

        hasTrades && isBreakEven && "bg-muted/40 border border-muted/50 text-foreground hover:bg-muted/50",

        !isCurrentMonth && "opacity-20 pointer-events-none",
        
        isTodayDate && isCurrentMonth && "ring-1 ring-primary ring-offset-0",
      )}
    >
      {/* Journal Note Indicator */}
      {!isMiniCalendar && hasJournal && (
        <CalendarIcon className={cn(
          "absolute top-2 left-2 h-3.5 w-3.5",
          hasTrades
            ? isProfit 
              ? "text-long/70 dark:text-white/70" 
              : isLoss 
                ? "text-short/70 dark:text-white/70" 
                : "text-muted-foreground/85"
            : "text-muted-foreground/60"
        )} />
      )}


      <div className={cn(
        "flex flex-col items-center justify-center w-full h-full relative p-1",
        !isMiniCalendar && "min-[1024px]:hidden"
      )}>
        {/* Centered Date Number for Simple View */}
        <span
          className={cn(
            "text-xs md:text-sm font-bold leading-none",
            isTodayDate && isCurrentMonth
              ? "text-primary-foreground bg-primary rounded-full w-5 h-5 md:w-6 md:h-6 flex items-center justify-center text-[10px] md:text-xs"
              : hasTrades
                ? isProfit 
                  ? "text-long/80 dark:text-white/60" 
                  : isLoss 
                    ? "text-short/80 dark:text-white/60" 
                    : "text-white/60"
                : "text-foreground/80",
          )}
        >
          {format(date, 'd')}
        </span>
        
        {/* Mini P&L indicator for cells with trades */}
        {hasTrades && (
          <span
            className={cn(
              "text-[9px] md:text-[10px] font-bold mt-0.5 leading-none",
              isProfit ? "text-long dark:text-long" : isLoss ? "text-short dark:text-short" : "text-muted-foreground"
            )}
          >
            {dayData && dayData.pnl !== undefined && formatValue(dayData.pnl, { kind: 'money', compact: true, rValue: dayData.dailyRMultiple ?? null, emptyLabel: '$0' })}
          </span>
        )}
      </div>


      <div className={cn(
        "hidden flex-col w-full h-full relative p-2 justify-center items-center",
        !isMiniCalendar && "min-[1024px]:flex"
      )}>
        {/* Day number - top right  */}
        <span
          className={cn(
            "absolute top-1.5 right-1.5 font-bold leading-none",
            isTodayDate
              ? "text-primary-foreground bg-primary rounded-full w-5 h-5 flex items-center justify-center text-[10px]"
              : hasTrades
                ? "text-foreground/50 dark:text-white/50 text-[11px]"
                : "text-muted-foreground/75 dark:text-muted-foreground/50 text-[11px]",
          )}
        >
          {format(date, 'd')}
        </span>

        {/* Main Content Container (P&L, trades, stats) */}
        <div className="flex-grow flex flex-col items-center justify-center w-full pt-4 min-h-0">
          {/* P&L */}
          {hasTrades && visibleStats.pnl && (
            <div
              className={cn(
                "font-extrabold tracking-tight text-center text-xs md:text-sm lg:text-sm xl:text-base",
                isProfit ? "text-long" : isLoss ? "text-short" : "text-foreground"
              )}
            >
              {formatValue(dayData.pnl, { kind: 'money', compact: true, rValue: dayData.dailyRMultiple ?? null, emptyLabel: '$0' })}
            </div>
          )}

          {/* Trade Count */}
          {hasTrades && visibleStats.trades && (
            <span className={cn(
              "font-semibold leading-none text-[10px] md:text-[11px] mt-0.5",
              hasTrades
                ? isProfit 
                  ? "text-long/60 dark:text-white/60" 
                  : isLoss 
                    ? "text-short/60 dark:text-white/60" 
                    : "text-muted-foreground/85"
                : "text-muted-foreground/80"
            )}>
              {dayData.tradeNumber} trade{dayData.tradeNumber !== 1 ? 's' : ''}
            </span>
          )}

          {/* Secondary Stats Row (R & WinRate) */}
          {hasTrades && (visibleStats.rMultiple || visibleStats.winRate) && (
            <div className="flex flex-wrap items-center justify-center gap-1 mt-1 w-full">
              {visibleStats.rMultiple && dayData.dailyRMultiple !== undefined && (
                <span className={cn(
                  "text-[9px] md:text-[10px] font-medium whitespace-nowrap",
                  hasTrades
                    ? isProfit 
                      ? "text-long dark:text-long" 
                      : isLoss 
                        ? "text-short dark:text-short" 
                        : "text-foreground"
                    : "text-foreground"
                )}>
                  {dayData.dailyRMultiple.toFixed(2)}R{visibleStats.winRate ? ',' : ''}
                </span>
              )}
              {visibleStats.winRate && (
                <span className={cn(
                  "text-[9px] md:text-[10px] font-medium whitespace-nowrap",
                  hasTrades
                    ? isProfit 
                      ? "text-long dark:text-long" 
                      : isLoss 
                        ? "text-short dark:text-short" 
                        : "text-foreground"
                    : "text-foreground"
                )}>
                  {winRateValue.toFixed(1)}%
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  )
})

function WeeklySummary({
  weekIndex,
  weekDays,
  calendarData,
  currentDate,
  onReviewWeek,
}: {
  weekIndex: number
  weekDays: Date[]
  calendarData: CalendarData
  currentDate: Date
  onReviewWeek?: ((date: Date) => void) | undefined
}) {
  const { formatValue } = useDashboardDisplay()
  const stats = useMemo(() => {
    let pnl = 0
    let tradedDays = 0

    weekDays.forEach((day) => {
      if (!isSameMonth(day, currentDate)) return
      const key = format(day, 'yyyy-MM-dd')
      const data = calendarData[key]
      if (data && data.tradeNumber > 0) {
        pnl += data.pnl
        tradedDays++
      }
    })

    return { pnl, tradedDays }
  }, [weekDays, calendarData, currentDate])

  const isPositive = stats.pnl >= 0

  return (
    <button
      type="button"
      disabled={!onReviewWeek || !weekDays[0]}
      aria-label={`Review week ${weekIndex + 1}`}
      className={cn(
        "flex h-full min-h-[48px] md:min-h-[60px] flex-col items-start justify-center rounded-[4px] md:rounded-[6px] border p-2.5 cursor-pointer transition-all hover:bg-muted/30 dark:hover:bg-muted/10 group lg:min-h-[68px] disabled:cursor-default",
        "bg-muted/25 dark:bg-[#0c0e12]/35 border-border/40 dark:border-border/20 shadow-none hover:border-border/60 dark:hover:border-border/40"
      )}
      onClick={() => { if (weekDays[0]) onReviewWeek?.(weekDays[0]) }}
    >
      <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-0.5">
        Week {weekIndex + 1}
      </span>
      <span
        className={cn(
          "text-sm md:text-base font-extrabold tracking-tight",
          stats.tradedDays === 0
            ? "text-muted-foreground/45"
            : isPositive
              ? "text-long"
              : "text-short",
        )}
      >
        {stats.tradedDays === 0 ? "$0.00" : formatValue(stats.pnl, { kind: 'money', compact: false, emptyLabel: '$0.00' })}
      </span>
      <div className={cn(
        "text-[9px] font-black mt-2 px-2 py-0.5 rounded-full border shadow-sm",
        stats.tradedDays === 0
          ? "bg-muted/50 text-muted-foreground/60 border-border/30 dark:bg-muted/10 dark:text-muted-foreground/40"
          : "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/25"
      )}>
        {stats.tradedDays} {stats.tradedDays === 1 ? 'day' : 'days'}
      </div>
    </button>
  )
}

export default function MonthlyView({
  currentDate,
  calendarData,
  onSelectDate,
  onReviewWeek,
  hideWeekends = false,
  isMiniCalendar = false,
}: {
  currentDate: Date
  calendarData: CalendarData
  onSelectDate?: (date: Date) => void
  onReviewWeek?: (weekDate: Date) => void
  hideWeekends?: boolean
  isMiniCalendar?: boolean
}) {
  const timezone = useUserStore((state) => state.timezone)
  const isCompactAdvancedCalendar = useMediaQuery('(max-width: 1439px)')
  const shouldUseWeekdayOnlyLayout = hideWeekends || (!isMiniCalendar && isCompactAdvancedCalendar)
  const weeks = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 })
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 })
    const days = eachDayOfInterval({ start, end })

    const weeksArray = []
    for (let i = 0; i < days.length; i += 7) {
      let weekDays = days.slice(i, i + 7)
      
      // Filter out weekends when explicitly requested or when the advanced
      // calendar switches to its compact weekday-first layout.
      if (shouldUseWeekdayOnlyLayout) {
        weekDays = weekDays.filter(day => {
          const dayIndex = day.getDay()
          return dayIndex !== 0 && dayIndex !== 6
        })
      }
      
      if (weekDays.length > 0) {
        weeksArray.push(weekDays)
      }
    }
    return weeksArray
  }, [currentDate, shouldUseWeekdayOnlyLayout])

  const startBound = useMemo(() => startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 }), [currentDate])
  const endBound = useMemo(() => endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 }), [currentDate])
  const { journals } = useJournalData(startBound, endBound, null)

  const displayWeekdays = shouldUseWeekdayOnlyLayout 
    ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] 
    : WEEKDAYS
  const isMobile = useMediaQuery('(max-width: 767px)')
  const rowTemplate = isMiniCalendar
    ? `repeat(${weeks.length}, minmax(68px, 1fr))`
    : isMobile
      ? `repeat(${weeks.length}, minmax(48px, 1fr))`
      : `repeat(${weeks.length}, minmax(68px, 1fr))`

  return (
    <div className={cn("flex h-full w-full overflow-hidden flex-col", isMiniCalendar ? "" : "md:flex-row")}>
      {/* Main Calendar Grid Container */}
      <div className={cn("flex flex-col flex-1 h-full min-h-0", isMiniCalendar ? "min-w-[300px]" : "min-w-0")}>
        {/* Weekday Headers */}
        <div className={cn("grid gap-1 md:gap-1.5 px-2 md:px-3 py-1.5 md:py-2 shrink-0", shouldUseWeekdayOnlyLayout ? "grid-cols-5" : "grid-cols-7")}>
          {displayWeekdays.map((day) => (
            <div
              key={day}
              className="text-center text-[10px] md:text-[11px] font-semibold text-muted-foreground/80 capitalize"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Day Grid - flex-1 to fill remaining space, grid-rows set to number of weeks */}
        <div className={cn("flex-1 h-0 grid gap-1 md:gap-1.5 p-2 md:p-3 pt-0 min-h-0", shouldUseWeekdayOnlyLayout ? "grid-cols-5" : "grid-cols-7")} style={{ gridTemplateRows: rowTemplate }}>
          {weeks.map((week, weekIndex) => (
            <React.Fragment key={weekIndex}>
              {week.map((date) => {
                const dateKey = format(date, 'yyyy-MM-dd')
                const dayData = calendarData[dateKey]
                const isCurrentMonth = isSameMonth(date, currentDate)
                const journal = journals?.[dateKey] || null
                const hasJournal = !!journal && (Boolean(journal.note?.trim()) || Boolean(journal.emotion))
                return (
                  <DayCell
                    key={date.toISOString()}
                    date={date}
                    dayData={dayData}
                    isCurrentMonth={isCurrentMonth}
                    hideWeekends={shouldUseWeekdayOnlyLayout}
                    isMiniCalendar={isMiniCalendar}
                    hasJournal={hasJournal}
                    onClick={() => onSelectDate?.(date)}
                  />
                )
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {!isMiniCalendar && (
        <div className={cn(
          "shrink-0 flex flex-col border-border/40 dark:border-border/20",
          isMobile 
            ? "w-full border-t p-3 bg-muted/5 gap-2" 
            : "h-full min-h-0 w-[90px] border-l min-[420px]:w-[100px] sm:w-[110px] lg:w-[125px] xl:w-[140px] 2xl:w-[150px] pr-2 md:pr-3 pb-2 md:pb-3"
        )}>
          {/* Desktop Spacer matches weekday-header height exactly */}
          {!isMobile ? (
            <div className="grid px-2 md:px-3 py-1.5 md:py-2 shrink-0 grid-cols-1">
              <div className="text-center text-[10px] md:text-[11px] font-semibold text-muted-foreground/80 capitalize invisible select-none">
                Perf
              </div>
            </div>
          ) : (
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em] mb-1">
              Weekly Performance
            </div>
          )}

          {/* Week rows - grid to align perfectly with calendar rows */}
          <div 
            className={cn(
              "grid gap-1 md:gap-1.5 min-h-0",
              isMobile ? "grid-cols-3 sm:grid-cols-5 w-full" : "flex-1 h-0 pt-0 pl-2 md:pl-3"
            )} 
            style={isMobile ? undefined : { gridTemplateRows: rowTemplate }}
          >
            {weeks.map((week, index) => (
              <WeeklySummary
                key={index}
                weekIndex={index}
                weekDays={week}
                calendarData={calendarData}
                currentDate={currentDate}
                onReviewWeek={onReviewWeek}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
