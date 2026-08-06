'use client'

import { useEffect, useState } from 'react'
import { format, subDays } from 'date-fns'
import { CalendarDays, ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { CustomDateRangePicker, type DateRange } from '@/components/ui/custom-date-range-picker'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export function getDatePresetRange(preset: '7d' | '30d' | '90d' | 'all', now: Date): DateRange | undefined {
  if (preset === 'all') return undefined
  const days = preset === '7d' ? 6 : preset === '30d' ? 29 : 89
  return { from: subDays(now, days), to: now }
}

export function DateRangeFilter({
  value,
  onChange,
  now = new Date(),
  className,
}: {
  value: DateRange | undefined
  onChange: (range: DateRange | undefined) => void
  now?: Date
  className?: string
}) {
  const [draft, setDraft] = useState<DateRange | undefined>(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  const commit = (range: DateRange | undefined) => {
    setDraft(range)
    onChange(range)
  }

  const label = value?.from
    ? value.to
      ? `${format(value.from, 'MMM d, yyyy')} - ${format(value.to, 'MMM d, yyyy')}`
      : `From ${format(value.from, 'MMM d, yyyy')}`
    : 'All time'

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" aria-label={`Date range: ${label}`} className={cn('min-h-11 justify-start gap-2', className)}>
          <CalendarDays className="size-4" aria-hidden />
          <span className="truncate">{label}</span>
          <ChevronDown className="ml-auto size-4 opacity-60" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-[calc(100vw-1rem)] p-3" align="start">
        <div className="mb-3 grid grid-cols-2 gap-2" aria-label="Date range presets">
          <Button type="button" variant="tertiary" onClick={() => commit(getDatePresetRange('7d', now))}>Last 7 days</Button>
          <Button type="button" variant="tertiary" onClick={() => commit(getDatePresetRange('30d', now))}>Last 30 days</Button>
          <Button type="button" variant="tertiary" onClick={() => commit(getDatePresetRange('90d', now))}>Last 90 days</Button>
          <Button type="button" variant="tertiary" onClick={() => commit(getDatePresetRange('all', now))}>All time</Button>
        </div>
        <CustomDateRangePicker
          {...(draft ? { selected: draft } : {})}
          onSelect={(range) => {
            setDraft(range)
            if (!range || (range.from && range.to)) onChange(range)
          }}
          className="border-0 p-0"
        />
      </PopoverContent>
    </Popover>
  )
}
