'use client'

import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  CalendarDays,
  LineChart,
  ListTodo,
  Briefcase
} from "lucide-react"
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useData } from '@/context/data-provider'
import {
  getActiveMobileNavId,
  getMobileNavHref,
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
  accounts: Briefcase,
}

const mobileNavItems: MobileNavItem[] = MOBILE_NAV_DESTINATIONS.map((item) => ({
  ...item,
  icon: icons[item.id],
}))

export function MobileBottomNav() {
  const pathname = usePathname()
  const data = useData()
  const isDemoMode = data?.isDemoMode

  const activeTab = getActiveMobileNavId(pathname || '', Boolean(isDemoMode))

  return (
    <nav aria-label="Primary mobile navigation" className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background lg:hidden">
      <div className="mx-auto flex min-h-16 max-w-lg items-center justify-around px-2">
        {mobileNavItems.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id

          return (
            <Link
              key={item.id}
              href={getMobileNavHref(item.href, Boolean(isDemoMode))}
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
                "mt-0.5 text-[10px] font-semibold tracking-wide",
                isActive ? "text-primary" : "text-muted-foreground/80"
              )}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
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
