'use client'

import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon } from '@hugeicons/core-free-icons'

import { cn } from '@/lib/utils'

export function RemovableFilterChip({
  label,
  value,
  onRemove,
  className,
}: {
  label: string
  value: React.ReactNode
  onRemove: () => void
  className?: string
}) {
  const accessibleValue = typeof value === 'string' || typeof value === 'number' ? String(value) : label

  return (
    <span className={cn('inline-flex min-h-8 items-center gap-1 rounded-full bg-muted px-2.5 text-xs font-medium text-foreground', className)}>
      <span className="sr-only">{label}: </span>
      <span>{value}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}: ${accessibleValue} filter`}
        className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11"
      >
        <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" aria-hidden strokeWidth={2} color="currentColor" />
      </button>
    </span>
  )
}
