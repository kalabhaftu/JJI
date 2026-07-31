'use client'

import React, { useEffect, useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, X } from "lucide-react"
import { WIDGET_REGISTRY } from '../config/widget-registry-lazy'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { WidgetLayout } from '@/server/dashboard-templates'
import { WIDGET_DIMENSIONS } from '../config/widget-dimensions'

interface WidgetLibraryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentLayout: WidgetLayout[]
  onInsertWidget: (widgetType: string) => void
}

export default function WidgetLibraryDialog({
  open,
  onOpenChange,
  currentLayout,
  onInsertWidget,
}: WidgetLibraryDialogProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [catalog, setCatalog] = useState<Record<string, any>>({})

  useEffect(() => {
    if (!open) return
    fetch('/api/v1/dashboard/widget-catalog')
      .then((response) => response.json())
      .then((payload) => {
        if (payload.success && Array.isArray(payload.data)) {
          setCatalog(Object.fromEntries(payload.data.map((item: any) => [item.widgetType, item])))
        }
      })
      .catch(() => setCatalog({}))
  }, [open])

  // Get list of widget types already in use
  const usedWidgetTypes = useMemo(() => {
    return new Set(currentLayout.map(w => w.type))
  }, [currentLayout])

  // Filter widgets by search query and exclude KPI-only widgets from general library
  const filteredWidgets = useMemo(() => {
    const query = searchQuery.toLowerCase()
    return Object.entries(WIDGET_REGISTRY).filter(([type, config]) => {
      // Exclude KPI-only widgets - they can only be added/swapped in the 5 KPI slots
      if (config.kpiRowOnly || config.hiddenFromLibrary) {
        return false
      }
      const adminSetting = catalog[type]
      if (adminSetting && (adminSetting.visible === false || adminSetting.deprecated === true)) {
        return false
      }

      const label = adminSetting?.label || type
      const description = adminSetting?.description || config.description || ''
      const nameMatch = `${type} ${label}`.toLowerCase().includes(query)
      const categoryMatch = config.category?.toLowerCase().includes(query)
      const descriptionMatch = description.toLowerCase().includes(query)
      return nameMatch || categoryMatch || descriptionMatch
    })
  }, [searchQuery, catalog])

  // Group by category
  const widgetsByCategory = useMemo(() => {
    const grouped: Record<string, Array<[string, typeof WIDGET_REGISTRY[keyof typeof WIDGET_REGISTRY]]>> = {}

    filteredWidgets.forEach(([type, config]) => {
      const category = config.category || 'other'
      if (!grouped[category]) {
        grouped[category] = []
      }
      grouped[category].push([type, config])
    })

    return grouped
  }, [filteredWidgets])

  const handleInsert = (widgetType: string) => {
    onInsertWidget(widgetType)
    onOpenChange(false)
  }

  const formatWidgetName = (type: string) => {
    // Convert camelCase to Title Case
    return type
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim()
  }

  const formatWidgetSize = (type: string) => {
    const config = WIDGET_REGISTRY[type as keyof typeof WIDGET_REGISTRY]
    if (!config) return ''

    const dims = WIDGET_DIMENSIONS[config.defaultSize]
    const cols = dims.colSpan

    if (cols === 12) return 'Full Width (12 cols)'
    if (cols === 8) return 'Large (8 cols)'
    if (cols === 6) return 'Medium (6 cols)'
    if (cols === 4) return 'Small (4 cols)'
    if (cols === 3) return 'Tiny (3 cols)'
    return `${cols} columns`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Chart Library</DialogTitle>
          <DialogDescription>
            Insert widgets to the dashboard
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search widgets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => setSearchQuery('')}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Widget List */}
        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {Object.keys(widgetsByCategory).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No widgets found matching &quot;{searchQuery}&quot;
            </div>
          ) : (
            Object.entries(widgetsByCategory).map(([category, widgets]) => (
              <div key={category} className="space-y-3">
                <h3 className="text-sm font-semibold capitalize sticky top-0 bg-background py-2">
                  {category}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {widgets.map(([type, config]) => {
                    const isUsed = usedWidgetTypes.has(type)

                    return (
                      <Card
                        key={type}
                        className={cn(
                          "hover:bg-muted/50 transition-colors",
                          isUsed && "opacity-60"
                        )}
                      >
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm truncate">
                                {catalog[type]?.label || formatWidgetName(type)}
                              </h4>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {catalog[type]?.description || config.description || 'No description available'}
                              </p>
                              <p className="text-xs text-primary/70 mt-1 font-medium">
                                {formatWidgetSize(type)}
                              </p>
                            </div>
                          </div>

                          <Button
                            size="sm"
                            className="w-full"
                            onClick={() => handleInsert(type)}
                            disabled={isUsed}
                          >
                            {isUsed ? 'Already Added' : 'Insert to dashboard'}
                          </Button>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
