'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { HugeiconsIcon } from '@hugeicons/react'
import type { HugeiconsIconProps } from '@hugeicons/react'
import {
  DashboardSquare01Icon,
  AnalyticsUpIcon,
  Calendar01Icon,
  Briefcase01Icon,
  Task01Icon,
  BookOpen01Icon,
  TestTube01Icon,
  Settings02Icon,
  Database01Icon,
  Bookmark01Icon,
  RefreshIcon,
  SidebarLeft01Icon,
  SidebarLeftIcon,
  Comment01Icon,
  FavouriteIcon,
  Award01Icon,
  Logout01Icon,
  Brain01Icon,
} from '@hugeicons/core-free-icons'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { Logo } from '@/components/logo'
import { cn } from '@/lib/utils'
import { useData } from '@/context/data-provider'
import type { SiteUiSettingsPayload } from '@/server/site-ui-settings'
import { useTradovateSyncContext } from '@/context/tradovate-sync-context'
import { useDxFeedSyncContext } from '@/context/dxfeed-sync-context'
import { useRithmicSyncContext } from '@/context/rithmic-sync-context'
import { getAllRithmicData } from '@/lib/rithmic-storage'
import { toast } from 'sonner'
import { useEffect, useRef, useState } from 'react'
import { reportClientError, reportError } from '@/lib/observability/report-error'
import { MOBILE_SYNC_EVENT } from '@/lib/navigation/mobile-nav'
import { usePublicSurfaceRouting } from '@/hooks/use-public-surface-routing'
import {
  getActiveNavigationId,
  getNavigationGroup,
  resolveNavigationPath,
  type NavigationContext,
  type NavigationId,
} from '@/lib/navigation/registry'

const navigationIcons: Record<NavigationId, HugeiconsIconProps['icon']> = {
  overview: DashboardSquare01Icon, journal: Calendar01Icon, reports: AnalyticsUpIcon, table: Task01Icon,
  accounts: Briefcase01Icon, playbook: BookOpen01Icon, backtesting: TestTube01Icon, goals: Award01Icon,
  assistant: Brain01Icon, data: Database01Icon, settings: Settings02Icon, docs: Bookmark01Icon,
  feedback: Comment01Icon, donate: FavouriteIcon, more: DashboardSquare01Icon,
}

function NavIcon({ icon, spin = false }: { icon: HugeiconsIconProps['icon']; spin?: boolean }) {
  return (
    <span className="flex size-5 shrink-0 items-center justify-center [&>svg]:size-5">
      <HugeiconsIcon icon={icon} className={spin ? 'animate-spin' : undefined} strokeWidth={2} color="currentColor" aria-hidden />
    </span>
  )
}

