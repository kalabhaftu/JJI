'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tag, Plus, X, Settings as SettingsIcon } from 'lucide-react'
import { TagManager } from './tag-manager'
import { cn } from '@/lib/utils'
import { useTags } from '@/hooks/use-tags'

interface TagSelectorProps {
  selectedTagIds: string[]
  onChange: (tagIds: string[]) => void
  className?: string
}

export function TagSelector({ selectedTagIds, onChange, className }: TagSelectorProps) {
  const { tags, isLoading } = useTags()
  const [showManager, setShowManager] = useState(false)
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)

  const handleToggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId))
    } else {
      onChange([...selectedTagIds, tagId])
    }
  }

  const handleRemoveTag = (tagId: string) => {
    onChange(selectedTagIds.filter((id) => id !== tagId))
  }

  const selectedTags = tags.filter((tag) => selectedTagIds.includes(tag.id))

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2 flex-wrap">
        {selectedTags.map((tag) => (
          <Badge
            key={tag.id}
            style={{
              '--tag-bg': tag.color,
              backgroundColor: 'var(--tag-bg)',
              color: 'white',
            } as React.CSSProperties}
            className="text-xs gap-1 pr-1"
          >
            {tag.name}
            <button
              onClick={() => handleRemoveTag(tag.id)}
              className="ml-1 hover:bg-black/20 rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}

        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 gap-1">
              <Plus className="h-3 w-3" />
              <span className="text-xs">Add Tag</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[min(18rem,calc(100vw-1rem))] p-3" align="start" side="bottom">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold flex items-center gap-1">
                  <Tag className="h-4 w-4" />
                  Select Tags
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => {
                    setShowManager(true)
                    setIsPopoverOpen(false)
                  }}
                >
                  <SettingsIcon className="h-3 w-3" />
                  Manage
                </Button>
              </div>

              {isLoading ? (
                <div className="text-xs text-muted-foreground text-center py-4">
                  Loading tags...
                </div>
              ) : tags.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4">
                  No tags available. Create one first!
                </div>
              ) : (
                <ScrollArea className="max-h-[200px]">
                  <div className="space-y-2">
                    {tags.map((tag) => (
                      <label
                        key={tag.id}
                        className="flex items-center gap-2 p-1.5 rounded hover:bg-accent/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedTagIds.includes(tag.id)}
                          onCheckedChange={() => handleToggleTag(tag.id)}
                        />
                        <Badge
                          style={{
                            '--tag-bg': tag.color,
                            backgroundColor: 'var(--tag-bg)',
                            color: 'white',
                          } as React.CSSProperties}
                          className="text-xs"
                        >
                          {tag.name}
                        </Badge>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <TagManager
        isOpen={showManager}
        onClose={() => setShowManager(false)}
      />
    </div>
  )
}
