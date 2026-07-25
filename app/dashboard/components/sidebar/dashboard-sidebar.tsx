'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard,
  LineChart,
  CalendarDays,
  Briefcase,
  ListTodo,
  BookOpen,
  FlaskConical,
  Settings,
  Database,
  BookMarked,
  RefreshCw,
  PanelLeftClose,
  PanelLeftOpen,
  MessageSquare,
  Heart,
  Trophy,
  LogOut,
  Brain,
} from 'lucide-react'

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
import { useState } from 'react'
import { logger } from '@/lib/logger';

const coreNavItems = [
  { id: 'widgets', label: 'Overview', icon: LayoutDashboard, href: '/dashboard' },
  { id: 'journal', label: 'Daily Journal', icon: CalendarDays, href: '/dashboard/journal' },
  { id: 'reports', label: 'Analytics', icon: LineChart, href: '/dashboard/reports' },
  { id: 'table', label: 'Trade Log', icon: ListTodo, href: '/dashboard/table' },
  { id: 'accounts', label: 'Portfolios', icon: Briefcase, href: '/dashboard/accounts' },
]

const toolItems = [
  { id: 'playbook', label: 'Playbook', icon: BookOpen, href: '/dashboard/playbook' },
  { id: 'backtesting', label: 'Backtesting', icon: FlaskConical, href: '/dashboard/backtesting' },
  { id: 'goals', label: 'Goals', icon: Trophy, href: '/dashboard/goals' },
]

