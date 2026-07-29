import { NextRequest, NextResponse } from 'next/server'
import { reportApiHandlerError, withCanonicalApiResponse } from '@/lib/api/canonical-handler'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { getResolvedUserIdentity } from '@/server/user-identity'
import { applyRateLimit, apiLimiter, aiReviewLimiter, consumeRateLimitKey } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import { cleanContent } from '@/lib/content/cleaning'
import { classifyOutcome, getBreakEvenThreshold } from '@/lib/metrics/outcome'
import { format, startOfWeek, endOfWeek, subWeeks } from 'date-fns'
import { getRuntimeBreakEvenThreshold } from '@/server/user-settings'
import { eq, and, ne, desc } from 'drizzle-orm'
import { z } from 'zod'
import { checkAIAccess } from '@/lib/services/ai-guard-service'
import { hasCurrentAiDataConsent } from '@/lib/services/ai-consent'

export const maxDuration = 30

const weeklyReviewRequestSchema = z.object({
  clientDate: z.string().datetime({ offset: true }).optional(),
}).strict()

const weeklyReviewResultSchema = z.object({
  grade: z.enum(['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F']),
  weekSummary: z.string().trim().min(1).max(2_000),
  highlights: z.array(z.string().trim().min(1).max(500)).max(3),
  lowlights: z.array(z.string().trim().min(1).max(500)).max(3),
  focusNextWeek: z.string().trim().min(1).max(1_000),
}).strict()

