export interface TemplateLayoutItem {
  i: string
  type: string
  size: string
  x: number
  y: number
  w: number
  h: number
}

const DEFAULT_TEMPLATE_LAYOUT: TemplateLayoutItem[] = [
  { i: 'kpi-1', type: 'accountBalancePnl', size: 'kpi', x: 0, y: 0, w: 1, h: 1 },
  { i: 'kpi-2', type: 'tradeWinRate', size: 'kpi', x: 1, y: 0, w: 1, h: 1 },
  { i: '0f139a04-41eb-43a5-bce7-416c2d4c784d', type: 'profitFactor', size: 'small', x: 2, y: 0, w: 1, h: 1 },
  { i: 'de6bfa2b-0bea-4dc0-9817-df75eb30cde5', type: 'dayWinRate', size: 'small', x: 3, y: 0, w: 1, h: 1 },
  { i: 'kpi-5', type: 'avgWinLoss', size: 'kpi', x: 4, y: 0, w: 1, h: 1 },
  { i: 'equity-curve', type: 'equityCurve', size: 'large', x: 0, y: 14, w: 4, h: 4 },
  { i: 'drawdown', type: 'drawdown', size: 'small-long', x: 8, y: 10, w: 4, h: 4 },
  { i: 'recent-trades', type: 'recentTrades', size: 'small', x: 8, y: 14, w: 4, h: 8 },
  { i: 'net-daily-pnl', type: 'netDailyPnL', size: 'small-long', x: 8, y: 1, w: 4, h: 5 },
  { i: 'outcome-dist', type: 'outcomeDistribution', size: 'medium', x: 4, y: 22, w: 4, h: 4 },
  { i: 'day-of-week', type: 'dayOfWeekPerformance', size: 'medium', x: 4, y: 14, w: 4, h: 4 },
  { i: 'weekday-pnl', type: 'weekdayPnL', size: 'small-long', x: 8, y: 6, w: 4, h: 4 },
  { i: 'pnl-by-instrument', type: 'pnlByInstrument', size: 'small-long', x: 4, y: 18, w: 4, h: 4 },
  { i: 'performance-score', type: 'performanceScore', size: 'small-long', x: 0, y: 22, w: 4, h: 4 },
  { i: 'trade-duration', type: 'tradeDurationPerformance', size: 'small-long', x: 0, y: 18, w: 4, h: 4 },
  { i: 'session-analysis', type: 'sessionAnalysis', size: 'medium', x: 8, y: 22, w: 4, h: 4 },
  { i: 'calendar-advanced', type: 'calendarAdvanced', size: 'extra-large', x: 0, y: 1, w: 8, h: 9 },
  { i: '22c371e9-0750-4416-9348-96152d86230e', type: 'performanceSummary', size: 'large', x: 0, y: 26, w: 12, h: 4 },
  { i: 'e8b7b18f-533e-44f9-85fa-474cfe5e4a3a', type: 'accountProgression', size: 'large', x: 0, y: 10, w: 8, h: 4 },
  { i: 'b3fd19eb-dc9f-402e-9b1d-9c4eedd4c34a', type: 'timeOfDayPerformance', size: 'medium', x: 0, y: 33, w: 12, h: 4 },
  { i: '7eb35a19-c0f1-41ba-a2c3-7e7dcf126fb6', type: 'propFirmGrowthCurve', size: 'extra-large', x: 0, y: 37, w: 12, h: 5 },
  { i: 'b7abd4a3-d729-4660-87cb-6443716c9350', type: 'propFirmAccountStatistics', size: 'extra-large', x: 0, y: 42, w: 12, h: 5 },
  { i: 'cbea8dc2-f8d6-4e4d-8d1b-d969dbaf9c7e', type: 'propFirmObjectivesToday', size: 'extra-large', x: 0, y: 47, w: 12, h: 4 },
  { i: '562e7ec8-af32-447a-a8f1-e49073449dd2', type: 'calendarHeatmap', size: 'small-long', x: 0, y: 30, w: 12, h: 3 },
]

export function cloneDefaultTemplateLayout(): TemplateLayoutItem[] {
  return DEFAULT_TEMPLATE_LAYOUT.map((item) => ({ ...item }))
}