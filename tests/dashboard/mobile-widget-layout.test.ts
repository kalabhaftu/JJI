import { describe, expect, it } from 'vitest'
import {
  getMobileWidgetHeight,
  isContentSizedMobileWidget,
  MAX_MOBILE_WIDGET_HEIGHT,
} from '@/lib/dashboard/mobile-widget-layout'

describe('mobile widget layout', () => {
  it('uses bounded, purpose-specific heights for dense widgets', () => {
    expect(getMobileWidgetHeight('calendarAdvanced', false)).toBe(560)
    expect(getMobileWidgetHeight('recentTrades', false)).toBe(360)
    expect(getMobileWidgetHeight('performanceSummary', false)).toBe(520)
    expect(getMobileWidgetHeight('propFirmObjectivesToday', false)).toBe(640)
    expect(getMobileWidgetHeight('propFirmAccountStatistics', false)).toBe(720)
  })

  it('lets dense wide widgets grow to their content on mobile', () => {
    expect(isContentSizedMobileWidget('performanceSummary')).toBe(true)
    expect(isContentSizedMobileWidget('propFirmObjectivesToday')).toBe(true)
    expect(isContentSizedMobileWidget('propFirmAccountStatistics')).toBe(true)
    expect(isContentSizedMobileWidget('recentTrades')).toBe(false)
  })

  it('uses a stable chart height instead of desktop grid row height', () => {
    expect(getMobileWidgetHeight('unknownChart', true, 1200)).toBe(320)
  })

  it('clamps generic widgets to a usable mobile range', () => {
    expect(getMobileWidgetHeight('shortWidget', false, 20)).toBe(180)
    expect(getMobileWidgetHeight('tallWidget', false, 1200)).toBe(420)
    expect(getMobileWidgetHeight('defaultWidget', false)).toBe(220)
  })

  it('never lets a known widget exceed the mobile maximum', () => {
    const knownTypes = [
      'calendarAdvanced',
      'calendarMini',
      'performanceSummary',
      'recentTrades',
      'propFirmObjectivesToday',
      'propFirmAccountStatistics',
      'propFirmGrowthCurve',
    ]

    for (const type of knownTypes) {
      expect(getMobileWidgetHeight(type, false)).toBeLessThanOrEqual(
        MAX_MOBILE_WIDGET_HEIGHT,
      )
    }
  })
})