export function DashboardSidebar({ siteUiSettings }: { siteUiSettings: SiteUiSettingsPayload }) {
  const pathname = usePathname()
  const { refreshTrades, isDemoMode } = useData()
  const { state, toggleSidebar, isOverlay, setOpenMobile } = useSidebar()
  
  const tradovateSyncContext = useTradovateSyncContext()
  const dxfeedSyncContext = useDxFeedSyncContext()
  const rithmicSyncContext = useRithmicSyncContext()
  const [isSyncing, setIsSyncing] = useState(false)

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
    
    // DxFeed
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
    
    // If no integrations configured, fallback to standard data refresh
    if (syncPromises.length === 0) {
      try {
        await refreshTrades()
        toast.success("Data refreshed")
      } catch (err) {
        toast.error("Failed to refresh data")
      } finally {
        setIsSyncing(false)
      }
      return
    }
    
    // Run all configured sync runs in parallel
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
      logger.error("Error during manual sync: " + err)
      await refreshTrades()
      toast.error("Manual sync failed to complete")
    } finally {
      setIsSyncing(false)
    }
  }
  const isCollapsed = state === 'collapsed' && !isOverlay

  const getDemoAdjustedHref = (href: string) => {
    if (isDemoMode) {
      return href.replace('/dashboard', '/demo')
    }
    return href
  }

  const utilityItems = [
    ...(siteUiSettings.showFeedbackButton
      ? [{ id: 'feedback', label: 'Feedback', icon: MessageSquare, href: '/feedback' }]
      : []),
    ...(siteUiSettings.showDonateButton
      ? [{ id: 'donate', label: 'Donate', icon: Heart, href: '/donate' }]
      : []),
    { id: 'docs', label: 'Documentation', icon: BookMarked, href: '/docs' },
    { id: 'data', label: 'Data', icon: Database, href: '/dashboard/data' },
    { id: 'settings', label: 'Settings', icon: Settings, href: '/dashboard/settings' },
  ]

  const getActiveId = () => {
    const p = pathname || ''
    const isDemo = p.startsWith('/demo')
    const base = isDemo ? '/demo' : '/dashboard'

    if (p === base) return 'widgets'
    if (p.startsWith(`${base}/table`)) return 'table'
    if (p.startsWith(`${base}/accounts`)) return 'accounts'
    if (p.startsWith(`${base}/journal`)) return 'journal'
    if (p.startsWith(`${base}/backtesting`)) return 'backtesting'
    if (p.startsWith(`${base}/playbook`)) return 'playbook'
    if (p.startsWith(`${base}/goals`)) return 'goals'
    if (p.startsWith(`${base}/reports`)) return 'reports'
    if (p.startsWith(`${base}/settings`)) return 'settings'
    if (p.startsWith(`${base}/data`)) return 'data'
    if (p.startsWith(`${base}/ai`)) return 'ai'
    if (p.startsWith('/docs')) return 'docs'
    return 'widgets'
  }

  const activeId = getActiveId()
  const collapseLabel = isCollapsed ? 'Expand' : 'Collapse'
  const CollapseIcon = isCollapsed ? PanelLeftOpen : PanelLeftClose

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
                  href={isDemoMode ? "/demo" : "/dashboard"}
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
                  {coreNavItems.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        size={isOverlay ? 'lg' : 'default'}
                        variant={isCollapsed ? 'icon' : 'default'}
                        tooltip={item.label!}
                        isActive={activeId === item.id}
                        asChild
                        className={cn(
                          isOverlay && 'h-11 rounded-2xl px-4 text-[15px] [&>svg]:size-[17px]',
                          !isOverlay && !isCollapsed && 'px-3'
                        )}
                      >
                        <Link href={getDemoAdjustedHref(item.href)} onClick={handleMobileClose} data-tour={`sidebar-${item.id}`}>
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className={cn('pt-4', isOverlay ? 'px-0' : 'px-0')}>
              <SidebarGroupLabel className={cn(isOverlay && 'h-7 px-1 text-[11px] tracking-wide')}>Tools</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className={cn(isOverlay && 'gap-1')}>
                  {toolItems.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        size={isOverlay ? 'lg' : 'default'}
                        variant={isCollapsed ? 'icon' : 'default'}
                        tooltip={item.label!}
                        isActive={activeId === item.id}
                        asChild
                        className={cn(
                          isOverlay && 'h-11 rounded-2xl px-4 text-[15px] [&>svg]:size-[17px]',
                          !isOverlay && !isCollapsed && 'px-3'
                        )}
                      >
                        <Link href={getDemoAdjustedHref(item.href)} onClick={handleMobileClose}>
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className={cn('pt-4', isOverlay ? 'px-0' : 'px-0')}>
              <SidebarGroupLabel className={cn(isOverlay && 'h-7 px-1 text-[11px] tracking-wide')}>AI Assistant</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className={cn(isOverlay && 'gap-1')}>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      size={isOverlay ? 'lg' : 'default'}
                      variant={isCollapsed ? 'icon' : 'default'}
                      tooltip="AI Assistant"
                      isActive={activeId === 'ai'}
                      asChild
                      className={cn(
                        isOverlay && 'h-11 rounded-2xl px-4 text-[15px] [&>svg]:size-[17px]',
                        !isOverlay && !isCollapsed && 'px-3'
                      )}
                    >
                      <Link href={getDemoAdjustedHref('/dashboard/ai')} onClick={handleMobileClose}>
                        <Brain />
                        <span>AI Assistant</span>
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
                        isOverlay && 'h-11 rounded-2xl px-4 text-[15px] [&>svg]:size-[17px]',
                        !isOverlay && !isCollapsed && 'px-3'
                      )}
                      onClick={() => {
                        handleManualSync()
                        handleMobileClose()
                      }}
                      disabled={isSyncing}
                    >
                      <RefreshCw className={cn(isSyncing && "animate-spin")} />
                      <span>{isSyncing ? "Syncing..." : "Sync Data"}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  {utilityItems.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        size={isOverlay ? 'lg' : 'default'}
                        variant={isCollapsed ? 'icon' : 'default'}
                        tooltip={item.label!}
                        isActive={activeId === item.id}
                        asChild
                        className={cn(
                          isOverlay && 'h-11 rounded-2xl px-4 text-[15px] [&>svg]:size-[17px]',
                          !isOverlay && !isCollapsed && 'px-3'
                        )}
                      >
                        <Link href={getDemoAdjustedHref(item.href)} onClick={handleMobileClose} data-tour={`sidebar-${item.id}`}>
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
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
                    window.location.href = '/';
                  }}
                  tooltip="Exit Demo"
                  className={cn(
                    'w-full text-red-500 hover:text-red-400 hover:bg-red-500/10 transition-colors font-semibold',
                    isOverlay && 'h-11 rounded-2xl px-4 text-[15px] [&>svg]:size-[17px]',
                    !isOverlay && !isCollapsed && 'justify-start px-3'
                  )}
                >
                  <LogOut className="h-4 w-4 shrink-0" />
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
                  isOverlay && 'h-11 rounded-2xl px-4 text-[15px] [&>svg]:size-[17px]',
                  !isOverlay && !isCollapsed && 'justify-start px-3'
                )}
              >
                <CollapseIcon />
                {(!isCollapsed || isOverlay) && <span>{collapseLabel}</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </div>
    </Sidebar>
  )
}
