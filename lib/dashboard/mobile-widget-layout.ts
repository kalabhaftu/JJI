const MOBILE_WIDGET_HEIGHTS: Readonly<Record<string, number>> = {
  calendarAdvanced: 560,
  calendarMini: 420,
  recentTrades: 360,
  propFirmGrowthCurve: 340,
}

const MIN_WIDGET_HEIGHT = 180
const CONTENT_SIZED_WIDGET_MIN_HEIGHTS: Readonly<Record<string, number>> = {
  performanceSummary: 520,
  propFirmObjectivesToday: 640,
  propFirmAccountStatistics: 720,
}
export const MAX_MOBILE_WIDGET_HEIGHT = Math.max(
  560,
  ...Object.values(CONTENT_SIZED_WIDGET_MIN_HEIGHTS),
)

export function isContentSizedMobileWidget(type: string) {
  return Object.prototype.hasOwnProperty.call(CONTENT_SIZED_WIDGET_MIN_HEIGHTS, type)
}

export function getMobileWidgetHeight(
  type: string,
  isChart: boolean,
  previewHeight?: number,
): number {
  const contentSizedMinHeight = CONTENT_SIZED_WIDGET_MIN_HEIGHTS[type]
  if (contentSizedMinHeight) return contentSizedMinHeight

  const configuredHeight = MOBILE_WIDGET_HEIGHTS[type]
  if (configuredHeight) return configuredHeight
  if (isChart) return 320

  return Math.min(
    Math.max(previewHeight ?? 220, MIN_WIDGET_HEIGHT),
    420,
  )
}
