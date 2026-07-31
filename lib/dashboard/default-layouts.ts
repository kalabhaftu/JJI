import { WidgetType, WidgetSize } from '@/app/dashboard/types/dashboard'

type PrismaDashboardLayout = {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  desktop: any[];
  mobile: any[];
};

// Original default layouts (without KPI widgets) - used for existing users to prevent flash
export const defaultLayouts: PrismaDashboardLayout = {
  id: '',
  userId: '',
  createdAt: new Date(),
  updatedAt: new Date(),
  desktop: [
    {
      "i": "widget-net-pnl-kpi",
      "type": "netPnlKpi",
      "size": "kpi",
      "x": 0,
      "y": 0,
      "w": 2.4,
      "h": 1.8
    },
    {
      "i": "widget-win-rate-kpi",
      "type": "winRateKpi",
      "size": "kpi",
      "x": 2.4,
      "y": 0,
      "w": 2.4,
      "h": 1.8
    },
    {
      "i": "widget-profit-factor-kpi",
      "type": "profitFactorKpi",
      "size": "kpi",
      "x": 4.8,
      "y": 0,
      "w": 2.4,
      "h": 1.8
    },
    {
      "i": "widget-day-win-rate-kpi",
      "type": "dayWinRateKpi",
      "size": "kpi",
      "x": 7.2,
      "y": 0,
      "w": 2.4,
      "h": 1.8
    },
    {
      "i": "widget-avg-win-loss-kpi",
      "type": "avgWinLossKpi",
      "size": "kpi",
      "x": 9.6,
      "y": 0,
      "w": 2.4,
      "h": 1.8
    },
    
    {
      "i": "widget1752135396857",
      "type": "statisticsWidget",
      "size": "medium",
      "x": 0,
      "y": 3,
      "w": 6,
      "h": 4
    },
    {
      "i": "widget1752135370000",
      "type": "tradeDistribution",
      "size": "medium",
      "x": 6,
      "y": 3,
      "w": 6,
      "h": 4
    },
    
    {
      "i": "widget1752135357688",
      "type": "weekdayPnlChart",
      "size": "medium",
      "x": 0,
      "y": 7,
      "w": 6,
      "h": 4
    },
    {
      "i": "widget1752135361015",
      "type": "timeInPositionChart",
      "size": "medium",
      "x": 6,
      "y": 7,
      "w": 6,
      "h": 4
    },
    
    {
      "i": "widget1751403095730",
      "type": "calendarAdvanced",
      "size": "extra-large",
      "x": 0,
      "y": 11,
      "w": 12,
      "h": 6
    },

    {
      "i": "widget1752135363430",
      "type": "equityChart",
      "size": "large",
      "x": 0,
      "y": 14,
      "w": 6,
      "h": 8
    },
    {
      "i": "widget1751741589330",
      "type": "pnlChart",
      "size": "medium",
      "x": 6,
      "y": 14,
      "w": 6,
      "h": 4
    },

    {
      "i": "widget1752135359621",
      "type": "timeOfDayChart",
      "size": "medium",
      "x": 6,
      "y": 18,
      "w": 6,
      "h": 4
    },

    {
      "i": "widget1752135365730",
      "type": "pnlBySideChart",
      "size": "medium",
      "x": 0,
      "y": 23,
      "w": 6,
      "h": 4
    },
    {
      "i": "widget1752135368429",
      "type": "radarChart",
      "size": "medium",
      "x": 6,
      "y": 23,
      "w": 6,
      "h": 4
    },
    {
      "i": "widget1752135370579",
      "type": "commissionsPnl",
      "size": "medium",
      "x": 0,
      "y": 27,
      "w": 6,
      "h": 4
    },
    {
      "i": "widget1752135378584",
      "type": "timeRangePerformance",
      "size": "medium",
      "x": 6,
      "y": 27,
      "w": 6,
      "h": 4
    },

    {
      "i": "widget1752135435916",
      "type": "riskRewardRatio",
      "size": "tiny",
      "x": 0,
      "y": 31,
      "w": 3,
      "h": 1
    },
    {
      "i": "widget1752135437611",
      "type": "profitFactor",
      "size": "tiny",
      "x": 3,
      "y": 31,
      "w": 3,
      "h": 1
    },
    {
      "i": "widget1752135441717",
      "type": "cumulativePnl",
      "size": "tiny",
      "x": 6,
      "y": 31,
      "w": 3,
      "h": 1
    },
    {
      "i": "widget1752135443857",
      "type": "tradePerformance",
      "size": "tiny",
      "x": 9,
      "y": 31,
      "w": 3,
      "h": 1
    },

    {
      "i": "widget1752135445916",
      "type": "winningStreak",
      "size": "tiny",
      "x": 0,
      "y": 32,
      "w": 3,
      "h": 1
    },
    {
      "i": "widget1752135449717",
      "type": "averagePositionTime",
      "size": "tiny",
      "x": 3,
      "y": 32,
      "w": 3,
      "h": 1
    },
    {
      "i": "widget1752135451857",
      "type": "longShortPerformance",
      "size": "tiny",
      "x": 6,
      "y": 32,
      "w": 3,
      "h": 1
    },
    {
      "i": "widget1752135448000",
      "type": "advancedMetrics",
      "size": "tiny",
      "x": 9,
      "y": 32,
      "w": 3,
      "h": 1
    },
    
  ],
  mobile: [
    {
      i: "mobile-net-pnl-kpi",
      type: "netPnlKpi" as WidgetType,
      size: "kpi" as WidgetSize,
      x: 0,
      y: 0,
      w: 12,
      h: 3
    },
    {
      i: "mobile-win-rate-kpi",
      type: "winRateKpi" as WidgetType,
      size: "kpi" as WidgetSize,
      x: 0,
      y: 3,
      w: 12,
      h: 3
    },
    {
      i: "mobile-profit-factor-kpi",
      type: "profitFactorKpi" as WidgetType,
      size: "kpi" as WidgetSize,
      x: 0,
      y: 6,
      w: 12,
      h: 3
    },
    {
      i: "mobile-day-win-rate-kpi",
      type: "dayWinRateKpi" as WidgetType,
      size: "kpi" as WidgetSize,
      x: 0,
      y: 9,
      w: 12,
      h: 3
    },
    {
      i: "mobile-avg-win-loss-kpi",
      type: "avgWinLossKpi" as WidgetType,
      size: "kpi" as WidgetSize,
      x: 0,
      y: 12,
      w: 12,
      h: 3
    },
    
    {
      i: "statisticsWidget",
      type: "statisticsWidget" as WidgetType,
      size: "medium" as WidgetSize,
      x: 0,
      y: 15,
      w: 12,
      h: 4
    },
    {
      i: "calendarWidget",
      type: "calendarAdvanced" as WidgetType,
      size: "extra-large" as WidgetSize,
      x: 0,
      y: 19,
      w: 12,
      h: 6
    },
    {
      i: "equityChart",
      type: "equityChart" as WidgetType,
      size: "medium" as WidgetSize,
      x: 0,
      y: 25,
      w: 12,
      h: 6
    },

    {
      i: "cumulativePnl",
      type: "cumulativePnl" as WidgetType,
      size: "tiny" as WidgetSize,
      x: 0,
      y: 31,
      w: 12,
      h: 1
    },
    {
      i: "tradePerformance",
      type: "tradePerformance" as WidgetType,
      size: "tiny" as WidgetSize,
      x: 0,
      y: 17,
      w: 12,
      h: 1
    },
    {
      i: "profitFactor",
      type: "profitFactor" as WidgetType,
      size: "tiny" as WidgetSize,
      x: 0,
      y: 23,
      w: 12,
      h: 1
    },

    {
      i: "pnlChart",
      type: "pnlChart" as WidgetType,
      size: "medium" as WidgetSize,
      x: 0,
      y: 24,
      w: 12,
      h: 4
    },
    {
      i: "weekdayPnlChart",
      type: "weekdayPnlChart" as WidgetType,
      size: "medium" as WidgetSize,
      x: 0,
      y: 28,
      w: 12,
      h: 4
    },
    {
      i: "timeOfDayChart",
      type: "timeOfDayChart" as WidgetType,
      size: "medium" as WidgetSize,
      x: 0,
      y: 32,
      w: 12,
      h: 4
    },
    
  ]
};

