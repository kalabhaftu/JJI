'use client'

import { useMemo } from 'react'
import { endOfWeek, format, parseISO, startOfWeek } from 'date-fns'
import { enUS } from 'date-fns/locale'
import type { CalendarData } from '@/app/dashboard/types/calendar'
import type { TradeType } from '@/lib/db/schema/trades'
import { classifyOutcome } from '@/lib/metrics/outcome'
import { getTradeNetPnl } from '@/lib/metrics/pnl'
import { getTradingSession } from '@/lib/time-utils'
import { groupTradesByExecution, type GroupedTrade } from '@/lib/trading/trade-grouping'

type WeeklyModalMetricsInput = {
  selectedDate: Date | null
  calendarData: CalendarData
  breakEvenThreshold: number
}

export function useWeeklyModalMetrics({
  selectedDate,
  calendarData,
  breakEvenThreshold,
}: WeeklyModalMetricsInput) {
// Aggregate weekly data
  const weeklyData = useMemo(() => {
    if (!selectedDate) return { trades: [], tradeNumber: 0, pnl: 0, longNumber: 0, shortNumber: 0, winRate: 0, avgWin: 0, avgLoss: 0, winningTrades: 0, losingTrades: 0 }

    const trades: any[] = []
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 })
    const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 0 })

    // Format week boundaries as YYYY-MM-DD strings for consistent comparison
    // This avoids timezone issues when comparing against dateString keys
    const weekStartStr = format(weekStart, 'yyyy-MM-dd')
    const weekEndStr = format(weekEnd, 'yyyy-MM-dd')

    for (const [dateString, dayData] of Object.entries(calendarData)) {
      // Compare date strings directly to avoid timezone parsing issues
      if (dateString >= weekStartStr && dateString <= weekEndStr && dayData.trades) {
        trades.push(...(dayData.trades as any[]))
      }
    }

    // CRITICAL: Group trades to show correct execution count
    const groupedTrades = groupTradesByExecution(trades as TradeType[]) as GroupedTrade[]

    let longNumber = 0
    let shortNumber = 0
    let winningTrades = 0
    let losingTrades = 0
    let pnl = 0
    let winPnl = 0
    let lossPnl = 0

    for (const trade of groupedTrades) {
      const side = (trade as any).side
      const sideValue = typeof side === 'string' ? side.toLowerCase() : ''
      if (sideValue === 'long' || sideValue === 'buy') longNumber += 1
      if (sideValue === 'short' || sideValue === 'sell') shortNumber += 1

      const netPnl = getTradeNetPnl(trade)
      pnl += netPnl
      const outcome = classifyOutcome(netPnl, breakEvenThreshold)
      if (outcome === 'win') {
        winningTrades += 1
        winPnl += netPnl
      } else if (outcome === 'loss') {
        losingTrades += 1
        lossPnl += netPnl
      }
    }

    const winRate = (winningTrades + losingTrades) > 0 ? (winningTrades / (winningTrades + losingTrades)) * 100 : 0
    const avgWin = winningTrades > 0 ? winPnl / winningTrades : 0
    const avgLoss = losingTrades > 0 ? Math.abs(lossPnl) / losingTrades : 0

    return {
      trades: groupedTrades,
      tradeNumber: groupedTrades.length,
      pnl,
      longNumber,
      shortNumber,
      winRate,
      avgWin,
      avgLoss,
      winningTrades,
      losingTrades
    }
  }, [selectedDate, calendarData, breakEvenThreshold])

  const stats = useMemo(() => {
    if (weeklyData.trades.length === 0) return null

    const dayStats: Record<string, { pnl: number; trades: number }> = {}
    const pairStats: Record<string, { pnl: number; trades: number; wins: number }> = {}
    const sessionStats: Record<string, { pnl: number; trades: number }> = {}
    let grossProfit = 0
    let grossLoss = 0

    weeklyData.trades.forEach((trade: any) => {
      // Day Stats
      const day = format(new Date(trade.entryDate), 'EEEE')
      const netPnL = getTradeNetPnl(trade)
      if (!dayStats[day]) dayStats[day] = { pnl: 0, trades: 0 }
      dayStats[day].pnl += netPnL
      dayStats[day].trades += 1

      // Pair Stats
      const pair = trade.instrument || 'Unknown'
      if (!pairStats[pair]) pairStats[pair] = { pnl: 0, trades: 0, wins: 0 }
      pairStats[pair].pnl += netPnL
      pairStats[pair].trades += 1
      if (classifyOutcome(netPnL, breakEvenThreshold) === 'win') pairStats[pair].wins += 1

      // Session Stats (proper timezone handling)
      const session = getTradingSession(trade.entryDate)
      if (!sessionStats[session]) sessionStats[session] = { pnl: 0, trades: 0 }
      sessionStats[session].pnl += netPnL
      sessionStats[session].trades += 1

      const outcome = classifyOutcome(netPnL, breakEvenThreshold)
      if (outcome === 'win') grossProfit += netPnL
      if (outcome === 'loss') grossLoss += netPnL
    })

    const sortedDays = Object.entries(dayStats).sort((a, b) => b[1].pnl - a[1].pnl)
    const sortedPairs = Object.entries(pairStats).sort((a, b) => b[1].pnl - a[1].pnl)
    const sortedSessions = Object.entries(sessionStats).sort((a, b) => b[1].pnl - a[1].pnl)

    const absoluteGrossLoss = Math.abs(grossLoss)
    const profitFactor = absoluteGrossLoss > 0 ? grossProfit / absoluteGrossLoss : grossProfit > 0 ? Infinity : 0

    return {
      bestDay: sortedDays[0],
      worstDay: sortedDays[sortedDays.length - 1],
      bestPair: sortedPairs[0],
      worstPair: sortedPairs[sortedPairs.length - 1],
      bestSession: sortedSessions[0],
      dayStats,
      pairStats: sortedPairs,
      sessionStats: sortedSessions,
      profitFactor,
      grossProfit,
      grossLoss: absoluteGrossLoss
    }
  }, [weeklyData, breakEvenThreshold])

  // Chart data for cumulative P&L
  const chartData = useMemo(() => {
    if (!selectedDate) return []

    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 })
    const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 0 })

    // Format week boundaries as YYYY-MM-DD strings for consistent comparison
    const weekStartStr = format(weekStart, 'yyyy-MM-dd')
    const weekEndStr = format(weekEnd, 'yyyy-MM-dd')

    const dailyData: Record<string, number> = {}
    for (const [dateString, dayData] of Object.entries(calendarData)) {
      // Compare date strings directly to avoid timezone parsing issues
      if (dateString >= weekStartStr && dateString <= weekEndStr) {
        dailyData[dateString] = dayData.pnl || 0
      }
    }

    const sortedDates = Object.keys(dailyData).sort()
    let cumulative = 0

    return sortedDates.map((date) => {
      cumulative += dailyData[date] ?? 0
      return {
        date,
        balance: cumulative,
        daily: dailyData[date],
        // Use parseISO to treat YYYY-MM-DD as local midnight, avoiding timezone shifts
        label: format(parseISO(date), 'EEE', { locale: enUS })
      }
    })
  }, [selectedDate, calendarData])

  return { weeklyData, stats, chartData }
}

export type WeeklyModalMetrics = ReturnType<typeof useWeeklyModalMetrics>
