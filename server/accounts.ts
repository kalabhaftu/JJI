'use server'
import logger from '@/lib/logger';

import { getUserId, getUserIdSafe } from '@/server/auth'
import type { TradeType } from '@/lib/db/schema/trades';

import { Account } from '@/context/data-provider'
import { unstable_cache, revalidateTag } from 'next/cache'
import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { convertDecimal } from '@/lib/utils/decimal'
import { NotificationService } from './services/notification-service'

import { logActivity } from '@/lib/activity-logger'
import { withCache } from '@/lib/cache/helpers'
import { CacheKeys, CacheTTL } from '@/lib/cache/keys'
import { calculateWinRate, classifyOutcome, getBreakEvenThreshold } from '@/lib/metrics/outcome'
import { TRADE_COUNT_SELECT, buildGroupedTradeCountSummary } from '@/lib/trade-counts'
import { buildSyntheticExecutionsFromTrade, buildTradePersistenceData, buildTradeIdentityKey } from '@/lib/trade-core'
import { getRuntimeAutoAdjustAccountDate, getRuntimeBreakEvenThreshold } from '@/server/user-settings'
import { deletePublicStorageUrls } from '@/server/storage-admin'
import { isFundedPhaseForEvaluation } from '@/lib/prop-firm/reporting'
import { eq, and, or, inArray, desc, asc } from 'drizzle-orm'

function isFundedPhase(evaluationType: string, phaseNumber: number): boolean {
  return isFundedPhaseForEvaluation(evaluationType, phaseNumber)
}

function getPhaseDisplayName(evaluationType: string, phaseNumber: number): string {
  if (isFundedPhase(evaluationType, phaseNumber)) {
    return 'Funded'
  }
  return `Phase ${phaseNumber}`
}

type GroupedTrades = Record<string, Record<string, TradeType[]>>

interface FetchTradesResult {
  groupedTrades: GroupedTrades;
  flattenedTrades: TradeType[];
}

async function fetchGroupedTradesAction(userId: string): Promise<FetchTradesResult> {
  const trades = await db.query.Trade.findMany({
    where: (table, { eq }) => eq(table.userId, userId),
    orderBy: (table, { asc }) => [asc(table.accountNumber), asc(table.instrument)]
  })

  const serializedTrades = trades.map(trade => ({
    ...trade,
    entryPrice: convertDecimal(trade.entryPrice),
    closePrice: convertDecimal(trade.closePrice),
    stopLoss: convertDecimal(trade.stopLoss),
    takeProfit: convertDecimal(trade.takeProfit),
  })) as any

  const groupedTrades = serializedTrades.reduce((acc: any, trade: any) => {
    if (!acc[trade.accountNumber]) {
      acc[trade.accountNumber] = {}
    }
    if (!acc[trade.accountNumber][trade.instrument]) {
      acc[trade.accountNumber][trade.instrument] = []
    }
    acc[trade.accountNumber][trade.instrument].push(trade)
    return acc
  }, {})

  return JSON.parse(JSON.stringify({
    groupedTrades,
    flattenedTrades: serializedTrades
  }))
}

export async function removeAccountsFromTradesAction(accountNumbers: string[]): Promise<void> {
  const userId = await getUserId()
  
  const tradesWithImages = await db.query.Trade.findMany({
    where: (table, { and, inArray, eq }) => and(inArray(table.accountNumber, accountNumbers), eq(table.userId, userId)),
    columns: {
      imageOne: true,
      imageTwo: true,
      imageThree: true,
      imageFour: true,
      imageFive: true,
      imageSix: true,
      cardPreviewImage: true
    }
  })

  const imageUrls = tradesWithImages.flatMap(trade => [
    trade.imageOne,
    trade.imageTwo,
    trade.imageThree,
    trade.imageFour,
    trade.imageFive,
    trade.imageSix,
    trade.cardPreviewImage
  ]).filter((url): url is string => !!url)

  if (imageUrls.length > 0) {
    try {
      await deletePublicStorageUrls(imageUrls)
    } catch (error) {
      logger.error({ event: 'system_error', error: error }, '[Remove Accounts] Storage deletion failed:')
    }
  }

  await db.delete(schema.Trade).where(and(inArray(schema.Trade.accountNumber, accountNumbers), eq(schema.Trade.userId, userId)))
  await db.delete(schema.Account).where(and(inArray(schema.Account.number, accountNumbers), eq(schema.Account.userId, userId)))
}

async function removeAccountFromTradesAction(accountNumber: string): Promise<void> {
  const userId = await getUserId()

  const tradesWithImages = await db.query.Trade.findMany({
    where: (table, { and, eq }) => and(eq(table.accountNumber, accountNumber), eq(table.userId, userId)),
    columns: {
      imageOne: true,
      imageTwo: true,
      imageThree: true,
      imageFour: true,
      imageFive: true,
      imageSix: true,
      cardPreviewImage: true
    }
  })

  const imageUrls = tradesWithImages.flatMap(trade => [
    trade.imageOne,
    trade.imageTwo,
    trade.imageThree,
    trade.imageFour,
    trade.imageFive,
    trade.imageSix,
    trade.cardPreviewImage
  ]).filter((url): url is string => !!url)

  if (imageUrls.length > 0) {
    try {
      await deletePublicStorageUrls(imageUrls)
    } catch (error) {
      logger.error({ event: 'system_error', error: error }, '[Remove Account From Trades] Storage deletion failed:')
    }
  }

  await db.delete(schema.Trade).where(and(eq(schema.Trade.accountNumber, accountNumber), eq(schema.Trade.userId, userId)))
}

async function deleteInstrumentGroupAction(accountNumber: string, instrumentGroup: string, userId: string): Promise<void> {
  const tradesWithImages = await db.query.Trade.findMany({
    where: (table, { and, eq }) => and(eq(table.accountNumber, accountNumber), eq(table.instrument, instrumentGroup), eq(table.userId, userId)),
    columns: {
      imageOne: true,
      imageTwo: true,
      imageThree: true,
      imageFour: true,
      imageFive: true,
      imageSix: true,
      cardPreviewImage: true
    }
  })

  const imageUrls = tradesWithImages.flatMap(trade => [
    trade.imageOne,
    trade.imageTwo,
    trade.imageThree,
    trade.imageFour,
    trade.imageFive,
    trade.imageSix,
    trade.cardPreviewImage
  ]).filter((url): url is string => !!url)

  if (imageUrls.length > 0) {
    try {
      await deletePublicStorageUrls(imageUrls)
    } catch (error) {
      logger.error({ event: 'system_error', error: error }, '[Delete Instrument Group] Storage deletion failed:')
    }
  }

  await db.delete(schema.Trade).where(and(eq(schema.Trade.accountNumber, accountNumber), eq(schema.Trade.instrument, instrumentGroup), eq(schema.Trade.userId, userId)))
}

async function updateCommissionForGroupAction(accountNumber: string, instrumentGroup: string, newCommission: number): Promise<void> {
  const trades = await db.query.Trade.findMany({
    where: (table, { and, eq, like }) => and(eq(table.accountNumber, accountNumber), like(table.instrument, `${instrumentGroup}%`))
  })
  for (const trade of trades) {
    const updatedCommission = newCommission * Number(trade.quantity || 0)
    await db.update(schema.Trade).set({ commission: updatedCommission }).where(eq(schema.Trade.id, trade.id))
  }
}

