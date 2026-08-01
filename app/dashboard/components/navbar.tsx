'use client'

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useData } from "@/context/data-provider"
import { useAuth } from "@/context/auth-provider"
import Link from 'next/link'
import { useState, useEffect } from 'react'
import ImportButton from './import/import-button'
import { NotificationCenter } from '@/components/notifications/notification-center'

import { useKeyboardShortcuts } from '../hooks/use-keyboard-shortcuts'
import { CombinedFilters } from './navbar-filters/combined-filters'
import { AccountSelector } from './navbar-filters/account-selector'
import { useUserStore } from '@/store/user-store'
import { ThemeSwitcher } from '@/components/theme-switcher'
import { TemplateSelector } from './template-selector'
import { DashboardDisplayModeSelector } from './navbar-display-mode'
import { signOut } from '@/server/auth/providers'
import { Settings, LogOut, Wallet, Plus, SlidersHorizontal } from 'lucide-react'
import { emitTourEvent } from '@/lib/tours/events'
import { useQuickAddStore } from '@/store/quick-add-store'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Logo } from '@/components/logo'
import { getUserAvatarUrl, getUserDisplayName } from '@/lib/user-avatar'
import { usePublicSurfaceRouting } from '@/hooks/use-public-surface-routing'

export default function Navbar() {
  const storeUser = useUserStore(state => state.supabaseUser)
  const { user: authUser } = useAuth()
  const user = storeUser ?? authUser
  const avatarUrl = getUserAvatarUrl(user)
  const displayName = getUserDisplayName(user) || user?.email?.split('@')[0] || 'User'
  const [filtersPopoverOpen, setFiltersPopoverOpen] = useState(false)
  const [accountPopoverOpen, setAccountPopoverOpen] = useState(false)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [mobileAccountsOpen, setMobileAccountsOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)

  const { isMobile, isDemoMode } = useData()
  const { forceClearAuth } = useAuth()
  const { demoRouteHref } = usePublicSurfaceRouting()

  useKeyboardShortcuts()

  useEffect(() => {
    const handleOpenAccountSelector = () => {
      if (isMobile) {
        setMobileAccountsOpen(true)
      } else {
        setAccountPopoverOpen(true)
      }
    }
    window.addEventListener('open-account-selector', handleOpenAccountSelector)
    return () => window.removeEventListener('open-account-selector', handleOpenAccountSelector)
  }, [isMobile])

  const handleLogout = async () => {
    localStorage.clear()
    sessionStorage.clear()
    forceClearAuth()
    await signOut()
  }

  return (
    <nav
      className="navbar-slide-in sticky top-0 z-20 flex w-full items-center border-b border-sidebar-border/60 bg-sidebar/95 text-foreground backdrop-blur-md lg:bg-sidebar/80"
    >
      <div className="flex h-11 w-full items-center justify-between px-3 sm:px-4">
        {/* Left: Sidebar mobile trigger & logo */}
        <div className="flex items-center gap-3">
          <SidebarTrigger className="lg:hidden w-8 h-8" />
          <Link href="/dashboard" className="lg:hidden flex items-center">
            <Logo className="h-6 w-6" />
          </Link>
        </div>

        {/* Right: Account Selector + Filters + Template + Import + Notifications + Theme + Profile */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:bg-muted/40 hover:text-foreground sm:hidden"
            onClick={() => { setMobileAccountsOpen(true); emitTourEvent('account-filter.changed') }}
            aria-label="Select accounts"
            data-tour="navbar-accounts-btn"
          >
            <Wallet className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:bg-muted/40 hover:text-foreground sm:hidden"
            onClick={() => setMobileFiltersOpen(true)}
            aria-label="Open filters"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>

          {/* Account Selector */}
          <Popover open={!isMobile && accountPopoverOpen} onOpenChange={(open) => {
            setAccountPopoverOpen(open)
            if (open) emitTourEvent('account-filter.changed')
          }}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" data-tour="navbar-accounts-btn" className="hidden h-8 w-8 text-muted-foreground hover:bg-muted/40 hover:text-foreground sm:flex" aria-label="Trading accounts">
                <Wallet className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[min(22rem,calc(100vw-1rem))] p-0 flex flex-col overflow-hidden"
              align="end"
              side="bottom"
              sideOffset={4}
              collisionPadding={16}
            >
              <AccountSelector onSave={() => setAccountPopoverOpen(false)} />
            </PopoverContent>
          </Popover>

          <div className="hidden sm:block">
            <DashboardDisplayModeSelector />
          </div>

          {/* Filters - hidden on mobile */}
          <div className="hidden sm:block">
            <CombinedFilters
              onSave={() => setFiltersPopoverOpen(false)}
              open={filtersPopoverOpen}
              onOpenChange={setFiltersPopoverOpen}
            />
          </div>

          {/* Template Selector - hidden on mobile */}
          <div className="hidden md:block">
            <TemplateSelector />
          </div>

          {/* Quick Add Trade - always visible on desktop */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { useQuickAddStore.getState().openQuickAdd(); emitTourEvent('trade.quick-add.opened') }}
            data-tour="quick-add-btn"
            className="hidden h-8 w-8 text-muted-foreground hover:bg-muted/40 hover:text-foreground sm:flex items-center justify-center rounded-lg"
            title="Quick Add Trade"
            aria-label="Quick add trade"
          >
            <Plus className="h-4 w-4" />
          </Button>

          {/* Import - always visible, icon only on mobile */}
          <ImportButton />

          {/* Notifications - always visible */}
          <NotificationCenter />

          {/* Theme - hidden on mobile, in profile dropdown */}
          <div className="hidden sm:block">
            <ThemeSwitcher />
          </div>

          {/* Profile dropdown - includes mobile-only items */}
          <DropdownMenu open={profileMenuOpen} onOpenChange={setProfileMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0" aria-label="Open profile menu">
                <Avatar className="h-8 w-8">
                  <AvatarImage key={avatarUrl ?? 'navbar-avatar-fallback'} src={avatarUrl} referrerPolicy="no-referrer" />
                  <AvatarFallback className="uppercase text-xs bg-muted text-foreground font-medium">
                    {user?.email?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[min(14rem,calc(100vw-1rem))]" align="end" sideOffset={8}>
              <div className="flex items-center gap-3 p-3">
                <Avatar className="h-9 w-9">
                  <AvatarImage key={avatarUrl ?? 'navbar-menu-avatar-fallback'} src={avatarUrl} referrerPolicy="no-referrer" />
                  <AvatarFallback className="uppercase text-xs bg-muted text-foreground font-medium">
                    {user?.email?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col space-y-0.5 leading-none">
                  <p className="text-sm font-semibold truncate max-w-[160px]">
                    {displayName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate max-w-[160px]">
                    {user?.email || ''}
                  </p>
                </div>
              </div>
              <DropdownMenuSeparator />

              <div className="sm:hidden px-2 py-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm">View</span>
                  <DashboardDisplayModeSelector mobile />
                </div>
              </div>

              <DropdownMenuItem asChild>
                <Link
                  href={isDemoMode ? demoRouteHref('/dashboard/settings', true) : '/dashboard/settings'}
                  className="cursor-pointer"
                  onClick={() => setProfileMenuOpen(false)}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>

              {/* Mobile-only: Theme toggle in menu */}
              <div className="sm:hidden px-2 py-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Theme</span>
                  <ThemeSwitcher />
                </div>
              </div>

              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Log Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Dialog open={mobileAccountsOpen} onOpenChange={setMobileAccountsOpen}>
        <DialogContent className="max-w-[min(100vw-1rem,32rem)] p-0 flex flex-col overflow-hidden max-h-[85dvh]">
          <DialogHeader className="px-4 pt-4 pb-0 flex-shrink-0">
            <DialogTitle>Accounts</DialogTitle>
            <DialogDescription>Choose which trading accounts apply to the current view.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 flex flex-col px-1 pb-3">
            <AccountSelector onSave={() => setMobileAccountsOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <DialogContent className="max-w-[min(100vw-1rem,32rem)] p-0 flex flex-col overflow-hidden max-h-[85dvh]">
          <DialogHeader className="px-4 pt-4 pb-0 flex-shrink-0">
            <DialogTitle>Filters</DialogTitle>
            <DialogDescription>Refine the data shown on the current page.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 flex flex-col px-1 pb-3">
            <CombinedFilters
              renderTrigger={false}
              onSave={() => setMobileFiltersOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </nav>
  )
}
