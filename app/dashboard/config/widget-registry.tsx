import React from 'react'
import { WidgetType, WidgetSize } from '../types/dashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { WidgetErrorBoundary } from '@/components/error-boundary'
import { cn } from '@/lib/utils'

// Calendar components
import CalendarPnl from '../components/calendar/calendar-widget'
import MiniCalendarWrapper from '../components/calendar/mini-calendar-wrapper'
import RecentTradesWidget from '../components/trades/recent-trades-widget'

// KPI components
import AccountBalancePnl from '../components/kpi/account-balance-pnl'
import TradeWinRate from '../components/kpi/trade-win-rate'
import DayWinRate from '../components/kpi/day-win-rate'
import ProfitFactor from '../components/kpi/profit-factor'
import AvgWinLoss from '../components/kpi/avg-win-loss'

import SessionAnalysis from '../components/kpi/session-analysis'
import StreakKpi from '../components/kpi/streak-kpi'

// Chart components
import NetDailyPnL from '../components/charts/net-daily-pnl'
import WeekdayPnL from '../components/charts/weekday-pnl'
import TradeDurationPerformance from '../components/charts/trade-duration-performance'
import PerformanceScore from '../components/charts/performance-score'
import PnLByInstrument from '../components/charts/pnl-by-instrument'
import EquityCurveWidget from '../components/charts/equity-curve-widget'
import OutcomeDistributionWidget from '../components/charts/outcome-distribution-widget'
import DayOfWeekPerformanceWidget from '../components/charts/day-of-week-performance-widget'
import DrawdownChart from '../components/charts/drawdown-chart'
import PerformanceSummaryWidget from '../components/charts/performance-summary'
import {
  AccountCurveWidget,
  DisciplineAnalyticsWidget,
  TagPerformanceWidget,
  TimeOfDayPerformanceWidget,
} from '../components/charts/analytics-widgets'
import { PropFirmAccountStatisticsWidget } from '../components/prop-firm-widgets/prop-firm-account-statistics-widget'
import { PropFirmGrowthCurveWidget } from '../components/prop-firm-widgets/prop-firm-growth-curve-widget'
import { PropFirmObjectivesTodayWidget } from '../components/prop-firm-widgets/prop-firm-objectives-today-widget'

export interface WidgetConfig {
  type: WidgetType
  defaultSize: WidgetSize
  allowedSizes: WidgetSize[]
  category: 'charts' | 'statistics' | 'tables' | 'other'
  description?: string
  hiddenFromLibrary?: boolean
  requiresFullWidth?: boolean
  minWidth?: number
  minHeight?: number
  previewHeight?: number
  kpiRowOnly?: boolean // If true, can only be placed in row 0 (first KPI row with 5 slots)
  getComponent: (props: { size: WidgetSize }) => React.ReactElement
  getPreview: () => React.ReactElement
}