export function DashboardSidebar({ siteUiSettings }: { siteUiSettings: SiteUiSettingsPayload }) {
  const pathname = usePathname()
  const { refreshTrades, isDemoMode } = useData()
  const { hostname, exitDemoHref } = usePublicSurfaceRouting()
  const { state, toggleSidebar, isOverlay, setOpenMobile } = useSidebar()
  
  const tradovateSyncContext = useTradovateSyncContext()
  const dxfeedSyncContext = useDxFeedSyncContext()
  const rithmicSyncContext = useRithmicSyncContext()
  const [isSyncing, setIsSyncing] = useState(false)
  const manualSyncRef = useRef<() => void>(() => {})

  const handleManualSync = async () => {
    if (isSyncing) return
    setIsSyncing(true)
    toast.info("Starting manual broker sync...", {
      description: "Syncing your active broker integrations in the background."
    })
    
    const syncPromises: Promise<any>[] = []
    
    if (tradovateSyncContext && tradovateSyncContext.accounts.length > 0) {
      syncPromises.push(
        tradovateSyncContext.performSyncForAllAccounts()
          .then(() => ({ service: 'Tradovate', success: true }))
          .catch((err) => ({ service: 'Tradovate', success: false, error: err }))
      )
    }
    

    if (dxfeedSyncContext && dxfeedSyncContext.accounts.length > 0) {
      syncPromises.push(
        dxfeedSyncContext.performSyncForAllAccounts()
          .then(() => ({ service: 'DxFeed', success: true }))
          .catch((err) => ({ service: 'DxFeed', success: false, error: err }))
      )
    }
    
    const rithmicCredentials = typeof window !== 'undefined' ? getAllRithmicData() : {}
    const rithmicIds = Object.keys(rithmicCredentials)
    if (rithmicSyncContext && rithmicIds.length > 0) {
      rithmicIds.forEach((id) => {
        syncPromises.push(
          rithmicSyncContext.performSyncForCredential(id)
            .then(() => ({ service: 'Rithmic', success: true }))
            .catch((err) => ({ service: 'Rithmic', success: false, error: err }))
        )
      })
    }
    
      if (syncPromises.length === 0) {
      try {
        await refreshTrades()
        toast.success("Data refreshed")
      } catch (err) {
        reportClientError(err, { operation: 'refresh-dashboard-data', route: '/dashboard' })
        toast.error("Failed to refresh data")
      } finally {
        setIsSyncing(false)
      }
      return
    }
    
    try {
      const results = await Promise.all(syncPromises)
      const failures = results.filter(r => !r.success)
      
      await refreshTrades()
      
      if (failures.length === 0) {
        toast.success("Manual sync completed successfully!", {
          description: `All ${results.length} broker integrations synchronized.`
        })
      } else {
        const failedServices = failures.map(f => f.service).join(', ')
        toast.warning("Manual sync completed with warnings", {
          description: `Failed to sync: ${failedServices}. Others succeeded.`
        })
      }
    } catch (err) {
      reportError(err, {
        surface: 'client',
        operation: 'run-manual-broker-sync',
      })
      await refreshTrades()
      toast.error("Manual sync failed to complete")
    } finally {
      setIsSyncing(false)
    }
  }
  manualSyncRef.current = () => {
    void handleManualSync()
  }

  useEffect(() => {
    const handleMobileSync = () => manualSyncRef.current()
    window.addEventListener(MOBILE_SYNC_EVENT, handleMobileSync)
    return () => window.removeEventListener(MOBILE_SYNC_EVENT, handleMobileSync)
  }, [])
  const isCollapsed = state === 'collapsed' && !isOverlay

  const navigationContext: NavigationContext = {
    surface: isDemoMode ? 'demo' : 'authenticated',
    isDemo: Boolean(isDemoMode),
    hostname,
  }
  const coreNavItems = getNavigationGroup('core', navigationContext)
  const toolItems = getNavigationGroup('tools', navigationContext)

  const utilityItems = [
    ...(siteUiSettings.showFeedbackButton
       ? [getNavigationGroup('utilities', navigationContext).find((item) => item.id === 'feedback')!]
      : []),
    ...(siteUiSettings.showDonateButton
       ? [getNavigationGroup('utilities', navigationContext).find((item) => item.id === 'donate')!]
       : []),
    ...getNavigationGroup('utilities', navigationContext).filter((item) => ['docs', 'data', 'settings'].includes(item.id)),
  ]

  const activeId = getActiveNavigationId(pathname || '', navigationContext)
  const collapseLabel = isCollapsed ? 'Expand' : 'Collapse'
  const CollapseIcon = isCollapsed ? SidebarLeftIcon : SidebarLeft01Icon

  const handleMobileClose = () => {
    if (isOverlay) {
      setOpenMobile(false)
    }
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-border/40 bg-sidebar">
      <div className={cn('grid h-full min-h-0 bg-sidebar', isOverlay ? 'grid-rows-[auto_1fr_auto]' : 'grid-rows-[auto_1fr_auto]')}>
        <SidebarHeader className={cn('border-b border-sidebar-border/40', isOverlay ? 'px-4 pt-4 pb-2.5' : 'px-2 py-2')}>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                variant={isCollapsed ? 'icon' : 'default'}
                className={cn(
                  'rounded-2xl data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground',
                  isOverlay ? 'h-11' : 'h-12',
                  !isCollapsed && !isOverlay && 'px-3'
                )}
                asChild
                tooltip="Dashboard Home"
              >
                <Link
                   href={resolveNavigationPath('overview', navigationContext)}
                  onClick={handleMobileClose}
                  className={cn('flex w-full items-center', isCollapsed ? 'justify-center' : 'gap-3')}
                >
                  <Logo className="h-6 w-6 shrink-0" />
                  {(!isCollapsed || isOverlay) && (
                    <span className="text-sm font-bold tracking-tight">JJI</span>
                  )}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent className={cn('min-h-0', isOverlay ? 'overflow-hidden px-4 py-2.5' : 'overflow-y-auto px-2 py-2')}>
          <div className={cn('flex flex-1 flex-col', isOverlay ? 'min-h-full overflow-y-auto overscroll-contain' : 'min-h-0')}>
            <SidebarGroup className={cn('pt-0', isOverlay ? 'px-0' : 'px-0')}>
              <SidebarGroupLabel className={cn(isOverlay && 'h-7 px-1 text-[11px] tracking-wide')}>Navigation</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className={cn(isOverlay && 'gap-1')}>
                   {coreNavItems.map((item) => {
                     const ItemIcon = navigationIcons[item.id]
                     return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        size={isOverlay ? 'lg' : 'default'}
                        variant={isCollapsed ? 'icon' : 'default'}
                        tooltip={item.label!}
                        isActive={activeId === item.id}
                        asChild
                        className={cn(
                          isOverlay && 'h-11 rounded-2xl px-4 text-[15px]',
                          !isOverlay && !isCollapsed && 'px-3'
                        )}
                      >
                         <Link href={resolveNavigationPath(item, navigationContext)} onClick={handleMobileClose} data-tour={`sidebar-${item.id}`}>
                           <NavIcon icon={ItemIcon} />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                     )
                   })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className={cn('pt-4', isOverlay ? 'px-0' : 'px-0')}>
              <SidebarGroupLabel className={cn(isOverlay && 'h-7 px-1 text-[11px] tracking-wide')}>Tools</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className={cn(isOverlay && 'gap-1')}>
                   {toolItems.map((item) => {
                     const ItemIcon = navigationIcons[item.id]
                     return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        size={isOverlay ? 'lg' : 'default'}
                        variant={isCollapsed ? 'icon' : 'default'}
                        tooltip={item.label!}
                        isActive={activeId === item.id}
                        asChild
                        className={cn(
                          isOverlay && 'h-11 rounded-2xl px-4 text-[15px]',
                          !isOverlay && !isCollapsed && 'px-3'
                        )}
                      >
                         <Link href={resolveNavigationPath(item, navigationContext)} onClick={handleMobileClose}>
                           <NavIcon icon={ItemIcon} />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                     )
                   })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className={cn('pt-4', isOverlay ? 'px-0' : 'px-0')}>
              <SidebarGroupLabel className={cn(isOverlay && 'h-7 px-1 text-[11px] tracking-wide')}>Assistant</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className={cn(isOverlay && 'gap-1')}>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      size={isOverlay ? 'lg' : 'default'}
                      variant={isCollapsed ? 'icon' : 'default'}
                      tooltip="Assistant"
                       isActive={activeId === 'assistant'}
                      asChild
                      className={cn(
                        isOverlay && 'h-11 rounded-2xl px-4 text-[15px]',
                        !isOverlay && !isCollapsed && 'px-3'
                      )}
                    >
                       <Link href={resolveNavigationPath('assistant', navigationContext)} onClick={handleMobileClose}>
                        <NavIcon icon={Brain01Icon} />
                        <span>Assistant</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className={cn('mt-auto', isOverlay ? 'px-0 pb-0 pt-6' : 'px-0 pb-0 pt-6')}>
              <SidebarGroupLabel className={cn(isOverlay && 'h-7 px-1 text-[11px] tracking-wide')}>Utilities</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className={cn(isOverlay && 'gap-1')}>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      size={isOverlay ? 'lg' : 'default'}
                      variant={isCollapsed ? 'icon' : 'default'}
                      tooltip={isSyncing ? "Syncing data..." : "Sync & Refresh Data"}
                      className={cn(
                        isOverlay && 'h-11 rounded-2xl px-4 text-[15px]',
                        !isOverlay && !isCollapsed && 'px-3'
                      )}
                      onClick={() => {
                        handleManualSync()
                        handleMobileClose()
                      }}
                      disabled={isSyncing}
                    >
                      <NavIcon icon={RefreshIcon} spin={isSyncing} />
                      <span>{isSyncing ? "Syncing..." : "Sync Data"}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                   {utilityItems.map((item) => {
                     const ItemIcon = navigationIcons[item.id]
                     return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        size={isOverlay ? 'lg' : 'default'}
                        variant={isCollapsed ? 'icon' : 'default'}
                        tooltip={item.label!}
                        isActive={activeId === item.id}
                        asChild
                        className={cn(
                          isOverlay && 'h-11 rounded-2xl px-4 text-[15px]',
                          !isOverlay && !isCollapsed && 'px-3'
                        )}
                      >
                         <Link href={resolveNavigationPath(item, navigationContext)} onClick={handleMobileClose} data-tour={`sidebar-${item.id}`}>
                           <NavIcon icon={ItemIcon} />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                     )
                   })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </div>
        </SidebarContent>

        <SidebarFooter
          className={cn(
            'border-t border-sidebar-border/60 bg-sidebar',
            isOverlay ? 'px-4 py-2 pb-[calc(max(0.5rem,env(safe-area-inset-bottom))+0.25rem)]' : 'p-2'
          )}
        >
          <SidebarMenu>
            {isDemoMode && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  size={isOverlay ? 'lg' : 'default'}
                  variant="default"
                  onClick={() => {
                    localStorage.removeItem('settings-cache');
                    localStorage.removeItem('active-accounts');
                    window.location.href = exitDemoHref;
                  }}
                  tooltip="Exit Demo"
                  className={cn(
                    'w-full text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors font-semibold',
                    isOverlay && 'h-11 rounded-2xl px-4 text-[15px]',
                    !isOverlay && !isCollapsed && 'justify-start px-3'
                  )}
                >
                  <NavIcon icon={Logout01Icon} />
                  {(!isCollapsed || isOverlay) && <span>Exit Demo</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            <SidebarMenuItem>
              <SidebarMenuButton
                size={isOverlay ? 'lg' : 'default'}
                variant={isCollapsed ? 'icon' : 'default'}
                onClick={toggleSidebar}
                tooltip={collapseLabel}
                className={cn(
                  'w-full text-muted-foreground hover:text-foreground',
                  isOverlay && 'h-11 rounded-2xl px-4 text-[15px]',
                  !isOverlay && !isCollapsed && 'justify-start px-3'
                )}
              >
                <NavIcon icon={CollapseIcon} />
                {(!isCollapsed || isOverlay) && <span>{collapseLabel}</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </div>
    </Sidebar>
  )
}
