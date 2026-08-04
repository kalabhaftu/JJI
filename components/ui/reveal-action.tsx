import * as React from "react"

import { Button, type ButtonProps } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const RevealAction = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "icon-only", ...props }, ref) => (
    <Button
      ref={ref}
      variant={variant}
      className={cn(
        "opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 [@media(pointer:coarse)]:opacity-100",
        className,
      )}
      {...props}
    />
  ),
)
RevealAction.displayName = "RevealAction"