export async function renameAccountAction(oldAccountNumber: string, newAccountNumber: string): Promise<void> {
  try {
    const userId = await getUserId()
    const existingAccount = await db.query.Account.findFirst({
      where: (table, { and, eq }) => and(eq(table.number, oldAccountNumber), eq(table.userId, userId))
    })

    if (!existingAccount) {
      throw new Error('Account not found')
    }

    const duplicateAccount = await db.query.Account.findFirst({
      where: (table, { and, eq }) => and(eq(table.number, newAccountNumber), eq(table.userId, userId))
    })

    if (duplicateAccount) {
      throw new Error('You already have an account with this number')
    }

    await db.transaction(async (tx) => {
      await tx.update(schema.Account).set({ number: newAccountNumber }).where(eq(schema.Account.id, existingAccount.id))

      await tx.update(schema.Trade).set({ accountNumber: newAccountNumber }).where(and(eq(schema.Trade.accountNumber, oldAccountNumber), eq(schema.Trade.userId, userId)))
    })
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Failed to rename account')
  }
}

export async function deleteTradesByIdsAction(tradeIds: string[]): Promise<void> {
  const userId = await getUserId()
  
  const tradesWithImages = await db.query.Trade.findMany({
    where: (table, { and, inArray, eq }) => and(inArray(table.id, tradeIds), eq(table.userId, userId)),
    columns: {
      imageOne: true,
      imageTwo: true,
      imageThree: true,
      imageFour: true,
      imageFive: true,
      imageSix: true,
      cardPreviewImage: true
    }
  })

  const imageUrls = tradesWithImages.flatMap(trade => [
    trade.imageOne,
    trade.imageTwo,
    trade.imageThree,
    trade.imageFour,
    trade.imageFive,
    trade.imageSix,
    trade.cardPreviewImage
  ]).filter((url): url is string => !!url)

  if (imageUrls.length > 0) {
    try {
      await deletePublicStorageUrls(imageUrls)
    } catch (error) {
      logger.error({ event: 'system_error', error: error }, '[Delete Trades By IDs] Storage deletion failed:')
    }
  }

  const BATCH_SIZE = 100
  for (let i = 0; i < tradeIds.length; i += BATCH_SIZE) {
    const batch = tradeIds.slice(i, i + BATCH_SIZE)
    await db.delete(schema.Trade).where(and(inArray(schema.Trade.id, batch), eq(schema.Trade.userId, userId)))
  }
}

export async function setupAccountAction(account: Account) {
  const userId = await getUserId()
  const existingAccount = await db.query.Account.findFirst({
    where: (table, { and, eq }) => and(eq(table.number, account.number), eq(table.userId, userId))
  })

  const insertData = {
    number: account.number || '',
    name: account.displayName || account.name || null,
    broker: account.broker || null,
    startingBalance: account.startingBalance || 0,
    isArchived: account.isArchived ?? false,
    isConfigured: account.isConfigured ?? false,
    updatedAt: new Date()
  }

  if (existingAccount) {
    return (await db.update(schema.Account).set(insertData).where(eq(schema.Account.id, existingAccount.id)).returning())[0]
  }

  return (await db.insert(schema.Account).values({
    id: crypto.randomUUID(),
    ...insertData,
    userId
  }).returning())[0]
}

export async function deleteAccountAction(accountId: string) {
  const userId = await getUserId()

  const account = await db.query.Account.findFirst({
    where: (table, { and, eq }) => and(eq(table.id, accountId), eq(table.userId, userId)),
    with: {
      Trade: {
        columns: {
          imageOne: true,
          imageTwo: true,
          imageThree: true,
          imageFour: true,
          imageFive: true,
          imageSix: true,
          cardPreviewImage: true
        }
      }
    }
  })

  if (!account) {
    throw new Error('Account not found')
  }

  const imageUrls = account.Trade.flatMap(trade => [
    trade.imageOne,
    trade.imageTwo,
    trade.imageThree,
    trade.imageFour,
    trade.imageFive,
    trade.imageSix,
    trade.cardPreviewImage
  ]).filter((url): url is string => !!url)

  if (imageUrls.length > 0) {
    try {
      await deletePublicStorageUrls(imageUrls)
    } catch (error) {
      logger.error({ event: 'system_error', error: error }, '[Delete Account] Storage deletion failed:')
    }
  }

  await db.delete(schema.Account).where(and(eq(schema.Account.id, accountId), eq(schema.Account.userId, userId)))

  await invalidateUserCaches(userId)
  logActivity({ userId, action: 'ACCOUNT_DELETED', entity: 'Account', entityId: accountId })
  
  return { success: true }
}

export async function deleteMasterAccountAction(masterAccountId: string) {
  const userId = await getUserId()

  const masterAccount = await db.query.MasterAccount.findFirst({
    where: (table, { and, eq }) => and(eq(table.id, masterAccountId), eq(table.userId, userId)),
    with: {
      PhaseAccount: {
        with: {
          Trade: {
            columns: {
              imageOne: true,
              imageTwo: true,
              imageThree: true,
              imageFour: true,
              imageFive: true,
              imageSix: true,
              cardPreviewImage: true
            }
          }
        }
      }
    }
  })

  if (!masterAccount) {
    throw new Error('Prop firm account not found')
  }

  const imageUrls = masterAccount.PhaseAccount.flatMap(phase => 
    phase.Trade.flatMap(trade => [
      trade.imageOne,
      trade.imageTwo,
      trade.imageThree,
      trade.imageFour,
      trade.imageFive,
      trade.imageSix,
      trade.cardPreviewImage
    ])
  ).filter((url): url is string => !!url)

  if (imageUrls.length > 0) {
    try {
      await deletePublicStorageUrls(imageUrls)
    } catch (error) {
      logger.error({ event: 'system_error', error: error }, '[Delete Master Account] Storage deletion failed:')
    }
  }

  // Cascades handle Payouts, PhaseAccounts, Trades, etc.
  await db.delete(schema.MasterAccount).where(and(eq(schema.MasterAccount.id, masterAccountId), eq(schema.MasterAccount.userId, userId)))

  await invalidateUserCaches(userId)
  logActivity({ userId, action: 'MASTER_ACCOUNT_DELETED', entity: 'MasterAccount', entityId: masterAccountId })

  return { success: true }
}

