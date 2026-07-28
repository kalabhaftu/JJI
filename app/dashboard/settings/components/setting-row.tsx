import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SettingRowProps {
  icon: LucideIcon
  label: string
  description?: string
  action: ReactNode
  className?: string
}

export function SettingRow({ icon: Icon, label, description, action, className }: SettingRowProps) {
  return (
    <div className={cn('grid grid-cols-1 gap-3 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-4', className)}>
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 pt-0.5">
          <p className="text-sm font-medium">{label}</p>
          {description && <p className="text-xs text-muted-foreground/85">{description}</p>}
        </div>
      </div>
      <div className="flex w-full min-w-0 md:w-auto md:justify-end">{action}</div>
    </div>
  )
}
