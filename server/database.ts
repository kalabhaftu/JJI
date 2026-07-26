'use server'
import type { TradeType } from '@/lib/db/schema/trades';

import { revalidatePath, revalidateTag } from 'next/cache'
import { Widget, Layouts } from '@/app/dashboard/types/dashboard'
import { createClient, getUserId, getUserIdSafe } from './auth'
import { startOfDay } from 'date-fns'

import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { unstable_cache } from 'next/cache'
import logger from '@/lib/logger'
import { convertDecimal } from '@/lib/utils/decimal'
import { buildTradePersistenceData } from '@/lib/trade-core'
import { parseTradeUpdate } from '@/lib/trades/update-schema'
import { eq, inArray, desc, and, sql } from 'drizzle-orm'

type Trade = typeof schema.Trade.$inferSelect

type TradeError =
  | 'DUPLICATE_TRADES'
  | 'NO_TRADES_ADDED'
  | 'DATABASE_ERROR'
  | 'INVALID_DATA'
  | 'DATABASE_CONNECTION_ERROR'

interface TradeResponse {
  error: TradeError | false
  numberOfTradesAdded: number
  details?: unknown
}

interface TradeQueryWhere {
  userId: string
  entryDate?: { gte: string }
}

interface TradeCountQuery {
  where: TradeQueryWhere
}

interface TradeQuery extends TradeCountQuery {
  orderBy: { entryDate: 'desc' }
  skip: number
  take: number
}

export async function revalidateCache(tags: string[]) {
  tags.forEach(tag => {
    try {
      revalidateTag(tag)
    } catch (error) {
      logger.error(error, `Error revalidating tag ${tag}`, 'Cache')
    }
  })
}

