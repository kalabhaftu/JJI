import { WIDGET_GRID_DEFAULTS } from '@/app/dashboard/config/widget-dimensions'
import type { WidgetType } from '@/app/dashboard/types/dashboard'

export interface DashboardLayoutItem {
  i: string
  type: string
  size: string
  x: number
  y: number
  w: number
  h: number
}

type ResponsiveGridItem = {
  i: string
  x: number
  y: number
  w: number
  h: number
  minW: number
  minH: number
  static: boolean
}

export type DashboardBreakpointLayouts = {
  wide: ResponsiveGridItem[]
  narrow: ResponsiveGridItem[]
  tablet: ResponsiveGridItem[]
  mobile: ResponsiveGridItem[]
}

type LayoutSpecItem = {
  type: WidgetType
  w: number
  h?: number
}

type LayoutSpecRow = LayoutSpecItem[]

const NARROW_DESKTOP_ROWS: LayoutSpecRow[] = [
  [
    { type: 'equityCurve', w: 8, h: 4 },
    { type: 'drawdown', w: 4, h: 4 },
  ],
  [{ type: 'performanceSummary', w: 12, h: 6 }],
  [{ type: 'recentTrades', w: 12, h: 4 }],
  [{ type: 'calendarMini', w: 12, h: 6 }],
  [
    { type: 'netDailyPnL', w: 6, h: 4 },
    { type: 'dailyCumulativePnL', w: 6, h: 4 },
  ],
  [{ type: 'accountBalanceChart', w: 12, h: 4 }],
  [
    { type: 'outcomeDistribution', w: 6, h: 4 },
    { type: 'dayOfWeekPerformance', w: 6, h: 4 },
  ],
  [{ type: 'weekdayPnL', w: 12, h: 4 }],
  [
    { type: 'pnlByStrategy', w: 6, h: 4 },
    { type: 'winRateByStrategy', w: 6, h: 4 },
  ],
  [{ type: 'pnlByInstrument', w: 12, h: 4 }],
  [
    { type: 'performanceScore', w: 6, h: 4 },
    { type: 'tradeDurationPerformance', w: 6, h: 4 },
  ],
  [{ type: 'sessionAnalysis', w: 12, h: 4 }],
  [{ type: 'calendarAdvanced', w: 12, h: 8 }],
  [{ type: 'propFirmGrowthCurve', w: 12, h: 5 }],
  [{ type: 'propFirmAccountStatistics', w: 12, h: 7 }],
  [{ type: 'propFirmObjectivesToday', w: 12, h: 9 }],
]

const TABLET_ROWS: LayoutSpecRow[] = [
  [{ type: 'equityCurve', w: 6, h: 4 }],
  [{ type: 'drawdown', w: 6, h: 4 }],
  [{ type: 'performanceSummary', w: 6, h: 6 }],
  [{ type: 'recentTrades', w: 6, h: 4 }],
  [{ type: 'calendarMini', w: 6, h: 6 }],
  [
    { type: 'netDailyPnL', w: 3, h: 4 },
    { type: 'dailyCumulativePnL', w: 3, h: 4 },
  ],
  [{ type: 'accountBalanceChart', w: 6, h: 4 }],
  [
    { type: 'outcomeDistribution', w: 3, h: 4 },
    { type: 'dayOfWeekPerformance', w: 3, h: 4 },
  ],
  [{ type: 'weekdayPnL', w: 6, h: 4 }],
  [
    { type: 'pnlByStrategy', w: 3, h: 4 },
    { type: 'winRateByStrategy', w: 3, h: 4 },
  ],
  [{ type: 'pnlByInstrument', w: 6, h: 4 }],
  [
    { type: 'performanceScore', w: 3, h: 4 },
    { type: 'tradeDurationPerformance', w: 3, h: 4 },
  ],
  [{ type: 'sessionAnalysis', w: 6, h: 4 }],
  [{ type: 'calendarAdvanced', w: 6, h: 8 }],
  [{ type: 'propFirmGrowthCurve', w: 6, h: 5 }],
  [{ type: 'propFirmAccountStatistics', w: 6, h: 8 }],
  [{ type: 'propFirmObjectivesToday', w: 6, h: 9 }],
]

