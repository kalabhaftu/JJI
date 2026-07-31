import { WidgetSize } from '../types/dashboard'

export interface WidgetDimensions {
  colSpan: number
  
  minWidth: string
  
  height: string
  
  aspectRatio?: string
}

export const WIDGET_DIMENSIONS: Record<WidgetSize, WidgetDimensions> = {
  'kpi': {
    colSpan: 12,  // Full width on mobile, managed by grid on desktop
    minWidth: '280px',
    height: '140px',
  },
  
  'tiny': {
    colSpan: 3,
    minWidth: '280px',
    height: '180px',
  },
  
  'small': {
    colSpan: 4,
    minWidth: '420px',
    height: '580px',
  },

  'small-long': {
    colSpan: 4,
    minWidth: '520px',
    height: '360px',
  },

  'medium': {
    colSpan: 6,
    minWidth: '620px',
    height: '580px',
  },

  'large': {
    colSpan: 8,
    minWidth: '780px',
    height: '580px',
  },
  
  'extra-large': {
    colSpan: 12,
    minWidth: '100%',
    height: '800px',
  },
}

function getGridColClass(size: WidgetSize): string {
  const span = WIDGET_DIMENSIONS[size].colSpan
  return `col-span-12 md:col-span-${span}`
}

function getWidgetHeightClass(size: WidgetSize): string {
  return `h-widget-${size}`
}

function getWidgetStyles(size: WidgetSize): React.CSSProperties {
  const dims = WIDGET_DIMENSIONS[size]
  return {
    minWidth: dims.minWidth,
    height: dims.height,
    ...(dims.aspectRatio && { aspectRatio: dims.aspectRatio }),
  }
}

const WIDGET_GROUPS = {
  kpi: {
    name: 'Key Performance Indicators',
    bgClass: 'bg-kpi-section',
    padding: 'p-4',
    gap: 'gap-3',
    gridCols: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
  },
  charts: {
    name: 'Charts & Analytics',
    bgClass: 'bg-transparent',
    padding: 'px-4',
    gap: 'gap-3',
    gridCols: 'grid-cols-1 md:grid-cols-12',
  },
  tables: {
    name: 'Data Tables',
    bgClass: 'bg-transparent',
    padding: 'px-4',
    gap: 'gap-3',
    gridCols: 'grid-cols-1',
  },
} as const

const CARD_PADDING: Record<WidgetSize, string> = {
  'kpi': 'p-4',
  'tiny': 'p-3',
  'small': 'p-4',
  'small-long': 'p-4',
  'medium': 'p-4',
  'large': 'p-6',
  'extra-large': 'p-6',
}

const CARD_HEADER_HEIGHT = '56px'

function getDashboardGridConfig() {
  return {
    container: 'max-w-[1920px] mx-auto',
    gap: 'gap-3',
    padding: 'px-4 py-6',
    cols: 'grid-cols-12',
  }
}

/**
 * react-grid-layout default and minimum sizes per widget type
 * 
 * w/h = grid units (columns out of 12, rows where 1 row = ROW_HEIGHT px)
 * minW/minH = minimum resize constraints
 */
export interface WidgetGridDefault {
  defaultW: number
  defaultH: number
  minW: number
  minH: number
}

export const WIDGET_GRID_DEFAULTS: Record<string, WidgetGridDefault> = {
  // KPIs - handled separately, but included for completeness
  accountBalancePnl: { defaultW: 1, defaultH: 1, minW: 1, minH: 1 },
  tradeWinRate:      { defaultW: 1, defaultH: 1, minW: 1, minH: 1 },
  dayWinRate:        { defaultW: 1, defaultH: 1, minW: 1, minH: 1 },
  profitFactor:      { defaultW: 1, defaultH: 1, minW: 1, minH: 1 },
  avgWinLoss:        { defaultW: 1, defaultH: 1, minW: 1, minH: 1 },

  netDailyPnL:              { defaultW: 4, defaultH: 4, minW: 3, minH: 3 },
  dailyCumulativePnL:       { defaultW: 4, defaultH: 4, minW: 3, minH: 3 },
  accountBalanceChart:      { defaultW: 4, defaultH: 4, minW: 3, minH: 3 },
  weekdayPnL:               { defaultW: 4, defaultH: 4, minW: 3, minH: 3 },
  tradeDurationPerformance: { defaultW: 4, defaultH: 4, minW: 3, minH: 3 },
  performanceScore:         { defaultW: 4, defaultH: 4, minW: 3, minH: 3 },
  pnlByInstrument:          { defaultW: 4, defaultH: 4, minW: 3, minH: 3 },
  pnlByStrategy:            { defaultW: 4, defaultH: 4, minW: 3, minH: 3 },
  winRateByStrategy:        { defaultW: 4, defaultH: 4, minW: 3, minH: 3 },

  sessionAnalysis:        { defaultW: 4, defaultH: 4, minW: 3, minH: 3 },

  // Tables - 5 rows = ~400px which fits 10 trade rows without scroll by default
  recentTrades: { defaultW: 4, defaultH: 5, minW: 3, minH: 4 },

  // Calendars - advanced unchanged, mini gets more height for taller cells
  calendarAdvanced: { defaultW: 12, defaultH: 6, minW: 4, minH: 5 },
  calendarMini:     { defaultW: 8, defaultH: 8, minW: 4, minH: 6 },

  equityCurve:            { defaultW: 8, defaultH: 4, minW: 4, minH: 3 },
  outcomeDistribution:    { defaultW: 4, defaultH: 4, minW: 3, minH: 3 },
  dayOfWeekPerformance:   { defaultW: 6, defaultH: 4, minW: 3, minH: 3 },
  drawdown:               { defaultW: 4, defaultH: 4, minW: 3, minH: 3 },
  performanceSummary:     { defaultW: 12, defaultH: 6, minW: 8, minH: 5 },
  propFirmObjectivesToday: { defaultW: 12, defaultH: 9, minW: 8, minH: 7 },
  propFirmAccountStatistics: { defaultW: 12, defaultH: 7, minW: 8, minH: 5 },
  propFirmGrowthCurve: { defaultW: 12, defaultH: 5, minW: 8, minH: 4 },
  accountProgression:     { defaultW: 8, defaultH: 4, minW: 4, minH: 3 },
  tagPerformance:         { defaultW: 4, defaultH: 4, minW: 3, minH: 3 },
  timeOfDayPerformance:   { defaultW: 4, defaultH: 4, minW: 3, minH: 3 },
  disciplineAnalytics:    { defaultW: 4, defaultH: 4, minW: 3, minH: 3 },

  default: { defaultW: 4, defaultH: 4, minW: 3, minH: 3 },
}