export async function getAccountsAction(options?: { includeArchived?: boolean }) {
  try {
    const userId = await getUserIdSafe()
    const { includeArchived = false } = options || {}

    // If user is not authenticated, return empty array instead of throwing error
    if (!userId) {
      return []
    }

    return await withCache(
      `${CacheKeys.userAccounts(userId)}:archived=${includeArchived}`,
      CacheTTL.userAccounts,
      async () => {
        let accounts: any[] = [];
        let masterAccounts: any[] = [];

        try {
          const accountsPromise = db.query.Account.findMany({
            where: (table, { and, eq }) => and(eq(table.userId, userId), includeArchived ? undefined : eq(table.isArchived, false)),
            columns: {
              id: true,
              number: true,
              name: true,
              broker: true,
              startingBalance: true,
              createdAt: true,
              userId: true,
              isArchived: true,
            },
            orderBy: (table, { desc }) => [desc(table.createdAt)]
          })

          const masterAccountsPromise = db.query.MasterAccount.findMany({
            where: (table, { and, eq }) => and(eq(table.userId, userId), includeArchived ? undefined : eq(table.isArchived, false)),
            with: {
              PhaseAccount: {
                orderBy: (table, { desc }) => [desc(table.phaseNumber)],
                limit: 10
              }
            },
            orderBy: (table, { desc }) => [desc(table.createdAt)]
          }).catch((masterAccountError) => {
            return []
          })

          const [regularAccounts, propFirmAccounts] = await Promise.all([
            accountsPromise,
            masterAccountsPromise
          ])

          accounts = regularAccounts
          masterAccounts = propFirmAccounts
        } catch (dbError) {
          // Return empty array instead of throwing to prevent app crash
          return []
        }

        // PERFORMANCE FIX: Single trade count query instead of duplicate
        // Both live and prop-firm accounts use accountNumber field, so one query is sufficient
        const allTrades = await db.query.Trade.findMany({
          where: (table, { eq }) => eq(table.userId, userId),
          columns: TRADE_COUNT_SELECT,
        })
        const groupedCounts = buildGroupedTradeCountSummary(allTrades as any)

        const transformedAccounts = accounts.map((account: any) => ({
          ...account,
          propfirm: '',
          accountType: 'live' as const,
          displayName: account.name || account.number,
          tradeCount: groupedCounts.groupedCountByLiveAccountNumber.get(account.number) || 0,
          owner: { id: userId, email: '' },
          isOwner: true,
          status: 'active' as const,
          currentPhase: 'live',
          group: null,
          isArchived: account.isArchived || false
        }))

        const transformedMasterAccounts: any[] = []
        masterAccounts.forEach((masterAccount: any) => {

          if (masterAccount.PhaseAccount && masterAccount.PhaseAccount.length > 0) {
                const hasFailedPhase = masterAccount.PhaseAccount.some((p: any) => p.status === 'failed')
            const isMasterAccountFailed = masterAccount.status === 'failed'

            // Get all phaseIds for this master account (for aggregation when failed)
            // Only calculate aggregation if there's a failed phase (for accounts page display)
              masterAccount.PhaseAccount.forEach((phase: any) => {
              if (phase.status === 'pending') return

                    const phaseName = getPhaseDisplayName(masterAccount.evaluationType, phase.phaseNumber)

              // Always use individual phase trade count
              // Aggregation for failed phases will be calculated on the client side (accounts page)
              const phaseTradeCount =
                groupedCounts.groupedCountByPhaseAccountId.get(phase.id) ||
                groupedCounts.groupedCountByAccountNumber.get(phase.phaseId) ||
                0

              transformedMasterAccounts.push({
                id: phase.id, // Use phase ID instead of composite key
                number: phase.phaseId,
                name: masterAccount.accountName,
                propfirm: masterAccount.propFirmName,
                broker: undefined,
                startingBalance: phase.accountSize || masterAccount.accountSize,
                accountType: 'prop-firm' as const,
                displayName: `${masterAccount.accountName} (${phaseName})`,
                tradeCount: phaseTradeCount,
                owner: { id: userId, email: '' },
                isOwner: true,
                status: phase.status,
                currentPhase: phase.phaseNumber,
                createdAt: phase.createdAt || masterAccount.createdAt,
                userId: masterAccount.userId,
                isArchived: masterAccount.isArchived || false,
                // Add phase details for UI components that need them (named currentPhaseDetails to match useAccounts)
                currentPhaseDetails: {
                  phaseNumber: phase.phaseNumber,
                  status: phase.status,
                  phaseId: phase.phaseId,
                  masterAccountId: masterAccount.id, // This is the key for deduplication
                  masterAccountName: masterAccount.accountName,
                  evaluationType: masterAccount.evaluationType // Add evaluationType for UI components
                }
              })
            })
          }
          // Remove fallback master account creation - it causes duplicates
          // If a master account has no phases, it won't be shown (correct behavior)
        })

        // Combine both account types and ensure strict serialization
        return JSON.parse(JSON.stringify([...transformedAccounts, ...transformedMasterAccounts]))
      }
    )
  } catch (error) {
    // Return empty array instead of throwing error to prevent frontend crashes
    return []
  }
}

/**
 * Save a payout request for a funded prop firm account
 * Business Rule: Payouts can ONLY be requested for accounts with 'Funded' status
 */
export async function savePayoutAction(payout: {
  masterAccountId: string
  phaseAccountId: string
  amount: number
  requestDate?: Date
  notes?: string
}) {
  try {
    const userId = await getUserId()

    if (!payout.masterAccountId || !payout.phaseAccountId || payout.amount === undefined || payout.amount === null) {
      throw new Error('Missing required payout fields: masterAccountId, phaseAccountId, and amount are required')
    }

    if (!Number.isFinite(payout.amount) || payout.amount <= 0) {
      throw new Error('Payout amount must be greater than 0')
    }

    const masterAccount = await db.query.MasterAccount.findFirst({
      where: (table, { and, eq }) => and(eq(table.id, payout.masterAccountId), eq(table.userId, userId)),
      with: {
        PhaseAccount: {
          where: (table, { eq }) => eq(table.id, payout.phaseAccountId)
        }
      }
    })

    if (!masterAccount) {
      throw new Error('Master account not found or unauthorized')
    }

    const phaseAccount = masterAccount.PhaseAccount[0]
    if (!phaseAccount) {
      throw new Error('Phase account not found')
    }

    // CRITICAL BUSINESS RULE: Only funded accounts can request payouts
    // Check if this is the funded phase based on evaluation type
    if (!isFundedPhase(masterAccount.evaluationType, phaseAccount.phaseNumber)) {
      const currentPhaseName = getPhaseDisplayName(masterAccount.evaluationType, phaseAccount.phaseNumber)
      throw new Error(`Payouts can only be requested for Funded accounts. This account is currently in ${currentPhaseName}.`)
    }

    if (phaseAccount.status !== 'active') {
      throw new Error(`Cannot request payout for ${phaseAccount.status} account. Account must be active.`)
    }

    const trades = await db.query.Trade.findMany({
      where: (table, { eq }) => eq(table.phaseAccountId, payout.phaseAccountId),
      columns: {
        pnl: true,
        commission: true
      }
    })

    const totalProfit = trades.reduce((sum, trade) => sum + trade.pnl, 0)

    const existingPayouts = await db.query.Payout.findMany({
      where: (table, { eq }) => eq(table.phaseAccountId, payout.phaseAccountId),
      columns: {
        amount: true
      }
    })

    const totalPayouts = existingPayouts.reduce((sum: number, p: { amount: number }) => sum + p.amount, 0)
    const availableBalance = totalProfit - totalPayouts

    if (payout.amount > availableBalance) {
      throw new Error(`Insufficient balance for payout. Available: $${availableBalance.toFixed(2)}, Requested: $${payout.amount.toFixed(2)}`)
    }

    const newPayout = (await db.insert(schema.Payout).values({
      id: crypto.randomUUID(),
      masterAccountId: payout.masterAccountId,
      phaseAccountId: payout.phaseAccountId,
      amount: payout.amount,
      requestDate: payout.requestDate || new Date(),
      status: 'pending',
      notes: payout.notes || null,
      updatedAt: new Date()
    }).returning())[0]

    await invalidateUserCaches(userId)

    await NotificationService.send({
      userId,
      type: 'SYSTEM',
      title: 'Payout Requested',
      message: `Request for $${payout.amount.toFixed(2)} submitted.`,
      data: {
        payoutId: newPayout?.id || '',
        amount: payout.amount,
        phaseAccountId: payout.phaseAccountId
      }
    })

    return {
      success: true,
      data: newPayout,
      message: `Payout request created for $${payout.amount.toFixed(2)}`
    }
  } catch (error) {
    throw error
  }
}

/**
 * Delete a payout request
 * Can only delete pending payouts
 */
