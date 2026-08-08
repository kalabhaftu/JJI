'use client'

import { Badge } from "@/components/ui/badge"
import { CommandItem } from "@/components/ui/command"
import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import { Alert02Icon } from "@hugeicons/core-free-icons"
import Image from "next/image"
import { PlatformConfig } from "../config/platforms"
interface PlatformItemProps {
  platform: PlatformConfig
  isSelected: boolean
  onSelect: (type: string) => void
  onHover: (category: string) => void
  onLeave: () => void
  isWeekend: boolean
}

export function PlatformItem({
  platform,
  isSelected,
  onSelect,
  onHover,
  onLeave,
  isWeekend
}: PlatformItemProps) {
  return (
    <div className={cn(
      (platform.isDisabled || platform.isComingSoon) && "cursor-not-allowed"
    )}>
      <CommandItem
        onSelect={() => !platform.isDisabled && onSelect(platform.type)}
        onMouseEnter={() => onHover(platform.category)}
        onMouseLeave={onLeave}
        data-tour={`platform-item-${platform.type}`}
        className={cn(
          "flex items-center gap-4 p-3.5 my-1.5 ml-4 mr-2 rounded-xl transition-all duration-200 border",
          platform.isDisabled && "opacity-40 select-none pointer-events-none",
          !platform.isDisabled && "cursor-pointer",
          isSelected 
            ? "border-primary/40 bg-primary/5 shadow-md shadow-primary/5 scale-[1.01] translate-x-0.5" 
            : "border-border/40 bg-card/40 backdrop-blur-sm hover:border-primary/20 hover:bg-muted/30 hover:translate-x-0.5"
        )}
        disabled={Boolean(platform.isDisabled || platform.isComingSoon)}
      >
        <div className="flex items-center justify-center h-10 w-10 bg-background/80 rounded-xl border border-border/50 shadow-sm p-1.5 shrink-0 transition-transform duration-200 group-hover:scale-105">
          {platform.logo.path && (
            <Image
              src={platform.logo.path}
              alt={platform.logo.alt || ''}
              width={28}
              height={28}
              className="object-contain rounded-md"
            />
          )}
          {platform.logo.component && (
            <div className="text-foreground/80">
              <platform.logo.component />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm flex flex-wrap items-center gap-1.5 text-foreground/90">
            {platform.name}
            {platform.isDisabled && (
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] bg-muted text-muted-foreground border-none">
                Disabled
              </Badge>
            )}
            {platform.isComingSoon && !platform.isDisabled && (
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] bg-muted/80 text-foreground border-none">
                Coming Soon
              </Badge>
            )}
            {!platform.isDisabled && platform.isRithmic && isWeekend && (
              <Badge variant="outline" className="px-1.5 py-0 text-[10px] border-warning/30 bg-warning/5 text-warning/90 gap-1">
                <HugeiconsIcon icon={Alert02Icon} className="h-2.5 w-2.5" strokeWidth={2} color="currentColor" />
                Weekend
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            {platform.description}
          </div>
        </div>
      </CommandItem>
    </div>
  )
} 