import { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: ReactNode
  meta?: ReactNode
  actions?: ReactNode
  className?: string
  contentClassName?: string
  titleClassName?: string
  metaClassName?: string
  actionsClassName?: string
}

export function PageHeader({
  title,
  meta,
  actions,
  className,
  contentClassName,
  titleClassName,
  metaClassName,
  actionsClassName,
}: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className={cn('flex min-w-0 flex-col gap-1', contentClassName)}>
        <h1 className={cn('truncate text-2xl font-bold tracking-tight sm:text-3xl', titleClassName)}>
          {title}
        </h1>
        {meta ? (
          <div className={cn('text-sm font-medium text-muted-foreground/85', metaClassName)}>
            {meta}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div className={cn('flex flex-wrap items-center gap-2 sm:flex-shrink-0', actionsClassName)}>
          {actions}
        </div>
      ) : null}
    </div>
  )
}
