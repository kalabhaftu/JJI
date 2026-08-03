"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isToday, 
  startOfWeek, 
  endOfWeek, 
  addMonths, 
  subMonths,
  isSameDay,
  isAfter,
  isBefore
} from "date-fns"

export interface DateRange {
  from: Date | undefined
  to: Date | undefined
}

interface CustomDateRangePickerProps {
  selected?: DateRange
  onSelect?: (range: DateRange | undefined) => void
  className?: string
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export function CustomDateRangePicker({ 
  selected, 
  onSelect, 
  className 
}: CustomDateRangePickerProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date())

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart)
  const calendarEnd = endOfWeek(monthEnd)
  
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const handlePrevMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1))
  }

  const handleDayClick = (day: Date) => {
    if (!selected?.from || (selected.from && selected.to)) {

      onSelect?.({ from: day, to: undefined })
    } else if (selected.from && !selected.to) {

      if (isSameDay(day, selected.from)) {

        onSelect?.({ from: day, to: day })
      } else if (isBefore(day, selected.from)) {

        onSelect?.({ from: day, to: selected.from })
      } else {

        onSelect?.({ from: selected.from, to: day })
      }
    }
  }

  const isDayInRange = (day: Date) => {
    if (!selected?.from) return false
    if (!selected.to) return isSameDay(day, selected.from)
    
    return (
      (isAfter(day, selected.from) || isSameDay(day, selected.from)) &&
      (isBefore(day, selected.to) || isSameDay(day, selected.to))
    )
  }

  const isDayRangeStart = (day: Date) => {
    return selected?.from && isSameDay(day, selected.from)
  }

  const isDayRangeEnd = (day: Date) => {
    return selected?.to && isSameDay(day, selected.to)
  }

  const isDayRangeMiddle = (day: Date) => {
    if (!selected?.from || !selected?.to) return false
    return isDayInRange(day) && !isDayRangeStart(day) && !isDayRangeEnd(day)
  }

  return (
    <div className={cn("p-3 bg-background border rounded-md", className)}>
      {}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrevMonth}
          className="h-7 w-7 p-0"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <h2 className="text-sm font-medium">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleNextMonth}
          className="h-7 w-7 p-0"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {}
      <div className="grid grid-cols-7 gap-1">
        {}
        {WEEKDAYS.map((weekday) => (
          <div
            key={weekday}
            className="h-9 flex items-center justify-center text-sm font-medium text-muted-foreground"
          >
            {weekday}
          </div>
        ))}
        
        {}
        {days.map((day) => {
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const isSelected = isDayInRange(day)
          const isRangeStart = isDayRangeStart(day)
          const isRangeEnd = isDayRangeEnd(day)
          const isRangeMiddle = isDayRangeMiddle(day)
          const isTodayDate = isToday(day)
          
          return (
            <Button
              key={day.toISOString()}
              variant="ghost"
              size="sm"
              onClick={() => handleDayClick(day)}
              className={cn(
                "h-9 w-9 p-0 font-normal",
                !isCurrentMonth && "text-muted-foreground opacity-50",
                isTodayDate && "bg-accent text-accent-foreground",
                isSelected && "bg-foreground text-background hover:bg-foreground hover:text-background",
                isRangeStart && "rounded-r-none",
                isRangeEnd && "rounded-l-none",
                isRangeMiddle && "rounded-none bg-muted/30 text-foreground hover:bg-muted/50",
                (isRangeStart || isRangeEnd) && "bg-foreground text-background"
              )}
            >
              {format(day, 'd')}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