export async function deletePayoutAction(payoutId: string) {
  try {
    const userId = await getUserId()

    if (!payoutId) {
      throw new Error('Payout ID is required')
    }

    const payout = await db.query.Payout.findFirst({
      where: (table, { eq }) => eq(table.id, payoutId),
      with: {
        MasterAccount: {
          columns: {
            userId: true
          }
        }
      }
    })

    if (!payout) {
      throw new Error('Payout not found')
    }

    if (payout.MasterAccount.userId !== userId) {
      throw new Error('Unauthorized: You do not own this payout')
    }

    if (payout.status !== 'pending') {
      throw new Error(`Cannot delete ${payout.status} payout. Only pending payouts can be deleted.`)
    }

    await db.delete(schema.Payout).where(eq(schema.Payout.id, payoutId))

    await invalidateUserCaches(userId)

    return {
      success: true,
      message: 'Payout deleted successfully'
    }
  } catch (error) {
    throw error
  }
}

async function renameInstrumentAction(accountNumber: string, oldInstrumentName: string, newInstrumentName: string): Promise<void> {
  try {
    const userId = await getUserId()
    await db.update(schema.Trade).set({ instrument: newInstrumentName }).where(and(eq(schema.Trade.accountNumber, accountNumber), eq(schema.Trade.instrument, oldInstrumentName), eq(schema.Trade.userId, userId)))
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Failed to rename instrument')
  }
}

async function checkAndResetAccountsAction() {
}

export async function invalidateUserCaches(userId: string) {
  try {
    const { revalidateTag } = await import('next/cache')
    revalidateTag(`accounts-${userId}`)
    revalidateTag(`user-data-${userId}`)
    revalidateTag(`grouped-trades-${userId}`)
    revalidateTag(`trades-${userId}`)
    revalidateTag(`prop-firm-accounts-${userId}`)
    revalidateTag(`prop-firm-phases-${userId}`)
  } catch (error) {
  }
}

async function createAccountAction(accountNumber: string) {
  try {
    const userId = await getUserId()
    const account = (await db.insert(schema.Account).values({
      id: crypto.randomUUID(),
      number: accountNumber,
      userId,
      startingBalance: 0,
      updatedAt: new Date()
    }).returning())[0]
    return account
  } catch (error) {
    throw error
  }
}

async function getCurrentActivePhase(accountId: string) {
  try {
    const userId = await getUserId()

    return await withCache(
      `${CacheKeys.propFirmPhase(accountId)}:active`,
      CacheTTL.propFirmPhase,
      async () => {
        const masterAccount = await db.query.MasterAccount.findFirst({
          where: (table, { eq }) => eq(table.id, accountId),
          with: {
            PhaseAccount: {
              where: (table, { eq }) => eq(table.status, 'active'),
              orderBy: (table, { asc }) => [asc(table.phaseNumber)],
              limit: 1
            }
          }
        })

        if (masterAccount && masterAccount.PhaseAccount.length > 0) {
          return masterAccount.PhaseAccount[0]
        }

        const regularAccount = await db.query.Account.findFirst({
          where: (table, { and, eq }) => and(eq(table.id, accountId), eq(table.userId, userId)),
          columns: { id: true }
        })

        if (!regularAccount) {
          throw new Error('Account not found')
        }

        return null
      }
    )
  } catch (error) {
    throw error
  }
}

async function getAccountPhases(accountId: string) {
  try {
    const userId = await getUserId()

    return await withCache(
      `${CacheKeys.propFirmPhase(accountId)}:all`,
      CacheTTL.propFirmPhase,
      async () => {
        const account = await db.query.Account.findFirst({
          where: (table, { and, eq }) => and(eq(table.id, accountId), eq(table.userId, userId)),
          columns: { id: true, name: true }
        })

        if (!account) {
          throw new Error('Account not found')
        }

        const phases = await db.query.PhaseAccount.findMany({
          where: (table, { eq }) => eq(table.masterAccountId, accountId),
          orderBy: (table, { asc }) => [asc(table.startDate)]
        })

        return phases
      }
    )
  } catch (error) {
    throw error
  }
}

export async function linkTradesToCurrentPhase(accountId: string, trades: any[]) {
  try {
    const userId = await getUserId()

    const masterAccount = await db.query.MasterAccount.findFirst({
      where: (table, { eq }) => eq(table.id, accountId),
      columns: { id: true, accountName: true }
    })

    if (masterAccount) {
      const currentPhase = await getCurrentActivePhase(accountId)

      if (!currentPhase) {
        throw new Error(`No active phase found for prop firm account "${masterAccount.accountName}". Please set up the account phases first.`)
      }

      if (currentPhase.status !== 'active') {
        throw new Error(`Prop firm account "${masterAccount.accountName}" is in ${currentPhase.status} status. Cannot add trades to inactive phases.`)
      }

      const tradesToCreate = trades.map(trade => buildTradePersistenceData({
        id: trade.id || crypto.randomUUID(),
        ...trade,
        phaseAccountId: currentPhase.id,
        userId
      }))

      // Use createMany for batch insert with skipDuplicates
      const result = await db.insert(schema.Trade).values(tradesToCreate as any).onConflictDoNothing()

      await db.insert(schema.TradeExecution).values(tradesToCreate.flatMap((trade: any) => buildSyntheticExecutionsFromTrade(trade)) as any).onConflictDoNothing()

      // If no trades were added, they're all duplicates
      if (result.count === 0) {
        return {
          success: true,
          linkedCount: 0,
          phaseAccountId: currentPhase.id,
          phaseNumber: currentPhase.phaseNumber,
          accountName: masterAccount.accountName,
          message: 'All trades already exist in this account'
        }
      }


      // Send notification for successful import
      await NotificationService.send({
        userId,
        type: 'IMPORT_STATUS',
        title: 'Trades Imported',
        message: `Successfully imported ${result.count} trades to ${masterAccount.accountName}.`,
        data: {
          count: result.count,
          accountName: masterAccount.accountName,
          phaseAccountId: currentPhase.id,
          invalidationKey: `import-${masterAccount.id}-${Date.now()}`
        }
      })

      return {
        success: true,
        linkedCount: result.count,
        phaseAccountId: currentPhase.id,
        phaseNumber: currentPhase.phaseNumber,
        accountName: masterAccount.accountName
      }
    } else {
      // Regular account - batch update
      const regularAccount = await db.query.Account.findFirst({
        where: (table, { and, eq }) => and(eq(table.id, accountId), eq(table.userId, userId))
      })

      if (!regularAccount) {
        throw new Error(`Account not found (ID: ${accountId}). Please create the account first.`)
      }

      // Create trades with account linking
      const tradesToCreate = trades.map(trade => buildTradePersistenceData({
        id: trade.id || crypto.randomUUID(),
        ...trade,
        accountId: regularAccount.id,
        userId
      }))

      const result = await db.insert(schema.Trade).values(tradesToCreate as any).onConflictDoNothing()

      await db.insert(schema.TradeExecution).values(tradesToCreate.flatMap((trade: any) => buildSyntheticExecutionsFromTrade(trade)) as any).onConflictDoNothing()

      // If no trades were added, they're all duplicates
      if (result.count === 0) {
        return {
          success: true,
          linkedCount: 0,
          accountId: regularAccount.id,
          accountName: regularAccount.name || regularAccount.number,
          message: 'All trades already exist in this account'
        }
      }

      return {
        success: true,
        linkedCount: result.count,
        accountId: regularAccount.id,
        accountName: regularAccount.name || regularAccount.number
      }
    }
  } catch (error) {

    throw error
  }
}

