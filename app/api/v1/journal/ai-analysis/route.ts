import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import { cleanContent, groupTradesByExecution } from '@/lib/utils'
import { classifyOutcome, getBreakEvenThreshold } from '@/lib/metrics/outcome'
import { getRuntimeBreakEvenThreshold } from '@/server/user-settings'
import { listDailyJournalEntries } from '@/server/daily-journal'

// GET - Generate AI analysis of journals and trades
export async function GET(request: NextRequest) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const internalUserId = identity.internalUserId

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const accountId = searchParams.get('accountId')

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      )
    }

    // Fetch journals in date range
    const journals = await listDailyJournalEntries(internalUserId, {
      startDate,
      endDate,
      ...(accountId ? { accountId } : {}),
      sortOrder: 'asc',
    })

    // Fetch trades in date range
    const tradesWhereStart = startDate.includes('T') ? startDate : `${startDate}T00:00:00.000Z`
    const tradesWhereEnd = endDate.includes('T') ? endDate : `${endDate}T23:59:59.999Z`

    const breakEvenThreshold = await getRuntimeBreakEvenThreshold(internalUserId)

    const trades = await db.query.Trade.findMany({
      where: (table, { eq, and, gte, lte }) => {
        const conds = [
          eq(table.userId, internalUserId),
          gte(table.entryDate, tradesWhereStart),
          lte(table.entryDate, tradesWhereEnd)
        ]
        if (accountId) conds.push(eq(table.accountId, accountId))
        return and(...conds)
      },
      orderBy: (table, { asc }) => [asc(table.entryDate)],
      columns: {
        id: true,
        entryId: true,
        instrument: true,
        side: true,
        pnl: true,
        commission: true,
        accountNumber: true,
        phaseAccountId: true,
        entryDate: true,
        closeDate: true,
        quantity: true,
        entryPrice: true,
        closePrice: true,
        comment: true,
        setup: true,
        selectedRules: true,
        ruleBroken: true,
        chartLinks: true,
        chartLinksList: true,
        modelId: true,
        marketBias: true,
        newsDay: true,
        selectedNews: true,
        newsTraded: true,
        biasTimeframe: true,
        narrativeTimeframe: true,
        entryTimeframe: true,
        structureTimeframe: true,
        orderType: true,
        entryTime: true,
        exitTime: true
      },
      with: {
        TradingModel: {
          columns: { name: true }
        }
      }
    })

    // Fetch funded/active accounts status (MasterAccounts for prop firms)
    const propFirmAccounts = await db.query.MasterAccount.findMany({
      where: (table, { eq, and }) => and(eq(table.userId, internalUserId), eq(table.isArchived, false)),
      columns: {
        accountName: true,
        propFirmName: true,
        status: true,
        accountSize: true,
        currentPhase: true
      }
    })

    // Fetch user's tags for context
    const userTags = await db.query.TradeTag.findMany({
      where: (table, { eq }) => eq(table.userId, internalUserId),
      columns: { id: true, name: true }
    })

    // Fetch user's trading models for context
    const tradingModels = await db.query.TradingModel.findMany({
      where: (table, { eq }) => eq(table.userId, internalUserId),
      columns: { id: true, name: true }
    })

    // Fetch weekly reviews for context
    const weeklyReviews = await db.query.WeeklyReview.findMany({
      where: (table, { eq, and, gte, lte }) => and(
        eq(table.userId, internalUserId),
        gte(table.startDate, new Date(startDate)),
        lte(table.startDate, new Date(endDate))
      ),
      columns: {
        startDate: true,
        expectation: true,
        actualOutcome: true,
        isCorrect: true,
        notes: true
      }
    })

    // Generate AI analysis
    const analysis = await generateAnalysis(
      journals,
      trades,
      propFirmAccounts,
      userTags,
      tradingModels,
      weeklyReviews,
      breakEvenThreshold
    )

    return NextResponse.json({ analysis })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate analysis' },
      { status: 500 }
    )
  }
}

