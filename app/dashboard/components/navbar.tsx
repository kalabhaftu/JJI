'use client'

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
import { signOut } from '@/server/auth'
import { Plus, Wallet } from 'lucide-react'
import { useQuickAddStore } from '@/store/quick-add-store'
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
import { HeaderActionGroup, MobileHeaderActions, ProfileMenu } from './header-actions'

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
      className="navbar-slide-in relative sticky top-0 z-40 flex w-full items-center overflow-hidden border-b border-sidebar-border/60 dark:border-sidebar-border/40 bg-sidebar lg:bg-sidebar/80 text-foreground lg:backdrop-blur-md"
    >
      <div className="relative z-10 flex items-center justify-between w-full px-4 h-12">
        {/* Left: Sidebar mobile trigger & logo */}
        <div className="flex items-center gap-3">
          <SidebarTrigger className="lg:hidden w-8 h-8" />
          <Link href="/dashboard" className="lg:hidden flex items-center">
            <Logo className="h-6 w-6" />
          </Link>
        </div>

        {/* Right: Account Selector + Filters + Template + Import + Notifications + Theme + Profile */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          <MobileHeaderActions onAccounts={() => setMobileAccountsOpen(true)} onFilters={() => setMobileFiltersOpen(true)} />

          {/* Account Selector */}
          <HeaderActionGroup className="hidden sm:flex">
          <Popover open={!isMobile && accountPopoverOpen} onOpenChange={setAccountPopoverOpen}>
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
          </HeaderActionGroup>

          {/* Template Selector - hidden on mobile */}
          <div className="hidden md:block">
            <TemplateSelector />
          </div>

          {/* Quick Add Trade - always visible on desktop */}
          <HeaderActionGroup className="hidden sm:flex">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => useQuickAddStore.getState().openQuickAdd()}
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
          </HeaderActionGroup>

          <ProfileMenu
            email={user?.email}
            displayName={displayName}
            avatarUrl={avatarUrl}
            initial={user?.email?.[0] || 'U'}
            isDemoMode={Boolean(isDemoMode)}
            open={profileMenuOpen}
            onOpenChange={setProfileMenuOpen}
            onLogout={handleLogout}
          />
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