export async function saveAndLinkTrades(accountId: string, trades: any[]) {
  try {
    const userId = await getUserId()

    const cleanedData = trades.map(trade => {
      const cleanTrade = Object.fromEntries(
        Object.entries(trade).filter(([_, value]) => value !== undefined)
      ) as Partial<any>

      return {
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
        userId: cleanTrade.userId || userId,
        side: cleanTrade.side || '',
        commission: cleanTrade.commission || 0,
        entryId: cleanTrade.entryId || null,
        comment: cleanTrade.comment || null,
        createdAt: cleanTrade.createdAt || new Date(),
      }
    })

    // STEP 1: PRE-TRANSACTION VALIDATION (OUTSIDE TRANSACTION - FASTER)
    // Determine if this is a prop firm or regular account BEFORE duplicate check
    const phaseAccount = await db.query.PhaseAccount.findFirst({
      where: (table, { eq }) => eq(table.id, accountId),
      with: {
        MasterAccount: {
          columns: {
            id: true,
            accountName: true,
            accountSize: true,
            userId: true
          }
        }
      }
    })

    let isPropFirm = false
    let phaseAccountId: string | null = null
    let regularAccountId: string | null = null
    let accountName: string
    let phaseNumber: number | null = null
    let masterAccountId: string | null = null

    if (phaseAccount) {
        isPropFirm = true
      phaseAccountId = phaseAccount.id
      phaseNumber = phaseAccount.phaseNumber
      accountName = phaseAccount.MasterAccount.accountName
      masterAccountId = phaseAccount.MasterAccount.id

      // Pre-check profit target OUTSIDE transaction to fail fast
      const pnlSum = await db.select({ sum: schema.Trade.pnl }).from(schema.Trade).where(eq(schema.Trade.phaseAccountId, phaseAccount.id))

      const currentPnL = pnlSum[0]?.sum || 0
      const profitTargetAmount = (phaseAccount.profitTargetPercent / 100) * phaseAccount.MasterAccount.accountSize

      if (profitTargetAmount && currentPnL >= profitTargetAmount) {
        const nextPhaseNumber = phaseAccount.phaseNumber + 1
        const nextPhaseName = nextPhaseNumber === 2 ? 'Phase 2' : nextPhaseNumber === 3 ? 'Funded' : `Phase ${nextPhaseNumber}`
        throw new Error(
          `This account has already passed ${phaseAccount.phaseNumber === 1 ? 'Phase 1' : phaseAccount.phaseNumber === 2 ? 'Phase 2' : 'the current phase'}. ` +
          `Please provide your ${nextPhaseName} account ID before importing more trades. ` +
          `Go to the account details page to complete the phase transition.`
        )
      }
    } else {
      const regularAccount = await db.query.Account.findFirst({
        where: (table, { and, eq }) => and(eq(table.id, accountId), eq(table.userId, userId)),
        columns: { id: true, name: true }
      })

      if (!regularAccount) {
        throw new Error(`Account not found (ID: ${accountId}). The account may have been deleted.`)
      }

      isPropFirm = false
      regularAccountId = accountId
      accountName = regularAccount.name || accountId
    }

    // STEP 2: DUPLICATE DETECTION (SCOPED TO SPECIFIC ACCOUNT)
    // Check for duplicates WITHIN the specific account being imported to
    const candidateIdentityKeys = cleanedData
      .map((trade) => buildTradeIdentityKey({
        ...trade,
        userId,
        accountNumber: trade.accountNumber || '',
      } as any))
      .filter(Boolean)

    let existingIdentityKeys = new Set<string>()
    if (candidateIdentityKeys.length > 0) {
      const existingTrades = await db.query.Trade.findMany({
        where: (table, { and, eq, inArray }) => and(eq(table.userId, userId), inArray(table.tradeIdentityKey, candidateIdentityKeys), isPropFirm ? eq(table.phaseAccountId, phaseAccountId!) : eq(table.accountId, regularAccountId!)),
        columns: {
          tradeIdentityKey: true
        }
      })

      existingIdentityKeys = new Set(existingTrades.map(t => t.tradeIdentityKey).filter(Boolean) as string[])
    }

    const seenIncomingIdentityKeys = new Set<string>()
    const newTrades = cleanedData.filter((trade) => {
      const identityKey = buildTradeIdentityKey({
        ...trade,
        userId,
        accountNumber: trade.accountNumber || '',
      } as any)

      if (!identityKey) return true
      if (existingIdentityKeys.has(identityKey)) return false
      if (seenIncomingIdentityKeys.has(identityKey)) return false

      seenIncomingIdentityKeys.add(identityKey)
      return true
    })

    if (newTrades.length === 0) {
      return {
        success: true,
        linkedCount: 0,
        totalTrades: cleanedData.length,
        message: `All ${cleanedData.length} trades already exist in this account - no new trades to import`,
        isDuplicate: true
      }
    }

    // STEP 3: OPTIMIZED BATCH PROCESSING
    // Use larger batch sizes and avoid transaction overhead for simple inserts
    const BATCH_SIZE = 1000 // Increased from 500 for better throughput
    const totalBatches = Math.ceil(newTrades.length / BATCH_SIZE)
    let totalCreated = 0

    const allTradesToCreate = newTrades.map(trade => {
      const cleanTrade: any = {}

      // Only include non-null fields
      for (const key of Object.keys(trade)) {
        const value = (trade as any)[key]
        if (value !== null && value !== undefined) {
          cleanTrade[key] = value
        }
      }

      // Add linking fields
      cleanTrade.phaseAccountId = isPropFirm ? phaseAccountId : null
      cleanTrade.accountId = isPropFirm ? null : regularAccountId

      return buildTradePersistenceData({
        id: cleanTrade.id || crypto.randomUUID(),
        ...cleanTrade,
      })
    })

    // Process trades in batches without transaction wrapper (createMany is already atomic)
    for (let i = 0; i < totalBatches; i++) {
      const start = i * BATCH_SIZE
      const end = Math.min(start + BATCH_SIZE, allTradesToCreate.length)
      const batch = allTradesToCreate.slice(start, end)

      // Direct createMany - faster than wrapping in transaction
      const createResult = await db.insert(schema.Trade).values(batch as any).onConflictDoNothing()

      await db.insert(schema.TradeExecution).values(batch.flatMap((trade: any) => buildSyntheticExecutionsFromTrade(trade)) as any).onConflictDoNothing()

      totalCreated += createResult.count
    }

    const result = {
      success: true,
      linkedCount: totalCreated,
      totalTrades: newTrades.length,
      phaseAccountId,
      phaseNumber,
      accountId: regularAccountId,
      accountName,
      isPropFirm,
      masterAccountId,
      evaluation: undefined as any,
      isDuplicate: false
    }

    logActivity({
      userId,
      action: 'TRADES_IMPORTED',
      entity: 'Trade',
      metadata: { 
        count: totalCreated, 
        totalTrades: newTrades.length,
        accountId: isPropFirm ? phaseAccountId : regularAccountId,
        accountName
      },
    })

    // AUTO-EVALUATION: Check for breaches synchronously (FAST - breach detection only)
    if (result.isPropFirm && result.phaseAccountId && result.masterAccountId) {
      try {
        const { PhaseEvaluationEngine } = await import('@/lib/prop-firm/phase-evaluation-engine')

        const evaluation = await PhaseEvaluationEngine.evaluatePhase(
          result.masterAccountId,
          result.phaseAccountId
        )

        // CRITICAL: Check for PASSING first (profit target achieved)
        if (evaluation.isPassed && evaluation.canAdvance) {
          if (!phaseAccount) {
            throw new Error('Phase account not found')
          }

          const currentPhaseNumber = phaseAccount.phaseNumber
          const nextPhaseNumber = currentPhaseNumber + 1

          const masterAccountData = await db.query.MasterAccount.findFirst({
            where: (table, { eq }) => eq(table.id, result.masterAccountId!),
            with: { PhaseAccount: { orderBy: (table, { asc }) => [asc(table.phaseNumber)] } }
          })

          if (!masterAccountData) {
            throw new Error('Master account not found')
          }

          const nextPhase = masterAccountData.PhaseAccount.find(p => p.phaseNumber === nextPhaseNumber)

          if (nextPhase) {
            // Check if next phase has a phaseId (account number)
            // If not, this requires MANUAL transition (user must provide next phase account ID)
            if (!nextPhase.phaseId || nextPhase.phaseId.trim() === '') {
              const isTransitioningToFunded = isFundedPhase(masterAccountData.evaluationType, nextPhaseNumber)

              const nextPhaseName = isTransitioningToFunded ? 'Funded' : `Phase ${nextPhaseNumber}`

              // Set phase to pending_approval and create appropriate notification
              await db.transaction(async (tx) => {
                await tx.update(schema.PhaseAccount).set({ status: 'pending_approval', endDate: new Date() }).where(eq(schema.PhaseAccount.id, result.phaseAccountId!))
                // Create different notification based on whether transitioning to funded or another eval phase
                await tx.insert(schema.Notification).values(isTransitioningToFunded ? {
                  // FUNDED transition: Needs approval first, then ID
                  userId: userId,
                  type: 'FUNDED_PENDING_APPROVAL',
                  title: 'Congratulations! Evaluation Complete!',
                  message: `Your ${masterAccountData.accountName} has passed all evaluation phases! Please confirm once your prop firm approves your funded account.`,
                  data: {
                    masterAccountId: result.masterAccountId,
                    phaseAccountId: result.phaseAccountId,
                    accountName: masterAccountData.accountName,
                    propFirmName: masterAccountData.propFirmName,
                    currentPhaseNumber: currentPhaseNumber,
                    nextPhaseNumber: nextPhaseNumber,
                    evaluationType: masterAccountData.evaluationType
                  },
                  actionRequired: true,
                  updatedAt: new Date()
                } : {
                  // NON-FUNDED transition: Just needs ID
                  userId: userId,
                  type: 'PHASE_TRANSITION_PENDING',
                  title: `Phase ${currentPhaseNumber} Complete!`,
                  message: `Your ${masterAccountData.accountName} has met the profit target! Enter your ${nextPhaseName} account ID to continue.`,
                  data: {
                    masterAccountId: result.masterAccountId,
                    phaseAccountId: result.phaseAccountId,
                    accountName: masterAccountData.accountName,
                    propFirmName: masterAccountData.propFirmName,
                    currentPhaseNumber: currentPhaseNumber,
                    nextPhaseNumber: nextPhaseNumber,
                    evaluationType: masterAccountData.evaluationType
                  },
                  actionRequired: true,
                  updatedAt: new Date()
                })
              })

                // Return different status based on whether transitioning to funded or another eval phase
                ; (result as any).evaluation = isTransitioningToFunded ? {
                  // FUNDED: Use pending_approval - notification handles approval
                  status: 'pending_approval',
                  reason: 'awaiting_firm_approval',
                  message: `Congratulations! Your evaluation is complete. Please confirm your firm's approval via notifications.`,
                  requiresManualTransition: true,
                  nextPhase: nextPhaseNumber,
                  currentPnL: evaluation.progress?.currentPnL || 0,
                  profitTargetPercent: evaluation.progress?.profitTargetPercent || 0,
                  currentPhaseNumber: currentPhaseNumber,
                  evaluationType: masterAccountData.evaluationType,
                  propFirmName: masterAccountData.propFirmName
                } : {
                  // NON-FUNDED: Use ready_for_transition - direct ID dialog
                  status: 'ready_for_transition',
                  reason: 'profit_target_achieved',
                  message: `Phase ${currentPhaseNumber} profit target achieved! Ready to advance to ${nextPhaseName}.`,
                  requiresManualTransition: true,
                  nextPhase: nextPhaseNumber,
                  currentPnL: evaluation.progress?.currentPnL || 0,
                  profitTargetPercent: evaluation.progress?.profitTargetPercent || 0,
                  currentPhaseNumber: currentPhaseNumber,
                  evaluationType: masterAccountData.evaluationType,
                  propFirmName: masterAccountData.propFirmName
                }
            } else {
              // Next phase has an account ID - safe to auto-advance
              await db.transaction(async (tx) => {
                // Mark current phase as passed
                await tx.update(schema.PhaseAccount).set({ status: 'passed', endDate: new Date() }).where(eq(schema.PhaseAccount.id, result.phaseAccountId!))
                // Activate next phase
                await tx.update(schema.PhaseAccount).set({ status: 'active', startDate: new Date() }).where(eq(schema.PhaseAccount.id, nextPhase.id))
                // Update master account current phase
                await tx.update(schema.MasterAccount).set({ currentPhase: nextPhaseNumber }).where(eq(schema.MasterAccount.id, result.masterAccountId!))
              })

              // Determine the display name for the next phase
              const autoNextPhaseName = isFundedPhase(masterAccountData.evaluationType, nextPhaseNumber)
                ? 'Funded'
                : `Phase ${nextPhaseNumber}`

                ; (result as any).evaluation = {
                  status: 'passed',
                  reason: 'profit_target_achieved',
                  message: `Phase ${currentPhaseNumber} passed! Advanced to ${autoNextPhaseName}`,
                  nextPhase: nextPhaseNumber,
                  currentPhaseNumber: currentPhaseNumber,
                  evaluationType: masterAccountData.evaluationType,
                  propFirmName: masterAccountData.propFirmName
                }
            }
          } else {
            // This was the final evaluation phase - waiting for firm approval
            // Use pending_approval status until user confirms firm's decision
            await db.transaction(async (tx) => {
              await tx.update(schema.PhaseAccount).set({ status: 'pending_approval', endDate: new Date() }).where(eq(schema.PhaseAccount.id, result.phaseAccountId!))
              // Create notification for user to take action
              await tx.insert(schema.Notification).values({
                userId: userId,
                type: 'FUNDED_PENDING_APPROVAL',
                title: 'Congratulations! Awaiting Firm Approval',
                message: `Your ${masterAccountData.accountName} account has met the profit target! Please update when the firm confirms your funded status.`,
                data: {
                  masterAccountId: result.masterAccountId,
                  phaseAccountId: result.phaseAccountId,
                  accountName: masterAccountData.accountName,
                  propFirmName: masterAccountData.propFirmName
                },
                actionRequired: true,
                updatedAt: new Date()
              })
            })

            result.evaluation = {
              status: 'pending_approval',
              reason: 'awaiting_firm_approval',
              message: `Congratulations! Your account met the profit target. Waiting for firm approval...`,
              currentPhaseNumber: currentPhaseNumber,
              evaluationType: masterAccountData.evaluationType,
              propFirmName: masterAccountData.propFirmName
            }
          }

          await invalidateUserCaches(userId)
        }
        // Check for FAILURE (breach detected)
        else if (evaluation.isFailed) {
          // Fetch account size for breach record
          const phaseAccountData = await db.query.PhaseAccount.findFirst({
            where: (table, { eq }) => eq(table.id, result.phaseAccountId!),
            with: { MasterAccount: { columns: { accountSize: true } } }
          })

          await db.transaction(async (tx) => {
            await tx.update(schema.PhaseAccount).set({ status: 'failed', endDate: new Date() }).where(eq(schema.PhaseAccount.id, result.phaseAccountId!))
            await tx.update(schema.MasterAccount).set({ status: 'failed' }).where(eq(schema.MasterAccount.id, result.masterAccountId!))
            await tx.insert(schema.BreachRecord).values({
              id: crypto.randomUUID(),
              phaseAccountId: result.phaseAccountId!,
              breachType: evaluation.drawdown.breachType || 'max_drawdown',
              breachAmount: evaluation.drawdown.breachAmount || 0,
              breachTime: evaluation.drawdown.breachTime || new Date(),
              currentEquity: evaluation.drawdown.currentEquity,
              accountSize: phaseAccountData?.MasterAccount.accountSize || 0,
              dailyStartBalance: evaluation.drawdown.dailyStartBalance,
              highWaterMark: evaluation.drawdown.highWaterMark,
              notes: `Auto-detected breach during trade import. ${evaluation.drawdown.breachType?.replace('_', ' ')} exceeded by $${evaluation.drawdown.breachAmount?.toFixed(2)}`,
              updatedAt: new Date()
            })
          })

          await invalidateUserCaches(userId)

          // Add evaluation result to response for user feedback
          result.evaluation = {
            status: 'failed',
            reason: evaluation.drawdown.breachType,
            message: `Account failed due to ${evaluation.drawdown.breachType?.replace('_', ' ')} breach`
          }
        }
        // Account is still in progress
        else {
          const progressPercent = evaluation.progress?.profitTargetPercent?.toFixed(1) || '0.0'

          result.evaluation = {
            status: 'in_progress',
            reason: 'profit_target_not_met',
            message: `Phase in progress: ${progressPercent}% of profit target achieved`,
            progressPercent: parseFloat(progressPercent)
          }
        }
      } catch (evalError) {
        // Don't fail the import if evaluation fails
      }
    }

    await invalidateUserCaches(userId)

    // STEP 4: ACCOUNT DATE ADJUSTMENT CHECK
    // Only check if trades were actually created
    if (totalCreated > 0) {
      // Find the earliest entryDate among the NEW trades
      const validEntryDates = newTrades
        .map(t => t.entryDate)
        .filter(d => d && !isNaN(new Date(d).getTime()))
        .map(d => new Date(d))
      
      if (validEntryDates.length > 0) {
        const earliestTradeDate = new Date(Math.min(...validEntryDates.map(d => d.getTime())))
        // Set to start of day as per user request
        earliestTradeDate.setHours(0, 0, 0, 0)

        // Get account creation date
        let accountCreatedAt: Date | null = null
        if (isPropFirm && masterAccountId) {
          const ma = await db.query.MasterAccount.findFirst({
            where: (table, { eq }) => eq(table.id, masterAccountId),
            columns: { createdAt: true }
          })
          accountCreatedAt = ma?.createdAt || null
        } else if (regularAccountId) {
          const ra = await db.query.Account.findFirst({
            where: (table, { eq }) => eq(table.id, regularAccountId),
            columns: { createdAt: true }
          })
          accountCreatedAt = ra?.createdAt || null
        }

        if (accountCreatedAt && earliestTradeDate < accountCreatedAt) {
          const autoAdjustAccountDate = await getRuntimeAutoAdjustAccountDate(userId)

          if (autoAdjustAccountDate) {
            if (isPropFirm && masterAccountId) {
              await db.update(schema.MasterAccount).set({ createdAt: earliestTradeDate }).where(eq(schema.MasterAccount.id, masterAccountId))
            } else if (regularAccountId) {
              await db.update(schema.Account).set({ createdAt: earliestTradeDate }).where(eq(schema.Account.id, regularAccountId))
            }

            // Informational notification
            await NotificationService.send({
              userId,
              type: 'SYSTEM',
              title: 'Account Date Adjusted',
              message: `The creation date for ${accountName} was automatically adjusted to ${earliestTradeDate.toLocaleDateString()} to match your first trade.`,
              data: {
                accountId: isPropFirm ? masterAccountId : regularAccountId,
                isPropFirm,
                newDate: earliestTradeDate.toISOString()
              }
            })
          } else {
            // MANUAL ADJUST (Action Required)
            await NotificationService.send({
              userId,
              type: 'SYSTEM',
              title: 'Adjust Account Date?',
              message: `Your first trade in ${accountName} is older than the account creation date. Would you like to adjust the account date to ${earliestTradeDate.toLocaleDateString()}?`,
              data: {
                accountId: isPropFirm ? masterAccountId : regularAccountId,
                isPropFirm,
                newDate: earliestTradeDate.toISOString(),
                currentDate: accountCreatedAt.toISOString()
              },
              actionRequired: true,
              invalidationKey: `adjust-date-${isPropFirm ? masterAccountId : regularAccountId}`
            })
          }
        }
      }
    }

    return result
  } catch (error) {
    throw error
  }
}

