const MOBILE_WIDGET_HEIGHTS: Readonly<Record<string, number>> = {
  calendarAdvanced: 560,
  calendarMini: 420,
  performanceSummary: 420,
  recentTrades: 360,
  propFirmObjectivesToday: 360,
  propFirmAccountStatistics: 380,
  propFirmGrowthCurve: 340,
}

const MIN_WIDGET_HEIGHT = 180
export const MAX_MOBILE_WIDGET_HEIGHT = 560

export function getMobileWidgetHeight(
  type: string,
  isChart: boolean,
  previewHeight?: number,
): number {
  const configuredHeight = MOBILE_WIDGET_HEIGHTS[type]
  if (configuredHeight) return configuredHeight
  if (isChart) return 320

  return Math.min(
    Math.max(previewHeight ?? 220, MIN_WIDGET_HEIGHT),
    420,
  )
}
