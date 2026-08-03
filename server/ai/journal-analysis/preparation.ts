import { classifyOutcome, getBreakEvenThreshold } from '@/lib/metrics/outcome'
import { getTradingSession } from '@/lib/time-utils'
import { groupTradesByExecution } from '@/lib/trading/trade-grouping'

export function prepareJournalAnalysis(
  journals: any[],
  trades: any[],
  propFirmAccounts: any[] = [],
  userTags: any[] = [],
  tradingModels: any[] = [],
  weeklyReviews: any[] = [],
  breakEvenThreshold: number = 10,
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


  const journalSummary = journals.map(j => ({
    date: j.date,
    emotion: j.emotion,
    note: j.note,
    account: j.Account?.name || 'All Accounts'
  }))


  const accountStatusSummary = propFirmAccounts.length > 0
    ? propFirmAccounts.map(acc =>
      `- ${acc.accountName} (${acc.propFirmName}): Status=${acc.status}, Phase=${acc.currentPhase}, Size=$${acc.accountSize}`
    ).join('\n')
    : 'No funded prop firm accounts found'


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


  const grossProfit = analyzedTrades
    .filter(t => getOutcome(t) === 'win')
    .reduce((sum, t) => sum + getNetPnl(t), 0)
  const grossLoss = Math.abs(
    analyzedTrades
      .filter(t => getOutcome(t) === 'loss')
      .reduce((sum, t) => sum + getNetPnl(t), 0)
  )
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0


  const avgWin = tradeStats.winningTrades > 0 ? grossProfit / tradeStats.winningTrades : 0
  const avgLoss = tradeStats.losingTrades > 0 ? grossLoss / tradeStats.losingTrades : 0


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


  const topInstruments = Object.entries(pnlByInstrument)
    .sort((a, b) => b[1].pnl - a[1].pnl)
    .slice(0, 5)


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


  const hourEntries = Object.entries(pnlByHour).map(([hour, data]) => ({ hour: parseInt(hour), ...data }))
  const bestHours = hourEntries.filter(h => h.trades >= 3).sort((a, b) => b.pnl - a.pnl).slice(0, 3)
  const worstHours = hourEntries.filter(h => h.trades >= 3).sort((a, b) => a.pnl - b.pnl).slice(0, 3)


  const emotionCounts: Record<string, number> = {}
  journals.forEach(j => {
    if (j.emotion) {
      emotionCounts[j.emotion] = (emotionCounts[j.emotion] || 0) + 1
    }
  })


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

  return {
    accountPerformance,
    accountStatusSummary,
    analyzedTrades,
    averagePartialsPerGroupedTrade,
    avgLoss,
    avgWin,
    bestHours,
    bestTrade,
    bestTradeContributionPct,
    biasAlignment,
    biasPerformance,
    brokenRuleTrades,
    consecutiveLossPattern,
    edgeFragility,
    emotionCounts,
    emotionPerformance,
    firstTradeAnalysis,
    getChartLinkCount,
    getNetPnl,
    getOutcome,
    getRuleList,
    getTradeDateKey,
    grossLoss,
    grossProfit,
    hourEntries,
    journalSummary,
    journals,
    newsDayLosses,
    newsDayPnL,
    newsDayWinRate,
    newsDayWins,
    newsEventsTrade,
    newsTradesStats,
    noNewsDayLosses,
    noNewsDayPnL,
    noNewsDayWinRate,
    noNewsDayWins,
    orderTypeStats,
    overtradingAnalysis,
    partialExecutionCount,
    pnlByHour,
    pnlByInstrument,
    pnlByStrategy,
    pnlByWeekday,
    pnlWithoutBestTrade,
    profitFactor,
    propFirmAccounts,
    revengeTradeAnalysis,
    reviewCompletenessRate,
    reviewReadyTrades,
    riskMetrics,
    ruleFrequency,
    secondBestTrade,
    sessionStats,
    setupPerformance,
    sortedPnls,
    streakPatterns,
    threshold,
    timeframeLabelMap,
    timeframeStats,
    topAccounts,
    topInstruments,
    topRules,
    topSetups,
    totalPnL,
    tradeNotes,
    tradeStats,
    tradedBeforeAfterNewsPnL,
    tradedDuringNewsPnL,
    trades,
    tradesAlignedWithBias,
    tradesWithBias,
    tradesWithCharts,
    tradesWithNotes,
    tradesWithRules,
    tradesWithSetup,
    tradingModels,
    usedOrderTypes,
    usedSessions,
    usedTimeframes,
    userTags,
    weeklyReviews,
    worstHours,
  }
}
