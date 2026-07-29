import type JSZip from 'jszip'

import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import {
  buildSyntheticExecutionsFromTrade,
  buildTradePersistenceData,
} from '@/lib/trade-core'
import type { ImportJobState } from '@/server/import-jobs/state'
import {
  uploadBacktestImages,
  uploadTradeImages,
} from '@/server/import-jobs/images'
import type { getSupabaseAdminClient } from '@/server/supabase-admin'

const TRADE_CHUNK_SIZE = 25
const BACKTEST_CHUNK_SIZE = 25

interface ImportExecutionInput {
  zip: JSZip
  data: Record<string, any>
  state: ImportJobState
  internalUserId: string
  supabase: ReturnType<typeof getSupabaseAdminClient>
  accountMap: Map<string, string>
  modelNameMap: Map<string, string>
  phaseMap: Map<string, string>
}

export async function processTradeImportChunk(
  input: ImportExecutionInput,
): Promise<void> {
  const trades = input.data.trades ?? []
  const endIndex = Math.min(
    trades.length,
    input.state.tradeIndex + TRADE_CHUNK_SIZE,
  )

  for (let index = input.state.tradeIndex; index < endIndex; index++) {
    const trade = trades[index]
    const preparedTrade = buildTradePersistenceData({
      ...trade,
      id: crypto.randomUUID(),
      userId: input.internalUserId,
      quantity: Number.parseFloat(trade.quantity || 0),
      pnl: Number.parseFloat(trade.pnl || 0),
    } as any)
    const existing = await db.query.Trade.findFirst({
      where: (table, operators) => operators.and(
        operators.eq(table.userId, input.internalUserId),
        operators.eq(
          table.tradeIdentityKey,
          preparedTrade.tradeIdentityKey,
        ),
      ),
      columns: { id: true },
    })
    if (existing) {
      input.state.skipped += 1
      continue
    }

    const newId = crypto.randomUUID()
    const images = await uploadTradeImages(
      input.zip,
      input.internalUserId,
      input.supabase,
      trade,
      newId,
    )
    const accountId = input.accountMap.get(trade.accountNumber) ?? null
    const phaseAccountId = input.phaseMap.get(
      trade.phaseId || trade.accountNumber,
    ) ?? null
    const modelId = trade.modelName
      ? input.modelNameMap.get(trade.modelName) ?? null
      : null
    const {
      id: _id,
      userId: _userId,
      originalId: _originalId,
      modelName: _modelName,
      ...rest
    } = trade
    const tradeToCreate = buildTradePersistenceData({
      ...rest,
      ...images,
      id: newId,
      userId: input.internalUserId,
      accountId,
      phaseAccountId,
      modelId,
      quantity: Number.parseFloat(trade.quantity || 0),
      pnl: Number.parseFloat(trade.pnl || 0),
    } as any)

    await db.transaction(async (tx) => {
      await tx.insert(schema.Trade).values(tradeToCreate as any)
      await tx.insert(schema.TradeExecution).values(
        buildSyntheticExecutionsFromTrade(tradeToCreate as any) as any,
      )
    })
    input.state.imported += 1
  }

  input.state.tradeIndex = endIndex
  if (input.state.tradeIndex >= trades.length) {
    input.state.phase = 'backtests'
  }
}

export async function processBacktestImportChunk(
  input: ImportExecutionInput,
): Promise<void> {
  const backtests = input.data.backtestTrades ?? []
  const endIndex = Math.min(
    backtests.length,
    input.state.backtestIndex + BACKTEST_CHUNK_SIZE,
  )

  for (let index = input.state.backtestIndex; index < endIndex; index++) {
    const backtestTrade = backtests[index]
    const existing = await db.query.BacktestTrade.findFirst({
      where: (table, operators) => operators.and(
        operators.eq(table.userId, input.internalUserId),
        operators.eq(table.pair, backtestTrade.pair),
        operators.eq(table.dateExecuted, backtestTrade.dateExecuted),
        operators.eq(table.entryPrice, backtestTrade.entryPrice),
        operators.eq(table.direction, backtestTrade.direction),
      ),
      columns: { id: true },
    })
    if (existing) {
      input.state.skipped += 1
      continue
    }

    const newId = crypto.randomUUID()
    const images = await uploadBacktestImages(
      input.zip,
      input.internalUserId,
      input.supabase,
      backtestTrade,
      newId,
    )
    const { id: _id, userId: _userId, ...rest } = backtestTrade
    await db.insert(schema.BacktestTrade).values({
      ...rest,
      ...images,
      userId: input.internalUserId,
      id: newId,
    })
    input.state.imported += 1
  }

  input.state.backtestIndex = endIndex
  if (input.state.backtestIndex >= backtests.length) {
    input.state.phase = 'completed'
  }
}
