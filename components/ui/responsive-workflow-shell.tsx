'use client'

import Link from 'next/link'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons'
import type { FormEventHandler, ReactNode } from 'react'

import { Button } from '@/components/ui/button'

export interface ResponsiveWorkflowShellProps {
  title: string
  description?: string
  backHref?: string
  dirty?: boolean
  onSubmit?: FormEventHandler
  actions: ReactNode
  children: ReactNode
}

export function ResponsiveWorkflowShell({ title, description, backHref, dirty, onSubmit, actions, children }: ResponsiveWorkflowShellProps) {
  return (
    <form onSubmit={onSubmit} className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b px-4 py-3 sm:px-6">
        {backHref && <Button asChild variant="tertiary" size="sm"><Link href={backHref}><HugeiconsIcon icon={ArrowLeft01Icon} data-icon="inline-start" strokeWidth={2} color="currentColor" />Back</Link></Button>}
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {dirty && <span className="ml-auto text-xs text-muted-foreground" role="status">Unsaved changes</span>}
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      <footer className="flex shrink-0 flex-col-reverse gap-2 border-t p-4 sm:flex-row sm:justify-end">{actions}</footer>
    </form>
  )
}
