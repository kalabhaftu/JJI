'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { DashboardDisplayMode } from '@/lib/dashboard/display-mode'
import { useDashboardDisplay } from '@/hooks/use-dashboard-display'
import { HugeiconsIcon } from '@hugeicons/react'
import type { HugeiconsIconProps } from '@hugeicons/react'
import {
  DollarCircleIcon,
  EyeOffIcon,
  PercentIcon,
  ScanEyeIcon,
  Target01Icon,
} from '@hugeicons/core-free-icons'

const ICONS: Record<DashboardDisplayMode, HugeiconsIconProps['icon']> = {
  dollars: DollarCircleIcon,
  percentage: PercentIcon,
  privacy: EyeOffIcon,
  rMultiple: Target01Icon,
}

export function DashboardDisplayModeSelector({
  mobile = false,
}: {
  mobile?: boolean
}) {
  const { mode, setMode, allModes } = useDashboardDisplay()

  const ActiveIcon = ICONS[mode]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="tertiary"
          size="navIcon"
          className={cn(
            'text-muted-foreground',
            mobile && 'h-9 w-9'
          )}
          title={allModes[mode].label}
          aria-label={allModes[mode].label}
        >
          <HugeiconsIcon icon={ActiveIcon} className="size-4" strokeWidth={2} color="currentColor" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-56">
        {(Object.keys(allModes) as DashboardDisplayMode[]).map((value) => {
          const Icon = ICONS[value]
          const isActive = value === mode

          return (
            <DropdownMenuItem
              key={value}
              className="flex items-start gap-3 py-2"
              onClick={() => setMode(value)}
            >
              <div
                className={cn(
                  'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
                  isActive ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border/50 bg-muted/30 text-muted-foreground'
                )}
              >
                <HugeiconsIcon icon={Icon} className="h-4 w-4" strokeWidth={2} color="currentColor" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{allModes[value].label}</span>
                  {isActive && <HugeiconsIcon icon={ScanEyeIcon} className="h-3.5 w-3.5 text-primary" strokeWidth={2} color="currentColor" />}
                </div>
                <p className="text-xs text-muted-foreground">{allModes[value].description}</p>
              </div>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