export async function saveTradesAction(data: Trade[]): Promise<TradeResponse> {
  if (!Array.isArray(data) || data.length === 0) {
    return {
      error: 'INVALID_DATA',
      numberOfTradesAdded: 0,
      details: 'No trades provided'
    }
  }

  try {
    const cleanedData = data.map(trade => {
      const cleanTrade = Object.fromEntries(
        Object.entries(trade).filter(([_, value]) => value !== undefined)
      ) as Partial<Trade>

      return buildTradePersistenceData({
        id: cleanTrade.id || crypto.randomUUID(),
        ...cleanTrade,
        accountNumber: cleanTrade.accountNumber || '',
        instrument: cleanTrade.instrument || '',
        entryPrice: cleanTrade.entryPrice || '',
        closePrice: cleanTrade.closePrice || '',
        entryDate: cleanTrade.entryDate || '',
        closeDate: cleanTrade.closeDate || '',
        quantity: cleanTrade.quantity ?? 0,
        pnl: cleanTrade.pnl || 0,
        timeInPosition: cleanTrade.timeInPosition || 0,
        userId: cleanTrade.userId || '',
        side: cleanTrade.side || '',
        commission: cleanTrade.commission || 0,
        entryId: cleanTrade.entryId || null,
        comment: cleanTrade.comment || null,
        groupId: cleanTrade.groupId || null,
        createdAt: cleanTrade.createdAt || new Date(),
      } as Trade) as Trade
    })

    const userId = cleanedData[0]?.userId
    if (!userId) {
      return {
        error: 'INVALID_DATA',
        numberOfTradesAdded: 0,
        details: 'No user ID found in trades'
      }
    }

    logger.debug({ userId }, `Inserting ${cleanedData.length} trades with database-level deduplication`, 'SaveTrades')

    const insertResult = await db.insert(schema.Trade).values(cleanedData as any).onConflictDoNothing()
    const result = { count: cleanedData.length }

    logger.debug({
      total: cleanedData.length,
      added: result.count,
      skipped: cleanedData.length - result.count
    }, `Batch insert completed: ${result.count} trades added`, 'SaveTrades')


    revalidatePath('/')
    return {
      error: false,
      numberOfTradesAdded: result.count,
      details: `Processed ${cleanedData.length} entries. ${result.count} new trades added.`
    }
  } catch (error) {
    logger.error(error, 'Database error in saveTrades', 'saveTrades')

    if (error instanceof Error && (
      error.message.includes("Can't reach database server") ||
      error.message.includes('P1001') ||
      error.message.includes('Connection timeout') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ENOTFOUND')
    )) {
      return {
        error: 'DATABASE_CONNECTION_ERROR',
        numberOfTradesAdded: 0,
        details: 'Database is temporarily unavailable. Please check your database connection and try again.'
      }
    }

    return {
      error: 'DATABASE_ERROR',
      numberOfTradesAdded: 0,
      details: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}



async function getTradesAction(userId: string | null = null, options?: {
  page?: number
  limit?: number
  offset?: number
  filters?: {
    dateRange?: { from: Date | string; to: Date | string }
    instruments?: string[]
    accountNumbers?: string[]
  }
}): Promise<Trade[]> {
  try {
    // PERFORMANCE FIX: If userId is provided (from DataProvider), use it directly
    // Only fetch from auth if no userId provided (rare case)
    let actualUserId = userId

    if (!actualUserId) {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return []
      }
      actualUserId = user.id
    }

    const page = options?.page || 1
    const limit = options?.limit || 100000 // Load all trades by default
    const offset = options?.offset || (page - 1) * limit

    // IMPORTANT: Removed unstable_cache wrapper to prevent "items over 2MB cannot be cached" errors
    // Trade data with images and large datasets exceeds Next.js 2MB cache limit
    // Database queries are already fast with proper indexing
    try {
      let whereClause: any = { userId: actualUserId }

      // CRITICAL: Primary account filter - fetch only selected accounts
      // PERFORMANCE FIX: Use accountNumbers from filters
      const accountsFilter = options?.filters?.accountNumbers
      if (accountsFilter?.length) {
        whereClause.accountNumber = { in: accountsFilter }
      }

    if (options?.filters?.dateRange?.from && options?.filters?.dateRange?.to) {
        const fromDate = options.filters.dateRange.from
        const toDate = options.filters.dateRange.to
        
        whereClause.entryDate = {
          gte: fromDate instanceof Date ? fromDate.toISOString() : fromDate,
          lte: toDate instanceof Date ? toDate.toISOString() : toDate
        }
      }

      if (options?.filters?.instruments?.length) {
        whereClause.instrument = { in: options.filters.instruments }
      }

      const trades = await db.query.Trade.findMany({
        where: (table, { eq, and, inArray, gte, lte }) => {
          const conditions = [eq(table.userId, actualUserId)]
          if (accountsFilter?.length) {
            conditions.push(inArray(table.accountNumber, accountsFilter))
          }
          if (options?.filters?.dateRange?.from && options?.filters?.dateRange?.to) {
            const fromDate = options.filters.dateRange.from instanceof Date ? options.filters.dateRange.from.toISOString() : options.filters.dateRange.from
            const toDate = options.filters.dateRange.to instanceof Date ? options.filters.dateRange.to.toISOString() : options.filters.dateRange.to
            conditions.push(gte(table.entryDate, fromDate), lte(table.entryDate, toDate))
          }
          if (options?.filters?.instruments?.length) {
            conditions.push(inArray(table.instrument, options.filters.instruments))
          }
          return and(...conditions)
        },
        orderBy: (table, { desc }) => [desc(table.entryDate)],
        limit,
        offset,
        with: {
          TradingModel: {
            columns: {
              id: true,
              name: true
            }
          }
        }
      })

      return trades.map((trade: any) => ({
        ...trade,
        entryPrice: convertDecimal(trade.entryPrice),
        closePrice: convertDecimal(trade.closePrice),
        stopLoss: convertDecimal(trade.stopLoss),
        takeProfit: convertDecimal(trade.takeProfit),
        entryDate: new Date(trade.entryDate).toISOString(),
        exitDate: trade.closeDate ? new Date(trade.closeDate).toISOString() : null,
        // Map TradingModel relation to tradingModel field for chart components
        tradingModel: trade.TradingModel?.name || null
      })) as any
    } catch (error) {
      if (error instanceof Error) {
        // Handle table doesn't exist error
        if (error.message.includes('does not exist')) {
          return []
        }
        // Handle database connection errors
        if (error.message.includes("Can't reach database server") ||
          error.message.includes('P1001') ||
          error.message.includes('connection') ||
          error.message.includes('timeout')) {
          return []
        }
      }
      // Unexpected error occurred
      return []
    }

  } catch (error) {
    // Error in getTradesAction
    // Return empty array if there's any error
    return []
  }
}


export async function updateTradesAction(tradesIds: string[], update: Partial<Trade>): Promise<number> {
  try {
    // CRITICAL: Convert auth_user_id to internal user.id
    const authUserId = await getUserIdSafe()
    if (!authUserId) {
      return 0
    }

    const userLookup = await db.query.User.findFirst({
      where: (table, { eq }) => eq(table.auth_user_id, authUserId),
      columns: { id: true }
    })

    if (!userLookup) {
      return 0
    }

    const internalUserId = userLookup.id

    const normalizedUpdate: Record<string, any> = parseTradeUpdate(update)
    if ('chartLinks' in update || 'chartLinksList' in update) {
      const normalized = buildTradePersistenceData(update as any)
      normalizedUpdate.chartLinks = normalized.chartLinks
      normalizedUpdate.chartLinksList = normalized.chartLinksList
    }
    if ('entryTime' in update || 'entryDate' in update) {
      normalizedUpdate.entryTime = buildTradePersistenceData(update as any).entryTime
    }
    if ('exitTime' in update || 'closeDate' in update) {
      normalizedUpdate.exitTime = buildTradePersistenceData(update as any).exitTime
    }
    if ('entryPrice' in update || 'entryPriceValue' in update) {
      normalizedUpdate.entryPriceValue = buildTradePersistenceData(update as any).entryPriceValue
    }
    if ('closePrice' in update || 'closePriceValue' in update) {
      normalizedUpdate.closePriceValue = buildTradePersistenceData(update as any).closePriceValue
    }
    if ('stopLoss' in update || 'stopLossValue' in update) {
      normalizedUpdate.stopLossValue = buildTradePersistenceData(update as any).stopLossValue
    }
    if ('takeProfit' in update || 'takeProfitValue' in update) {
      normalizedUpdate.takeProfitValue = buildTradePersistenceData(update as any).takeProfitValue
    }

    const result = await db.update(schema.Trade).set(normalizedUpdate as any).where(and(inArray(schema.Trade.id, tradesIds), eq(schema.Trade.userId, internalUserId))).returning()

    revalidateTag(`trades-${internalUserId}`)

    return result.length
  } catch (error) {
    return 0
  }
}

export async function appendTagsToTradesAction(tradeIds: string[], tagIds: string[]): Promise<number> {
  try {
    const authUserId = await getUserIdSafe()
    if (!authUserId) return 0

    const userLookup = await db.query.User.findFirst({
      where: (table, { eq }) => eq(table.auth_user_id, authUserId),
      columns: { id: true }
    })
    if (!userLookup) return 0
    const internalUserId = userLookup.id

    // Optimized: Use raw SQL to append and deduplicate tags in a single atomic operation
    // This is much faster than fetching all trades and updating them one by one
    const result = await db.execute(sql`
      UPDATE "Trade"
      SET tags = COALESCE(
        (SELECT array_agg(DISTINCT x)
         FROM unnest(COALESCE(tags, ARRAY[]::text[]) || ${tagIds}::text[]) AS x),
        ARRAY[]::text[]
      )
      WHERE id = ANY(${tradeIds}) 
      AND "userId" = ${internalUserId}
    `)

    revalidateTag(`trades-${internalUserId}`)
    
    return (result as any).rowCount || 0
  } catch (error) {
    logger.error(error, 'Failed to append tags to trades')
    return 0
  }
}

async function updateTradeCommentAction(tradeId: string, comment: string | null) {
  try {
    await db.update(schema.Trade).set({ comment }).where(eq(schema.Trade.id, tradeId)).returning()
    revalidatePath('/')
  } catch (error) {
    throw error
  }
}

  async function loadDashboardLayoutAction(): Promise<Layouts | null> {
  return null
}

export async function saveDashboardLayoutAction(layouts: any): Promise<void> {
  return
}

export async function groupTradesAction(tradeIds: string[]): Promise<boolean> {
  try {
    const userId = await getUserIdSafe()

    if (!userId) {
      return false
    }

    const groupId = crypto.randomUUID()

    await db.update(schema.Trade).set({ groupId }).where(and(inArray(schema.Trade.id, tradeIds), eq(schema.Trade.userId, userId))).returning()

    revalidatePath('/')
    return true
  } catch (error) {
    return false
  }
}

export async function ungroupTradesAction(tradeIds: string[]): Promise<boolean> {
  try {
    const userId = await getUserIdSafe()

    if (!userId) {
      return false
    }

    await db.update(schema.Trade).set({ groupId: "" }).where(and(inArray(schema.Trade.id, tradeIds), eq(schema.Trade.userId, userId))).returning()

    revalidatePath('/')
    return true
  } catch (error) {
    return false
  }
}