const MOBILE_ROWS: LayoutSpecRow[] = [
  [{ type: 'equityCurve', w: 1, h: 4 }],
  [{ type: 'drawdown', w: 1, h: 4 }],
  [{ type: 'performanceSummary', w: 1, h: 7 }],
  [{ type: 'recentTrades', w: 1, h: 5 }],
  [{ type: 'calendarMini', w: 1, h: 6 }],
  [{ type: 'netDailyPnL', w: 1, h: 4 }],
  [{ type: 'dailyCumulativePnL', w: 1, h: 4 }],
  [{ type: 'accountBalanceChart', w: 1, h: 4 }],
  [{ type: 'outcomeDistribution', w: 1, h: 4 }],
  [{ type: 'dayOfWeekPerformance', w: 1, h: 4 }],
  [{ type: 'weekdayPnL', w: 1, h: 4 }],
  [{ type: 'pnlByStrategy', w: 1, h: 4 }],
  [{ type: 'winRateByStrategy', w: 1, h: 4 }],
  [{ type: 'pnlByInstrument', w: 1, h: 4 }],
  [{ type: 'performanceScore', w: 1, h: 4 }],
  [{ type: 'tradeDurationPerformance', w: 1, h: 4 }],
  [{ type: 'sessionAnalysis', w: 1, h: 4 }],
  [{ type: 'calendarAdvanced', w: 1, h: 10 }],
  [{ type: 'propFirmGrowthCurve', w: 1, h: 5 }],
  [{ type: 'propFirmAccountStatistics', w: 1, h: 9 }],
  [{ type: 'propFirmObjectivesToday', w: 1, h: 9 }],
]

function getWidgetDefaults(type: string) {
  return WIDGET_GRID_DEFAULTS[type as WidgetType] || WIDGET_GRID_DEFAULTS.default
}

function toResponsiveGridItem(
  item: DashboardLayoutItem,
  overrides: Partial<Pick<ResponsiveGridItem, 'x' | 'y' | 'w' | 'h'>>,
  isEditMode: boolean,
) {
  const defaults = getWidgetDefaults(item.type)

  return {
    i: item.i,
    x: overrides.x ?? item.x,
    y: overrides.y ?? item.y,
    w: overrides.w ?? item.w,
    h: overrides.h ?? item.h,
    minW: defaults?.minW ?? 2,
    minH: defaults?.minH ?? 2,
    static: !isEditMode,
  }
}

function buildLayoutFromRows(
  items: DashboardLayoutItem[],
  rows: LayoutSpecRow[],
  cols: number,
  isEditMode: boolean,
) {
  const buckets = new Map<string, DashboardLayoutItem[]>()

  items.forEach((item) => {
    const bucket = buckets.get(item.type) || []
    bucket.push(item)
    buckets.set(item.type, bucket)
  })

  const placedIds = new Set<string>()
  const layout: ResponsiveGridItem[] = []
  let currentY = 0

  const takeNext = (type: WidgetType) => {
    const bucket = buckets.get(type)
    if (!bucket?.length) return null
    return bucket.shift() || null
  }

  rows.forEach((row) => {
    let rowX = 0
    let rowHeight = 0
    const rowItems: ResponsiveGridItem[] = []

    row.forEach((spec) => {
      const item = takeNext(spec.type)
      if (!item) return

      const gridItem = toResponsiveGridItem(
        item,
        {
          x: rowX,
          y: currentY,
          w: Math.min(spec.w, cols),
          h: spec.h ?? item.h,
        },
        isEditMode,
      )

      rowItems.push(gridItem)
      placedIds.add(item.i)
      rowX += gridItem.w
      rowHeight = Math.max(rowHeight, gridItem.h)
    })

    if (rowItems.length > 0) {
      if (rowItems.length === 1 && row.length > 1) {
        rowItems[0]!.x = 0
        rowItems[0]!.w = cols
      }

      layout.push(...rowItems)
      currentY += rowHeight
    }
  })

  const leftovers = items
    .filter((item) => !placedIds.has(item.i))
    .sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y))

  leftovers.forEach((item) => {
    const defaults = getWidgetDefaults(item.type)
    const stackedWidth = cols === 1 ? 1 : cols
    const stackedHeight =
      cols === 1 ? Math.max(item.h, defaults?.minH || 4) : item.h

    layout.push(
      toResponsiveGridItem(
        item,
        {
          x: 0,
          y: currentY,
          w: stackedWidth,
          h: stackedHeight,
        },
        isEditMode,
      ),
    )
    currentY += stackedHeight
  })

  return layout
}

export function buildResponsiveDashboardLayouts(
  items: DashboardLayoutItem[],
  isEditMode: boolean,
): DashboardBreakpointLayouts {
  const gridItems = items.filter((item) => item.y > 0)

  return {
    wide: gridItems.map((item) =>
      toResponsiveGridItem(
        item,
        {
          y: item.y - 1,
        },
        isEditMode,
      ),
    ),
    narrow: buildLayoutFromRows(gridItems, NARROW_DESKTOP_ROWS, 12, isEditMode),
    tablet: buildLayoutFromRows(gridItems, TABLET_ROWS, 6, isEditMode),
    mobile: buildLayoutFromRows(gridItems, MOBILE_ROWS, 1, isEditMode),
  }
}
