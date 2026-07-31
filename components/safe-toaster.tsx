'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { motion } from 'framer-motion'
import {
  Toaster as SonnerToaster,
  toast as sonnerToast,
} from 'sonner'
import {
  CheckCircle,
  AlertCircle,
  Info,
  AlertTriangle,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Variant = 'default' | 'success' | 'error' | 'warning'

interface CustomToastProps {
  title?: string | undefined
  message: string
  variant?: Variant | undefined
  toastId: string | number
  actions?: {
    label: string
    onClick: () => void
    variant?: 'default' | 'outline' | 'ghost'
  } | undefined
  onDismiss?: (() => void) | undefined
}

const variantStyles: Record<Variant, string> = {
  default: 'bg-background border-border text-foreground',
  success: 'bg-background border-green-600/50',
  error: 'bg-background border-destructive/50',
  warning: 'bg-background border-amber-600/50',
}

const titleColor: Record<Variant, string> = {
  default: 'text-foreground',
  success: 'text-green-600 dark:text-green-400',
  error: 'text-destructive',
  warning: 'text-amber-600 dark:text-amber-400',
}

const iconColor: Record<Variant, string> = {
  default: 'text-muted-foreground',
  success: 'text-green-600 dark:text-green-400',
  error: 'text-destructive',
  warning: 'text-amber-600 dark:text-amber-400',
}

const variantIcons: Record<Variant, React.ComponentType<{ className?: string }>> = {
  default: Info,
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
}

const toastAnimation = {
  initial: { opacity: 0, y: 50, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 50, scale: 0.95 },
}

function CustomToast({
  title,
  message,
  variant = 'default',
  toastId,
  actions,
  onDismiss,
}: CustomToastProps) {
  const Icon = variantIcons[variant]

  return (
    <motion.div
      variants={toastAnimation}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn(
        'flex items-center justify-between w-full max-w-xs p-3 rounded-xl border shadow-md',
        variantStyles[variant]
      )}
    >
      <div className="flex items-start gap-2">
        <Icon className={cn('h-4 w-4 mt-0.5 flex-shrink-0', iconColor[variant])} />
        <div className="space-y-0.5">
          {title && (
            <h3 className={cn('text-xs font-medium leading-none', titleColor[variant])}>
              {title}
            </h3>
          )}
          <p className="text-xs text-muted-foreground">{message}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {actions?.label && (
          <Button
            variant={actions.variant || 'outline'}
            size="sm"
            onClick={() => {
              actions.onClick()
              sonnerToast.dismiss(toastId)
            }}
            className={cn(
              'cursor-pointer h-7 text-xs',
              variant === 'success'
                ? 'text-green-600 border-green-600 hover:bg-green-600/10 dark:hover:bg-green-400/20'
                : variant === 'error'
                ? 'text-destructive border-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20'
                : variant === 'warning'
                ? 'text-amber-600 border-amber-600 hover:bg-amber-600/10 dark:hover:bg-amber-400/20'
                : 'text-foreground border-border hover:bg-muted/10 dark:hover:bg-muted/20'
            )}
          >
            {actions.label}
          </Button>
        )}

        <button
          onClick={() => {
            sonnerToast.dismiss(toastId)
            onDismiss?.()
          }}
          className="rounded-full p-1 hover:bg-muted/50 dark:hover:bg-muted/30 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Dismiss notification"
        >
          <X className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>
    </motion.div>
  )
}

export function SafeToaster() {
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()
  const { theme = "system" } = useTheme()

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true)
    }, 100)

    return () => clearTimeout(timer)
  }, [pathname])

  if (!mounted) return null

  return (
    <SonnerToaster
      position="bottom-right"
      theme={theme as 'light' | 'dark' | 'system'}
      toastOptions={{
        className: 'bg-background text-foreground border border-border rounded-xl opacity-100 shadow-md p-3 text-xs',
        descriptionClassName: 'text-muted-foreground text-xs',
      }}
    />
  )
}

/**
 * Custom toast utility - call instead of sonner's `toast()` for the branded UI.
 * For backward compatibility, you can still use `toast()` from sonner directly.
 */
export function showToast({
  title,
  message,
  variant = 'default',
  duration = 4000,
  position = 'bottom-right',
  actions,
  onDismiss,
}: {
  title?: string
  message: string
  variant?: Variant
  duration?: number
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
  actions?: { label: string; onClick: () => void; variant?: 'default' | 'outline' | 'ghost' }
  onDismiss?: () => void
}) {
  sonnerToast.custom(
    (toastId) => (
      <CustomToast
        title={title}
        message={message}
        variant={variant}
        toastId={toastId}
        actions={actions}
        onDismiss={onDismiss}
      />
    ),
    { duration, position }
  )
}
