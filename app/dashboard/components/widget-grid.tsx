'use client'

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Responsive, verticalCompactor } from 'react-grid-layout'

function useGridContainerWidth(isMobile?: boolean) {
  const [width, setWidth] = useState(0)
  const [mounted, setMounted] = useState(false)
  const lastWidthRef = useRef(0)
  const observerRef = useRef<ResizeObserver | null>(null)
  const timersRef = useRef<NodeJS.Timeout[]>([])

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    // Cleanup previous observer and timers
    if (observerRef.current) {
      observerRef.current.disconnect()
      observerRef.current = null
    }
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []

    if (!node || isMobile) return

    const measure = () => {
      const w = node.offsetWidth
      if (w > 0 && w !== lastWidthRef.current) {
        lastWidthRef.current = w
        setWidth(w)
      }
      if (w > 0 && !mounted) setMounted(true)
    }

    // Immediate measurement
    requestAnimationFrame(measure)

    // Setup new observer
    observerRef.current = new ResizeObserver(() => {
      requestAnimationFrame(measure)
    })
    observerRef.current.observe(node)

    // Setup delayed passes for transitions
    timersRef.current = [300, 600, 1200].map((delay) =>
      setTimeout(() => {
        requestAnimationFrame(() => {
          measure()
          window.dispatchEvent(new Event('resize'))
        })
      }, delay)
    )
  }, [mounted, isMobile])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) observerRef.current.disconnect()
      timersRef.current.forEach(clearTimeout)
    }
  }, [])

  return { width, containerRef, mounted: isMobile ? true : mounted }
}
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { X, Plus, GripVertical } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { WIDGET_REGISTRY } from '../config/widget-registry-lazy'
import { useTemplateEditStore } from '@/store/template-edit-store'
import { useTemplates } from '@/context/template-provider'
import { useData } from '@/context/data-provider'
import { useAccounts } from '@/hooks/use-accounts'
import { cn } from '@/lib/utils'
import { cloneDefaultTemplateLayout } from '@/lib/dashboard/default-template-layout'
import type { WidgetLayout } from '@/server/dashboard-templates'
import type { WidgetType } from '../types/dashboard'
import WidgetLibraryDialog from './widget-library-dialog'
import KpiWidgetSelector from './kpi-widget-selector'
import { EmptyAccountState } from './empty-account-state'
import { EmptyTradeState } from './empty-trade-state'
import { TemplateAwareDashboardSkeleton } from '@/components/ui/dashboard-skeleton'
import { WidgetErrorBoundary } from './widget-wrapper'
import { WIDGET_GRID_DEFAULTS } from '../config/widget-dimensions'
import { buildResponsiveDashboardLayouts } from '@/lib/dashboard/responsive-layouts'
import { getMobileWidgetHeight, isContentSizedMobileWidget } from '@/lib/dashboard/mobile-widget-layout'
import { toast } from 'sonner'
import { useDashboardPropFirmAccount } from '@/hooks/use-dashboard-prop-firm-account'
import { getPropFirmCacheKey, usePropFirmStore } from '@/hooks/use-prop-firm-dashboard-widget-data'

import 'react-grid-layout/css/styles.css'

const GRID_COLS = 12
const ROW_HEIGHT = 80
const GRID_MARGIN: [number, number] = [12, 12]

