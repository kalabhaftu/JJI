'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { type LucideIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { usePublicSurfaceRouting } from '@/hooks/use-public-surface-routing'
import { cn } from '@/lib/utils'

export function DocsPage({
  badge,
  title,
  description,
  children,
}: {
  badge?: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="space-y-10">
      <div className="space-y-4">
        {badge && <Badge variant="outline">{badge}</Badge>}
        <div className="space-y-3">
          <h1>{title}</h1>
          <p className="text-lg text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

export function DocsSection({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('space-y-5', className)}>
      <div className="space-y-2">
        <h2>{title}</h2>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  )
}

export function DocsCardGrid({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn('grid gap-4 md:grid-cols-2', className)}>{children}</div>
}

export function DocsInfoCard({
  title,
  description,
  icon: Icon,
  items,
  footer,
}: {
  title: string
  description: string
  icon?: LucideIcon
  items?: string[]
  footer?: ReactNode
}) {
  return (
    <Card className="border-border/70 bg-card/55">
      <CardHeader className="space-y-3">
        {Icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        )}
        <div className="space-y-1">
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      {(items || footer) && (
        <CardContent className="space-y-3">
          {items && (
            <ul className="m-0 space-y-2 pl-4 text-sm text-muted-foreground">
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          {footer}
        </CardContent>
      )}
    </Card>
  )
}

export function DocsCallout({
  title,
  children,
  tone = 'default',
}: {
  title: string
  children: ReactNode
  tone?: 'default' | 'success' | 'warning'
}) {
  const toneClasses =
    tone === 'success'
      ? 'border-emerald-500/30 bg-emerald-500/8'
      : tone === 'warning'
        ? 'border-amber-500/30 bg-amber-500/8'
        : 'border-primary/20 bg-primary/5'

  return (
    <div className={cn('rounded-2xl border px-5 py-4', toneClasses)}>
      <h3 className="mt-0 text-lg font-semibold">{title}</h3>
      <div className="text-sm text-muted-foreground">{children}</div>
    </div>
  )
}

export function DocsLinkList({
  links,
}: {
  links: Array<{ href: string; label: string; description: string }>
}) {
  const { docsHref } = usePublicSurfaceRouting()

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {links.map((link) => (
        <Link
          key={link.href}
          href={docsHref(link.href) as any}
          className="rounded-2xl border border-border/70 bg-card/55 p-4 no-underline transition-colors hover:border-primary/40 hover:bg-accent/25"
        >
          <p className="m-0 text-base font-semibold text-foreground">{link.label}</p>
          <p className="m-0 mt-1 text-sm text-muted-foreground">{link.description}</p>
        </Link>
      ))}
    </div>
  )
}