function CreateCalendarPreview() {
  const weekdays = [
    'Sun',
    'Mon',
    'Tue',
    'Wed',
    'Thu',
    'Fri',
    'Sat'
  ] as const

  return (
    <Card className="w-full h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Calendar</CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        <div className="space-y-1">
          <div className="grid grid-cols-7 gap-1 text-xs text-muted-foreground">
            {weekdays.map(day => (
              <div key={day} className="text-center p-1">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }, (_, i) => (
              <div
                key={i}
                className="aspect-square text-xs flex items-center justify-center rounded hover:bg-muted"
              >
                {i % 7 === 0 ? Math.floor(i / 7) + 1 : ''}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CreateLinePreview({ title }: { title: string }) {
  return (
    <Card className="w-full h-full">
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="p-2"><div className="h-24 rounded bg-muted/30" /></CardContent>
    </Card>
  )
}

export const WIDGET_REGISTRY: Record<WidgetType, WidgetConfig> = {
  calendarAdvanced: {
    type: 'calendarAdvanced',
    defaultSize: 'extra-large',
    allowedSizes: ['large', 'extra-large'],
    category: 'charts',
    description: 'Full calendar with daily P&L, trade counts, and performance analytics',
    previewHeight: 500,
    getComponent: () => <CalendarPnl />,
    getPreview: () => <CreateCalendarPreview />
  },
  calendarMini: {
    type: 'calendarMini',
    defaultSize: 'large',
    allowedSizes: ['medium', 'large'],
    category: 'charts',
    description: 'Compact calendar (Mon-Fri) with monthly P&L and weekly summary',
    previewHeight: 300,
    getComponent: () => <MiniCalendarWrapper />,
    getPreview: () => <CreateCalendarPreview />
  },
  recentTrades: {
    type: 'recentTrades',
    defaultSize: 'small',
    allowedSizes: ['small', 'medium', 'large'],
    category: 'tables',
    description: 'List of your 10 most recent trades with P&L and side',
    previewHeight: 300,
    getComponent: () => <RecentTradesWidget />,
    getPreview: () => (
      <Card className="w-full h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Recent Trades</CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <div className="space-y-1 text-xs text-muted-foreground">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex justify-between p-2 hover:bg-muted rounded">
                <span>AAPL</span>
                <span className="text-profit">+$125.50</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  },
  accountBalancePnl: {
    type: 'accountBalancePnl',
    defaultSize: 'kpi',
    allowedSizes: ['kpi'],
    category: 'statistics',
    description: 'Current account balance with total P&L',
    previewHeight: 80,
    kpiRowOnly: true,
    getComponent: ({ size }) => <AccountBalancePnl size={size} />,
    getPreview: () => <AccountBalancePnl size="kpi" />
  },
  tradeWinRate: {
    type: 'tradeWinRate',
    defaultSize: 'kpi',
    allowedSizes: ['kpi'],
    category: 'statistics',
    description: 'Percentage of winning trades',
    previewHeight: 80,
    kpiRowOnly: true,
    getComponent: ({ size }) => <TradeWinRate size={size} />,
    getPreview: () => <TradeWinRate size="kpi" />
  },
  dayWinRate: {
    type: 'dayWinRate',
    defaultSize: 'kpi',
    allowedSizes: ['kpi'],
    category: 'statistics',
    description: 'Percentage of profitable trading days',
    previewHeight: 80,
    kpiRowOnly: true,
    getComponent: ({ size }) => <DayWinRate size={size} />,
    getPreview: () => <DayWinRate size="kpi" />
  },
  profitFactor: {
    type: 'profitFactor',
    defaultSize: 'kpi',
    allowedSizes: ['kpi'],
    category: 'statistics',
    description: 'Total profits divided by total losses',
    previewHeight: 80,
    kpiRowOnly: true,
    getComponent: ({ size }) => <ProfitFactor size={size} />,
    getPreview: () => <ProfitFactor size="kpi" />
  },
  avgWinLoss: {
    type: 'avgWinLoss',
    defaultSize: 'kpi',
    allowedSizes: ['kpi'],
    category: 'statistics',
    description: 'Average profit on winning vs losing trades',
    previewHeight: 80,
    kpiRowOnly: true,
    getComponent: ({ size }) => <AvgWinLoss size={size} />,
    getPreview: () => <AvgWinLoss size="kpi" />
  },
  netDailyPnL: {
    type: 'netDailyPnL',
    defaultSize: 'small-long',
    allowedSizes: ['small-long', 'medium', 'large'],
    category: 'charts',
    description: 'Daily profit/loss bar chart showing wins and losses',
    previewHeight: 200,
    getComponent: ({ size }) => <NetDailyPnL size={size} />,
    getPreview: () => (
      <Card className="w-full h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Net Daily P/L</CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <div className="h-32 flex items-end gap-1">
            {Array.from({ length: 12 }).map((_, i) => {
              const isPositive = Math.random() > 0.4
              const height = Math.random() * 80 + 20
              return (
                <div
                  key={i}
                  className={cn(
                    "flex-1 rounded-t",
                    isPositive ? "bg-long" : "bg-short"
                  )}
                  style={{ height: `${height}%` }}
                />
              )
            })}
          </div>
        </CardContent>
      </Card>
    )
  },
  dailyCumulativePnL: {
    type: 'dailyCumulativePnL',
    defaultSize: 'small-long',
    allowedSizes: ['small-long', 'medium', 'large'],
    category: 'charts',
    description: 'Legacy cumulative P/L entry, now shown through Account Curve',
    hiddenFromLibrary: true,
    previewHeight: 200,
    getComponent: () => <AccountCurveWidget initialMode="cumulative" />,
    getPreview: () => (
      <Card className="w-full h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Daily Net Cumulative P/L</CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <div className="h-32 relative">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <defs>
                <linearGradient id="preview-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity="0.8" />
                  <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity="0.1" />
                </linearGradient>
              </defs>
              <path
                d="M 0,80 L 20,60 L 40,45 L 60,50 L 80,30 L 100,20 L 100,100 L 0,100 Z"
                fill="url(#preview-gradient)"
                stroke="hsl(var(--chart-2))"
                strokeWidth="2"
              />
            </svg>
          </div>
        </CardContent>
      </Card>
    )
  },
  accountBalanceChart: {
    type: 'accountBalanceChart',
    defaultSize: 'small-long',
    allowedSizes: ['small-long', 'medium', 'large'],
    category: 'charts',
    description: 'Legacy account balance entry, now shown through Account Curve',
    hiddenFromLibrary: true,
    previewHeight: 200,
    getComponent: () => <AccountCurveWidget initialMode="balance" />,
    getPreview: () => (
      <Card className="w-full h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Account Balance</CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <div className="h-32 relative">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <defs>
                <linearGradient id="balance-preview-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity="0.8" />
                  <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity="0.1" />
                </linearGradient>
              </defs>
              <path
                d="M 0,80 L 20,60 L 40,65 L 60,40 L 80,45 L 100,25 L 100,100 L 0,100 Z"
                fill="url(#balance-preview-gradient)"
                stroke="hsl(var(--chart-2))"
                strokeWidth="2"
              />
            </svg>
          </div>
        </CardContent>
      </Card>
    )
  },
  weekdayPnL: {
    type: 'weekdayPnL',
    defaultSize: 'small-long',
    allowedSizes: ['small-long', 'medium', 'large'],
    category: 'charts',
    description: 'P&L breakdown by weekday (Mon-Fri) with average toggle',
    previewHeight: 200,
    getComponent: ({ size }) => <WeekdayPnL size={size} />,
    getPreview: () => (
      <Card className="w-full h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Weekday P/L</CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <div className="h-32 flex items-end gap-1">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day, i) => {
              const isPositive = Math.random() > 0.3
              const height = Math.random() * 80 + 20
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={cn(
                      "w-full rounded-t",
                      isPositive ? "bg-long" : "bg-short"
                    )}
                    style={{ height: `${height}%` }}
                  />
                  <span className="text-[8px] text-muted-foreground">{day}</span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    )
  },
  tradeDurationPerformance: {
    type: 'tradeDurationPerformance',
    defaultSize: 'small-long',
    allowedSizes: ['small-long', 'medium', 'large'],
    category: 'charts',
    description: 'P&L by trade duration (how long positions were held)',
    previewHeight: 200,
    getComponent: ({ size }) => <TradeDurationPerformance size={size} />,
    getPreview: () => (
      <Card className="w-full h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Trade Duration Performance</CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <div className="h-32 flex items-end gap-1">
            {Array.from({ length: 6 }).map((_, i) => {
              const isPositive = Math.random() > 0.4
              const height = Math.random() * 80 + 20
              return (
                <div
                  key={i}
                  className={cn(
                    "flex-1 rounded-t",
                    isPositive ? "bg-long" : "bg-short"
                  )}
                  style={{ height: `${height}%` }}
                />
              )
            })}
          </div>
        </CardContent>
      </Card>
    )
  },
  performanceScore: {
    type: 'performanceScore',
    defaultSize: 'small-long',
    allowedSizes: ['small-long', 'medium', 'large'],
    category: 'charts',
    description: 'Overall performance score with radar chart showing 6 metrics',
    previewHeight: 200,
    getComponent: ({ size }) => <PerformanceScore size={size} />,
    getPreview: () => (
      <Card className="w-full h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Performance Score</CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <div className="h-32 relative flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <defs>
                <linearGradient id="score-gradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="hsl(var(--destructive))" />
                  <stop offset="50%" stopColor="hsl(var(--warning))" />
                  <stop offset="100%" stopColor="hsl(var(--chart-2))" />
                </linearGradient>
              </defs>
              <polygon
                points="50,20 70,40 70,70 50,80 30,70 30,40"
                fill="hsl(var(--chart-3))"
                fillOpacity="0.3"
                stroke="hsl(var(--chart-3))"
                strokeWidth="2"
              />
              <text x="50" y="55" textAnchor="middle" fontSize="16" fill="currentColor" fontWeight="bold">
                75
              </text>
            </svg>
          </div>
        </CardContent>
      </Card>
    )
  },
  pnlByInstrument: {
    type: 'pnlByInstrument',
    defaultSize: 'small-long',
    allowedSizes: ['small-long', 'medium', 'large'],
    category: 'charts',
    description: 'P&L breakdown by trading instrument/pair with metrics',
    previewHeight: 250,
    getComponent: ({ size }) => <PnLByInstrument size={size} />,
    getPreview: () => (
      <Card className="w-full h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">P&L by Instrument</CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span>NAS100</span>
              <span className="text-profit font-medium">$1,240</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span>EURUSD</span>
              <span className="text-loss font-medium">-$320</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span>GOLD</span>
              <span className="text-profit font-medium">$890</span>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  },
  pnlByStrategy: {
    type: 'pnlByStrategy',
    defaultSize: 'small-long',
    allowedSizes: ['small-long', 'medium', 'large'],
    category: 'charts',
    description: 'P&L performance by trading strategy/model with win/loss stats',
    hiddenFromLibrary: true,
    previewHeight: 250,
    getComponent: () => <PerformanceSummaryWidget />,
    getPreview: () => (
      <Card className="w-full h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">P&L by Strategy</CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span>ICT 2022</span>
              <span className="text-profit font-medium">$2,140</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span>MSNR</span>
              <span className="text-profit font-medium">$780</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span>Price Action</span>
              <span className="text-loss font-medium">-$420</span>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  },
  winRateByStrategy: {
    type: 'winRateByStrategy',
    defaultSize: 'small-long',
    allowedSizes: ['small-long', 'medium', 'large'],
    category: 'charts',
    description: 'Win rate distribution and success metrics by strategy',
    hiddenFromLibrary: true,
    previewHeight: 250,
    getComponent: () => <PerformanceSummaryWidget />,
    getPreview: () => (
      <Card className="w-full h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Win Rate by Strategy</CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span>ICT 2022</span>
              <span className="text-profit font-medium">72%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span>MSNR</span>
              <span className="text-profit font-medium">68%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span>Price Action</span>
              <span className="text-muted-foreground font-medium">45%</span>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  },

  sessionAnalysis: {
    type: 'sessionAnalysis',
    defaultSize: 'small-long',
    allowedSizes: ['small', 'small-long', 'medium', 'large'],
    category: 'statistics',
    description: 'Performance breakdown by trading session',
    previewHeight: 200,
    getComponent: ({ size }) => <SessionAnalysis size={size as any} />,
    getPreview: () => (
      <Card className="w-full h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Session Analysis</CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <div className="space-y-2 text-xs">
            <div className="p-2 bg-chart-1/10 rounded"><span>Asia</span></div>
            <div className="p-2 bg-warning/10 rounded"><span>New York</span></div>
          </div>
        </CardContent>
      </Card>
    )
  },
  equityCurve: {
    type: 'equityCurve',
    defaultSize: 'large',
    allowedSizes: ['medium', 'large', 'extra-large'],
    category: 'charts',
    description: 'Cumulative equity curve over time',
    hiddenFromLibrary: true,
    previewHeight: 250,
    getComponent: () => <EquityCurveWidget />,
    getPreview: () => (
      <Card className="w-full h-full">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Equity Curve</CardTitle></CardHeader>
        <CardContent className="p-2"><div className="h-20 bg-chart-1/10 rounded" /></CardContent>
      </Card>
    )
  },
  outcomeDistribution: {
    type: 'outcomeDistribution',
    defaultSize: 'medium',
    allowedSizes: ['small', 'medium', 'large'],
    category: 'charts',
    description: 'Win/Loss/Breakeven trade distribution',
    previewHeight: 250,
    getComponent: () => <OutcomeDistributionWidget />,
    getPreview: () => (
      <Card className="w-full h-full">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Outcome Distribution</CardTitle></CardHeader>
        <CardContent className="p-2"><div className="h-20 bg-chart-2/10 rounded-full mx-auto w-20" /></CardContent>
      </Card>
    )
  },
  dayOfWeekPerformance: {
    type: 'dayOfWeekPerformance',
    defaultSize: 'medium',
    allowedSizes: ['medium', 'large'],
    category: 'charts',
    description: 'P&L performance by day of week',
    hiddenFromLibrary: true,
    previewHeight: 250,
    getComponent: () => <DayOfWeekPerformanceWidget />,
    getPreview: () => (
      <Card className="w-full h-full">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Day of Week</CardTitle></CardHeader>
        <CardContent className="p-2"><div className="flex gap-1 items-end h-16">{[40,60,30,80,50].map((h,i)=><div key={i} className="flex-1 bg-chart-1/20 rounded-t" style={{height:`${h}%`}} />)}</div></CardContent>
      </Card>
    )
  },
  drawdown: {
    type: 'drawdown',
    defaultSize: 'small-long',
    allowedSizes: ['small-long', 'medium', 'large'],
    category: 'charts',
    description: 'Drawdown from peak equity over time',
    previewHeight: 200,
    getComponent: ({ size }) => <DrawdownChart size={size} />,
    getPreview: () => (
      <Card className="w-full h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Drawdown</CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <div className="h-32 relative">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <defs>
                <linearGradient id="dd-preview" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-loss))" stopOpacity="0.4" />
                  <stop offset="95%" stopColor="hsl(var(--chart-loss))" stopOpacity="0.05" />
                </linearGradient>
              </defs>
              <path
                d="M 0,10 L 15,40 L 25,10 L 35,10 L 45,10 L 55,60 L 65,80 L 75,50 L 85,10 L 100,10 L 100,10 L 0,10 Z"
                fill="url(#dd-preview)"
                stroke="hsl(var(--chart-loss))"
                strokeWidth="2"
              />
            </svg>
          </div>
        </CardContent>
      </Card>
    )
  },
  performanceSummary: {
    type: 'performanceSummary',
    defaultSize: 'extra-large',
    allowedSizes: ['large', 'extra-large'],
    category: 'charts',
    description: 'Full-width performance diagnostics with strategy P&L and win rate',
    previewHeight: 260,
    getComponent: () => <PerformanceSummaryWidget />,
    getPreview: () => (
      <Card className="w-full h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Performance</CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <div className="flex gap-2 h-20">
            <div className="flex-1 bg-chart-profit/10 rounded" />
            <div className="w-20 space-y-1">
              {[1,2,3,4].map(i => <div key={i} className="h-3 bg-muted/30 rounded" />)}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  },
  streakKpi: {
    type: 'streakKpi',
    defaultSize: 'kpi',
    allowedSizes: ['kpi'],
    category: 'statistics',
    description: 'Current trade streak with longest win/loss records',
    previewHeight: 80,
    kpiRowOnly: true,
    getComponent: ({ size }) => <StreakKpi size={size} />,
    getPreview: () => <StreakKpi size="kpi" />
  },
  accountProgression: {
    type: 'accountProgression',
    defaultSize: 'large',
    allowedSizes: ['medium', 'large', 'extra-large'],
    category: 'charts',
    description: 'Cumulative P/L and account balance in one area-curve view',
    previewHeight: 260,
    getComponent: () => <AccountCurveWidget />,
    getPreview: () => <CreateLinePreview title="Account Curve" />,
  },
  tagPerformance: {
    type: 'tagPerformance',
    defaultSize: 'small-long',
    allowedSizes: ['small-long', 'medium', 'large'],
    category: 'charts',
    description: 'Tag, setup, and mistake performance ranked by P&L, win rate, expectancy, and profit factor',
    previewHeight: 250,
    getComponent: () => <TagPerformanceWidget />,
    getPreview: () => <CreateLinePreview title="Tag Performance" />,
  },
  timeOfDayPerformance: {
    type: 'timeOfDayPerformance',
    defaultSize: 'medium',
    allowedSizes: ['medium', 'large'],
    category: 'charts',
    description: 'Hourly trading performance heatmap for intraday timing review',
    previewHeight: 220,
    getComponent: () => <TimeOfDayPerformanceWidget />,
    getPreview: () => <CreateLinePreview title="Time of Day" />,
  },
  disciplineAnalytics: {
    type: 'disciplineAnalytics',
    defaultSize: 'medium',
    allowedSizes: ['medium', 'large'],
    category: 'statistics',
    description: 'Rule adherence, playbook coverage, and discipline performance summary',
    previewHeight: 220,
    getComponent: () => <DisciplineAnalyticsWidget />,
    getPreview: () => <CreateLinePreview title="Discipline" />,
  },
  propFirmObjectivesToday: {
    type: 'propFirmObjectivesToday',
    defaultSize: 'extra-large',
    allowedSizes: ['extra-large'],
    category: 'statistics',
    description: 'Prop firm objectives, drawdown limits, and today’s current-phase stats',
    requiresFullWidth: true,
    previewHeight: 280,
    getComponent: () => <PropFirmObjectivesTodayWidget />,
    getPreview: () => <CreateLinePreview title="Prop Firm Objectives" />,
  },
  propFirmAccountStatistics: {
    type: 'propFirmAccountStatistics',
    defaultSize: 'extra-large',
    allowedSizes: ['extra-large'],
    category: 'statistics',
    description: 'Full-width prop firm account statistics for the selected challenge',
    requiresFullWidth: true,
    previewHeight: 280,
    getComponent: () => <PropFirmAccountStatisticsWidget />,
    getPreview: () => <CreateLinePreview title="Prop Firm Stats" />,
  },
  propFirmGrowthCurve: {
    type: 'propFirmGrowthCurve',
    defaultSize: 'extra-large',
    allowedSizes: ['extra-large'],
    category: 'charts',
    description: 'Selected prop firm challenge growth curve with target and drawdown references',
    requiresFullWidth: true,
    previewHeight: 340,
    getComponent: () => <PropFirmGrowthCurveWidget />,
    getPreview: () => <CreateLinePreview title="Prop Firm Growth" />,
  },
}

function getWidgetsByCategory(category: WidgetConfig['category']) {
  return Object.values(WIDGET_REGISTRY).filter(widget => widget.category === category)
}

function isValidWidgetSize(type: WidgetType, size: WidgetSize): boolean {
  return WIDGET_REGISTRY[type].allowedSizes.includes(size)
}

export function requiresFullWidth(type: WidgetType): boolean {
  return WIDGET_REGISTRY[type].requiresFullWidth || false
}

function isKpiRowOnly(type: WidgetType): boolean {
  return WIDGET_REGISTRY[type].kpiRowOnly || false
}

function canPlaceWidgetInRow(type: WidgetType, row: number): boolean {
  // If widget is KPI-only, it can only be placed in row 0 (first row with 5 KPI slots)
  if (isKpiRowOnly(type)) {
    return row === 0
  }
  // Other widgets can be placed anywhere except row 0 (reserved for KPIs)
  return row > 0
}

function getWidgetComponent(type: WidgetType, size: WidgetSize): React.ReactElement {
  return (
    <WidgetErrorBoundary widgetType={type}>
      {WIDGET_REGISTRY[type].getComponent({ size })}
    </WidgetErrorBoundary>
  )
}

function getWidgetPreview(type: WidgetType): React.ReactElement {
  return WIDGET_REGISTRY[type].getPreview()
} 