async function getWeeklyReviews(request: NextRequest) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  try {
    const { internalUserId } = await getResolvedUserIdentity()
    const params = request.nextUrl.searchParams
    const limit = z.coerce.number().int().min(1).max(50).catch(10).parse(params.get('limit') || '10')
    const latest = params.get('latest') === 'true'
    const reviewId = params.get('reviewId')

    if (reviewId) {
      const requestedReview = await db.query.WeeklyAIReview.findFirst({
        where: (table, { eq, and }) => and(eq(table.id, reviewId), eq(table.userId, internalUserId)),
      })

      if (!requestedReview) {
        return NextResponse.json({ success: true, data: [] })
      }

      const siblingReviews = await db.query.WeeklyAIReview.findMany({
        where: (table, { eq }) => and(eq(table.userId, internalUserId), ne(table.id, reviewId)),
        orderBy: (table, { desc }) => [desc(table.weekStart)],
        limit: Math.max(0, limit - 1),
      })

      return NextResponse.json({ success: true, data: [requestedReview, ...siblingReviews] })
    }

    if (latest) {
      const review = await db.query.WeeklyAIReview.findFirst({
        where: (table, { eq }) => eq(table.userId, internalUserId),
        orderBy: (table, { desc }) => [desc(table.createdAt)],
      })
      return NextResponse.json({ success: true, data: review })
    }

    const reviews = await db.query.WeeklyAIReview.findMany({
      where: (table, { eq }) => eq(table.userId, internalUserId),
      orderBy: (table, { desc }) => [desc(table.weekStart)],
      limit,
    })

    return NextResponse.json({ success: true, data: reviews })
  } catch (error: any) {
    if (error.message?.includes('not authenticated') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    reportApiHandlerError(request, error, 'list-weekly-reviews')
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

async function createWeeklyReview(request: NextRequest) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  const start = Date.now()

  let reviewWeekStart: Date | null = null
  let resolvedUserId: string | null = null

  try {
    const { internalUserId } = await getResolvedUserIdentity()
    resolvedUserId = internalUserId

    const aiGuard = await checkAIAccess(internalUserId)
    if (!aiGuard.hasAccess) {
      return NextResponse.json({ error: aiGuard.reason, code: 'PAYWALL' }, { status: 403 })
    }
    if (!(await hasCurrentAiDataConsent(internalUserId))) {
      return NextResponse.json(
        { error: 'AI data processing consent is required', code: 'AI_DATA_CONSENT_REQUIRED' },
        { status: 412 },
      )
    }

    // Calculate last week's window (Mon–Sun)
    let requestBody: z.infer<typeof weeklyReviewRequestSchema>
    try {
      const rawBody = await request.text()
      requestBody = weeklyReviewRequestSchema.parse(rawBody ? JSON.parse(rawBody) : {})
     } catch {
       return NextResponse.json({ error: 'Invalid review request' }, { status: 400 })
     }

    const now = requestBody.clientDate ? new Date(requestBody.clientDate) : new Date()
    const dayOfWeek = now.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    let lastWeekStart: Date
    let lastWeekEnd: Date

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // Saturday or Sunday: review the week starting this Monday
      lastWeekStart = startOfWeek(now, { weekStartsOn: 1 })
      lastWeekEnd = endOfWeek(now, { weekStartsOn: 1 })
    } else {
      // Monday through Friday: review the week starting last Monday
      lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
      lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
    }
    
    // Normalize to start and end of day
    lastWeekStart.setHours(0, 0, 0, 0)
    lastWeekEnd.setHours(23, 59, 59, 999)
    reviewWeekStart = lastWeekStart

    // Idempotent: return existing review if already generated
    const existing = await db.query.WeeklyAIReview.findFirst({
      where: (table, { eq, and }) => and(eq(table.userId, internalUserId), eq(table.weekStart, lastWeekStart)),
    })

    if (existing) {
      return NextResponse.json({ success: true, data: existing, cached: true })
    }

    let trades = await db.query.Trade.findMany({
      where: (table, { eq, and, gte, lte }) => and(
        eq(table.userId, internalUserId),
        gte(table.entryDate, format(lastWeekStart, 'yyyy-MM-dd')),
        lte(table.entryDate, format(lastWeekEnd, 'yyyy-MM-dd') + 'T23:59:59.999Z')
      ),
      orderBy: (table, { desc }) => [desc(table.entryDate)],
      with: { TradingModel: true },
      limit: 100,
    })
    
    trades = trades.reverse()

    // No trades last week → don't create a review
    if (trades.length === 0) {
      return NextResponse.json({ success: true, data: null, reason: 'no_trades' })
    }

    const apiKey = process.env.XAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI provider is unavailable', code: 'AI_PROVIDER_UNAVAILABLE' },
        { status: 503 },
      )
    }

    const { allowed } = await consumeRateLimitKey(`ai-review:${internalUserId}`, aiReviewLimiter)
    if (!allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many requests',
          details: 'You can only generate one AI review per 24 hours.',
          code: 'RATE_LIMIT_EXCEEDED',
          retryable: true,
        },
        { status: 429 },
      )
    }

    const breakEvenThreshold = await getRuntimeBreakEvenThreshold(internalUserId)
    const getNetPnl = (trade: any) => Number(trade.pnl || 0)
    const getOutcome = (trade: any) => classifyOutcome(getNetPnl(trade), breakEvenThreshold)

    // Compute stats
    const wins = trades.filter(t => getOutcome(t) === 'win')
    const losses = trades.filter(t => getOutcome(t) === 'loss')
    const totalPnl = trades.reduce((s, t) => s + getNetPnl(t), 0)
    const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0
    const grossProfit = wins.reduce((s, t) => s + getNetPnl(t), 0)
    const grossLoss = Math.abs(losses.reduce((s, t) => s + getNetPnl(t), 0))
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0
    const avgWin = wins.length > 0 ? grossProfit / wins.length : 0
    const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0

    // P&L by day
    const pnlByDay: Record<string, { pnl: number; trades: number }> = {}
    trades.forEach(t => {
      const day = format(new Date(t.entryDate), 'EEEE')
      if (!pnlByDay[day]) pnlByDay[day] = { pnl: 0, trades: 0 }
      pnlByDay[day].pnl += getNetPnl(t)
      pnlByDay[day].trades++
    })

    const dayEntries = Object.entries(pnlByDay).sort((a, b) => b[1].pnl - a[1].pnl)
    const bestDay = dayEntries[0] || null
    const worstDay = dayEntries[dayEntries.length - 1] || null

    // P&L by instrument
    const pnlByInstrument: Record<string, { pnl: number; trades: number; wins: number }> = {}
    trades.forEach(t => {
      if (!pnlByInstrument[t.instrument]) pnlByInstrument[t.instrument] = { pnl: 0, trades: 0, wins: 0 }
      pnlByInstrument[t.instrument]!.pnl += getNetPnl(t)
      pnlByInstrument[t.instrument]!.trades++
      if (getOutcome(t) === 'win') pnlByInstrument[t.instrument]!.wins++
    })

    // Streak analysis
    let maxWinStreak = 0, maxLossStreak = 0, curW = 0, curL = 0
    trades.forEach(t => {
      if (getOutcome(t) === 'win') { curW++; curL = 0; maxWinStreak = Math.max(maxWinStreak, curW) }
      else if (getOutcome(t) === 'loss') { curL++; curW = 0; maxLossStreak = Math.max(maxLossStreak, curL) }
    })

    // Trades per day
    const tradingDays = new Set(trades.map(t => format(new Date(t.entryDate), 'yyyy-MM-dd'))).size
    const avgTradesPerDay = tradingDays > 0 ? trades.length / tradingDays : 0

    const keyStats = {
      totalTrades: trades.length,
      winRate: Math.round(winRate * 10) / 10,
      totalPnl: Math.round(totalPnl * 100) / 100,
      profitFactor: profitFactor === Infinity ? 999 : Math.round(profitFactor * 100) / 100,
      wins: wins.length,
      losses: losses.length,
      avgWin: Math.round(avgWin * 100) / 100,
      avgLoss: Math.round(avgLoss * 100) / 100,
      bestDay: bestDay ? { day: bestDay[0], pnl: Math.round(bestDay[1].pnl * 100) / 100, trades: bestDay[1].trades } : null,
      worstDay: worstDay ? { day: worstDay[0], pnl: Math.round(worstDay[1].pnl * 100) / 100, trades: worstDay[1].trades } : null,
      avgTradesPerDay: Math.round(avgTradesPerDay * 10) / 10,
      tradingDays,
      maxWinStreak,
      maxLossStreak,
      instruments: Object.entries(pnlByInstrument)
        .sort((a, b) => b[1].pnl - a[1].pnl)
        .slice(0, 5)
        .map(([name, d]) => ({ name, pnl: Math.round(d.pnl * 100) / 100, trades: d.trades, winRate: d.trades > 0 ? Math.round((d.wins / d.trades) * 1000) / 10 : 0 })),
    }

    // Build stats summary for the AI prompt
    const instrumentSummary = Object.entries(pnlByInstrument)
      .sort((a, b) => b[1].pnl - a[1].pnl)
      .map(([name, d]) => `${name}: ${d.trades} trades, $${d.pnl.toFixed(2)}, ${d.trades > 0 ? ((d.wins / d.trades) * 100).toFixed(0) : 0}% WR`)
      .join('\n')

    const daySummary = dayEntries
      .map(([day, d]) => `${day}: ${d.trades} trades, $${d.pnl.toFixed(2)}`)
      .join('\n')

    // Call AI
    const baseUrl = process.env.XAI_BASE_URL || 'https://api.x.ai/v1'
    const model = process.env.XAI_MODEL || 'grok-4-1-fast-reasoning'

    let aiResult: z.infer<typeof weeklyReviewResultSchema>

    try {
        const prompt = `You are a trading performance analyst writing a concise Weekly Performance Report Card.

This is NOT a deep behavioral audit. This is a short, scannable weekly summary that tells the trader:
1. How their week went (grade + one paragraph)
2. What went right (2 to 3 bullet points)
3. What went wrong (2 to 3 bullet points)
4. ONE specific focus for next week

TONE: Professional but warm. Not a drill sergeant. Think Bloomberg performance summary meets supportive mentor. Be specific with numbers.

GRADING SCALE:
A+ = Exceptional (profitable + high discipline + improving)
A  = Excellent (strongly profitable + good execution)
B+ = Good (profitable + minor issues)
B  = Above Average (slightly profitable or breakeven but disciplined)
C+ = Average (breakeven, mixed signals)
C  = Below Average (slightly negative, clear issues)
D  = Poor (negative P&L + discipline issues)
F  = Failing (large losses + no discipline)

THE DATA:

Week: ${format(lastWeekStart, 'MMM d')} to ${format(lastWeekEnd, 'MMM d, yyyy')}

Key Stats:
- Total Trades: ${keyStats.totalTrades} across ${tradingDays} trading days
- Win Rate: ${keyStats.winRate}% (${wins.length}W / ${losses.length}L)
- Total P&L: $${totalPnl.toFixed(2)}
- Profit Factor: ${profitFactor === Infinity ? 'Infinite' : profitFactor.toFixed(2)}
- Avg Win: $${avgWin.toFixed(2)} | Avg Loss: $${avgLoss.toFixed(2)}
- R:R Ratio: ${avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : 'N/A'}
- Max Win Streak: ${maxWinStreak} | Max Loss Streak: ${maxLossStreak}
- Avg Trades/Day: ${avgTradesPerDay.toFixed(1)}

By Instrument:
${instrumentSummary || 'No instrument data'}

By Day:
${daySummary || 'No daily data'}

RESPOND WITH EXACTLY THIS JSON:
{
  "grade": "Letter grade (A+ through F)",
  "weekSummary": "One paragraph (3 to 4 sentences). Start with the verdict. Then the key takeaway. Keep it under 200 words.",
  "highlights": ["2 to 3 specific positive observations backed by numbers"],
  "lowlights": ["2 to 3 specific negative observations backed by numbers. Empty array if genuinely nothing wrong."],
  "focusNextWeek": "ONE specific, actionable, measurable thing to focus on next week. Not generic advice."
}

RULES:
- NO emojis, NO hyphens/dashes in output
- Use "negative" or "to" instead of dashes
- Output ONLY valid JSON. Nothing else.
- Be concise. This is a quick report, not an essay.`

        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'system',
                content: 'You are a trading performance analyst. Write concise weekly report cards. Output ONLY valid JSON. No emojis. No dashes.'
              },
              { role: 'user', content: prompt }
            ],
            temperature: 0.6,
            max_tokens: 1500,
          }),
          signal: AbortSignal.timeout(25_000),
        })

        if (!response.ok) {
          throw new Error(`AI provider returned ${response.status}`)
        }
        const data = await response.json()
        const content = data.choices?.[0]?.message?.content
        const jsonMatch = typeof content === 'string' ? content.match(/\{[\s\S]*\}/) : null
        if (!jsonMatch) {
          throw new Error('AI provider returned no structured review')
        }
        aiResult = weeklyReviewResultSchema.parse(cleanContent(JSON.parse(jsonMatch[0])))
    } catch (error) {
      reportApiHandlerError(request, error, 'generate-weekly-review')
      return NextResponse.json(
        { error: 'AI review generation failed', code: 'AI_PROVIDER_ERROR' },
        { status: 502 },
      )
    }

    const review = await db.transaction(async (tx) => {
      const insertedReview = (await tx.insert(schema.WeeklyAIReview).values({
        userId: internalUserId,
        weekStart: lastWeekStart,
        weekEnd: lastWeekEnd,
        summary: aiResult.weekSummary,
        highlights: aiResult.highlights,
        lowlights: aiResult.lowlights,
        stats: keyStats,
        grade: aiResult.grade,
        focusNextWeek: aiResult.focusNextWeek,
      }).returning())[0]

      if (!insertedReview) throw new Error('Failed to persist weekly review')

      await tx.insert(schema.Notification).values({
        userId: internalUserId,
        type: 'WEEKLY_PERFORMANCE',
        title: `Weekly Report: ${format(lastWeekStart, 'MMM d')} – ${format(lastWeekEnd, 'MMM d')} | Grade: ${aiResult.grade}`,
        message: aiResult.weekSummary.slice(0, 500),
        data: { reviewId: insertedReview.id },
        actionRequired: false,
      })

      return insertedReview
    })

    logger.info({ latencyMs: Date.now() - start, grade: aiResult.grade, layer: 'api' }, 'POST /api/v1/weekly-review')
    return NextResponse.json({ success: true, data: review })
  } catch (error: any) {
    if (error.message?.includes('not authenticated') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // Unique constraint = already exists (race condition)
    if (error.code === '23505' && reviewWeekStart && resolvedUserId) {
      const existing = await db.query.WeeklyAIReview.findFirst({
        where: (table, { eq, and }) => and(
          eq(table.userId, resolvedUserId!),
          eq(table.weekStart, reviewWeekStart!),
        ),
      })
      return NextResponse.json({ success: true, data: existing, cached: true })
    }
    reportApiHandlerError(request, error, 'create-weekly-review')
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export const GET = withCanonicalApiResponse(getWeeklyReviews)
export const POST = withCanonicalApiResponse(createWeeklyReview)