// New default layouts with KPI widgets - used only for new users and reset functionality
const defaultLayoutsWithKPI: PrismaDashboardLayout = {
  id: '',
  userId: '',
  createdAt: new Date(),
  updatedAt: new Date(),
  desktop: [
    {
      "i": "kpi-net-pnl",
      "type": "netPnlKpi",
      "size": "kpi",
      "x": 0,
      "y": 0,
      "w": 2.4,
      "h": 1.8
    },
    {
      "i": "kpi-win-rate",
      "type": "winRateKpi",
      "size": "kpi",
      "x": 2.4,
      "y": 0,
      "w": 2.4,
      "h": 1.8
    },
    {
      "i": "kpi-profit-factor",
      "type": "profitFactorKpi",
      "size": "kpi",
      "x": 4.8,
      "y": 0,
      "w": 2.4,
      "h": 1.8
    },
    {
      "i": "kpi-day-win-rate",
      "type": "dayWinRateKpi",
      "size": "kpi",
      "x": 7.2,
      "y": 0,
      "w": 2.4,
      "h": 1.8
    },
    {
      "i": "kpi-avg-win-loss",
      "type": "avgWinLossKpi",
      "size": "kpi",
      "x": 9.6,
      "y": 0,
      "w": 2.4,
      "h": 1.8
    },
    
    {
      "i": "widget1752135396857",
      "type": "statisticsWidget",
      "size": "medium",
      "x": 0,
      "y": 3,
      "w": 6,
      "h": 4
    },
    {
      "i": "widget1752135370000",
      "type": "tradeDistribution",
      "size": "medium",
      "x": 6,
      "y": 3,
      "w": 6,
      "h": 4
    },
    
    {
      "i": "widget1752135357688",
      "type": "weekdayPnlChart",
      "size": "medium",
      "x": 0,
      "y": 7,
      "w": 6,
      "h": 4
    },
    {
      "i": "widget1752135361015",
      "type": "timeInPositionChart",
      "size": "medium",
      "x": 6,
      "y": 7,
      "w": 6,
      "h": 4
    },
    
    {
      "i": "widget1751403095730",
      "type": "calendarAdvanced",
      "size": "extra-large",
      "x": 0,
      "y": 11,
      "w": 12,
      "h": 6
    },

    {
      "i": "widget1752135363430",
      "type": "equityChart",
      "size": "large",
      "x": 0,
      "y": 17,
      "w": 6,
      "h": 8
    },
    {
      "i": "widget1751741589330",
      "type": "pnlChart",
      "size": "medium",
      "x": 6,
      "y": 17,
      "w": 6,
      "h": 4
    },

    {
      "i": "widget1752135359621",
      "type": "timeOfDayChart",
      "size": "medium",
      "x": 6,
      "y": 21,
      "w": 6,
      "h": 4
    },

    {
      "i": "widget1752135365730",
      "type": "pnlBySideChart",
      "size": "medium",
      "x": 0,
      "y": 25,
      "w": 6,
      "h": 4
    },
    {
      "i": "widget1752135368429",
      "type": "tickDistribution",
      "size": "medium",
      "x": 6,
      "y": 25,
      "w": 6,
      "h": 4
    },
    {
      "i": "widget1752135370579",
      "type": "commissionsPnl",
      "size": "medium",
      "x": 0,
      "y": 29,
      "w": 6,
      "h": 4
    },
    {
      "i": "widget1752135378584",
      "type": "timeRangePerformance",
      "size": "medium",
      "x": 6,
      "y": 29,
      "w": 6,
      "h": 4
    },

    {
      "i": "widget1752135435916",
      "type": "riskRewardRatio",
      "size": "tiny",
      "x": 0,
      "y": 33,
      "w": 3,
      "h": 1
    },
    {
      "i": "widget1752135437611",
      "type": "profitFactor",
      "size": "tiny",
      "x": 3,
      "y": 33,
      "w": 3,
      "h": 1
    },
    {
      "i": "widget1752135441717",
      "type": "cumulativePnl",
      "size": "tiny",
      "x": 6,
      "y": 33,
      "w": 3,
      "h": 1
    },
    {
      "i": "widget1752135443857",
      "type": "tradePerformance",
      "size": "tiny",
      "x": 9,
      "y": 33,
      "w": 3,
      "h": 1
    },

    {
      "i": "widget1752135445916",
      "type": "winningStreak",
      "size": "tiny",
      "x": 0,
      "y": 34,
      "w": 3,
      "h": 1
    },
    {
      "i": "widget1752135449717",
      "type": "averagePositionTime",
      "size": "tiny",
      "x": 3,
      "y": 34,
      "w": 3,
      "h": 1
    },
    {
      "i": "widget1752135451857",
      "type": "longShortPerformance",
      "size": "tiny",
      "x": 6,
      "y": 34,
      "w": 3,
      "h": 1
    },
    {
      "i": "widget1752135448000",
      "type": "advancedMetrics",
      "size": "tiny",
      "x": 9,
      "y": 34,
      "w": 3,
      "h": 1
    },
    
  ],
  mobile: [
    {
      i: "kpi-net-pnl-mobile",
      type: "netPnlKpi" as WidgetType,
      size: "kpi" as WidgetSize,
      x: 0,
      y: 0,
      w: 12,
      h: 3
    },
    {
      i: "kpi-win-rate-mobile",
      type: "winRateKpi" as WidgetType,
      size: "kpi" as WidgetSize,
      x: 0,
      y: 3,
      w: 12,
      h: 3
    },
    {
      i: "kpi-profit-factor-mobile",
      type: "profitFactorKpi" as WidgetType,
      size: "kpi" as WidgetSize,
      x: 0,
      y: 6,
      w: 12,
      h: 3
    },
    {
      i: "kpi-day-win-rate-mobile",
      type: "dayWinRateKpi" as WidgetType,
      size: "kpi" as WidgetSize,
      x: 0,
      y: 9,
      w: 12,
      h: 3
    },
    {
      i: "kpi-avg-win-loss-mobile",
      type: "avgWinLossKpi" as WidgetType,
      size: "kpi" as WidgetSize,
      x: 0,
      y: 12,
      w: 12,
      h: 3
    },
    
    {
      i: "statisticsWidget",
      type: "statisticsWidget" as WidgetType,
      size: "medium" as WidgetSize,
      x: 0,
      y: 15,
      w: 12,
      h: 4
    },
    {
      i: "calendarWidget",
      type: "calendarAdvanced" as WidgetType,
      size: "extra-large" as WidgetSize,
      x: 0,
      y: 19,
      w: 12,
      h: 6
    },
    {
      i: "equityChart",
      type: "equityChart" as WidgetType,
      size: "medium" as WidgetSize,
      x: 0,
      y: 25,
      w: 12,
      h: 6
    },

    {
      i: "cumulativePnl",
      type: "cumulativePnl" as WidgetType,
      size: "tiny" as WidgetSize,
      x: 0,
      y: 31,
      w: 12,
      h: 1
    },
    {
      i: "tradePerformance",
      type: "tradePerformance" as WidgetType,
      size: "tiny" as WidgetSize,
      x: 0,
      y: 32,
      w: 12,
      h: 1
    },
    {
      i: "profitFactor",
      type: "profitFactor" as WidgetType,
      size: "tiny" as WidgetSize,
      x: 0,
      y: 33,
      w: 12,
      h: 1
    },

    {
      i: "pnlChart",
      type: "pnlChart" as WidgetType,
      size: "medium" as WidgetSize,
      x: 0,
      y: 34,
      w: 12,
      h: 4
    },
    {
      i: "weekdayPnlChart",
      type: "weekdayPnlChart" as WidgetType,
      size: "medium" as WidgetSize,
      x: 0,
      y: 38,
      w: 12,
      h: 4
    },
    {
      i: "timeOfDayChart",
      type: "timeOfDayChart" as WidgetType,
      size: "medium" as WidgetSize,
      x: 0,
      y: 42,
      w: 12,
      h: 4
    },
    
  ]
};
