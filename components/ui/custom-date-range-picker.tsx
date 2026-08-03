'use client'

import { DayPicker, type DateRange as DayPickerDateRange } from 'react-day-picker'

import { cn } from '@/lib/utils'

export interface DateRange {
  from: Date | undefined
  to: Date | undefined
}

interface CustomDateRangePickerProps {
  selected?: DateRange
  onSelect?: (range: DateRange | undefined) => void
  className?: string
  defaultMonth?: Date
}

export function CustomDateRangePicker({ selected, onSelect, className, defaultMonth }: CustomDateRangePickerProps) {
  const initialMonth = defaultMonth ?? selected?.from
  return (
    <DayPicker
      mode="range"
      {...(selected ? { selected: selected as DayPickerDateRange } : {})}
      onSelect={(range) => onSelect?.(range ? { from: range.from, to: range.to } : undefined)}
      {...(initialMonth ? { defaultMonth: initialMonth } : {})}
      showOutsideDays
      className={cn('rounded-lg border bg-background p-3', className)}
      classNames={{
        months: 'flex flex-col gap-4',
        month_caption: 'relative flex h-11 items-center justify-center font-medium',
        nav: 'absolute inset-x-3 top-3 flex items-center justify-between',
        button_previous: 'inline-flex size-11 items-center justify-center rounded-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        button_next: 'inline-flex size-11 items-center justify-center rounded-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        month_grid: 'w-full border-collapse',
        weekdays: 'grid grid-cols-7',
        weekday: 'flex size-11 items-center justify-center text-xs font-medium text-muted-foreground',
        week: 'grid grid-cols-7',
        day: 'size-11 p-0 text-center',
        day_button: 'size-11 rounded-lg text-sm hover:bg-muted focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        today: 'font-bold text-primary',
        selected: 'bg-primary text-primary-foreground hover:bg-primary/90',
        range_start: 'rounded-l-lg bg-primary text-primary-foreground',
        range_middle: 'rounded-none bg-primary/15 text-foreground',
        range_end: 'rounded-r-lg bg-primary text-primary-foreground',
        outside: 'text-muted-foreground opacity-45',
        disabled: 'text-muted-foreground opacity-35',
      }}
    />
  )
}