export async function checkPhaseProgression(accountId: string) {
  try {
    const userId = await getUserId()

    const masterAccount = await db.query.MasterAccount.findFirst({
      where: (table, { eq }) => eq(table.id, accountId),
      columns: { id: true, accountName: true, accountSize: true }
    })

    if (masterAccount) {
      const currentPhase = await getCurrentActivePhase(accountId)

      if (!currentPhase) {
        return {
          isFailed: false,
          reason: 'No active phase',
          account: { id: accountId, name: masterAccount.accountName }
        }
      }

      const phaseTrades = await db.query.Trade.findMany({
        where: (table, { eq }) => eq(table.phaseAccountId, currentPhase.id),
        columns: { pnl: true, commission: true }
      })

      const netProfit = phaseTrades.reduce((sum, trade) => sum + trade.pnl, 0)

      const profitTargetAmount = (currentPhase.profitTargetPercent / 100) * masterAccount.accountSize

      if (profitTargetAmount && netProfit >= profitTargetAmount) {
        return await progressAccountPhase(accountId, currentPhase)
      }

      return {
        currentPhase,
        netProfit,
        profitTarget: profitTargetAmount,
        progressPercentage: profitTargetAmount ? (netProfit / profitTargetAmount) * 100 : 0,
        canProgress: profitTargetAmount ? netProfit >= profitTargetAmount : false
      }
    }

    const regularAccount = await db.query.Account.findFirst({
      where: (table, { and, eq }) => and(eq(table.id, accountId), eq(table.userId, userId)),
      columns: { id: true, name: true, startingBalance: true }
    })

    if (!regularAccount) {
      throw new Error('Account not found')
    }

    const accountTrades = await db.query.Trade.findMany({
      where: (table, { eq }) => eq(table.accountId, accountId),
      columns: { pnl: true, commission: true }
    })

    const netProfit = accountTrades.reduce((sum, trade) => sum + trade.pnl, 0)

    return {
      currentPhase: null,
      netProfit,
      profitTarget: null,
      progressPercentage: 0,
      canProgress: false
    }

  } catch (error) {
    throw error
  }
}