const generateWidgetId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `widget-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const isKpiRowWidget = (widget: WidgetLayout) => widget.y === 0 && widget.h === 1

function LazyMobileWidget({ children, minHeight, height, isEditMode }: { children: React.ReactNode; minHeight?: number; height?: number; isEditMode: boolean }) {
  const [isIntersecting, setIsIntersecting] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isEditMode) {
      setIsIntersecting(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsIntersecting(true)
          observer.disconnect()
        }
      },
      {
        rootMargin: '200px',
      }
    )

    const el = ref.current
    if (el) {
      observer.observe(el)
    }

    return () => {
      observer.disconnect()
    }
  }, [isEditMode])

  return (
    <div
      ref={ref}
      style={{ height, minHeight }}
      className={cn('w-full flex flex-col', height ? 'h-full' : 'h-auto')}
    >
      {isIntersecting ? (
        children
      ) : (
        <div 
          className="w-full flex-1 bg-muted/10 animate-pulse rounded-xl border border-border/40" 
          style={{ minHeight: height || minHeight }}
        />
      )}
    </div>
  )
}

interface WidgetGridProps {
  className?: string
}

export default function WidgetGrid({ className }: WidgetGridProps) {
  const isMobile = useIsMobile()
  const { isEditMode, currentLayout, updateLayout } = useTemplateEditStore()
  const { activeTemplate, isLoading } = useTemplates()
  const { accountNumbers, formattedTrades, isLoadingAccountFilterSettings, accountFilterSettings, accounts: contextAccounts } = useData()
  const [showWidgetLibrary, setShowWidgetLibrary] = useState(false)
  const [showKpiSelector, setShowKpiSelector] = useState(false)
  const { width: containerWidth, containerRef: gridContainerRef, mounted: gridMounted } = useGridContainerWidth(isMobile)

  // Use current layout if in edit mode, otherwise use active template
  const layout = useMemo(
    () => (isEditMode && currentLayout ? currentLayout : activeTemplate?.layout ?? []),
    [isEditMode, currentLayout, activeTemplate?.layout]
  )

  const hasPropFirmWidget = useMemo(() => {
    return layout.some(w => w.type.startsWith('propFirm'))
  }, [layout])

  // Track initial mount and load state for active prop-firm challenge
  const propFirmAccount = useDashboardPropFirmAccount()
  const activePropFirmId = propFirmAccount.selectedMasterAccountId
  const activePropFirmCacheKey = getPropFirmCacheKey(activePropFirmId, propFirmAccount.resetTimezone)
  const propFirmCache = usePropFirmStore(state => state.cache[activePropFirmCacheKey])
  const fetchPropFirmData = usePropFirmStore(state => state.fetchData)

  // Trigger fetch early if we have prop firm widgets so the dashboard skeleton can wait for it
  useEffect(() => {
    if (hasPropFirmWidget && activePropFirmId) {
      fetchPropFirmData(activePropFirmId, propFirmAccount.resetTimezone)
    }
  }, [hasPropFirmWidget, activePropFirmId, propFirmAccount.resetTimezone, fetchPropFirmData])

  const isPropFirmLoading = (hasPropFirmWidget && activePropFirmId)
    ? (propFirmAccount.isLoading || !propFirmCache || propFirmCache.isLoading)
    : false

  const [hasMountedOnce, setHasMountedOnce] = useState(false)
  useEffect(() => {
    const gridReady = isMobile ? true : (gridMounted && containerWidth > 0)
    if (!isLoading && !isPropFirmLoading && gridReady && activeTemplate) {
      setHasMountedOnce(true)
    }
  }, [isLoading, isPropFirmLoading, isMobile, gridMounted, containerWidth, activeTemplate])
  const [targetSlot, setTargetSlot] = useState<{
    slotIndex?: number
    x?: number
    y?: number
  } | null>(null)

  // Ref to prevent layout save loops
  const isInternalUpdate = useRef(false)

  // Clear targetSlot when dialogs close
  useEffect(() => {
    if (!showWidgetLibrary && !showKpiSelector) {
      setTargetSlot(null)
    }
  }, [showWidgetLibrary, showKpiSelector])

  // Separate KPI widgets from other widgets
  const kpiWidgets = useMemo(() => {
    return layout
      .filter(isKpiRowWidget)
      .sort((a, b) => a.x - b.x)
      .slice(0, 5)
  }, [layout])

  // Fill KPI slots (always 5)
  const kpiLayout = useMemo(() => {
    return Array(5).fill(null).map((_, index) => {
      return kpiWidgets.find(w => w.x === index) || null
    }) as (WidgetLayout | null)[]
  }, [kpiWidgets])

  // Non-KPI widgets - these go in the react-grid-layout
  const gridWidgets = useMemo(() => {
    return layout.filter(w => !isKpiRowWidget(w))
  }, [layout])

  const gridLayouts = useMemo(
    () => buildResponsiveDashboardLayouts(layout as any, isEditMode),
    [layout, isEditMode]
  )

  // Handle layout change from react-grid-layout
  const handleLayoutChange = useCallback((newLayout: any[], allLayouts: Record<string, any[]>) => {
    if (!isEditMode || isInternalUpdate.current) return

    // Get the current breakpoint layout
    const updatedGridWidgets: WidgetLayout[] = newLayout.map(item => {
      const original = gridWidgets.find(w => w.i === item.i)
      return {
        i: item.i,
        type: original?.type || '',
        size: original?.size || 'medium',
        x: item.x,
        y: item.y + 1, // Shift back up for KPI row offset
        w: item.w,
        h: item.h,
      }
    })

    // Combine with KPI widgets
    const fullLayout = [...kpiWidgets, ...updatedGridWidgets]
    updateLayout(fullLayout)
  }, [isEditMode, gridWidgets, kpiWidgets, updateLayout])

  // Handle widget removal
  const handleRemoveWidget = useCallback((widgetId: string) => {
    if (!currentLayout) return
    const updatedLayout = currentLayout.filter(w => w.i !== widgetId)
    updateLayout(updatedLayout)
  }, [currentLayout, updateLayout])

  // Handle add widget
  const handleAddWidget = useCallback((slotInfo?: { slotIndex?: number; x?: number; y?: number }) => {
    setTargetSlot(slotInfo || null)
    if (slotInfo?.slotIndex !== undefined && slotInfo.slotIndex < 5) {
      setShowKpiSelector(true)
    } else {
      setShowWidgetLibrary(true)
    }
  }, [])

  // Handle widget insertion from library
  const handleInsertWidget = useCallback((widgetType: string) => {
    if (!currentLayout) return

    const config = WIDGET_REGISTRY[widgetType as keyof typeof WIDGET_REGISTRY]
    if (!config) return

    const slotToUse = targetSlot
    const defaults = WIDGET_GRID_DEFAULTS[widgetType as WidgetType] || WIDGET_GRID_DEFAULTS.default || { defaultW: 3, defaultH: 3 }

    let x = 0, y = 1, w = defaults.defaultW || 3, h = defaults.defaultH || 3

    if (config.kpiRowOnly && slotToUse?.slotIndex !== undefined) {
      x = slotToUse.slotIndex
      y = 0
      w = 1
      h = 1
    } else if (slotToUse?.x !== undefined && slotToUse?.y !== undefined) {
      x = slotToUse.x
      y = slotToUse.y
    } else {
      // Place at the bottom
      const maxY = currentLayout.reduce((max, widget) => {
        if (isKpiRowWidget(widget)) return max
        return Math.max(max, widget.y + widget.h)
      }, 1)
      y = maxY
      x = 0
    }

    const newWidget: WidgetLayout = {
      i: generateWidgetId(),
      type: widgetType,
      size: config.defaultSize,
      x,
      y,
      w,
      h,
    }

    isInternalUpdate.current = true
    updateLayout([...currentLayout, newWidget])
    setTargetSlot(null)
    setTimeout(() => {
      isInternalUpdate.current = false
      toast.success('Widget added successfully', { duration: 2000 })
    }, 0)
  }, [currentLayout, targetSlot, updateLayout])

  // Handle KPI widget selection
  const handleSelectKpiWidget = useCallback((widgetType: string) => {
    handleInsertWidget(widgetType)
  }, [handleInsertWidget])

  // Handle KPI drag reorder
  const handleKpiDragEnd = useCallback((dragIndex: number, dropIndex: number) => {
    if (!currentLayout || dragIndex === dropIndex) return

    const reorderedKpi = [...kpiWidgets]
    const [moved] = reorderedKpi.splice(dragIndex, 1)
    if (moved) {
      reorderedKpi.splice(dropIndex, 0, moved)
    }

    const updatedKpi = reorderedKpi.map((widget, index) => ({
      ...widget,
      x: index,
    }))

    const otherWidgets = currentLayout.filter(w => !isKpiRowWidget(w))
    updateLayout([...updatedKpi, ...otherWidgets])
  }, [currentLayout, kpiWidgets, updateLayout])

  // hasAccounts: true if the user has any accounts in context (already loaded) OR has trades
  // Use contextAccounts first, fall back to checking if trades exist (imported trades don't need a live broker)
  const hasAccounts = (contextAccounts && contextAccounts.length > 0) || formattedTrades.length > 0
  const settingsReady = !isLoadingAccountFilterSettings
  const hasNoSelectedAccounts = settingsReady
    && accountNumbers.length === 0
    && (!accountFilterSettings?.selectedPhaseAccountIds || accountFilterSettings.selectedPhaseAccountIds.length === 0)

  const showEmptyTradeState = !isEditMode && !isLoading && !hasAccounts
  const showEmptyAccountState = !isEditMode && !isLoading && settingsReady && hasAccounts && hasNoSelectedAccounts && !showEmptyTradeState

  if (showEmptyTradeState) {
    return <EmptyTradeState />
  }

  if (showEmptyAccountState) {
    return <EmptyAccountState />
  }

  // Whether the grid has finished its initial width measurement
  const gridReady = isMobile ? true : (gridMounted && containerWidth > 0)
  const shouldShowTemplateSkeleton = !hasMountedOnce && (isLoading || !activeTemplate || !gridReady || isPropFirmLoading)
  const skeletonLayout = layout.length > 0
    ? layout
    : ((activeTemplate?.layout?.length ? activeTemplate.layout : cloneDefaultTemplateLayout()) as WidgetLayout[])

  if (shouldShowTemplateSkeleton) {
    return (
      <div className={cn('px-2', className)} ref={gridContainerRef}>
        <TemplateAwareDashboardSkeleton
          layout={skeletonLayout.map(item => ({
            i: item.i,
            type: item.type,
            size: item.size,
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h,
          }))}
          layouts={buildResponsiveDashboardLayouts(skeletonLayout as any, false)}
        />
      </div>
    )
  }

  return (
    <div className={cn('space-y-3 lg:isolate', className)}>
      {/* KPI Row - mobile 1-up, tablet 2+2+1, narrow desktop 3+2, wide desktop 5-up */}
      <div className="px-3 sm:px-4 pt-3 sm:pt-4 kpi-row-container lg:isolate lg:relative lg:z-10">
        <div
          className={cn(
            'relative',
            isEditMode && 'border-2 border-dashed border-border/50 rounded-xl p-2'
          )}
        >
          <div className="grid grid-cols-1 min-[768px]:grid-cols-2 min-[1024px]:grid-cols-6 min-[1440px]:grid-cols-5 gap-2 sm:gap-3">
            {kpiLayout.map((widget, index) => {
              return (
              <div
                key={`kpi-slot-${index}`}
                className={cn(
                  "relative",
                  index === 4 && "min-[768px]:max-[1023px]:col-span-2",
                  index <= 2 && "min-[1024px]:max-[1439px]:col-span-2",
                  index >= 3 && "min-[1024px]:max-[1439px]:col-span-3"
                )}
              >
                {widget ? (
                  <div className="relative group h-full">
                    {/* Edit mode controls */}
                    {isEditMode && (
                      <>
                        <div className="absolute top-2 left-2 cursor-move z-10 bg-background/80 backdrop-blur-sm rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          aria-label={`Remove ${widget.type} widget`}
                          className="absolute top-2 right-2 h-6 w-6 rounded-full p-0 shadow-md z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleRemoveWidget(widget.i)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                    {WIDGET_REGISTRY[widget.type as WidgetType]?.getComponent({ size: 'kpi' as any })}
                  </div>
                ) : (
                  isEditMode && (
                    <Card
                      className="h-24 border-2 border-dashed border-border/50 bg-muted/20 hover:bg-muted/40 cursor-pointer transition-all hover:border-primary/30"
                      onClick={() => handleAddWidget({ slotIndex: index })}
                    >
                      <CardContent className="h-full flex flex-col items-center justify-center p-4">
                        <Plus className="h-5 w-5 text-muted-foreground mb-1.5" />
                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                          Add KPI
                        </span>
                      </CardContent>
                    </Card>
                  )
              )}
            </div>
          )})}
          
          </div>
        </div>
      </div>

      {/* Main Grid - react-grid-layout */}
      {/* The ref div MUST always be in the DOM so ResizeObserver can measure width */}
      <div className="px-2 lg:isolate" ref={gridContainerRef} data-tour="widget-canvas">
        {isMobile ? (
          /* ----------------------------------------------------------------
           * MOBILE RENDERING PATH - GPU-SAFE
           *
           * Flat DOM: no nested flex containers, no stacking contexts,
           * no relative/z-index, no group hover, no transition-all.
           * Each wrapper is a plain block div. Off-screen widgets are
           * skipped by content-visibility: auto (set in globals.css).
           * ---------------------------------------------------------------- */
          <div className="pb-4 space-y-3">
            {gridWidgets.map(widget => {
              const config = WIDGET_REGISTRY[widget.type as WidgetType]
              if (!config) return null

              const isChart = (config.category === 'charts' && widget.type !== 'performanceSummary') || widget.type.startsWith('calendar')
              const mobileHeight = getMobileWidgetHeight(widget.type, isChart, config.previewHeight)
              const isContentSized = isContentSizedMobileWidget(widget.type)
              const minHeight = mobileHeight

              return (
                <div
                  key={`mobile-${widget.i}`}
                  className={cn('widget-wrapper flex-shrink-0', isEditMode && 'relative rounded-2xl ring-1 ring-border/30 ring-inset')}
                  style={{ height: isContentSized ? undefined : mobileHeight, minHeight }}
                >
                  {isEditMode && (
                    <Button
                      variant="destructive"
                      size="sm"
                      aria-label={`Remove ${widget.type} widget`}
                      className="absolute top-2 right-2 h-6 w-6 rounded-full p-0 shadow-md z-10"
                      onClick={() => handleRemoveWidget(widget.i)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                  <LazyMobileWidget height={mobileHeight} minHeight={minHeight} isEditMode={isEditMode}>
                    {config.getComponent({ size: widget.size as any })}
                  </LazyMobileWidget>
                </div>
              )
            })}
          </div>
        ) : (
          <Responsive
            width={containerWidth}
            layouts={gridLayouts}
            breakpoints={{ wide: 1440, narrow: 1024, tablet: 768, mobile: 0 }}
            cols={{ wide: GRID_COLS, narrow: GRID_COLS, tablet: 6, mobile: 1 }}
            rowHeight={ROW_HEIGHT}
            margin={GRID_MARGIN}
            containerPadding={[8, 8]}
            isDraggable={isEditMode && containerWidth >= 768}
            isResizable={isEditMode && containerWidth >= 768}
            draggableHandle=".widget-drag-handle"
            resizeHandles={['s', 'w', 'e', 'n', 'sw', 'nw', 'se', 'ne']}
            compactor={verticalCompactor}
            onLayoutChange={handleLayoutChange as any}
            {...({} as any)}
          >
          {gridWidgets.map(widget => {
            const config = WIDGET_REGISTRY[widget.type as WidgetType]
            if (!config) return null

            return (
              <div key={widget.i} data-is-chart={config.category === 'charts'} className={cn("group", isEditMode && "ring-1 ring-border/30 ring-inset rounded-2xl hover:ring-primary/40 transition-all")}>
                <div className="relative h-full w-full">
                  {/* Edit mode overlay controls */}
                  {isEditMode && (
                    <>
                      <div className="widget-drag-handle absolute top-2 left-2 cursor-grab active:cursor-grabbing z-10 bg-background/80 backdrop-blur-sm rounded-md p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm border border-border/50">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        aria-label={`Remove ${widget.type} widget`}
                        className="absolute top-2 right-2 h-6 w-6 rounded-full p-0 shadow-md z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleRemoveWidget(widget.i)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                      {/* Resize hint indicator - bottom right */}
                      <div className="absolute bottom-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <div className="flex items-center gap-1 bg-background/80 backdrop-blur-sm rounded px-1.5 py-0.5 border border-border/50 shadow-sm">
                          <svg className="w-3 h-3 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                          </svg>
                          <span className="text-[9px] font-bold text-muted-foreground uppercase">Resize</span>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Widget content */}
                  <div className="h-full w-full overflow-hidden">
                    <WidgetErrorBoundary widgetId={widget.i} title={config.type}>
                      {config.getComponent({ size: widget.size as any })}
                    </WidgetErrorBoundary>
                  </div>
                </div>
              </div>
            )
          })}
          </Responsive>
        )}
      </div>

      {/* Add new widget button at bottom in edit mode */}
      {isEditMode && (
        <div className="px-4 pb-4">
          <Card
            className="h-24 border-2 border-dashed border-border/50 bg-muted/20 hover:bg-muted/40 cursor-pointer transition-all hover:border-primary/30"
            onClick={() => handleAddWidget()}
          >
            <CardContent className="h-full flex flex-col items-center justify-center p-4">
              <Plus className="h-6 w-6 text-muted-foreground mb-1.5" />
              <span className="text-xs font-bold text-muted-foreground">
                Add Widget
              </span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Widget Library Dialog */}
      <WidgetLibraryDialog
        open={showWidgetLibrary}
        onOpenChange={setShowWidgetLibrary}
        currentLayout={currentLayout || []}
        onInsertWidget={handleInsertWidget}
      />

      {/* KPI Widget Selector */}
      <KpiWidgetSelector
        open={showKpiSelector}
        onOpenChange={setShowKpiSelector}
        currentLayout={currentLayout || []}
        onSelectWidget={handleSelectKpiWidget}
      />
    </div>
  )
}
