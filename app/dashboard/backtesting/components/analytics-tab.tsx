'use client'

import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BacktestTrade } from '@/types/backtesting-types'
import { HugeiconsIcon } from '@hugeicons/react'
import { BarChartIcon, ArrowUp01Icon, CalendarDaysIcon, Target01Icon } from '@hugeicons/core-free-icons'

interface AnalyticsTabProps {
  backtests: BacktestTrade[]
}

export function AnalyticsTab({ backtests }: AnalyticsTabProps) {
  const analytics = useMemo(() => {
    if (backtests.length === 0) return null

    const wins = backtests.filter(b => b.outcome === 'WIN').length
    const losses = backtests.filter(b => b.outcome === 'LOSS').length
    const total = backtests.length
    const winRate = total > 0 ? (wins / total) * 100 : 0

    const byModel = backtests.reduce((acc, b) => {
      const model = b.customModel || b.model
      if (!acc[model]) {
        acc[model] = { total: 0, wins: 0, losses: 0, totalPnl: 0 }
      }
      acc[model].total++
      if (b.outcome === 'WIN') acc[model].wins++
      if (b.outcome === 'LOSS') acc[model].losses++
      acc[model].totalPnl += (b.pnl || 0)
      return acc
    }, {} as Record<string, { total: number; wins: number; losses: number; totalPnl: number }>)

    const bySession = backtests.reduce((acc, b) => {
      if (!acc[b.session]) {
        acc[b.session] = { total: 0, wins: 0, losses: 0, totalPnl: 0 }
      }
      acc[b.session]!.total++
      if (b.outcome === 'WIN') acc[b.session]!.wins++
      if (b.outcome === 'LOSS') acc[b.session]!.losses++
      acc[b.session]!.totalPnl += (b.pnl || 0)
      return acc
    }, {} as Record<string, { total: number; wins: number; losses: number; totalPnl: number }>)

    const byDirection = backtests.reduce((acc, b) => {
      if (!acc[b.direction]) {
        acc[b.direction] = { total: 0, wins: 0, losses: 0, totalPnl: 0 }
      }
      acc[b.direction]!.total++
      if (b.outcome === 'WIN') acc[b.direction]!.wins++
      if (b.outcome === 'LOSS') acc[b.direction]!.losses++
      acc[b.direction]!.totalPnl += (b.pnl || 0)
      return acc
    }, {} as Record<string, { total: number; wins: number; losses: number; totalPnl: number }>)

    const byPair = backtests.reduce((acc, b) => {
      if (!acc[b.pair]) {
        acc[b.pair] = { total: 0, wins: 0, losses: 0, totalPnl: 0, avgRR: 0, totalWinPips: 0, totalLossPips: 0 }
      }
      acc[b.pair]!.total++
      if (b.outcome === 'WIN') {
        acc[b.pair]!.wins++
        acc[b.pair]!.totalWinPips += (b.pnl || 0)
      }
      if (b.outcome === 'LOSS') {
        acc[b.pair]!.losses++
        acc[b.pair]!.totalLossPips += Math.abs(b.pnl || 0)
      }
      acc[b.pair]!.totalPnl += (b.pnl || 0)
      acc[b.pair]!.avgRR += (b.riskRewardRatio || 0)
      return acc
    }, {} as Record<string, { total: number; wins: number; losses: number; totalPnl: number; avgRR: number; totalWinPips: number; totalLossPips: number }>)

    Object.keys(byPair).forEach(pair => {
      byPair[pair]!.avgRR = byPair[pair]!.total > 0 ? byPair[pair]!.avgRR / byPair[pair]!.total : 0
    })

    const byDayOfWeek = backtests.reduce((acc, b) => {
      const day = new Date(b.dateExecuted).toLocaleDateString('en-US', { weekday: 'long' })
      if (!acc[day]) {
        acc[day] = { total: 0, wins: 0, losses: 0, totalPnl: 0 }
      }
      acc[day]!.total++
      if (b.outcome === 'WIN') acc[day]!.wins++
      if (b.outcome === 'LOSS') acc[day]!.losses++
      acc[day]!.totalPnl += (b.pnl || 0)
      return acc
    }, {} as Record<string, { total: number; wins: number; losses: number; totalPnl: number }>)

    const modelSessionBreakdown = backtests.reduce((acc, b) => {
      const model = b.customModel || b.model
      if (!acc[model]) acc[model] = {}
      if (!acc[model][b.session]) {
        acc[model][b.session] = { total: 0, wins: 0, losses: 0, totalPnl: 0 }
      }
      acc[model]![b.session]!.total++
      if (b.outcome === 'WIN') acc[model]![b.session]!.wins++
      if (b.outcome === 'LOSS') acc[model]![b.session]!.losses++
      acc[model]![b.session]!.totalPnl += (b.pnl || 0)
      return acc
    }, {} as Record<string, Record<string, { total: number; wins: number; losses: number; totalPnl: number }>>)

    const totalPips = backtests.reduce((sum, b) => sum + (b.pnl || 0), 0)

    const validRRs = backtests.filter(b => (b.riskRewardRatio || 0) > 0)
    const avgRR = validRRs.length > 0
      ? validRRs.reduce((sum, b) => sum + b.riskRewardRatio, 0) / validRRs.length
      : 0

    const winningTrades = backtests.filter(b => b.outcome === 'WIN')
    const totalWinningPips = winningTrades.reduce((sum, b) => sum + (b.pnl || 0), 0)
    const avgWin = wins > 0 ? totalWinningPips / wins : 0
    const largestWin = winningTrades.length > 0
      ? Math.max(...winningTrades.map(b => b.pnl || 0))
      : 0

    const losingTrades = backtests.filter(b => b.outcome === 'LOSS')
    const totalLosingPips = Math.abs(losingTrades.reduce((sum, b) => sum + (b.pnl || 0), 0))
    const avgLoss = losses > 0 ? totalLosingPips / losses : 0
    const largestLoss = losingTrades.length > 0
      ? Math.abs(Math.min(...losingTrades.map(b => b.pnl || 0)))
      : 0

    const profitFactor = totalLosingPips > 0
      ? totalWinningPips / totalLosingPips
      : (wins > 0 ? -1 : 0)

    const expectancy = total > 0 ? totalPips / total : 0

    return {
      winRate,
      wins,
      losses,
      total,
      totalPips,
      avgRR,
      avgWin,
      avgLoss,
      largestWin,
      largestLoss,
      profitFactor,
      expectancy,
      byModel,
      bySession,
      byDirection,
      byPair,
      byDayOfWeek,
      modelSessionBreakdown
    }
  }, [backtests])

  if (!analytics) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">No data available for analytics</p>
      </div>
    )
  }

  const formatSession = (session: string) => {
    return session.split('_').map(word =>
      word.charAt(0) + word.slice(1).toLowerCase()
    ).join(' ')
  }

  const formatModel = (model: string) => {
    return model.replace(/_/g, ' ')
  }

  return (
    <div className="space-y-6">
      {                    }
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Win Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.winRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics.wins}W / {analytics.losses}L
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Trades</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.total}</div>
            <p className="text-xs text-muted-foreground mt-1">Backtests analyzed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Points/Pips</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${analytics.totalPips >= 0 ? 'text-long' : 'text-short'}`}>
              {analytics.totalPips >= 0 ? '+' : ''}{analytics.totalPips.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Cumulative result</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expectancy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${analytics.expectancy >= 0 ? 'text-long' : 'text-short'}`}>
              {analytics.expectancy >= 0 ? '+' : ''}{analytics.expectancy.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Avg pips per trade</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg R:R</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1:{analytics.avgRR.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Risk/Reward ratio</p>
          </CardContent>
        </Card>
      </div>

      {                         }
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Win</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-long">
              +{analytics.avgWin.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Pips per winning trade</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Loss</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${analytics.avgLoss > 0 ? 'text-short' : 'text-muted-foreground'}`}>
              {analytics.avgLoss > 0 ? `-${analytics.avgLoss.toFixed(2)}` : '-'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics.avgLoss > 0 ? 'Pips per losing trade' : 'No losses'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Largest Win</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-long">
              +{analytics.largestWin.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Best single trade</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Largest Loss</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${analytics.largestLoss > 0 ? 'text-short' : 'text-muted-foreground'}`}>
              {analytics.largestLoss > 0 ? `-${analytics.largestLoss.toFixed(2)}` : '-'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics.largestLoss > 0 ? 'Worst single trade' : 'No losses'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Profit Factor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${analytics.profitFactor === -1 || analytics.profitFactor >= 1
                ? 'text-long'
                : analytics.profitFactor > 0
                  ? 'text-short'
                  : 'text-muted-foreground'
              }`}>
              {analytics.profitFactor === -1
                ? '∞'
                : analytics.profitFactor > 0
                  ? analytics.profitFactor.toFixed(2)
                  : '-'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics.profitFactor === -1 ? 'Perfect record' : 'Win pips ÷ Loss pips'}
            </p>
          </CardContent>
        </Card>
      </div>

      {                      }
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HugeiconsIcon icon={BarChartIcon} className="w-5 h-5" strokeWidth={2} color="currentColor" />
            Performance by Trading Model
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(analytics.byModel)
              .sort((a, b) => (b[1].wins / b[1].total) - (a[1].wins / a[1].total))
              .map(([model, stats]) => {
                const winRate = (stats.wins / stats.total) * 100
                return (
                  <div key={model} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatModel(model)}</span>
                        <Badge variant="outline" className="text-xs">
                          {stats.total} trades
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">
                          {winRate.toFixed(1)}% WR
                        </span>
                        <span className={`text-sm font-semibold ${stats.totalPnl >= 0 ? 'text-long' : 'text-short'}`}>
                          {stats.totalPnl >= 0 ? '+' : ''}{stats.totalPnl.toFixed(2)} pips
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-foreground h-2 rounded-full transition-all"
                        style={{ width: `${winRate}%` }}
                      />
                    </div>
                  </div>
                )
              })}
          </div>
        </CardContent>
      </Card>

      {                }
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HugeiconsIcon icon={CalendarDaysIcon} className="w-5 h-5" strokeWidth={2} color="currentColor" />
            Performance by Trading Session
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(analytics.bySession)
              .sort((a, b) => (b[1].wins / b[1].total) - (a[1].wins / a[1].total))
              .map(([session, stats]) => {
                const winRate = (stats.wins / stats.total) * 100
                return (
                  <div key={session} className="p-4 border rounded-lg">
                    <h4 className="font-semibold mb-2">{formatSession(session)}</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Win Rate</span>
                        <span className="font-medium">{winRate.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Trades</span>
                        <span className="font-medium">{stats.total}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Pips</span>
                        <span className={`font-semibold ${stats.totalPnl >= 0 ? 'text-long' : 'text-short'}`}>
                          {stats.totalPnl >= 0 ? '+' : ''}{stats.totalPnl.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Avg Pips/Trade</span>
                        <span className={`font-medium ${(stats.totalPnl / stats.total) >= 0 ? 'text-long' : 'text-short'}`}>
                          {(stats.totalPnl / stats.total) >= 0 ? '+' : ''}{(stats.totalPnl / stats.total).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        </CardContent>
      </Card>

      {                  }
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HugeiconsIcon icon={ArrowUp01Icon} className="w-5 h-5" strokeWidth={2} color="currentColor" />
            Performance by Direction
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(analytics.byDirection).map(([direction, stats]) => {
              const winRate = (stats.wins / stats.total) * 100
              return (
                <div key={direction} className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2">{direction}</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Win Rate</span>
                      <span className="font-medium">{winRate.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">W/L</span>
                      <span className="font-medium">{stats.wins}W / {stats.losses}L</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Pips</span>
                      <span className={`font-semibold ${stats.totalPnl >= 0 ? 'text-long' : 'text-short'}`}>
                        {stats.totalPnl >= 0 ? '+' : ''}{stats.totalPnl.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Avg Pips/Trade</span>
                      <span className={`font-medium ${(stats.totalPnl / stats.total) >= 0 ? 'text-long' : 'text-short'}`}>
                        {(stats.totalPnl / stats.total) >= 0 ? '+' : ''}{(stats.totalPnl / stats.total).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {                        }
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HugeiconsIcon icon={Target01Icon} className="w-5 h-5" strokeWidth={2} color="currentColor" />
            Performance by Pair/Instrument
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(analytics.byPair)
              .sort((a, b) => (b[1].wins / b[1].total) - (a[1].wins / a[1].total))
              .map(([pair, stats]) => {
                const winRate = (stats.wins / stats.total) * 100
                const avgWin = stats.wins > 0 ? stats.totalWinPips / stats.wins : 0
                const avgLoss = stats.losses > 0 ? stats.totalLossPips / stats.losses : 0
                return (
                  <div key={pair} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">{pair}</span>
                      <Badge variant="secondary" className="text-xs">
                        {stats.total} trades
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-right">
                        <p className="text-muted-foreground text-xs">Win Rate</p>
                        <p className="font-medium">{winRate.toFixed(1)}%</p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground text-xs">Avg R:R</p>
                        <p className="font-medium">1:{stats.avgRR.toFixed(2)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground text-xs">Avg Win</p>
                        <p className="font-medium text-long">
                          +{avgWin.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground text-xs">Avg Loss</p>
                        <p className="font-medium text-short">
                          -{avgLoss.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground text-xs">Total Pips</p>
                        <p className={`font-semibold ${stats.totalPnl >= 0 ? 'text-long' : 'text-short'}`}>
                          {stats.totalPnl >= 0 ? '+' : ''}{stats.totalPnl.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        </CardContent>
      </Card>

      {                    }
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HugeiconsIcon icon={CalendarDaysIcon} className="w-5 h-5" strokeWidth={2} color="currentColor" />
            Performance by Day of Week
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
              .filter(day => analytics.byDayOfWeek[day])
              .map(day => {
                const stats = analytics.byDayOfWeek[day]!
                const winRate = (stats.wins / stats.total) * 100
                return (
                  <div key={day} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium w-24">{day}</span>
                        <Badge variant="outline" className="text-xs">
                          {stats.total} trades
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">
                          {winRate.toFixed(1)}% WR
                        </span>
                        <span className={`font-semibold ${stats.totalPnl >= 0 ? 'text-long' : 'text-short'}`}>
                          {stats.totalPnl >= 0 ? '+' : ''}{stats.totalPnl.toFixed(2)} pips
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-foreground h-2 rounded-full transition-all"
                        style={{ width: `${winRate}%` }}
                      />
                    </div>
                  </div>
                )
              })}
          </div>
        </CardContent>
      </Card>

      {                             }
      <Card>
        <CardHeader>
          <CardTitle>Model Performance by Session (Deep Dive)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Object.entries(analytics.modelSessionBreakdown).map(([model, sessions]) => (
              <div key={model} className="space-y-3">
                <h4 className="font-semibold text-lg">{formatModel(model)}</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {Object.entries(sessions).map(([session, stats]) => {
                    const winRate = (stats.wins / stats.total) * 100
                    return (
                      <div key={session} className="p-3 bg-muted rounded-lg">
                        <p className="font-medium text-sm mb-2">{formatSession(session)}</p>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Trades</span>
                            <span>{stats.total}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Win Rate</span>
                            <span className="font-medium">{winRate.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Pips</span>
                            <span className={`font-semibold ${stats.totalPnl >= 0 ? 'text-long' : 'text-short'}`}>
                              {stats.totalPnl >= 0 ? '+' : ''}{stats.totalPnl.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

