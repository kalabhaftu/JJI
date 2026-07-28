import type { ReactNode } from "react"
import Link from "next/link"
import { LogOut, Settings, SlidersHorizontal, Wallet } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { DashboardDisplayModeSelector } from "./navbar-display-mode"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { usePublicSurfaceRouting } from "@/hooks/use-public-surface-routing"
import { cn } from "@/lib/utils"

export function HeaderActionGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex items-center gap-1 rounded-lg border border-sidebar-border/40 bg-sidebar/50 p-0.5", className)}>{children}</div>
}

export function MobileHeaderActions({ onAccounts, onFilters }: { onAccounts: () => void; onFilters: () => void }) {
  return <HeaderActionGroup className="sm:hidden">
    <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:bg-muted/40 hover:text-foreground" onClick={onAccounts} aria-label="Select accounts"><Wallet className="h-4 w-4" /></Button>
    <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:bg-muted/40 hover:text-foreground" onClick={onFilters} aria-label="Open filters"><SlidersHorizontal className="h-4 w-4" /></Button>
  </HeaderActionGroup>
}

type ProfileMenuProps = {
  email?: string
  displayName: string
  avatarUrl?: string | undefined
  initial: string
  isDemoMode: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onLogout: () => void | Promise<void>
}

export function ProfileMenu({ email, displayName, avatarUrl, initial, isDemoMode, open, onOpenChange, onLogout }: ProfileMenuProps) {
  const { demoRouteHref } = usePublicSurfaceRouting()
  const settingsHref = isDemoMode ? demoRouteHref('/dashboard/settings', true) : '/dashboard/settings'

  return <DropdownMenu open={open} onOpenChange={onOpenChange}>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" className="relative size-8 rounded-full p-0" aria-label="Open profile menu">
        <Avatar className="size-8"><AvatarImage src={avatarUrl} referrerPolicy="no-referrer" /><AvatarFallback className="bg-muted text-xs font-medium uppercase text-foreground">{initial}</AvatarFallback></Avatar>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent className="w-[min(14rem,calc(100vw-1rem))]" align="end" sideOffset={8}>
      <div className="flex items-center gap-3 p-3">
        <Avatar className="size-9"><AvatarImage src={avatarUrl} referrerPolicy="no-referrer" /><AvatarFallback className="bg-muted text-xs font-medium uppercase text-foreground">{initial}</AvatarFallback></Avatar>
        <div className="flex min-w-0 flex-col gap-0.5 leading-none"><p className="max-w-[160px] truncate text-sm font-semibold">{displayName}</p><p className="max-w-[160px] truncate text-xs text-muted-foreground">{email || ''}</p></div>
      </div>
      <DropdownMenuSeparator />
      <div className="flex items-center justify-between px-2 py-1.5 sm:hidden"><span className="text-sm">View</span><DashboardDisplayModeSelector mobile /></div>
      <DropdownMenuItem asChild><Link href={settingsHref} className="cursor-pointer" onClick={() => onOpenChange(false)}><Settings className="mr-2 size-4" />Settings</Link></DropdownMenuItem>
      <div className="flex items-center justify-between px-2 py-1.5 sm:hidden"><span className="text-sm">Theme</span><ThemeSwitcher /></div>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onLogout} className="cursor-pointer text-destructive focus:text-destructive"><LogOut className="mr-2 size-4" />Log Out</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
}
