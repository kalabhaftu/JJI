'use client'

import { ReactNode, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { DashboardSidebar } from './sidebar/dashboard-sidebar'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { useUserStore } from '@/store/user-store'
import Navbar from './navbar'
import type { SiteUiSettingsPayload } from '@/server/site-ui-settings'

interface SidebarLayoutProps {
  children: ReactNode
  siteUiSettings: SiteUiSettingsPayload
}

export function SidebarLayout({ children, siteUiSettings }: SidebarLayoutProps) {
  const pathname = usePathname()
  const setIsLoading = useUserStore(state => state.setIsLoading)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 100)
    return () => clearTimeout(timer)
  }, [pathname, setIsLoading])

  return (
    <SidebarProvider defaultOpen={false}>
      <DashboardSidebar siteUiSettings={siteUiSettings} />
      <SidebarInset id="main-content">
        <Navbar />
        <div className="min-w-0 w-full max-w-full pb-24 lg:pb-0">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
