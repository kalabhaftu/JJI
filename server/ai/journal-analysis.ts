import { generateRuleBasedAnalysis } from '@/server/ai/journal-analysis/fallback'
import { requestJournalAnalysis } from '@/server/ai/journal-analysis/provider'
import { buildJournalAnalysisPrompt } from '@/server/ai/journal-analysis/prompt'
import { prepareJournalAnalysis } from '@/server/ai/journal-analysis/preparation'
import { reportError } from '@/lib/observability/report-error'

export async function generateJournalAnalysis(
  journals: any[],
  trades: any[],
  propFirmAccounts: any[] = [],
  userTags: any[] = [],
  tradingModels: any[] = [],
  weeklyReviews: any[] = [],
  breakEvenThreshold: number = 10
) {
  const analysisContext = prepareJournalAnalysis(
    journals,
    trades,
    propFirmAccounts,
    userTags,
    tradingModels,
    weeklyReviews,
    breakEvenThreshold,
  )
  const {
    emotionCounts,
    emotionPerformance,
    journalSummary,
    tradeNotes,
    tradeStats,
  } = analysisContext

  try {
    const apiKey = process.env.XAI_API_KEY
    const baseUrl = process.env.XAI_BASE_URL || 'https://api.x.ai/v1'
    const model = process.env.XAI_MODEL || 'grok-4-1-fast-reasoning'

    if (!apiKey) {
      return generateRuleBasedAnalysis(journalSummary, tradeStats, emotionCounts, emotionPerformance)
    }

    const prompt = buildJournalAnalysisPrompt(analysisContext)

    const providerAnalysis = await requestJournalAnalysis({
      apiKey,
      baseUrl,
      model,
      prompt,
    })
    return providerAnalysis
      ?? generateRuleBasedAnalysis(
        journalSummary,
        tradeStats,
        emotionCounts,
        emotionPerformance,
        tradeNotes,
      )
  } catch (error) {
    reportError(error, {
      surface: 'server',
      operation: 'request-journal-analysis-provider',
      extra: { fallbackUsed: true },
    })
    return generateRuleBasedAnalysis(journalSummary, tradeStats, emotionCounts, emotionPerformance, tradeNotes)
  }
}