async function progressAccountPhase(masterAccountId: string, currentPhase: any) {
  try {
    const userId = await getUserId()

    await db.update(schema.PhaseAccount).set({ status: 'passed', endDate: new Date() }).where(eq(schema.PhaseAccount.id, currentPhase.id))

    let nextPhaseNumber: number
    let nextPhaseAccountNumber: string

    switch (currentPhase.phaseNumber) {
      case 1:
        nextPhaseNumber = 2
        const phase2Phase = await db.query.PhaseAccount.findFirst({
          where: (table, { and, eq }) => and(eq(table.masterAccountId, masterAccountId), eq(table.phaseNumber, 2)),
          columns: { phaseId: true }
        })
        nextPhaseAccountNumber = phase2Phase?.phaseId || 'Not Set'
        break
      case 2:
        nextPhaseNumber = 3
        const fundedPhase = await db.query.PhaseAccount.findFirst({
          where: (table, { and, eq }) => and(eq(table.masterAccountId, masterAccountId), eq(table.phaseNumber, 3)),
          columns: { phaseId: true }
        })
        nextPhaseAccountNumber = fundedPhase?.phaseId || 'Not Set'
        break
      default:
        throw new Error('Cannot progress from funded phase')
    }

    if (nextPhaseAccountNumber === 'Not Set') {
      throw new Error(`Please set the account number for phase ${nextPhaseNumber} before progressing`)
    }

    const nextPhase = await db.query.PhaseAccount.findFirst({
      where: (table, { and, eq }) => and(eq(table.masterAccountId, masterAccountId), eq(table.phaseNumber, nextPhaseNumber), eq(table.status, 'pending'))
    })

    if (!nextPhase) {
      throw new Error(`Next phase (${nextPhaseNumber}) not found or not in pending status`)
    }

    const updatedPhase = (await db.update(schema.PhaseAccount).set({ status: 'active', phaseId: nextPhaseAccountNumber, startDate: new Date() }).where(eq(schema.PhaseAccount.id, nextPhase.id)).returning())[0]

    await db.update(schema.MasterAccount).set({ currentPhase: nextPhaseNumber }).where(eq(schema.MasterAccount.id, masterAccountId))

    return {
      success: true,
      previousPhase: currentPhase.phaseNumber,
      newPhase: nextPhaseNumber,
      message: `Account progressed from phase ${currentPhase.phaseNumber} to phase ${nextPhaseNumber}`
    }

  } catch (error) {
    throw error
  }
}

