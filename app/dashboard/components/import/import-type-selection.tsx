'use client'

import React, { useEffect, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link02Icon, File01Icon, DatabaseIcon } from '@hugeicons/core-free-icons'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
} from "@/components/ui/command"
import { ScrollArea } from "@/components/ui/scroll-area"
import { platforms, PlatformConfig, PlatformType } from './config/platforms'
import { PlatformItem } from './components/platform-item'
import { PlatformTutorial } from './components/platform-tutorial'
import { cn } from '@/lib/utils'

export type ImportType = PlatformType

interface ImportTypeSelectionProps {
  selectedType: ImportType
  setSelectedType: React.Dispatch<React.SetStateAction<ImportType>>
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>
}

const categoryIcons: Record<PlatformConfig['category'], React.ReactNode> = {
  'Direct Account Sync': <HugeiconsIcon icon={Link02Icon} className="h-4 w-4" strokeWidth={1.5} color="currentColor" />,
  'Intelligent Import': <HugeiconsIcon icon={File01Icon} className="h-4 w-4" strokeWidth={1.5} color="currentColor" />,
  'Platform CSV Import': <HugeiconsIcon icon={DatabaseIcon} className="h-4 w-4" strokeWidth={1.5} color="currentColor" />
}

function isWeekend() {
  const day = new Date().getDay()
  return day === 0 || day === 6
}

export default function ImportTypeSelection({ selectedType, setSelectedType, setIsOpen }: ImportTypeSelectionProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [hoveredCategory, setHoveredCategory] = useState<PlatformConfig['category'] | null>(null)
  

  const selectedPlatform = platforms.find(p => p.type === selectedType)
  

  if (selectedType && selectedPlatform?.customComponent) {
    const CustomComponent = selectedPlatform.customComponent
    return (
      <div className="h-full">
        <CustomComponent setIsOpen={setIsOpen} />
      </div>
    )
  }

  const getTranslatedCategory = (category: PlatformConfig['category']) => {
    switch (category) {
      case 'Direct Account Sync':
        return 'Direct Account Sync'
      case 'Intelligent Import':
        return 'Intelligent Import'
      case 'Platform CSV Import':
        return 'Platform CSV Import'
      default:
        return category
    }
  }

  const filteredPlatforms = platforms.filter(platform => 
    platform.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    platform.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    getTranslatedCategory(platform.category).toLowerCase().includes(searchQuery.toLowerCase())
  )

  const categories = Array.from(new Set(filteredPlatforms.map(platform => platform.category)))

  return (
    <div className="flex flex-col h-full">
      <div className="grid md:grid-cols-2 gap-6 h-full min-h-0 p-1">
        {}
        <div className="h-full min-h-0">
          <div className="border border-border/40 bg-card/45 rounded-2xl h-full shadow-sm overflow-hidden flex flex-col">
            <Command className="bg-transparent h-full flex flex-col">
              <div className="border-b border-border/60 bg-muted/20 shrink-0">
                <CommandInput
                  className="h-12 bg-transparent"
                  placeholder="Search platforms..."
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                />
              </div>
              <ScrollArea className="flex-1">
                <CommandList className="h-full py-2">
                  <CommandEmpty className="py-8 text-center text-xs text-muted-foreground">
                    No platforms found
                  </CommandEmpty>
                  {categories.map(category => {
                    const categoryPlatforms = filteredPlatforms.filter(platform => platform.category === category)
                    if (categoryPlatforms.length === 0) return null

                    return (
                      <CommandGroup
                        key={category}
                        heading={
                          <div className={cn(
                            "flex items-center gap-2 text-muted-foreground/75 font-bold uppercase tracking-wider text-[10px] transition-all duration-200 px-1 py-1.5",
                            hoveredCategory === category ? "text-foreground scale-[1.01] translate-x-0.5" : ""
                          )}
                          style={{ contentVisibility: 'auto' }}
                        >
                          {categoryIcons[category]}
                          <span>{getTranslatedCategory(category)}</span>
                        </div>
                      }>
                        {categoryPlatforms.map((platform) => (
                          <PlatformItem
                            key={platform.type}
                            platform={platform}
                            isSelected={selectedType === platform.type}
                            onSelect={(type) => setSelectedType(type as ImportType)}
                            onHover={(category) => setHoveredCategory(category as PlatformConfig['category'])}
                            onLeave={() => setHoveredCategory(null)}
                            isWeekend={isWeekend()}
                          />
                        ))}
                      </CommandGroup>
                    )
                  })}
                </CommandList>
              </ScrollArea>
            </Command>
          </div>
        </div>

        {}
        <div className="h-full min-h-0">
          {selectedType !== '' && selectedPlatform && !selectedPlatform.customComponent ? (
            <div className="h-full overflow-y-auto bg-card/45 border border-border/40 rounded-2xl p-6 shadow-sm">
              <PlatformTutorial selectedPlatform={selectedPlatform} setIsOpen={setIsOpen} />
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-card/45 border border-border/40 rounded-2xl shadow-sm">
              <div className="relative mb-4">
                <HugeiconsIcon icon={File01Icon} className="h-12 w-12 text-muted-foreground/60" strokeWidth={1.5} color="currentColor" />
                <div className="absolute -inset-2 bg-primary/5 rounded-full blur-md" />
              </div>
              <h3 className="font-semibold text-foreground/80 text-sm mb-1">No Platform Selected</h3>
              <p className="text-xs text-muted-foreground max-w-[240px] leading-relaxed">
                Choose an import source from the list on the left to view instructions and start syncing your trades.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