async function generateAnalysis(
  journals: any[],
  trades: any[],
  propFirmAccounts: any[] = [],
  userTags: any[] = [],
  tradingModels: any[] = [],
  weeklyReviews: any[] = [],
  breakEvenThreshold: number = 10
) {
  const threshold = getBreakEvenThreshold(breakEvenThreshold)
  const analyzedTrades = (groupTradesByExecution(trades as any[]) as any[])
    .sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime())
  const getNetPnl = (trade: any) => Number(trade.pnl || 0)
  const getOutcome = (trade: any) => classifyOutcome(getNetPnl(trade), threshold)
  const getTradeDateKey = (trade: any) => {
    const raw = trade.closeDate || trade.entryDate
    return raw ? new Date(raw).toISOString().split('T')[0] : null
  }
  const getRuleList = (trade: any) => Array.isArray(trade.selectedRules) ? trade.selectedRules.map((rule: unknown) => String(rule)).filter(Boolean) : []
  const getChartLinkCount = (trade: any) => {
    if (Array.isArray(trade.chartLinksList) && trade.chartLinksList.length > 0) return trade.chartLinksList.length
    if (typeof trade.chartLinks === 'string' && trade.chartLinks.trim()) return trade.chartLinks.split(',').map((item: string) => item.trim()).filter(Boolean).length
    return 0
  }

  // Prepare data for AI
  const journalSummary = journals.map(j => ({
    date: j.date,
    emotion: j.emotion,
    note: j.note,
    account: j.Account?.name || 'All Accounts'
  }))

  // Format prop firm account status for AI
  const accountStatusSummary = propFirmAccounts.length > 0
    ? propFirmAccounts.map(acc =>
      `- ${acc.accountName} (${acc.propFirmName}): Status=${acc.status}, Phase=${acc.currentPhase}, Size=$${acc.accountSize}`
    ).join('\n')
    : 'No funded prop firm accounts found'

  // Extract trade notes for analysis
  const tradeNotes = analyzedTrades
    .filter(t => t.comment && t.comment.trim().length > 0)
    .map(t => ({
      date: t.entryDate,
      note: t.comment,
      pnl: getNetPnl(t),
      instrument: t.instrument,
      side: t.side,
      duration: t.closeDate ? (new Date(t.closeDate).getTime() - new Date(t.entryDate).getTime()) / 1000 / 60 : 0
    }))

  const tradeStats = {
    totalTrades: analyzedTrades.length,
    winningTrades: analyzedTrades.filter(t => getOutcome(t) === 'win').length,
    losingTrades: analyzedTrades.filter(t => getOutcome(t) === 'loss').length,
    breakEvenTrades: analyzedTrades.filter(t => getOutcome(t) === 'breakeven').length,
    totalPnL: analyzedTrades.reduce((sum, t) => sum + getNetPnl(t), 0),
    averagePnL: analyzedTrades.length > 0 ? analyzedTrades.reduce((sum, t) => sum + getNetPnl(t), 0) / analyzedTrades.length : 0,
    totalCommission: analyzedTrades.reduce((sum, t) => sum + (t.commission || 0), 0),
    tradesWithNotes: tradeNotes.length
  }

  // Calculate profit factor
  const grossProfit = analyzedTrades
    .filter(t => getOutcome(t) === 'win')
    .reduce((sum, t) => sum + getNetPnl(t), 0)
  const grossLoss = Math.abs(
    analyzedTrades
      .filter(t => getOutcome(t) === 'loss')
      .reduce((sum, t) => sum + getNetPnl(t), 0)
  )
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0

  // Calculate average win/loss
  const avgWin = tradeStats.winningTrades > 0 ? grossProfit / tradeStats.winningTrades : 0
  const avgLoss = tradeStats.losingTrades > 0 ? grossLoss / tradeStats.losingTrades : 0

  // P&L by instrument
  const pnlByInstrument: Record<string, { trades: number, pnl: number, wins: number }> = {}
  analyzedTrades.forEach(t => {
    const netPnL = getNetPnl(t)
    const inst = t.instrument || 'Unknown'
    if (!pnlByInstrument[inst]) {
      pnlByInstrument[inst] = { trades: 0, pnl: 0, wins: 0 }
    }
    pnlByInstrument[inst]!.trades++
    pnlByInstrument[inst]!.pnl += netPnL
    if (getOutcome(t) === 'win') pnlByInstrument[inst]!.wins++
  })

  // Sort instruments by P&L
  const topInstruments = Object.entries(pnlByInstrument)
    .sort((a, b) => b[1].pnl - a[1].pnl)
    .slice(0, 5)

  // P&L by strategy (trading model)
  const pnlByStrategy: Record<string, { trades: number, pnl: number, wins: number }> = {}
  analyzedTrades.forEach(t => {
    const strategy = (t as any).TradingModel?.name || 'No Strategy'
    const netPnL = getNetPnl(t)
    if (!pnlByStrategy[strategy]) {
      pnlByStrategy[strategy] = { trades: 0, pnl: 0, wins: 0 }
    }
    pnlByStrategy[strategy]!.trades++
    pnlByStrategy[strategy]!.pnl += netPnL
    if (getOutcome(t) === 'win') pnlByStrategy[strategy]!.wins++
  })

  // P&L by weekday
  const pnlByWeekday: Record<string, { trades: number, pnl: number }> = {
    Sunday: { trades: 0, pnl: 0 },
    Monday: { trades: 0, pnl: 0 },
    Tuesday: { trades: 0, pnl: 0 },
    Wednesday: { trades: 0, pnl: 0 },
    Thursday: { trades: 0, pnl: 0 },
    Friday: { trades: 0, pnl: 0 },
    Saturday: { trades: 0, pnl: 0 }
  }
  analyzedTrades.forEach(t => {
    const dayOfWeek = new Date(t.entryDate).toLocaleDateString('en-US', { weekday: 'long' })
    const netPnL = getNetPnl(t)
    pnlByWeekday[dayOfWeek]!.trades++
    pnlByWeekday[dayOfWeek]!.pnl += netPnL
  })

  // P&L by hour of day
  const pnlByHour: Record<number, { trades: number, pnl: number }> = {}
  analyzedTrades.forEach(t => {
    const hour = new Date(t.entryDate).getHours()
    const netPnL = getNetPnl(t)
    if (!pnlByHour[hour]) {
      pnlByHour[hour] = { trades: 0, pnl: 0 }
    }
    pnlByHour[hour]!.trades++
    pnlByHour[hour]!.pnl += netPnL
  })

  // Find best/worst hours
  const hourEntries = Object.entries(pnlByHour).map(([hour, data]) => ({ hour: parseInt(hour), ...data }))
  const bestHours = hourEntries.filter(h => h.trades >= 3).sort((a, b) => b.pnl - a.pnl).slice(0, 3)
  const worstHours = hourEntries.filter(h => h.trades >= 3).sort((a, b) => a.pnl - b.pnl).slice(0, 3)

  // Count emotions
  const emotionCounts: Record<string, number> = {}
  journals.forEach(j => {
    if (j.emotion) {
      emotionCounts[j.emotion] = (emotionCounts[j.emotion] || 0) + 1
    }
  })

  // Group trades by emotion (find trades on days with specific emotions)
  const emotionPerformance: Record<string, { trades: number, totalPnL: number }> = {}
  journals.forEach(j => {
    if (j.emotion) {
      const dateStr = new Date(j.date).toISOString().split('T')[0]
      const dayTrades = analyzedTrades.filter(t => getTradeDateKey(t) === dateStr)

      if (!emotionPerformance[j.emotion]) {
        emotionPerformance[j.emotion] = { trades: 0, totalPnL: 0 }
      }

      emotionPerformance[j.emotion]!.trades += dayTrades.length
      emotionPerformance[j.emotion]!.totalPnL += dayTrades.reduce(
        (sum, t) => sum + getNetPnl(t),
        0
      )
    }
  })

  // Market Bias Analysis
  const biasPerformance: Record<string, { trades: number, pnl: number, wins: number, alignedWithSide: number }> = {
    BULLISH: { trades: 0, pnl: 0, wins: 0, alignedWithSide: 0 },
    BEARISH: { trades: 0, pnl: 0, wins: 0, alignedWithSide: 0 },
    UNDECIDED: { trades: 0, pnl: 0, wins: 0, alignedWithSide: 0 },
  }

  let tradesWithBias = 0
  let tradesAlignedWithBias = 0

  analyzedTrades.forEach(t => {
    if (t.marketBias) {
      tradesWithBias++
      const netPnL = getNetPnl(t)
      biasPerformance[t.marketBias]!.trades++
      biasPerformance[t.marketBias]!.pnl += netPnL
      if (getOutcome(t) === 'win') biasPerformance[t.marketBias]!.wins++

      const isLong = t.side?.toUpperCase() === 'BUY' || t.side?.toLowerCase() === 'long'
      const isShort = t.side?.toUpperCase() === 'SELL' || t.side?.toLowerCase() === 'short'

      if ((t.marketBias === 'BULLISH' && isLong) || (t.marketBias === 'BEARISH' && isShort)) {
        biasPerformance[t.marketBias]!.alignedWithSide++
        tradesAlignedWithBias++
      }
    }
  })

  const biasAlignment = tradesWithBias > 0 ? (tradesAlignedWithBias / tradesWithBias) * 100 : 0

  // News Trading Analysis
  const newsTradesStats = {
    totalNewsDays: analyzedTrades.filter(t => t.newsDay).length,
    tradedDuringNews: analyzedTrades.filter(t => t.newsDay && t.newsTraded).length,
    tradedBeforeAfterNews: analyzedTrades.filter(t => t.newsDay && !t.newsTraded).length,
    noNewsTraded: analyzedTrades.filter(t => !t.newsDay).length,
  }

  const newsDayPnL = analyzedTrades.filter(t => t.newsDay).reduce((sum, t) => sum + getNetPnl(t), 0)
  const noNewsDayPnL = analyzedTrades.filter(t => !t.newsDay).reduce((sum, t) => sum + getNetPnl(t), 0)

  const tradedDuringNewsPnL = analyzedTrades.filter(t => t.newsDay && t.newsTraded).reduce((sum, t) => sum + getNetPnl(t), 0)
  const tradedBeforeAfterNewsPnL = analyzedTrades.filter(t => t.newsDay && !t.newsTraded).reduce((sum, t) => sum + getNetPnl(t), 0)

  const newsDayWins = analyzedTrades.filter(t => t.newsDay && getOutcome(t) === 'win').length
  const newsDayLosses = analyzedTrades.filter(t => t.newsDay && getOutcome(t) === 'loss').length
  const newsDayWinRate = newsTradesStats.totalNewsDays > 0 ? (newsDayWins / newsTradesStats.totalNewsDays) * 100 : 0

  const noNewsDayWins = analyzedTrades.filter(t => !t.newsDay && getOutcome(t) === 'win').length
  const noNewsDayLosses = analyzedTrades.filter(t => !t.newsDay && getOutcome(t) === 'loss').length
  const noNewsDayWinRate = newsTradesStats.noNewsTraded > 0 ? (noNewsDayWins / newsTradesStats.noNewsTraded) * 100 : 0

  // Extract specific news events that were traded
  const newsEventsTrade: Record<string, { trades: number, pnl: number, wins: number, tradedDuring: number }> = {}
  analyzedTrades.forEach(t => {
    if (t.newsDay && t.selectedNews) {
      const newsIds = t.selectedNews.split(',').filter(Boolean)
      const netPnL = getNetPnl(t)
      newsIds.forEach((newsId: string) => {
        if (!newsEventsTrade[newsId]) {
          newsEventsTrade[newsId] = { trades: 0, pnl: 0, wins: 0, tradedDuring: 0 }
        }
        newsEventsTrade[newsId]!.trades++
        newsEventsTrade[newsId]!.pnl += netPnL
        if (getOutcome(t) === 'win') newsEventsTrade[newsId]!.wins++
        if (t.newsTraded) newsEventsTrade[newsId]!.tradedDuring++
      })
    }
  })

  // Timeframe Analysis
  const timeframeStats: Record<string, { trades: number, pnl: number, wins: number }> = {
    '1m': { trades: 0, pnl: 0, wins: 0 },
    '5m': { trades: 0, pnl: 0, wins: 0 },
    '15m': { trades: 0, pnl: 0, wins: 0 },
    '30m': { trades: 0, pnl: 0, wins: 0 },
    '1h': { trades: 0, pnl: 0, wins: 0 },
    '4h': { trades: 0, pnl: 0, wins: 0 },
    'd': { trades: 0, pnl: 0, wins: 0 },
    'w': { trades: 0, pnl: 0, wins: 0 },
    'm': { trades: 0, pnl: 0, wins: 0 },
  }

  const timeframeLabelMap: Record<string, string> = {
    '1m': '1 Minute',
    '5m': '5 Minutes',
    '15m': '15 Minutes',
    '30m': '30 Minutes',
    '1h': '1 Hour',
    '4h': '4 Hours',
    'd': 'Daily',
    'w': 'Weekly',
    'm': 'Monthly',
  }

  analyzedTrades.forEach(t => {
    const netPnL = getNetPnl(t)
    const isWin = getOutcome(t) === 'win'

    if ((t as any).entryTimeframe && timeframeStats[(t as any).entryTimeframe]) {
      timeframeStats[(t as any).entryTimeframe]!.trades++
      timeframeStats[(t as any).entryTimeframe]!.pnl += netPnL
      if (isWin) timeframeStats[(t as any).entryTimeframe]!.wins++
    }
  })

  const usedTimeframes = Object.entries(timeframeStats)
    .filter(([_, data]) => data.trades > 0)
    .sort((a, b) => b[1].pnl - a[1].pnl)

  // Order Type Analysis
  const orderTypeStats: Record<string, { trades: number, pnl: number, wins: number }> = {
    'market': { trades: 0, pnl: 0, wins: 0 },
    'limit': { trades: 0, pnl: 0, wins: 0 },
  }

  analyzedTrades.forEach(t => {
    if ((t as any).orderType) {
      const netPnL = getNetPnl(t)
      const isWin = getOutcome(t) === 'win'
      const orderType = (t as any).orderType

      if (orderTypeStats[orderType]) {
        orderTypeStats[orderType].trades++
        orderTypeStats[orderType].pnl += netPnL
        if (isWin) orderTypeStats[orderType].wins++
      }
    }
  })

  const usedOrderTypes = Object.entries(orderTypeStats)
    .filter(([_, data]) => data.trades > 0)
    .sort((a, b) => b[1].pnl - a[1].pnl)

  // Session Analysis
  const { getTradingSession } = await import('@/lib/time-utils')
  const sessionStats: Record<string, { trades: number, pnl: number, wins: number }> = {}

  analyzedTrades.forEach(t => {
    if ((t as any).entryTime) {
      const session = getTradingSession((t as any).entryTime)
      if (session) {
        const netPnL = getNetPnl(t)
        const isWin = getOutcome(t) === 'win'

        if (!sessionStats[session]) {
          sessionStats[session] = { trades: 0, pnl: 0, wins: 0 }
        }

        sessionStats[session].trades++
        sessionStats[session].pnl += netPnL
        if (isWin) sessionStats[session].wins++
      }
    }
  })

  const usedSessions = Object.entries(sessionStats)
    .filter(([_, data]) => data.trades > 0)
    .sort((a, b) => b[1].pnl - a[1].pnl)

  function calculateAvgTradeAfterLoss(tradesList: typeof trades): { avg: number | null, count: number, winRate: number } {
    let sum = 0, count = 0, wins = 0
    for (let i = 1; i < tradesList.length; i++) {
      const prevTrade = tradesList[i - 1]
      const currentTrade = tradesList[i]
      if (getOutcome(prevTrade) === 'loss') {
        const netPnL = getNetPnl(currentTrade)
        sum += netPnL
        count++
        if (getOutcome(currentTrade) === 'win') wins++
      }
    }
    return { avg: count > 0 ? sum / count : null, count, winRate: count > 0 ? (wins / count) * 100 : 0 }
  }

  function analyzeConsecutiveLosses(tradesList: typeof trades): { maxStreak: number, avgAfterStreak: number | null, tradesAfterStreak: number } {
    let maxStreak = 0, currentStreak = 0
    let afterStreakSum = 0, afterStreakCount = 0
    
    for (let i = 0; i < tradesList.length; i++) {
      const netPnL = getNetPnl(tradesList[i])
      if (getOutcome(tradesList[i]) === 'loss') {
        currentStreak++
        maxStreak = Math.max(maxStreak, currentStreak)
      } else {
        if (currentStreak >= 2 && i < tradesList.length) {
          afterStreakSum += netPnL
          afterStreakCount++
        }
        currentStreak = 0
      }
    }
    return { maxStreak, avgAfterStreak: afterStreakCount > 0 ? afterStreakSum / afterStreakCount : null, tradesAfterStreak: afterStreakCount }
  }

  function analyzeFirstTradePerformance(tradesList: typeof trades): { avgPnL: number | null, winRate: number, count: number } {
    const tradesByDate: Record<string, typeof trades[0][]> = {}
    tradesList.forEach(t => {
      const dateKey = new Date(t.entryDate).toISOString().split('T')[0] || ''
      if (!tradesByDate[dateKey]) tradesByDate[dateKey] = []
      tradesByDate[dateKey]!.push(t)
    })
    
    let sum = 0, count = 0, wins = 0
    Object.values(tradesByDate).forEach(dayTrades => {
      if (dayTrades.length > 0) {
        const firstTrade = dayTrades.sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime())[0]
        const netPnL = getNetPnl(firstTrade)
        sum += netPnL
        count++
        if (getOutcome(firstTrade) === 'win') wins++
      }
    })
    return { avgPnL: count > 0 ? sum / count : null, winRate: count > 0 ? (wins / count) * 100 : 0, count }
  }

  function analyzeOvertradingPatterns(tradesList: typeof trades): { avgTradesPerDay: number, daysOver5Trades: number, pnlOnHighVolumeDay: number, pnlOnLowVolumeDay: number } {
    const tradesByDate: Record<string, { count: number, pnl: number }> = {}
    tradesList.forEach(t => {
      const dateKey = new Date(t.entryDate).toISOString().split('T')[0] || ''
      if (!tradesByDate[dateKey]) tradesByDate[dateKey] = { count: 0, pnl: 0 }
      tradesByDate[dateKey]!.count++
      tradesByDate[dateKey]!.pnl += getNetPnl(t)
    })
    
    const tradingDays = Object.keys(tradesByDate).length
    const highVolumeDays = Object.entries(tradesByDate).filter(([_, d]) => d.count > 5)
    const lowVolumeDays = Object.entries(tradesByDate).filter(([_, d]) => d.count <= 3)
    
    return {
      avgTradesPerDay: tradingDays > 0 ? tradesList.length / tradingDays : 0,
      daysOver5Trades: highVolumeDays.length,
      pnlOnHighVolumeDay: highVolumeDays.reduce((sum, [_, d]) => sum + d.pnl, 0),
      pnlOnLowVolumeDay: lowVolumeDays.reduce((sum, [_, d]) => sum + d.pnl, 0)
    }
  }

  function analyzeRiskMetrics(tradesList: typeof trades): { largestWin: number, largestLoss: number, avgRRR: number | null, tradesWithLargerLossThanAvg: number } {
    if (tradesList.length === 0) return { largestWin: 0, largestLoss: 0, avgRRR: null, tradesWithLargerLossThanAvg: 0 }
    
    const netPnLs = tradesList.map(t => getNetPnl(t))
    const largestWin = Math.max(...netPnLs, 0)
    const largestLoss = Math.min(...netPnLs, 0)
    const avgLossValue = avgLoss > 0 ? avgLoss : 1
    
    const lossTrades = tradesList.filter(t => getOutcome(t) === 'loss')
    const tradesWithLargerLossThanAvg = lossTrades.filter(t => Math.abs(getNetPnl(t)) > avgLossValue).length
    
    return {
      largestWin,
      largestLoss,
      avgRRR: avgLoss > 0 ? avgWin / avgLoss : null,
      tradesWithLargerLossThanAvg
    }
  }

  function analyzeStreakPatterns(tradesList: typeof trades): { maxWinStreak: number, maxLossStreak: number, currentStreak: { type: string, count: number } } {
    let maxWinStreak = 0, maxLossStreak = 0
    let currentWinStreak = 0, currentLossStreak = 0
    let lastType = ''
    
    tradesList.forEach(t => {
      const outcome = getOutcome(t)
      if (outcome === 'win') {
        currentWinStreak++
        currentLossStreak = 0
        maxWinStreak = Math.max(maxWinStreak, currentWinStreak)
        lastType = 'win'
      } else if (outcome === 'loss') {
        currentLossStreak++
        currentWinStreak = 0
        maxLossStreak = Math.max(maxLossStreak, currentLossStreak)
        lastType = 'loss'
      }
    })
    
    return {
      maxWinStreak,
      maxLossStreak,
      currentStreak: { type: lastType, count: lastType === 'win' ? currentWinStreak : currentLossStreak }
    }
  }

  const ruleFrequency: Record<string, number> = {}
  let tradesWithRules = 0
  let brokenRuleTrades = 0
  let reviewReadyTrades = 0
  let tradesWithCharts = 0
  let tradesWithSetup = 0
  let tradesWithNotes = 0
  const setupPerformance: Record<string, { trades: number, pnl: number, wins: number }> = {}
  const accountPerformance: Record<string, { trades: number, pnl: number }> = {}

  analyzedTrades.forEach((trade) => {
    const rules = getRuleList(trade)
    const chartLinkCount = getChartLinkCount(trade)
    const setupName = typeof trade.setup === 'string' && trade.setup.trim() ? trade.setup.trim() : null
    const accountKey = trade.accountNumber || trade.phaseAccountId || 'Unknown Account'
    const netPnl = getNetPnl(trade)

    if (rules.length > 0) {
      tradesWithRules++
      rules.forEach((rule: string) => {
        ruleFrequency[rule] = (ruleFrequency[rule] || 0) + 1
      })
    }
    if (trade.ruleBroken) brokenRuleTrades++
    if (chartLinkCount > 0) tradesWithCharts++
    if (setupName) {
      tradesWithSetup++
      if (!setupPerformance[setupName]) setupPerformance[setupName] = { trades: 0, pnl: 0, wins: 0 }
      setupPerformance[setupName].trades++
      setupPerformance[setupName].pnl += netPnl
      if (getOutcome(trade) === 'win') setupPerformance[setupName].wins++
    }
    if (trade.comment && trade.comment.trim()) tradesWithNotes++
    if (rules.length > 0 && chartLinkCount > 0 && trade.comment?.trim()) reviewReadyTrades++
    if (!accountPerformance[accountKey]) accountPerformance[accountKey] = { trades: 0, pnl: 0 }
    accountPerformance[accountKey].trades++
    accountPerformance[accountKey].pnl += netPnl
  })

  const partialExecutionCount = analyzedTrades.filter((trade) => Array.isArray(trade.partialTrades) && trade.partialTrades.length > 1).length
  const averagePartialsPerGroupedTrade = partialExecutionCount > 0
    ? analyzedTrades
      .filter((trade) => Array.isArray(trade.partialTrades) && trade.partialTrades.length > 1)
      .reduce((sum, trade) => sum + trade.partialTrades.length, 0) / partialExecutionCount
    : 0
  const sortedPnls = analyzedTrades.map((trade) => getNetPnl(trade)).sort((a, b) => b - a)
  const totalPnL = tradeStats.totalPnL
  const bestTrade = sortedPnls[0] ?? 0
  const secondBestTrade = sortedPnls[1] ?? 0
  const pnlWithoutBestTrade = totalPnL - bestTrade
  const bestTradeContributionPct = totalPnL !== 0 ? (bestTrade / totalPnL) * 100 : 0
  const edgeFragility = totalPnL > 0 && pnlWithoutBestTrade <= 0
  const topRules = Object.entries(ruleFrequency).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const topSetups = Object.entries(setupPerformance).sort((a, b) => b[1].pnl - a[1].pnl).slice(0, 5)
  const topAccounts = Object.entries(accountPerformance).sort((a, b) => b[1].pnl - a[1].pnl).slice(0, 5)
  const reviewCompletenessRate = analyzedTrades.length > 0 ? (reviewReadyTrades / analyzedTrades.length) * 100 : 0

  const revengeTradeAnalysis = calculateAvgTradeAfterLoss(analyzedTrades)
  const consecutiveLossPattern = analyzeConsecutiveLosses(analyzedTrades)
  const firstTradeAnalysis = analyzeFirstTradePerformance(analyzedTrades)
  const overtradingAnalysis = analyzeOvertradingPatterns(analyzedTrades)
  const riskMetrics = analyzeRiskMetrics(analyzedTrades)
  const streakPatterns = analyzeStreakPatterns(analyzedTrades)

  try {
    const apiKey = process.env.XAI_API_KEY
    const baseUrl = process.env.XAI_BASE_URL || 'https://api.x.ai/v1'
    const model = process.env.XAI_MODEL || 'grok-4-1-fast-reasoning'

    if (!apiKey) {
      return generateRuleBasedAnalysis(journalSummary, tradeStats, emotionCounts, emotionPerformance)
    }

    const prompt = `You are The Trading Accountability Coach. Not a cheerleader. Not a therapist. A straight-shooting performance analyst who tells traders EXACTLY what they need to hear, not what they want to hear.

YOUR CORE PHILOSOPHY:
"Profitable trading requires brutal self-honesty. If you're losing money, there's a REASON. Your job is to find it, name it, and fix it. No excuses. No sugarcoating."

YOUR COMMUNICATION STYLE:
- Direct and blunt, but not cruel. Think: tough love from a mentor who genuinely wants you to succeed.
- If their data shows they're gambling, call it gambling. If they're overtrading, say it clearly.
- Use phrases like: "Let me be real with you", "The data doesn't lie", "Here's the hard truth"
- Celebrate genuine progress, but don't manufacture false positives
- ALWAYS back statements with their actual numbers. "You THINK you're disciplined, but 47% of your trades are revenge trades after losses."
- NO corporate-speak, no fluff, no "areas for improvement" euphemisms. Say "weakness" when you mean weakness.

WHAT TO LOOK FOR (Be ruthless in analysis):

1. THE GAMBLING TELL-TALES:
   - Trading news releases without edge (CPI, NFP gambling)
   - Increasing position size after losses (classic tilt)
   - Random instruments (jumping from NQ to Gold to Forex = no real strategy)
   - Emotional entries: "Frustrated" in journal followed by oversized trades

2. THE DISCIPLINE LEAKS:
   - Win rate below 40%? They're taking low-probability setups
   - Profit factor below 1.5? Risk management is broken
   - Average loss bigger than average win? No stop discipline
   - Trading counter to stated bias? They don't trust their own analysis

3. THE TIME BOMBS:
   - Best hour vs worst hour P&L spread - are they trading when they shouldn't?
   - Best day vs worst day - should they skip certain days entirely?
   - Session performance gaps - London killer but NY destroyer?

4. THE PSYCHOLOGICAL RED FLAGS:
   - Correlation between negative emotions and losses (the obvious one most ignore)
   - Overconfidence after wins leading to blow-ups
   - "Anxious" emotion BEFORE trading = they know they shouldn't be trading

5. THE PROP FIRM REALITY CHECK:
   - Failed accounts? Don't coddle them. Analyze WHY. What rule was broken? What pattern repeated?
   - Multiple failures? There's a systemic issue, not bad luck.

OUTPUT REQUIREMENTS:
- Summary: 3-4 sentences. Start with the bottom line (profitable/unprofitable), then the PRIMARY issue holding them back.
- Emotional Patterns: Connect SPECIFIC emotions to SPECIFIC P&L outcomes. "When you logged 'Frustrated', you averaged -$147 per trade. When 'Focused', +$89. The math is clear."
- Performance Insights: The 2-3 biggest data patterns. Not observations, ACTIONABLE insights.
- Strengths: ONLY if genuinely demonstrated. Empty array is valid if nothing stands out.
- Weaknesses: The real ones. If their R:R is inverted, say it. If they're overtrading, say it.
- Recommendations: Specific, actionable, prioritized. Not "be more disciplined" - instead "Stop trading after 2 consecutive losses. Your data shows your 3rd trade after losses is wrong 78% of the time."
- In weaknesses and recommendations, explicitly separate:
  1. execution mistakes
  2. setup-quality mistakes
  3. discipline/behavior mistakes
  4. review-process gaps
- End recommendations with a blunt "Stop / Keep / Test" mini-playbook.
    
    THE DATA (Study this carefully):
    
    **Time Period**: ${journals.length > 0 ? `${new Date(journals[0].date).toLocaleDateString()} to ${new Date(journals[journals.length - 1].date).toLocaleDateString()}` : 'No data'}
    
    **FUNDED ACCOUNT STATUS (CRITICAL - Failures mean real money lost)**:
    ${accountStatusSummary}
    ${propFirmAccounts.filter(acc => acc.status === 'failed').length > 0 ?
        `[RED FLAG] ${propFirmAccounts.filter(acc => acc.status === 'failed').length} failed account(s). Do NOT coddle them. Analyze what rule was broken, what pattern led to failure, and what must change. Failed accounts are not bad luck, they are feedback.` : ''}

    **USER'S TRADING SETUP**:
    Tags they use: ${userTags.length > 0 ? userTags.map(t => t.name).join(', ') : 'No custom tags'}
    Trading models/strategies: ${tradingModels.length > 0 ? tradingModels.map(m => m.name).join(', ') : 'No custom trading models'}

    **WEEKLY REVIEW INSIGHTS** (Their own market analysis):
    ${weeklyReviews.length > 0
        ? weeklyReviews.map(r =>
          `Week of ${new Date(r.startDate).toLocaleDateString()}: Expected ${r.expectation || 'not set'}, Actual ${r.actualOutcome || 'not set'}, ${r.isCorrect === true ? 'Correct prediction' : r.isCorrect === false ? 'Incorrect prediction' : 'Not evaluated'}${r.notes ? `. Notes: "${r.notes.slice(0, 100)}..."` : ''}`
        ).join('\n')
        : 'No weekly reviews recorded for this period'}

    **Trading Performance (Dashboard Metrics)**:
    - Canonical Trades: ${tradeStats.totalTrades} grouped executions (partials merged into one trade idea)
    - Win Rate: ${tradeStats.totalTrades > 0 ? ((tradeStats.winningTrades / tradeStats.totalTrades) * 100).toFixed(1) : 0}%
    - Total P&L: $${tradeStats.totalPnL.toFixed(2)}
    - Gross Profit: $${grossProfit.toFixed(2)} | Gross Loss: -$${grossLoss.toFixed(2)}
    - Profit Factor: ${profitFactor === Infinity ? '∞' : profitFactor.toFixed(2)}
    - Average Win: $${avgWin.toFixed(2)} | Average Loss: -$${avgLoss.toFixed(2)}
    - Risk/Reward Ratio: ${avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : 'N/A'}
    - Total Commission Paid: $${tradeStats.totalCommission.toFixed(2)}

    **Execution Quality / Review Readiness**:
    - Trades with setup tagged: ${tradesWithSetup} / ${tradeStats.totalTrades}
    - Trades with selected rules: ${tradesWithRules} / ${tradeStats.totalTrades}
    - Trades marked as broken rule: ${brokenRuleTrades} / ${tradeStats.totalTrades}
    - Trades with chart evidence: ${tradesWithCharts} / ${tradeStats.totalTrades}
    - Trades with notes: ${tradesWithNotes} / ${tradeStats.totalTrades}
    - Review-ready trades (rules + charts + notes): ${reviewReadyTrades} / ${tradeStats.totalTrades} (${reviewCompletenessRate.toFixed(1)}%)
    - Partial execution groups: ${partialExecutionCount}${partialExecutionCount > 0 ? ` (avg ${averagePartialsPerGroupedTrade.toFixed(1)} partials each)` : ''}

    **Rule and Setup Context**:
    Top rules used:
    ${topRules.length > 0 ? topRules.map(([rule, count]) => `- ${rule}: ${count} trades`).join('\n') : 'No selected rules recorded'}
    Top setups by P&L:
    ${topSetups.length > 0 ? topSetups.map(([setup, data]) => `- ${setup}: ${data.trades} trades, $${data.pnl.toFixed(2)} P&L, ${data.trades > 0 ? ((data.wins / data.trades) * 100).toFixed(1) : 0}% WR`).join('\n') : 'No setup data recorded'}

    **Account / Phase Context**:
    ${topAccounts.length > 0 ? topAccounts.map(([account, data]) => `- ${account}: ${data.trades} trades, $${data.pnl.toFixed(2)} P&L`).join('\n') : 'No account breakdown available'}

    **Edge Fragility Check**:
    - Best trade: $${bestTrade.toFixed(2)}
    - Second-best trade: $${secondBestTrade.toFixed(2)}
    - P&L without best trade: $${pnlWithoutBestTrade.toFixed(2)}
    - Best trade contribution: ${Number.isFinite(bestTradeContributionPct) ? bestTradeContributionPct.toFixed(1) : '0.0'}%
    ${edgeFragility ? '[WARNING] Remove the best trade and the whole period goes non-profitable. The edge is fragile, not robust.' : ''}

    **P&L by Instrument (Top 5)**:
    ${topInstruments.length > 0
        ? topInstruments.map(([inst, data]) =>
          `- ${inst}: ${data.trades} trades, $${data.pnl.toFixed(2)} P&L, ${data.trades > 0 ? ((data.wins / data.trades) * 100).toFixed(1) : 0}% WR`
        ).join('\n')
        : 'No trades'}

    **P&L by Strategy/Model**:
    ${Object.entries(pnlByStrategy).length > 0
        ? Object.entries(pnlByStrategy).map(([strat, data]) =>
          `- ${strat}: ${data.trades} trades, $${data.pnl.toFixed(2)} P&L, ${data.trades > 0 ? ((data.wins / data.trades) * 100).toFixed(1) : 0}% WR`
        ).join('\n')
        : 'No strategy data'}

    **P&L by Weekday** (Identify best/worst days):
    ${Object.entries(pnlByWeekday)
        .filter(([_, data]) => data.trades > 0)
        .map(([day, data]) =>
          `- ${day}: ${data.trades} trades, $${data.pnl.toFixed(2)} P&L, ${data.trades > 0 ? `Avg: $${(data.pnl / data.trades).toFixed(2)}` : ''}`
        ).join('\n') || 'No weekday data'}

    **Best Trading Hours** (By P&L, min 3 trades):
    ${bestHours.length > 0
        ? bestHours.map(h => `- ${h.hour}:00: ${h.trades} trades, $${h.pnl.toFixed(2)} P&L`).join('\n')
        : 'Insufficient data'}

    **Worst Trading Hours** (By P&L, min 3 trades):
    ${worstHours.length > 0
        ? worstHours.map(h => `- ${h.hour}:00: ${h.trades} trades, $${h.pnl.toFixed(2)} P&L`).join('\n')
        : 'Insufficient data'}

    **Emotional States (Self-Reported)**:
    ${Object.entries(emotionCounts).map(([emotion, count]) => `- ${emotion}: ${count} days`).join('\n') || 'No emotions tracked'}

    **Performance by Emotion** (THIS IS KEY DATA):
    ${Object.entries(emotionPerformance).map(([emotion, perf]) =>
          `- ${emotion}: ${perf.trades} trades, $${perf.totalPnL.toFixed(2)} P&L${perf.trades > 0 ? ` (avg: $${(perf.totalPnL / perf.trades).toFixed(2)})` : ''}`
        ).join('\n') || 'No emotion-performance correlation data'}

    **Market Bias Analysis** (CRITICAL: Are they following their bias?):
    - Trades with recorded bias: ${tradesWithBias} out of ${tradeStats.totalTrades} trades
    - Trades aligned with bias: ${tradesAlignedWithBias} (${biasAlignment.toFixed(1)}%)
    ${Object.entries(biasPerformance)
        .filter(([_, data]) => data.trades > 0)
        .map(([bias, data]) => {
          const winRate = data.trades > 0 ? ((data.wins / data.trades) * 100).toFixed(1) : 0
          const alignmentRate = data.trades > 0 ? ((data.alignedWithSide / data.trades) * 100).toFixed(1) : 0
          return `- ${bias} Bias: ${data.trades} trades, $${data.pnl.toFixed(2)} P&L, ${winRate}% WR, ${alignmentRate}% aligned with bias`
        }).join('\n') || 'No bias data recorded'}
    ${tradesWithBias > 0 && biasAlignment < 50 ?
        `[WARNING] Only ${biasAlignment.toFixed(1)}% of trades align with stated bias. They're trading AGAINST their market sentiment-potential counter-trend losses!` : ''}

    **News Trading Analysis** (High-Impact Events):
    - News Day Trades: ${newsTradesStats.totalNewsDays} trades ($${newsDayPnL.toFixed(2)} P&L, ${newsDayWinRate.toFixed(1)}% WR)
    - Traded DURING News Release: ${newsTradesStats.tradedDuringNews} trades ($${tradedDuringNewsPnL.toFixed(2)} P&L)
    - Traded BEFORE/AFTER News: ${newsTradesStats.tradedBeforeAfterNews} trades ($${tradedBeforeAfterNewsPnL.toFixed(2)} P&L)
    - Non-News Day Trades: ${newsTradesStats.noNewsTraded} trades ($${noNewsDayPnL.toFixed(2)} P&L, ${noNewsDayWinRate.toFixed(1)}% WR)
    ${Object.entries(newsEventsTrade).length > 0 ? `
    **Specific News Events Traded**:
    ${Object.entries(newsEventsTrade).map(([eventId, data]) => {
          const winRate = data.trades > 0 ? ((data.wins / data.trades) * 100).toFixed(1) : 0
          return `- ${eventId}: ${data.trades} trades, $${data.pnl.toFixed(2)} P&L, ${winRate}% WR, ${data.tradedDuring} during release`
        }).join('\n')}` : ''}
    ${newsTradesStats.tradedDuringNews > 0 && tradedDuringNewsPnL < 0 ?
        `[WARNING] Negative P&L when trading DURING news releases. News volatility might be hurting performance-consider waiting for clarity!` : ''}
    ${newsTradesStats.totalNewsDays > 0 && noNewsDayWinRate > newsDayWinRate + 10 ?
        `[INSIGHT] Win rate is ${(noNewsDayWinRate - newsDayWinRate).toFixed(1)}% higher on non-news days. Consider avoiding high-impact news!` : ''}

    ${usedTimeframes.length > 0 ? `**Entry Timeframe Performance** (Multi-Timeframe Analysis):
    ${usedTimeframes.map(([tf, data]) => {
          const winRate = data.trades > 0 ? ((data.wins / data.trades) * 100).toFixed(1) : 0
          return `- ${timeframeLabelMap[tf]}: ${data.trades} trades, $${data.pnl.toFixed(2)} P&L, ${winRate}% WR`
        }).join('\n')}
    ${usedTimeframes.length > 1 && (usedTimeframes[0]?.[1]?.pnl ?? 0) > 0 && (usedTimeframes[usedTimeframes.length - 1]?.[1]?.pnl ?? 0) < 0 ?
          `[INSIGHT] Best timeframe: ${timeframeLabelMap[usedTimeframes[0]![0]]} (+$${usedTimeframes[0]![1]!.pnl.toFixed(2)}). Worst: ${timeframeLabelMap[usedTimeframes[usedTimeframes.length - 1]![0]]} ($${usedTimeframes[usedTimeframes.length - 1]![1]!.pnl.toFixed(2)}). Stick to what works!` : ''}
    ` : ''}

    ${usedOrderTypes.length > 0 ? `**Order Type Performance**:
    ${usedOrderTypes.map(([type, data]) => {
            const winRate = data.trades > 0 ? ((data.wins / data.trades) * 100).toFixed(1) : 0
            const label = type === 'market' ? 'Market Orders' : 'Limit Orders'
            return `- ${label}: ${data.trades} trades, $${data.pnl.toFixed(2)} P&L, ${winRate}% WR`
          }).join('\n')}
    ${usedOrderTypes.length === 2 && (usedOrderTypes[0]?.[1]?.pnl ?? 0) > 0 && (usedOrderTypes[1]?.[1]?.pnl ?? 0) < 0 ?
          `[INSIGHT] ${usedOrderTypes[0]![0] === 'market' ? 'Market orders' : 'Limit orders'} are working better (+$${usedOrderTypes[0]![1]!.pnl.toFixed(2)}) vs ${usedOrderTypes[1]![0] === 'market' ? 'market' : 'limit'} ($${usedOrderTypes[1]![1]!.pnl.toFixed(2)}).` : ''}
    ` : ''}

    ${usedSessions.length > 0 ? `**Trading Session Performance**:
    ${usedSessions.map(([session, data]) => {
            const winRate = data.trades > 0 ? ((data.wins / data.trades) * 100).toFixed(1) : 0
            return `- ${session}: ${data.trades} trades, $${data.pnl.toFixed(2)} P&L, ${winRate}% WR`
          }).join('\n')}
    ${usedSessions.length > 1 && (usedSessions[0]?.[1]?.pnl ?? 0) > 0 && (usedSessions[usedSessions.length - 1]?.[1]?.pnl ?? 0) < 0 ?
          `[INSIGHT] Best session: ${usedSessions[0]![0]} (+$${usedSessions[0]![1]!.pnl.toFixed(2)}). Worst: ${usedSessions[usedSessions.length - 1]![0]} ($${usedSessions[usedSessions.length - 1]![1]!.pnl.toFixed(2)}). Focus on your best times!` : ''}
    ` : ''}

    **Daily Journal Entries** (READ EVERY WORD - The vibe is in here):
    ${journalSummary.map(j => `- ${new Date(j.date).toLocaleDateString()}: [${j.emotion || 'No emotion'}] "${j.note}" (${j.account})`).join('\n') || 'No journal entries'}

    **Individual Trade Notes** (Look for patterns in wins vs losses):
    ${tradeNotes.slice(0, 20).map(t => `- ${new Date(t.date).toLocaleDateString()}: ${t.instrument} ${t.side} | ${t.pnl >= 0 ? 'WIN' : 'LOSS'}: $${t.pnl.toFixed(2)} | ${t.duration.toFixed(0)}min | "${t.note}"`).join('\n') || 'No trade notes available'}

    ========== BEHAVIORAL DEEP DIVE (USE THIS DATA) ==========

    **REVENGE TRADING ANALYSIS** (Trades After Losses):
    - Trades taken immediately after a loss: ${revengeTradeAnalysis.count}
    - Average P&L on trade after loss: ${revengeTradeAnalysis.avg !== null ? `$${revengeTradeAnalysis.avg.toFixed(2)}` : 'N/A'}
    - Win rate on trade after loss: ${revengeTradeAnalysis.winRate.toFixed(1)}%
    ${revengeTradeAnalysis.avg !== null && revengeTradeAnalysis.avg < 0 ? `[CRITICAL] They LOSE money on average after a loss. Clear revenge trading pattern. Call this out!` : ''}
    ${revengeTradeAnalysis.count > 0 && revengeTradeAnalysis.winRate < 40 ? `[WARNING] Win rate drops significantly after losses. They should STOP trading after a loss.` : ''}

    **CONSECUTIVE LOSS PATTERNS** (Tilt Analysis):
    - Max consecutive losing streak: ${consecutiveLossPattern.maxStreak} trades
    - Avg P&L on first trade after 2+ losses: ${consecutiveLossPattern.avgAfterStreak !== null ? `$${consecutiveLossPattern.avgAfterStreak.toFixed(2)}` : 'N/A'}
    ${consecutiveLossPattern.maxStreak >= 4 ? `[RED FLAG] A ${consecutiveLossPattern.maxStreak}-trade losing streak indicates either tilt or fundamentally broken strategy execution.` : ''}

    **FIRST TRADE OF DAY ANALYSIS** (Morning Discipline):
    - First trade of day avg P&L: ${firstTradeAnalysis.avgPnL !== null ? `$${firstTradeAnalysis.avgPnL.toFixed(2)}` : 'N/A'}
    - First trade win rate: ${firstTradeAnalysis.winRate.toFixed(1)}%
    - Total trading days: ${firstTradeAnalysis.count}
    ${firstTradeAnalysis.avgPnL !== null && firstTradeAnalysis.avgPnL > 0 && revengeTradeAnalysis.avg !== null && revengeTradeAnalysis.avg < 0 ? `[INSIGHT] First trade is profitable (+$${firstTradeAnalysis.avgPnL.toFixed(2)}) but trades after losses are negative ($${revengeTradeAnalysis.avg.toFixed(2)}). They should trade less.` : ''}

    **OVERTRADING ANALYSIS** (Volume vs Quality):
    - Average trades per day: ${overtradingAnalysis.avgTradesPerDay.toFixed(1)}
    - Days with 5+ trades: ${overtradingAnalysis.daysOver5Trades}
    - P&L on high volume days (5+ trades): $${overtradingAnalysis.pnlOnHighVolumeDay.toFixed(2)}
    - P&L on low volume days (1-3 trades): $${overtradingAnalysis.pnlOnLowVolumeDay.toFixed(2)}
    ${overtradingAnalysis.pnlOnHighVolumeDay < 0 && overtradingAnalysis.pnlOnLowVolumeDay > 0 ? `[CRITICAL] They MAKE money when trading less (1-3 trades: +$${overtradingAnalysis.pnlOnLowVolumeDay.toFixed(2)}) and LOSE money when overtrading (5+: $${overtradingAnalysis.pnlOnHighVolumeDay.toFixed(2)}). Tell them to trade LESS.` : ''}
    ${overtradingAnalysis.avgTradesPerDay > 7 ? `[WARNING] Averaging ${overtradingAnalysis.avgTradesPerDay.toFixed(1)} trades/day is excessive for most strategies. Possible gambling behavior.` : ''}

    **RISK MANAGEMENT METRICS**:
    - Largest single win: $${riskMetrics.largestWin.toFixed(2)}
    - Largest single loss: $${Math.abs(riskMetrics.largestLoss).toFixed(2)}
    - Risk/Reward Ratio (Avg Win / Avg Loss): ${riskMetrics.avgRRR !== null ? riskMetrics.avgRRR.toFixed(2) : 'N/A'}
    - Trades with loss larger than average: ${riskMetrics.tradesWithLargerLossThanAvg} out of ${tradeStats.losingTrades} losses
    ${riskMetrics.avgRRR !== null && riskMetrics.avgRRR < 1 ? `[CRITICAL] Risk/Reward below 1.0 (${riskMetrics.avgRRR.toFixed(2)}). Average loss is BIGGER than average win. They're letting losers run.` : ''}
    ${Math.abs(riskMetrics.largestLoss) > riskMetrics.largestWin * 2 ? `[RED FLAG] Largest loss ($${Math.abs(riskMetrics.largestLoss).toFixed(2)}) is more than 2x largest win ($${riskMetrics.largestWin.toFixed(2)}). Asymmetric risk = disaster waiting to happen.` : ''}

    **STREAK PATTERNS** (Momentum):
    - Max winning streak: ${streakPatterns.maxWinStreak} trades
    - Max losing streak: ${streakPatterns.maxLossStreak} trades
    - Current streak: ${streakPatterns.currentStreak.count} ${streakPatterns.currentStreak.type}s
    ${streakPatterns.maxLossStreak > streakPatterns.maxWinStreak + 2 ? `[CONCERN] Max losing streak (${streakPatterns.maxLossStreak}) exceeds max winning streak (${streakPatterns.maxWinStreak}) by a lot. Indicates poor loss management.` : ''}

    ==========================================================

    ADDITIONAL ANALYSIS DIRECTIVES:
    
    6. CONSISTENCY CHECK:
       - Are they making money consistently or having one big win that masks many losses?
       - Is their edge real (repeatable) or lucky (one-off)?
       - Would removing the best trade make them unprofitable? If so, their edge is fragile.
    
    7. TRADE DURATION PATTERNS:
       - Are winning trades held long enough? Or are they cutting winners short out of fear?
       - Are losing trades cut quickly? Or are they hoping for a reversal (holding losers too long)?
       - Compare avg duration of wins vs losses. If losses are held longer, that's a huge red flag.
    
    8. POSITION SIZING PATTERNS:
       - Look at largest wins vs largest losses. Asymmetry = ticking time bomb.
       - Are they sizing up after wins? (overconfidence trap)
       - Are they sizing up after losses? (martingale/tilt behavior, the fastest way to blow an account)
    
    9. DRAWDOWN AWARENESS:
       - If total P&L went from high to low within the period, calculate the peak-to-trough drawdown.
       - How quickly (or slowly) did they recover from their worst losing stretch?

    RESPOND WITH THIS EXACT JSON STRUCTURE:
    {
      "summary": "4 to 5 sentences. Lead with the verdict: profitable or not, and by how much. Then state the PRIMARY problem or strength. Then mention one hidden pattern they likely do not see. Be direct. Example: 'You lost $847 over 23 trades this period. The core issue is not your strategy, it is your inability to stop trading after losses. Your average trade after a loss is negative $67, while your first trade of the day averages positive $34. Remove the revenge trades and you would actually be profitable.'",
      "emotionalPatterns": [
        "Connect specific emotions to specific dollar outcomes. Example: 'When you logged Frustrated, you averaged negative $147 per trade across 8 trades. When Focused, positive $89 across 12 trades. The pattern is obvious.'",
        "If they trade without logging emotions, call it out. Example: 'You have emotion data for only 30% of trading days. You cannot fix what you do not track.'",
        "Look for revenge trading patterns, overconfidence spirals, fear-based exits.",
        "Look for emotional state TRANSITIONS: does going from Confident to Frustrated in the same day predict blowups?"
      ],
      "performanceInsights": [
        "The single biggest P&L leak. Be specific. Example: 'You made $1,200 on NQ and lost $1,847 on ES. Why are you still trading ES?'",
        "Time based patterns. Example: 'Your afternoon trades (after 2pm) are negative $523 total. Your morning trades are positive $412. You should stop trading after lunch.'",
        "Strategy or execution gaps. Example: 'Your limit orders have 67% win rate. Your market orders have 38%. Stop chasing entries.'",
        "Duration insight: Are they cutting winners too early or holding losers too long? Use the trade duration data.",
        "Consistency check: Would removing the single biggest win make them unprofitable? If so, say it."
      ],
      "strengths": [
        "Only include if genuinely demonstrated by the data. Empty array is valid.",
        "If positive: be specific. 'You maintained discipline on position sizing. No trade exceeded 2% risk.'"
      ],
      "weaknesses": [
        "The real problems. No euphemisms. Example: 'You are gambling on news events. 4 trades during CPI, all losers, totaling negative $340.'",
        "Example: 'Your average loss ($89) is larger than your average win ($67). You are letting losers run and cutting winners short. Classic fear pattern.'",
        "Include any consistency or fragility issues.",
        "Name the category directly when it fits: execution mistake, setup quality mistake, discipline mistake, or review process gap."
      ],
      "recommendations": [
        "Specific, actionable, measurable. Example: 'Stop trading after 2 consecutive losses. Your data shows the 3rd trade after losses is wrong 78% of the time.'",
        "Example: 'Remove ES from your watchlist for 2 weeks. Trade only NQ where you actually have edge.'",
        "Example: 'Set a hard rule: no trades within 30 minutes of high impact news. You have proven you cannot handle it.'",
        "The ONE THING that would have the biggest impact if they did nothing else.",
        "Close the list with a Stop / Keep / Test framing."
      ],
      "riskGrade": "A letter grade (A through F) for their risk management discipline this period. A = tight stops, consistent sizing, good R:R. F = no stops, random sizing, inverted R:R.",
      "consistencyScore": "A number from 1 to 10 rating how consistent and repeatable their edge appears. 10 = rock solid. 1 = pure randomness.",
      "topPriorityFix": "The single most impactful change they could make. Not a list, just ONE concrete sentence. This is the thing that, if they change nothing else, would improve their results the most."
    }

    FORMATTING RULES:
    * NO HYPHENS/DASHES in your response. Use "to" instead of "-" for ranges, "negative" instead of "-$" for losses.
    * Use "you" and "your" throughout. This is personal.
    * NO EMOJIS.
    * Output ONLY valid JSON. No text before or after.
    * If they have failed accounts, do not coddle them. Analyze what went wrong and what pattern they need to break.
    * Every single claim MUST reference a specific number from the data. No vague statements.
    * If data is insufficient for a section, say so honestly rather than making things up.
    
    Analyze now. Be the coach they need, not the friend they want.`;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: `You are The Trading Accountability Coach. A straight-shooting performance analyst who gives traders EXACTLY what they need to hear, not what they want to hear.

Your approach:
- Brutally honest but constructive
- Every claim backed by data with specific numbers
- No sugarcoating, no euphemisms, no corporate speak
- Direct statements like "you are gambling" if the data shows gambling
- Call out patterns they might be in denial about
- If there is nothing positive to say, say nothing positive
- NEVER use hyphens or dashes in output. Use "to" for ranges, "negative" for losses
- Output ONLY valid JSON. Nothing else.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.75,
        max_tokens: 4000
      })
    })

    if (!response.ok) {
      return generateRuleBasedAnalysis(journalSummary, tradeStats, emotionCounts, emotionPerformance, tradeNotes)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      return generateRuleBasedAnalysis(journalSummary, tradeStats, emotionCounts, emotionPerformance, tradeNotes)
    }

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return cleanContent(parsed)
      }
      return generateRuleBasedAnalysis(journalSummary, tradeStats, emotionCounts, emotionPerformance, tradeNotes)
    } catch (parseError) {
      return generateRuleBasedAnalysis(journalSummary, tradeStats, emotionCounts, emotionPerformance, tradeNotes)
    }
  } catch (error) {
    return generateRuleBasedAnalysis(journalSummary, tradeStats, emotionCounts, emotionPerformance, tradeNotes)
  }
}

