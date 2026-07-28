'use client'

import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  CalendarDays,
  LineChart,
  ListTodo,
  MoreHorizontal,
  Briefcase,
  BookOpen,
  FlaskConical,
  Trophy,
  Brain,
  Database,
  Settings,
  BookMarked,
  RefreshCw,
} from "lucide-react"
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { useData } from '@/context/data-provider'
import { Button } from '@/components/ui/button'
import { usePublicSurfaceRouting } from '@/hooks/use-public-surface-routing'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  getActiveMobileNavId,
  getMobileNavHref,
  MOBILE_SYNC_EVENT,
  MOBILE_NAV_DESTINATIONS,
  type MobileNavId,
} from '@/lib/navigation/mobile-nav'

interface MobileNavItem {
  id: MobileNavId
  label: string
  icon: React.ComponentType<{ className?: string; weight?: any }>
  href: string
}

const icons: Record<MobileNavId, MobileNavItem['icon']> = {
  widgets: LayoutDashboard,
  journal: CalendarDays,
  reports: LineChart,
  table: ListTodo,
  more: MoreHorizontal,
}

const mobileNavItems: MobileNavItem[] = MOBILE_NAV_DESTINATIONS.map((item) => ({
  ...item,
  icon: icons[item.id],
}))

export function MobileBottomNav() {
  const pathname = usePathname()
  const data = useData()
  const isDemoMode = data?.isDemoMode
  const { docsHref, hostname } = usePublicSurfaceRouting()
  const [moreOpen, setMoreOpen] = useState(false)

  const activeTab = getActiveMobileNavId(pathname || '', Boolean(isDemoMode), hostname)
  const moreItems = [
    { label: 'Accounts', href: '/dashboard/accounts', icon: Briefcase },
    { label: 'Playbook', href: '/dashboard/playbook', icon: BookOpen },
    { label: 'Backtesting', href: '/dashboard/backtesting', icon: FlaskConical },
    { label: 'Goals', href: '/dashboard/goals', icon: Trophy },
    { label: 'Assistant', href: '/dashboard/ai', icon: Brain },
    { label: 'Data', href: '/dashboard/data', icon: Database },
    { label: 'Settings', href: '/dashboard/settings', icon: Settings },
    { label: 'Docs', href: '/docs', icon: BookMarked },
  ] as const

  return (
    <nav aria-label="Primary mobile navigation" className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background lg:hidden">
      <div className="mx-auto flex min-h-16 max-w-lg items-center justify-around px-2">
        {mobileNavItems.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id

          if (item.id === 'more') {
            return (
              <button
                type="button"
                key={item.id}
                aria-current={isActive ? 'page' : undefined}
                aria-haspopup="dialog"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen(true)}
                className={cn(
                  "flex min-h-14 min-w-[60px] flex-col items-center justify-center rounded-xl px-2 py-1 touch-manipulation transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground active:text-foreground"
                )}
              >
                <div className={cn("flex h-7 w-10 items-center justify-center rounded-full transition-colors", isActive && "bg-primary/15")}>
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                </div>
                <span className={cn("mt-0.5 text-xs font-semibold", isActive ? "text-primary" : "text-muted-foreground")}>
                  {item.label}
                </span>
              </button>
            )
          }

          return (
            <Link
              key={item.id}
              href={getMobileNavHref(item.href, Boolean(isDemoMode), hostname) as any}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                "flex min-h-14 min-w-[60px] flex-col items-center justify-center rounded-xl px-2 py-1 touch-manipulation transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground active:text-foreground"
              )}
            >
              <div className={cn(
                "flex h-7 w-10 items-center justify-center rounded-full transition-colors",
                isActive && "bg-primary/15"
              )}>
                <Icon className="h-[18px] w-[18px] shrink-0" />
              </div>
              <span className={cn(
                "mt-0.5 text-xs font-semibold",
                isActive ? "text-primary" : "text-muted-foreground/80"
              )}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent className="bottom-0 left-0 top-auto w-full max-w-none translate-x-0 translate-y-0 rounded-b-none px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:left-1/2 sm:top-1/2 sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl">
          <DialogHeader>
            <DialogTitle>More</DialogTitle>
            <DialogDescription>Open tools, account settings, documentation, or sync your data.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {moreItems.map(({ label, href, icon: MoreIcon }) => (
              <Button key={label} asChild variant="outline" className="h-12 justify-start gap-3">
                <Link
                  href={(href.startsWith('/docs') ? docsHref(href) : getMobileNavHref(href, Boolean(isDemoMode), hostname)) as any}
                  onClick={() => setMoreOpen(false)}
                >
                  <MoreIcon className="h-4 w-4" />
                  {label}
                </Link>
              </Button>
            ))}
          </div>
          <Button
            type="button"
            variant="secondary"
            className="w-full gap-2"
            onClick={() => {
              window.dispatchEvent(new CustomEvent(MOBILE_SYNC_EVENT))
              setMoreOpen(false)
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Sync data
          </Button>
        </DialogContent>
      </Dialog>
    </nav>
  )
}

// Wrapper component for pages that should have bottom nav padding on mobile
export function MobileNavPadding({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <div className="h-20 lg:hidden" />
    </>
  )
}
