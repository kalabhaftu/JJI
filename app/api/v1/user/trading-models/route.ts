import { NextRequest, NextResponse } from 'next/server'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { calculateWinRate, classifyOutcome, getBreakEvenThreshold } from '@/lib/metrics/outcome'
import { getRuntimeBreakEvenThreshold } from '@/server/user-settings'
import { and, eq, gte, lte, or } from 'drizzle-orm'

const ruleCategorySchema = z.enum(['entry', 'target', 'confirmation', 'confluence', 'exit', 'risk', 'general'])

const ruleSchema = z.object({
  text: z.string(),
  category: ruleCategorySchema
})

const tradingModelSchema = z.object({
  name: z.string().min(1, 'Model name is required').max(100),
  rules: z.array(ruleSchema).default([]),
  setups: z.array(z.string()).default([]),
  notes: z.string().nullable().optional(),
})

function boundedList(value: string | null, max = 50) {
  if (!value) return []
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, max)
}

function buildTradeFilterWhere(params: URLSearchParams) {
  const accounts = boundedList(params.get('accounts'))
  const dateFrom = params.get('dateFrom')
  const dateTo = params.get('dateTo')
  const conditions: any[] = []

  if (accounts.length > 0) {
    conditions.push(
      or(
        eq(schema.Trade.accountNumber, accounts[0]!),
        eq(schema.Trade.phaseAccountId, accounts[0]!)
      )
    )
  }

  if (dateFrom || dateTo) {
    const dateConds = []
    if (dateFrom) {
      const fromVal = dateFrom.includes('T') ? dateFrom : `${dateFrom}T00:00:00.000Z`
      dateConds.push(gte(schema.Trade.entryDate, fromVal))
    }
    if (dateTo) {
      const toVal = dateTo.includes('T') ? dateTo : `${dateTo}T23:59:59.999Z`
      dateConds.push(lte(schema.Trade.entryDate, toVal))
    }
    if (dateConds.length > 0) conditions.push(and(...dateConds))
  }

  return conditions.length > 0 ? and(...conditions) : undefined
}

// GET - List all trading models for user
export async function GET(request: NextRequest) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = identity.internalUserId

    const [models, breakEvenThreshold] = await Promise.all([
      db.query.TradingModel.findMany({
        where: (table, { eq }) => eq(table.userId, userId),
        orderBy: (table, { desc }) => [desc(table.createdAt)],
        with: {
          Trade: {
            where: buildTradeFilterWhere(request.nextUrl.searchParams),
            columns: {
              pnl: true,
              selectedRules: true
            }
          }
        }
      }),
      getRuntimeBreakEvenThreshold(userId)
    ])

    // Parse rules from JSON to array and calculate stats
    const formattedModels = models.map((model: (typeof models)[number]) => {
      const trades = model.Trade || []
      const tradeCount = trades.length

      const modelRules = typeof model.rules === 'string'
        ? JSON.parse(model.rules)
        : Array.isArray(model.rules)
          ? model.rules
          : []

      // Initialize rule adherence map
      const ruleAdherence: Record<string, { followed: number; total: number }> = {}
      modelRules.forEach((rule: any) => {
        const text = typeof rule === 'string' ? rule : rule.text
        ruleAdherence[text] = { followed: 0, total: 0 }
      })

      let totalPnL = 0
      let winCount = 0
      let lossCount = 0
      let breakEvenCount = 0

      trades.forEach((trade: (typeof trades)[number]) => {
        const netPnL = Number(trade.pnl || 0)
        totalPnL += netPnL

        const outcome = classifyOutcome(netPnL, breakEvenThreshold)
        if (outcome === 'win') {
          winCount++
        } else if (outcome === 'loss') {
          lossCount++
        } else {
          breakEvenCount++
        }

        // Track rule adherence
        const selectedRules = Array.isArray(trade.selectedRules) ? trade.selectedRules : []
        modelRules.forEach((rule: any) => {
          const text = typeof rule === 'string' ? rule : rule.text
          ruleAdherence[text]!.total++
          if (selectedRules.includes(text)) {
            ruleAdherence[text]!.followed++
          }
        })
      })

      // Calculate win rate (excluding break-even from denominator)
      const winRate = calculateWinRate(winCount, lossCount)

      // Overall adherence rate
      let totalMet = 0
      let totalPossible = 0
      Object.values(ruleAdherence).forEach(stat => {
        totalMet += stat.followed
        totalPossible += stat.total
      })
      const avgAdherence = totalPossible > 0 ? (totalMet / totalPossible) * 100 : 0

      // Remove Trade array from response to keep it light
      const { Trade, ...modelData } = model

      return {
        ...modelData,
        rules: modelRules,
        stats: {
          tradeCount,
          totalPnL,
          winRate,
          winCount,
          lossCount,
          breakEvenCount,
          avgAdherence,
          ruleAdherence
        }
      }
    })

    return NextResponse.json({ success: true, models: formattedModels })
  } catch (error) {
    logger.error('Failed to fetch trading models' + ' : ' + error)
    return NextResponse.json(
      { error: 'Failed to fetch models' },
      { status: 500 }
    )
  }
}

// POST - Create new trading model
export async function POST(request: NextRequest) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = identity.internalUserId

    const body = await request.json()
    const validated = tradingModelSchema.parse(body)

    const existing = await db.query.TradingModel.findFirst({
      where: (table, { and, eq }) => and(
        eq(table.userId, userId),
        eq(table.name, validated.name)
      ),
    })

    if (existing) {
      return NextResponse.json(
        { error: 'A model with this name already exists' },
        { status: 400 }
      )
    }

    const model = (await db.insert(schema.TradingModel).values({
      id: randomUUID(),
      userId,
      name: validated.name,
      rules: validated.rules,
      setups: validated.setups,
      notes: validated.notes,
    }).returning())[0]

    return NextResponse.json({ success: true, model }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to create model' },
      { status: 500 }
    )
  }
}