function generateRuleBasedAnalysis(
  journals: any[],
  tradeStats: any,
  emotionCounts: Record<string, number>,
  emotionPerformance: Record<string, { trades: number, totalPnL: number }>,
  tradeNotes: any[] = []
) {
  const winRate = tradeStats.totalTrades > 0
    ? (tradeStats.winningTrades / tradeStats.totalTrades) * 100
    : 0

  const emotionsWithPerf = Object.entries(emotionPerformance)
    .filter(([_, perf]) => perf.trades > 0)
    .map(([emotion, perf]) => ({
      emotion,
      avgPnL: perf.totalPnL / perf.trades,
      trades: perf.trades
    }))
    .sort((a, b) => b.avgPnL - a.avgPnL)

  const bestEmotion = emotionsWithPerf[0]
  const worstEmotion = emotionsWithPerf[emotionsWithPerf.length - 1]

  const summary = `Based on your ${tradeStats.totalTrades} trades${tradeNotes.length > 0 ? ` (${tradeNotes.length} with detailed notes)` : ''} and ${journals.length} journal entries, you have a ${winRate.toFixed(1)}% win rate with a total P&L of $${tradeStats.totalPnL.toFixed(2)}. ${bestEmotion ? `Your best performance occurs when feeling ${bestEmotion.emotion} (avg: $${bestEmotion.avgPnL.toFixed(2)} per trade).` : ''
    } ${journals.length > 5 || tradeNotes.length > 10 ? 'Your consistent documentation shows good self-awareness and discipline.' : 'More consistent journaling and trade notes could provide deeper insights into your trading patterns.'
    }`

  const emotionalPatterns = []
  if (bestEmotion && worstEmotion) {
    emotionalPatterns.push(`Best performance when ${bestEmotion.emotion}: $${bestEmotion.avgPnL.toFixed(2)} avg per trade`)
    emotionalPatterns.push(`Challenging performance when ${worstEmotion.emotion}: $${worstEmotion.avgPnL.toFixed(2)} avg per trade`)
  }
  if (emotionCounts['anxious'] && emotionCounts['anxious'] > 3) {
    emotionalPatterns.push(`Frequent anxiety noted (${emotionCounts['anxious']} days) - may indicate overtrading or position sizing issues`)
  }
  if (emotionCounts['confident'] && emotionPerformance['confident']) {
    emotionalPatterns.push(`Confidence correlates with ${emotionPerformance['confident'].trades} trades averaging $${(emotionPerformance['confident'].totalPnL / emotionPerformance['confident'].trades).toFixed(2)}`)
  }

  const performanceInsights = []
  if (winRate >= 60) {
    performanceInsights.push(`Strong win rate of ${winRate.toFixed(1)}% indicates good trade selection`)
  } else if (winRate < 40) {
    performanceInsights.push(`Win rate of ${winRate.toFixed(1)}% suggests need to refine entry criteria or risk management`)
  }

  if (tradeStats.totalPnL > 0) {
    performanceInsights.push(`Net positive P&L of $${tradeStats.totalPnL.toFixed(2)} shows overall profitability`)
  } else {
    performanceInsights.push(`Net negative P&L indicates need for strategy adjustment`)
  }

  if (tradeStats.totalTrades > 0) {
    performanceInsights.push(`Average P&L per trade: $${tradeStats.averagePnL.toFixed(2)}`)
  }

  const strengths = []
  if (journals.length >= 10 || tradeNotes.length >= 15) {
    strengths.push('Consistent documentation habit demonstrates discipline and self-awareness')
  }
  if (tradeNotes.length > 0) {
    strengths.push(`Detailed trade notes on ${tradeNotes.length} trades show commitment to improvement`)
  }
  if (winRate >= 50) {
    strengths.push('Positive win rate shows effective trade selection')
  }
  if (tradeStats.totalPnL > 0) {
    strengths.push('Net profitable trading over the analyzed period')
  }
  if (Object.keys(emotionCounts).length >= 5) {
    strengths.push('Good emotional awareness and tracking')
  }

  const weaknesses = []
  if (journals.length < 5 && tradeStats.totalTrades > 10) {
    weaknesses.push('Inconsistent journaling relative to trading frequency')
  }
  if (winRate < 45) {
    weaknesses.push('Low win rate may indicate need for better entry criteria')
  }
  if (worstEmotion && worstEmotion.avgPnL < -50) {
    weaknesses.push(`Poor performance when ${worstEmotion.emotion} - avoid trading in this state`)
  }

  const recommendations = []
  if (bestEmotion) {
    recommendations.push(`Focus on trading when feeling ${bestEmotion.emotion} - your best performance state`)
  }
  if (worstEmotion && worstEmotion.avgPnL < 0) {
    recommendations.push(`Avoid trading or reduce position size when ${worstEmotion.emotion}`)
  }
  if (journals.length < 10) {
    recommendations.push('Increase journaling frequency to identify more patterns')
  }
  recommendations.push('Review journal entries before trading to build self-awareness')
  recommendations.push('Set specific trading rules for different emotional states')

  return {
    summary,
    emotionalPatterns: emotionalPatterns.slice(0, 5),
    performanceInsights: performanceInsights.slice(0, 5),
    strengths: strengths.slice(0, 4),
    weaknesses: weaknesses.slice(0, 4),
    recommendations: recommendations.slice(0, 5)
  }
}