async function getAccountHistory(accountId: string) {
  try {
    const userId = await getUserId()

    // Verify account ownership
    const account = await db.query.Account.findFirst({
      where: (table, { and, eq }) => and(eq(table.id, accountId), eq(table.userId, userId)),
      columns: { id: true, name: true }
    })

    if (!account) {
      throw new Error('Account not found')
    }

    const breakEvenThreshold = await getRuntimeBreakEvenThreshold(userId)

    const phases = await db.query.PhaseAccount.findMany({
      where: (table, { eq }) => eq(table.masterAccountId, accountId),
      orderBy: (table, { asc }) => [asc(table.startDate)],
      with: {
        Trade: {
          columns: TRADE_COUNT_SELECT,
          orderBy: (table, { asc }) => [asc(table.createdAt)]
        }
      }
    })

    const totalTrades = phases.reduce(
      (sum, phase) => sum + buildGroupedTradeCountSummary(phase.Trade as any).groupedTradeCount,
      0
    )
    const totalPnl = phases.reduce((sum, phase) =>
      sum + phase.Trade.reduce((tradeSum, trade) => tradeSum + (trade.pnl || 0), 0), 0)
    const totalCommission = phases.reduce((sum, phase) =>
      sum + phase.Trade.reduce((tradeSum, trade) => tradeSum + Number(trade.commission || 0), 0), 0)

    const netProfit = totalPnl
    const winningTrades = phases.reduce((sum, phase) => (
      sum + phase.Trade.filter(
        trade => classifyOutcome(trade.pnl || 0, breakEvenThreshold) === 'win'
      ).length
    ), 0)
    const losingTrades = phases.reduce((sum, phase) => (
      sum + phase.Trade.filter(
        trade => classifyOutcome(trade.pnl || 0, breakEvenThreshold) === 'loss'
      ).length
    ), 0)
    const tradableTrades = winningTrades + losingTrades

    return {
      account: {
        id: account.id,
        name: account.name
      },
      phases: phases.map(phase => {
        const groupedPhaseTrades = buildGroupedTradeCountSummary(phase.Trade as any).groupedTrades
        const phaseWins = groupedPhaseTrades.filter(
          trade => classifyOutcome(trade.pnl, breakEvenThreshold) === 'win'
        ).length || 0
        const phaseLosses = groupedPhaseTrades.filter(
          trade => classifyOutcome(trade.pnl, breakEvenThreshold) === 'loss'
        ).length || 0
        const tradableCount = phaseWins + phaseLosses

        return {
          id: phase.id,
          phaseNumber: phase.phaseNumber,
          status: phase.status,
          phaseId: phase.phaseId,
          profitTargetPercent: phase.profitTargetPercent,
          dailyDrawdownPercent: phase.dailyDrawdownPercent,
          maxDrawdownPercent: phase.maxDrawdownPercent,
          totalTrades: groupedPhaseTrades.length,
          winningTrades: phaseWins,
          winRate: calculateWinRate(phaseWins, phaseLosses),
          startDate: phase.startDate,
          endDate: phase.endDate
        }
      }),
      summary: {
        totalTrades,
        totalPnl,
        totalCommission,
        netProfit,
        winningTrades,
        winRate: tradableTrades > 0 ? calculateWinRate(winningTrades, losingTrades) : 0
      }
    }

  } catch (error) {
    throw error
  }
}

export async function checkAccountBreaches(accountId: string) {
  try {
    const userId = await getUserId()

    const masterAccount = await db.query.MasterAccount.findFirst({
      where: (table, { eq }) => eq(table.id, accountId),
      columns: { id: true, accountName: true, accountSize: true }
    })

    if (masterAccount) {
      return {
        isFailed: false,
        reason: 'Prop firm accounts have different breach rules',
        account: { id: accountId, name: masterAccount.accountName, accountSize: masterAccount.accountSize }
      }
    }

    const regularAccount = await db.query.Account.findFirst({
      where: (table, { and, eq }) => and(eq(table.id, accountId), eq(table.userId, userId)),
      columns: { id: true, name: true, startingBalance: true }
    })

    if (!regularAccount) {
      throw new Error('Account not found')
    }

    return {
      isFailed: false,
      reason: 'Regular accounts have no breach rules',
      account: { id: accountId, name: regularAccount.name, startingBalance: regularAccount.startingBalance }
    }
  } catch (error) {
    throw error
  }
}

async function failAccount(accountId: string, currentPhase: any, breachDetails: any) {
  try {
    const userId = await getUserId()

    const masterAccount = await db.query.MasterAccount.findFirst({
      where: (table, { eq }) => eq(table.id, accountId),
      columns: { id: true, accountName: true }
    })

    if (masterAccount && currentPhase) {
      // Update the phase status to failed and master account status
      await db.transaction(async (tx) => {
        await tx.update(schema.PhaseAccount).set({ status: 'failed', endDate: new Date() }).where(eq(schema.PhaseAccount.id, currentPhase.id))
        await tx.update(schema.MasterAccount).set({ status: 'failed' }).where(eq(schema.MasterAccount.id, accountId))
      })

      return {
        isFailed: true,
        reason: breachDetails?.reason || 'Account failed due to breach',
        account: { id: accountId, name: masterAccount.accountName }
      }
    }

    return {
      isFailed: false,
      reason: 'Account not found or no active phase',
      account: { id: accountId, name: 'Unknown' }
    }
  } catch (error) {
    throw error
  }
}

async function getFailedAccountsHistory() {
  try {
    const userId = await getUserId()

    const failedAccounts = await db.query.Account.findMany({
      where: (table, { eq }) => eq(table.userId, userId)
    })

    return failedAccounts
  } catch (error) {
    throw error
  }
}