'use client'

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Responsive, verticalCompactor } from 'react-grid-layout'
import { useGridContainerWidth } from '@/hooks/use-grid-container-width'
import { LazyMobileWidget } from './lazy-mobile-widget'
import { Button } from '@/components/ui/button'
import { X, Plus, GripVertical } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { WIDGET_REGISTRY } from '../config/widget-registry-lazy'
import { useTemplateEditStore } from '@/store/template-edit-store'
import { useTemplates } from '@/context/template-provider'
import { useData } from '@/context/data-provider'
import { cn } from '@/lib/utils'
import { cloneDefaultTemplateLayout } from '@/lib/dashboard/default-template-layout'
import type { WidgetLayout } from '@/lib/dashboard/template-types'
import type { WidgetType } from '../types/dashboard'
import WidgetLibraryDialog from './widget-library-dialog'
import KpiWidgetSelector from './kpi-widget-selector'
import { EmptyAccountState } from './empty-account-state'
import { EmptyTradeState } from './empty-trade-state'
import { TemplateAwareDashboardSkeleton } from '@/components/ui/dashboard-skeleton'
import { WidgetErrorBoundary } from './widget-wrapper'
import { WIDGET_GRID_DEFAULTS } from '../config/widget-dimensions'
import { buildResponsiveDashboardLayouts } from '@/lib/dashboard/responsive-layouts'
import { getMobileWidgetHeight, getWidgetSurfaceContract } from '@/lib/dashboard/mobile-widget-layout'
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


  const layout = useMemo(
    () => (isEditMode && currentLayout ? currentLayout : activeTemplate?.layout ?? []),
    [isEditMode, currentLayout, activeTemplate?.layout]
  )

  const hasPropFirmWidget = useMemo(() => {
    return layout.some(w => w.type.startsWith('propFirm'))
  }, [layout])


  const propFirmAccount = useDashboardPropFirmAccount()
  const activePropFirmId = propFirmAccount.selectedMasterAccountId
  const activePropFirmCacheKey = getPropFirmCacheKey(activePropFirmId, propFirmAccount.resetTimezone)
  const propFirmCache = usePropFirmStore(state => state.cache[activePropFirmCacheKey])
  const fetchPropFirmData = usePropFirmStore(state => state.fetchData)


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


  const isInternalUpdate = useRef(false)


  useEffect(() => {
    if (!showWidgetLibrary && !showKpiSelector) {
      setTargetSlot(null)
    }
  }, [showWidgetLibrary, showKpiSelector])


  const kpiWidgets = useMemo(() => {
    return layout
      .filter(isKpiRowWidget)
      .sort((a, b) => a.x - b.x)
      .slice(0, 5)
  }, [layout])


  const kpiLayout = useMemo(() => {
    return Array(5).fill(null).map((_, index) => {
      return kpiWidgets.find(w => w.x === index) || null
    }) as (WidgetLayout | null)[]
  }, [kpiWidgets])


  const gridWidgets = useMemo(() => {
    return layout.filter(w => !isKpiRowWidget(w))
  }, [layout])

  const gridLayouts = useMemo(
    () => buildResponsiveDashboardLayouts(layout as any, isEditMode),
    [layout, isEditMode]
  )


  const handleLayoutChange = useCallback((newLayout: any[], allLayouts: Record<string, any[]>) => {
    if (!isEditMode || isInternalUpdate.current) return


    const updatedGridWidgets: WidgetLayout[] = newLayout.map(item => {
      const original = gridWidgets.find(w => w.i === item.i)
      return {
        i: item.i,
        type: original?.type || '',
        size: original?.size || 'medium',
        x: item.x,
        y: item.y + 1,
        w: item.w,
        h: item.h,
      }
    })


    const fullLayout = [...kpiWidgets, ...updatedGridWidgets]
    updateLayout(fullLayout)
  }, [isEditMode, gridWidgets, kpiWidgets, updateLayout])


  const handleRemoveWidget = useCallback((widgetId: string) => {
    if (!currentLayout) return
    const updatedLayout = currentLayout.filter(w => w.i !== widgetId)
    updateLayout(updatedLayout)
  }, [currentLayout, updateLayout])


  const handleAddWidget = useCallback((slotInfo?: { slotIndex?: number; x?: number; y?: number }) => {
    setTargetSlot(slotInfo || null)
    if (slotInfo?.slotIndex !== undefined && slotInfo.slotIndex < 5) {
      setShowKpiSelector(true)
    } else {
      setShowWidgetLibrary(true)
    }
  }, [])


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


  const handleSelectKpiWidget = useCallback((widgetType: string) => {
    handleInsertWidget(widgetType)
  }, [handleInsertWidget])


  const hasAccounts = (contextAccounts && contextAccounts.length > 0) || formattedTrades.length > 0
  const settingsReady = !isLoadingAccountFilterSettings
  const hasSelectedScope = accountNumbers.length > 0
    || (accountFilterSettings?.selectedPhaseAccountIds?.length ?? 0) > 0

  const showEmptyTradeState = !isEditMode && !isLoading && !hasAccounts
  const showNoTradesState = !isEditMode && !isLoading && settingsReady && hasAccounts && formattedTrades.length === 0
  const showEmptyAccountState = !isEditMode && !isLoading && settingsReady && hasAccounts && !hasSelectedScope && formattedTrades.length > 0 && !showEmptyTradeState

  if (showEmptyTradeState) {
    return <EmptyTradeState variant="no-account" />
  }

  if (showNoTradesState) {
    return <EmptyTradeState variant={hasSelectedScope ? 'filtered' : 'no-trades'} />
  }

  if (showEmptyAccountState) {
    return <EmptyAccountState />
  }


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
      {}
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
                    {}
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
                    <button
                      type="button"
                      className="h-24 w-full rounded-xl border-2 border-dashed border-border/50 bg-muted/20 hover:bg-muted/40 cursor-pointer transition-all hover:border-primary/30"
                      onClick={() => handleAddWidget({ slotIndex: index })}
                    >
                      <div className="h-full flex flex-col items-center justify-center p-4">
                        <Plus className="h-5 w-5 text-muted-foreground mb-1.5" />
                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                          Add KPI
                        </span>
                      </div>
                    </button>
                  )
              )}
            </div>
          )})}
          
          </div>
        </div>
      </div>

      {}
      {}
      <div className="px-2 lg:isolate" ref={gridContainerRef} data-tour="widget-canvas">
        {isMobile ? (

          <div className="pb-4 space-y-3">
            {gridWidgets.map(widget => {
              const config = WIDGET_REGISTRY[widget.type as WidgetType]
              if (!config) return null

              const isChart = (config.category === 'charts' && widget.type !== 'performanceSummary') || widget.type.startsWith('calendar')
              const mobileHeight = getMobileWidgetHeight(widget.type, isChart, config.previewHeight)
              const surfaceContract = getWidgetSurfaceContract(widget.type, isChart, config.previewHeight)
              const minHeight = surfaceContract.mobileMinHeight ?? mobileHeight

              return (
                <div
                  key={`mobile-${widget.i}`}
                  className={cn('widget-wrapper flex-shrink-0', isEditMode && 'relative rounded-2xl ring-1 ring-border/30 ring-inset')}
                  style={{ minHeight }}
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
                  <LazyMobileWidget
                    minHeight={minHeight}
                    isEditMode={isEditMode}
                  >
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
                  {}
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
                      {}
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

                  {}
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

      {}
      {isEditMode && (
        <div className="px-4 pb-4">
          <button
            type="button"
            className="h-24 w-full rounded-xl border-2 border-dashed border-border/50 bg-muted/20 hover:bg-muted/40 cursor-pointer transition-all hover:border-primary/30"
            onClick={() => handleAddWidget()}
          >
            <div className="h-full flex flex-col items-center justify-center p-4">
              <Plus className="h-6 w-6 text-muted-foreground mb-1.5" />
              <span className="text-xs font-bold text-muted-foreground">
                Add Widget
              </span>
            </div>
          </button>
        </div>
      )}

      {}
      <WidgetLibraryDialog
        open={showWidgetLibrary}
        onOpenChange={setShowWidgetLibrary}
        currentLayout={currentLayout || []}
        onInsertWidget={handleInsertWidget}
      />

      {}
      <KpiWidgetSelector
        open={showKpiSelector}
        onOpenChange={setShowKpiSelector}
        currentLayout={currentLayout || []}
        onSelectWidget={handleSelectKpiWidget}
      />
    </div>
  )
}
