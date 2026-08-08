'use client'

import { useEffect, useMemo, useState } from 'react'

import { HugeiconsIcon } from '@hugeicons/react'
import { useDashboardShellActionGroups } from '@/components/dashboard-shell-actions'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false)
  const actionGroups = useDashboardShellActionGroups()

  const flatActions = useMemo(
    () => actionGroups.flatMap((group) => group.items.map((item) => item.id)),
    [actionGroups]
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setIsOpen((open) => !open)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <CommandDialog open={isOpen} onOpenChange={setIsOpen}>
      <CommandInput autoFocus placeholder="Search pages and actions..." />
      <CommandList className="max-h-[min(70dvh,30rem)]">
        <CommandEmpty>No matching pages or actions.</CommandEmpty>
        {actionGroups.map((group, index) => (
          <div key={group.id}>
            {index > 0 && <CommandSeparator />}
            <CommandGroup heading={group.heading}>
              {group.items.map((item) => {
                const Icon = item.icon

                return (
                  <CommandItem
                    key={item.id}
                    value={[item.title, item.description, ...item.keywords].join(' ')}
                    onSelect={() => {
                      item.perform()
                      setIsOpen(false)
                    }}
                    className="flex items-center gap-3 rounded-lg px-3 py-3"
                  >
                    <HugeiconsIcon icon={Icon} className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} color="currentColor" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{item.title}</div>
                      <div className="truncate text-xs text-muted-foreground">{item.description}</div>
                    </div>
                    {item.id === 'add-trade' && <CommandShortcut>New</CommandShortcut>}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
      <div className="border-t px-3 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px]">↑↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px]">↵</kbd>
            select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px]">esc</kbd>
            close
          </span>
          {flatActions.length > 0 && (
            <span className="ml-auto hidden sm:inline">{flatActions.length} actions</span>
          )}
        </div>
      </div>
    </CommandDialog>
  )
}
