import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { HugeiconsIcon } from '@hugeicons/react'
import { Loading01Icon } from '@hugeicons/core-free-icons'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-[background-color,border-color,color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-press disabled:bg-primary-disabled disabled:text-muted-foreground disabled:opacity-100",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        tertiary: "hover:bg-muted/50 hover:text-foreground",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        link: "text-primary underline-offset-4 hover:underline",
        "icon-only": "hover:bg-muted/50 hover:text-foreground",
        toolbar: "hover:bg-muted/50 hover:text-foreground",
        "table-row": "hover:bg-muted/50 hover:text-foreground",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3 text-xs",
        lg: "h-11 px-6 text-base",
        icon: "h-10 w-10",
        navIcon: "h-8 w-8 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  loadingText?: string
  disabledReason?: string
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, loadingText = 'Loading…', children, disabled, disabledReason, ...props }, ref) => {
    const reasonId = React.useId()
    if (asChild) {
      return (
        <>
        <Slot
          className={cn(
            buttonVariants({ variant, size, className }),
            (disabled || loading) && "pointer-events-none opacity-50"
          )}
          ref={ref}
          aria-disabled={disabled || loading || undefined}
          aria-busy={loading || undefined}
          aria-describedby={disabled && disabledReason ? reasonId : undefined}
          {...props}
        >
          {children}
        </Slot>
        {disabled && disabledReason && <span id={reasonId} className="sr-only">{disabledReason}</span>}
        </>
      )
    }

    return (
      <>
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        aria-describedby={disabled && disabledReason ? reasonId : undefined}
        {...props}
      >
        {loading && <HugeiconsIcon icon={Loading01Icon} className="animate-spin" strokeWidth={1.5} color="currentColor" />}
        {loading ? <><span>{loadingText}</span><span className="sr-only">: {children}</span></> : children}
      </button>
      {disabled && disabledReason && <span id={reasonId} className="sr-only">{disabledReason}</span>}
      </>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
