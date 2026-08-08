import Link from 'next/link'
import { cookies, headers } from 'next/headers'
import { HugeiconsIcon } from '@hugeicons/react'
import { Menu01Icon } from '@hugeicons/core-free-icons'

import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { getDocsHref, getMainAppHref, getMainAppLaunchHref } from '@/lib/public-surface-routing'
import { cn } from '@/lib/utils'

type PublicHeaderNavItem = {
  href: string
  label: string
}

interface PublicHeaderProps {
  navItems?: PublicHeaderNavItem[]
  activeHref?: string
  containerClassName?: string
}

function hasSupabaseSessionCookie(cookieNames: string[]) {
  return cookieNames.some((name) => name.startsWith('sb-'))
}

export async function PublicHeader({
  navItems = [],
  activeHref,
  containerClassName,
}: PublicHeaderProps) {
  const cookieStore = await cookies()
  const requestHeaders = await headers()
  const hostname = requestHeaders.get('host')
  const isSignedIn = hasSupabaseSessionCookie(cookieStore.getAll().map((cookie) => cookie.name))
  const mainHref = getMainAppHref('/', hostname)
  const appHref = getMainAppHref('/dashboard', hostname)
  const signInHref = getMainAppLaunchHref('/dashboard', hostname)
  const getNavHref = (href: string) => {
    if (href.startsWith('/docs')) return getDocsHref(href, hostname)
    if (href.startsWith('/')) return getMainAppHref(href, hostname)
    return href
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/88 backdrop-blur-xl">
      <div
        className={cn(
          'mx-auto flex h-14 w-full items-center justify-between gap-6 px-4 sm:px-6',
          containerClassName ?? 'max-w-6xl'
        )}
      >
        <Link
          href={mainHref as any}
          className="flex min-w-0 items-center gap-3 transition-opacity hover:opacity-80"
        >
          <Logo className="h-7 w-7 shrink-0" />
          <div className="min-w-0">
            <p className="truncate text-sm font-black tracking-tight">JJI</p>
          </div>
        </Link>

        <div className="flex items-center justify-end gap-2 sm:gap-3">
          <div className="hidden items-center gap-1 sm:flex">
            {navItems.map((item) => {
              const isActive = activeHref === item.href
              const href = getNavHref(item.href)

              return (
                <Button
                  key={item.href}
                  asChild
                  variant="tertiary"
                  size="sm"
                  className={cn(
                    'h-9 rounded-xl px-3 text-xs',
                    isActive && 'bg-accent/70 text-foreground'
                  )}
                >
                  <Link href={href as any}>{item.label}</Link>
                </Button>
              )
            })}
          </div>

          <details className="relative sm:hidden">
            <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-xl border border-border/70 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              <HugeiconsIcon icon={Menu01Icon} className="h-4 w-4" strokeWidth={2} color="currentColor" />
              <span className="sr-only">Open navigation</span>
            </summary>
            <div className="absolute right-0 top-11 z-50 min-w-44 rounded-2xl border border-border/80 bg-popover p-2 shadow-xl">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={getNavHref(item.href) as any}
                  className="block rounded-xl px-3 py-2 text-sm text-popover-foreground hover:bg-accent"
                >
                  {item.label}
                </Link>
              ))}
              <Link href={getMainAppHref('/privacy', hostname) as any} className="block rounded-xl px-3 py-2 text-sm text-popover-foreground hover:bg-accent">Privacy</Link>
              <Link href={getMainAppHref('/terms', hostname) as any} className="block rounded-xl px-3 py-2 text-sm text-popover-foreground hover:bg-accent">Terms</Link>
              <Link href={getMainAppHref('/contact', hostname) as any} className="block rounded-xl px-3 py-2 text-sm text-popover-foreground hover:bg-accent">Contact</Link>
            </div>
          </details>

          <Button asChild size="sm" className="h-9 rounded-xl px-4 text-xs font-semibold">
            <Link href={(isSignedIn ? appHref : signInHref) as any}>
              {isSignedIn ? 'Back to App' : 'Sign In'}
            </Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
