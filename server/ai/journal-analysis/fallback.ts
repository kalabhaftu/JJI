export function generateRuleBasedAnalysis(
  journals: any[],
  tradeStats: any,
  emotionCounts: Record<string, number>,
  emotionPerformance: Record<string, { trades: number; totalPnL: number }>,
  tradeNotes: any[] = [],
) {
  const winRate = tradeStats.totalTrades > 0
    ? (tradeStats.winningTrades / tradeStats.totalTrades) * 100
    : 0
  const emotionsWithPerformance = Object.entries(emotionPerformance)
    .filter(([, performance]) => performance.trades > 0)
    .map(([emotion, performance]) => ({
      emotion,
      avgPnL: performance.totalPnL / performance.trades,
      trades: performance.trades,
    }))
    .sort((a, b) => b.avgPnL - a.avgPnL)
  const bestEmotion = emotionsWithPerformance[0]
  const worstEmotion = emotionsWithPerformance[emotionsWithPerformance.length - 1]

  const summary = `Based on your ${tradeStats.totalTrades} trades${tradeNotes.length > 0 ? ` (${tradeNotes.length} with detailed notes)` : ''} and ${journals.length} journal entries, you have a ${winRate.toFixed(1)}% win rate with a total P&L of $${tradeStats.totalPnL.toFixed(2)}. ${bestEmotion ? `Your best performance occurs when feeling ${bestEmotion.emotion} (avg: $${bestEmotion.avgPnL.toFixed(2)} per trade).` : ''
  } ${journals.length > 5 || tradeNotes.length > 10 ? 'Your consistent documentation shows good self-awareness and discipline.' : 'More consistent journaling and trade notes could provide deeper insights into your trading patterns.'
  }`

  const emotionalPatterns: string[] = []
  if (bestEmotion && worstEmotion) {
    emotionalPatterns.push(`Best performance when ${bestEmotion.emotion}: $${bestEmotion.avgPnL.toFixed(2)} avg per trade`)
    emotionalPatterns.push(`Challenging performance when ${worstEmotion.emotion}: $${worstEmotion.avgPnL.toFixed(2)} avg per trade`)
  }
  if (emotionCounts.anxious && emotionCounts.anxious > 3) {
    emotionalPatterns.push(`Frequent anxiety noted (${emotionCounts.anxious} days) - may indicate overtrading or position sizing issues`)
  }
  if (emotionCounts.confident && emotionPerformance.confident) {
    const confidentPerformance = emotionPerformance.confident
    emotionalPatterns.push(`Confidence correlates with ${confidentPerformance.trades} trades averaging $${(confidentPerformance.totalPnL / confidentPerformance.trades).toFixed(2)}`)
  }

  const performanceInsights: string[] = []
  if (winRate >= 60) {
    performanceInsights.push(`Strong win rate of ${winRate.toFixed(1)}% indicates good trade selection`)
  } else if (winRate < 40) {
    performanceInsights.push(`Win rate of ${winRate.toFixed(1)}% suggests need to refine entry criteria or risk management`)
  }
  performanceInsights.push(
    tradeStats.totalPnL > 0
      ? `Net positive P&L of $${tradeStats.totalPnL.toFixed(2)} shows overall profitability`
      : 'Net negative P&L indicates need for strategy adjustment',
  )
  if (tradeStats.totalTrades > 0) {
    performanceInsights.push(`Average P&L per trade: $${tradeStats.averagePnL.toFixed(2)}`)
  }

  const strengths: string[] = []
  if (journals.length >= 10 || tradeNotes.length >= 15) {
    strengths.push('Consistent documentation habit demonstrates discipline and self-awareness')
  }
  if (tradeNotes.length > 0) {
    strengths.push(`Detailed trade notes on ${tradeNotes.length} trades show commitment to improvement`)
  }
  if (winRate >= 50) strengths.push('Positive win rate shows effective trade selection')
  if (tradeStats.totalPnL > 0) strengths.push('Net profitable trading over the analyzed period')
  if (Object.keys(emotionCounts).length >= 5) strengths.push('Good emotional awareness and tracking')

  const weaknesses: string[] = []
  if (journals.length < 5 && tradeStats.totalTrades > 10) {
    weaknesses.push('Inconsistent journaling relative to trading frequency')
  }
  if (winRate < 45) weaknesses.push('Low win rate may indicate need for better entry criteria')
  if (worstEmotion && worstEmotion.avgPnL < -50) {
    weaknesses.push(`Poor performance when ${worstEmotion.emotion} - avoid trading in this state`)
  }

  const recommendations: string[] = []
  if (bestEmotion) {
    recommendations.push(`Focus on trading when feeling ${bestEmotion.emotion} - your best performance state`)
  }
  if (worstEmotion && worstEmotion.avgPnL < 0) {
    recommendations.push(`Avoid trading or reduce position size when ${worstEmotion.emotion}`)
  }
  if (journals.length < 10) recommendations.push('Increase journaling frequency to identify more patterns')
  recommendations.push('Review journal entries before trading to build self-awareness')
  recommendations.push('Set specific trading rules for different emotional states')

  return {
    summary,
    emotionalPatterns: emotionalPatterns.slice(0, 5),
    performanceInsights: performanceInsights.slice(0, 5),
    strengths: strengths.slice(0, 4),
    weaknesses: weaknesses.slice(0, 4),
    recommendations: recommendations.slice(0, 5),
  }
}
