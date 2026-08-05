import React from 'react'
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { cloneDefaultTemplateLayout } from "@/lib/dashboard/default-template-layout"
import { buildResponsiveDashboardLayouts } from "@/lib/dashboard/responsive-layouts"

const loadingLayout = cloneDefaultTemplateLayout()
const loadingLayouts = buildResponsiveDashboardLayouts(loadingLayout, false)

export function DashboardLoadingSkeleton() {
  return (
    <div role="status" aria-label="Loading dashboard" className="w-full">
      <TemplateAwareDashboardSkeleton
        layout={loadingLayout}
        layouts={loadingLayouts}
      />
    </div>
  )
}

function KpiSkeleton() {
  return (
    <Card className="border-border/24 bg-card/76">
      <CardContent className="px-4 py-3 min-[1440px]:px-4 min-[1440px]:py-4 h-[104px] min-[1440px]:h-[100px] flex flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <Skeleton className="h-3 w-28 bg-muted/45" />
          <Skeleton className="h-4 w-4 rounded-md bg-muted/30" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-7 w-24 bg-muted/55" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-14 bg-muted/30" />
            <Skeleton className="h-3 w-16 bg-muted/40" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function WidgetSkeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <Card className={cn("border-border/24 bg-card/76 overflow-hidden", className)} style={style}>
      <CardContent className="p-4 sm:p-5 flex flex-col gap-4 h-full">
        <div className="flex items-center justify-between gap-3 shrink-0">
          <Skeleton className="h-3 w-20 bg-muted/40" />
          <Skeleton className="h-7 w-7 rounded-lg bg-muted/25" />
        </div>
        <Skeleton className="flex-1 w-full rounded-xl bg-muted/20 min-h-[120px]" />
        <div className="grid grid-cols-2 gap-3 border-t border-border/12 pt-3 shrink-0">
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-14 bg-muted/25" />
            <Skeleton className="h-4 w-20 bg-muted/40" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-12 bg-muted/25" />
            <Skeleton className="h-4 w-16 bg-muted/40" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CalendarWidgetSkeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <Card className={cn("border-border/24 bg-card/76 overflow-hidden", className)} style={style}>
      <CardContent className="p-0 flex flex-col h-full">
        <div className="flex items-center justify-between border-b border-border/14 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-28 rounded-lg bg-muted/30" />
            <Skeleton className="h-6 w-16 rounded-md bg-muted/25" />
          </div>
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-5 w-14 rounded bg-muted/30" />
            <Skeleton className="h-5 w-8 rounded bg-muted/25" />
            <Skeleton className="h-6 w-6 rounded-lg bg-muted/20" />
          </div>
        </div>
        <div className="grid grid-cols-5 gap-1.5 px-3 py-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={`wk-${i}`} className="h-3 w-8 mx-auto bg-muted/20" />
          ))}
        </div>
        <div className="flex-1 grid grid-cols-5 gap-1.5 p-3 pt-0">
          {Array.from({ length: 25 }).map((_, i) => (
            <Skeleton key={`day-${i}`} className="rounded-lg bg-muted/[0.08] min-h-[52px]" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function TradeTableSkeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <Card className={cn("border-border/24 bg-card/76 overflow-hidden", className)} style={style}>
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-border/14 px-4 py-3">
          <Skeleton className="h-9 flex-1 min-w-[180px] rounded-xl bg-muted/30" />
          <Skeleton className="h-9 w-28 rounded-xl bg-muted/25" />
          <Skeleton className="h-9 w-24 rounded-xl bg-muted/25" />
        </div>
        <div className="divide-y divide-border/8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-4 w-20 bg-muted/30" />
              <Skeleton className="h-4 w-16 bg-muted/30" />
              <Skeleton className="h-4 w-12 bg-muted/25" />
              <Skeleton className="h-4 w-16 ml-auto bg-muted/35" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

const SKELETON_ROW_HEIGHT = 80
const SKELETON_GRID_GAP = 12
const SKELETON_GRID_PADDING = 8

function getSkeletonKind(type?: string) {
  if (type === 'calendar' || type === 'calendarAdvanced' || type === 'calendarMini') return 'calendar'
  if (type === 'recent-trades' || type === 'recentTrades') return 'recent-trades'
  return 'widget'
}

function getSkeletonMinHeight(item: TemplateAwareLayoutItem) {
  return Math.max(160, item.h * SKELETON_ROW_HEIGHT + Math.max(0, item.h - 1) * SKELETON_GRID_GAP)
}

function renderSkeletonForItem(item: TemplateAwareLayoutItem, style?: React.CSSProperties, className?: string) {
  const kind = getSkeletonKind(item.type)
  const props = {
    ...(className !== undefined && { className }),
    ...(style !== undefined && { style })
  }
  if (kind === 'calendar') return <CalendarWidgetSkeleton key={item.i} {...props} />
  if (kind === 'recent-trades') return <TradeTableSkeleton key={item.i} {...props} />
  return <WidgetSkeleton key={item.i} {...props} />
}

interface TemplateAwareLayoutItem {
  i: string
  type?: string
  size?: string
  x: number
  y: number
  w: number
  h: number
}

interface TemplateAwareLayouts {
  wide: TemplateAwareLayoutItem[]
  narrow: TemplateAwareLayoutItem[]
  tablet: TemplateAwareLayoutItem[]
  mobile: TemplateAwareLayoutItem[]
}

function GridSkeletonLayout({
  items,
  cols,
  className,
}: {
  items: TemplateAwareLayoutItem[]
  cols: number
  className?: string
}) {
  return (
    <div
      className={cn("grid", className)}
      style={{
        gridAutoRows: `${SKELETON_ROW_HEIGHT}px`,
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gap: `${SKELETON_GRID_GAP}px`,
        padding: `${SKELETON_GRID_PADDING}px`,
      }}
    >
      {items.map((item) => {
        const spanW = Math.max(1, Math.min(cols, item.w))
        const spanH = Math.max(1, item.h)
        const x = Math.max(0, Math.min(cols - 1, item.x))
        const style = {
          gridColumn: `${x + 1} / span ${Math.min(spanW, cols - x)}`,
          gridRow: `${Math.max(0, item.y) + 1} / span ${spanH}`,
          minHeight: `${getSkeletonMinHeight(item)}px`,
        }

        return renderSkeletonForItem(item, style)
      })}
    </div>
  )
}

export function TemplateAwareDashboardSkeleton({
  layout,
  layouts,
  className,
}: {
  layout: TemplateAwareLayoutItem[]
  layouts: TemplateAwareLayouts
  className?: string
}) {
  const kpiWidgets = layout
    .filter((item) => item.y === 0 && item.h === 1)
    .sort((a, b) => a.x - b.x)
    .slice(0, 5)

  return (
    <div className={cn("px-3 sm:px-4 pt-3 sm:pt-4 space-y-3", className)}>
      <div className="grid grid-cols-1 min-[768px]:grid-cols-2 min-[1024px]:grid-cols-6 min-[1440px]:grid-cols-5 gap-2 sm:gap-3">
        {Array.from({ length: 5 }).map((_, index) => {
          const hasSlot = kpiWidgets.some((item) => item.x === index)
          return hasSlot ? (
            <div
              key={`kpi-${index}`}
              className={cn(
                index === 4 && "min-[768px]:max-[1023px]:col-span-2",
                index <= 2 && "min-[1024px]:max-[1439px]:col-span-2",
                index >= 3 && "min-[1024px]:max-[1439px]:col-span-3"
              )}
            >
              <KpiSkeleton />
            </div>
          ) : (
            <div
              key={`kpi-empty-${index}`}
              className={cn(
                "h-[100px] rounded-2xl border border-border/15 bg-transparent",
                index === 4 && "min-[768px]:max-[1023px]:col-span-2",
                index <= 2 && "min-[1024px]:max-[1439px]:col-span-2",
                index >= 3 && "min-[1024px]:max-[1439px]:col-span-3"
              )}
            />
          )
        })}
      </div>

      <div className="space-y-3 min-[768px]:hidden">
        {layouts.mobile.map((item) => {
          const style = { minHeight: `${getSkeletonMinHeight(item)}px` }
          const className = "min-h-[160px]"

          return renderSkeletonForItem(item, style, className)
        })}
      </div>

      <GridSkeletonLayout
        items={layouts.tablet}
        cols={6}
        className="hidden min-[768px]:grid min-[1024px]:hidden"
      />

      <GridSkeletonLayout
        items={layouts.narrow}
        cols={12}
        className="hidden min-[1024px]:grid min-[1440px]:hidden"
      />

      <GridSkeletonLayout
        items={layouts.wide}
        cols={12}
        className="hidden min-[1440px]:grid"
      />
    </div>
  )
}

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48 bg-muted/55" />
          <Skeleton className="h-4 w-72 bg-muted/30" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <WidgetSkeleton className="lg:col-span-2 min-h-[400px]" />
          <WidgetSkeleton className="min-h-[400px]" />
        </div>
      </div>
    </div>
  )
}

function CompactSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array(rows).fill(0).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded bg-muted/30" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-3 w-3/4 bg-muted/35" />
            <Skeleton className="h-2 w-1/2 bg-muted/25" />
          </div>
          <Skeleton className="h-4 w-12 bg-muted/30" />
        </div>
      ))}
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-40 bg-muted/55" />
        <Skeleton className="h-8 w-32 rounded-lg bg-muted/35" />
      </div>
      <TradeTableSkeleton />
    </div>
  )
}

function ReportsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-48 bg-muted/55" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20 rounded-lg bg-muted/35" />
          <Skeleton className="h-8 w-20 rounded-lg bg-muted/35" />
        </div>
      </div>
      <Skeleton className="h-10 w-full rounded-xl bg-muted/30" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {[0, 1, 2, 3, 4, 5].map(i => <WidgetSkeleton key={`rep-${i}`} className="min-h-[260px]" />)}
      </div>
    </div>
  )
}

