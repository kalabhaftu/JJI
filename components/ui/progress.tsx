"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  indicatorClassName?: string;
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, max = 100, indicatorClassName, ...props }, ref) => {
  const effectiveMax = typeof max === "number" && Number.isFinite(max) && max > 0 ? max : 100

  return (
  <ProgressPrimitive.Root
    ref={ref}
    value={value}
    max={effectiveMax}
    className={cn(
      "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className={cn(
        "h-full w-full flex-1 transition-transform duration-500",
        indicatorClassName || "bg-foreground"
      )}
      style={{ 
        '--progress-val': `-${100 - Math.min(Math.max(((value ?? 0) / effectiveMax) * 100, 0), 100)}%`,
        transform: 'translateX(var(--progress-val))'
      } as React.CSSProperties}
    />
  </ProgressPrimitive.Root>
  )
})
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
