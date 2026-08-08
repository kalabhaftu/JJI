'use client'

import React, { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { HugeiconsIcon } from '@hugeicons/react'
import { Search01Icon, Cancel01Icon } from '@hugeicons/core-free-icons'
import { WIDGET_REGISTRY } from '../config/widget-registry-lazy'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { WidgetLayout } from '@/lib/dashboard/template-types'

interface KpiWidgetSelectorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentLayout: WidgetLayout[]
  onSelectWidget: (widgetType: string) => void
}

export default function KpiWidgetSelector({
  open,
  onOpenChange,
  currentLayout,
  onSelectWidget,
}: KpiWidgetSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('')


  const kpiWidgets = useMemo(() => {
    const query = searchQuery.toLowerCase()
    return Object.entries(WIDGET_REGISTRY).filter(([type, config]) => {

      if (!config.kpiRowOnly) {
        return false
      }
      
      const nameMatch = type.toLowerCase().includes(query)
      const categoryMatch = config.category?.toLowerCase().includes(query)
      return nameMatch || categoryMatch
    })
  }, [searchQuery])


  const usedKpiTypes = useMemo(() => {
    return new Set(
      currentLayout
        .filter(w => w.y === 0 && w.x < 5)
        .map(w => w.type)
    )
  }, [currentLayout])

  const handleSelect = (widgetType: string) => {
    onSelectWidget(widgetType)
    onOpenChange(false)
  }

  const formatWidgetName = (type: string) => {

    return type
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Select KPI Widget</DialogTitle>
          <DialogDescription>
            Choose a KPI widget to add to this slot
          </DialogDescription>
        </DialogHeader>

        {}
        <div className="relative">
          <HugeiconsIcon icon={Search01Icon} className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} color="currentColor" />
          <Input
            placeholder="Search KPI widgets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <Button
              variant="tertiary"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => setSearchQuery('')}
            >
              <HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3" strokeWidth={1.5} color="currentColor" />
            </Button>
          )}
        </div>

        {}
        <div className="flex-1 overflow-y-auto">
          {kpiWidgets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No KPI widgets found matching &quot;{searchQuery}&quot;
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {kpiWidgets.map(([type, config]) => {
                const isUsed = usedKpiTypes.has(type)
                
                return (
                  <Card
                    key={type}
                    className={cn(
                      "transition-colors",
                      isUsed && "opacity-60"
                    )}
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">
                            {formatWidgetName(type)}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {config.description || 'No description available'}
                          </p>
                        </div>
                      </div>
                      
                      <Button
                        size="sm"
                        className="w-full"
                        disabled={isUsed}
                        onClick={() => handleSelect(type)}
                      >
                        {isUsed ? 'Already in use' : 'Select'}
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        {}
        <div className="flex justify-end pt-4 border-t">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
