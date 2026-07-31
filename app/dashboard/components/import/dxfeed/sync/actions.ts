'use server'

import { logger as appLogger } from '@/lib/logger';

import { saveTradesAction } from '@/server/database'
import { generateDeterministicTradeId } from '@/lib/trade-id-utils'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { formatTimestamp } from '@/lib/date-utils'
import { createTradeWithDefaults } from '@/lib/trade-factory'
import { getResolvedUserIdentity } from '@/server/user-identity'
import { DIRECT_SYNC_STATUS, directSyncUnderDevelopmentMessage } from '@/lib/integrations/direct-sync-status'
import type {
  DxFeedLoginRequest,
  DxFeedLoginResponse,
  DxFeedStoredCredentials,
  DxFeedAccountListResponse,
  DxFeedTradesResponse,
  DxFeedReportTrade,
  DxFeedTradesResult,
  DxFeedTradingAccount,
} from './dxfeed-types'

const DXFEED_AUTH_URL = process.env.DXFEED_AUTH_URL
const DXFEED_PLATFORM_KEY = process.env.DXFEED_PLATFORM_KEY

const IS_DEV = process.env.NODE_ENV === 'development' || process.env.DXFEED_DEBUG === 'true'
const DXFEED_ENVIRONMENT = Number(
  process.env.DXFEED_ENVIRONMENT ?? (process.env.NODE_ENV === 'production' ? '0' : '1'),
)
const DXFEED_HISTORY_LOOKBACK_DAYS = Math.max(
  1,
  Number(process.env.DXFEED_HISTORY_LOOKBACK_DAYS ?? '364'),
)

const dxLogger = {
  debug: (message: string, data?: any) => {
    if (IS_DEV) appLogger.info({ layer: 'dxfeed', ...data }, `[DXFEED-DEBUG] ${message}`)
  },
  info: (message: string) => {
    appLogger.info({ layer: 'dxfeed' }, `[DXFEED] ${message}`)
  },
  warn: (message: string) => {
    appLogger.warn({ layer: 'dxfeed' }, `[DXFEED] ${message}`)
  },
  error: (message: string, error?: unknown) => {
    appLogger.error({ error: error instanceof Error ? error : new Error(String(error)), layer: 'dxfeed' }, `[DXFEED] ${message}`)
  },
}

function parseStoredCredentials(tokenField: string): DxFeedStoredCredentials | null {
  try {
    const parsed = JSON.parse(tokenField)
    if (parsed.accessToken && parsed.historicalHost) {
      return parsed as DxFeedStoredCredentials
    }
    return null
  } catch {
    return null
  }
}

function normalizeHistoricalHost(value?: string | null): string {
  if (!value) return ''

  try {
    const parsed = new URL(value)
    return `${parsed.protocol}//${parsed.host}`.replace(/\/$/, '')
  } catch {
    return value.replace(/\/$/, '')
  }
}

function parseHistoricalHostFromTradingWss(wssUrl?: string | null): string {
  if (!wssUrl) return ''

  try {
    const parsed = new URL(wssUrl)
    return `https://${parsed.hostname}`
  } catch {
    dxLogger.warn('Failed to parse trading websocket URL')
    return ''
  }
}

function buildHistoricalAuthHeaders(accessToken: string): HeadersInit {
  return {
    'Authorization': accessToken,
    'Accept': 'application/json',
  }
}

function extractArrayPayload<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[]
  }

  if (payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: T[] }).data
  }

  return []
}

function extractApiErrorMessage(payload: unknown): string | null {
  if (!payload) return null

  if (Array.isArray(payload)) {
    const firstError = payload.find(
      (item): item is { message?: string } => !!item && typeof item === 'object' && 'message' in item,
    )
    return firstError?.message ?? null
  }

  if (typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message?: unknown }).message
    return typeof message === 'string' ? message : null
  }

  return null
}

export async function authenticateDxFeed(
  login: string,
  password: string,
): Promise<{ success?: boolean; error?: string }> {
  if (DIRECT_SYNC_STATUS.isPaused) {
    void login
    void password
    return { error: directSyncUnderDevelopmentMessage('DxFeed') }
  }

  try {
    if (!DXFEED_AUTH_URL || !DXFEED_PLATFORM_KEY) {
      return { error: 'DxFeed configuration not set' }
    }

    const { internalUserId } = await getResolvedUserIdentity()
    if (!internalUserId) {
      return { error: 'User not authenticated' }
    }

    const body: DxFeedLoginRequest = {
      login,
      password,
      environment: DXFEED_ENVIRONMENT,
      version: 3,
      withDetails: true,
      connectOnlyTrading: true,
    }

    dxLogger.info('Sending auth request')

    const response = await fetch(DXFEED_AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PltfKey': DXFEED_PLATFORM_KEY,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const text = await response.text()
      dxLogger.error(`Auth request failed with status ${response.status}`)
      return { error: `Authentication failed (${response.status}): ${text || response.statusText}` }
    }

    const data: DxFeedLoginResponse = await response.json()

    if (data.status !== 'OK' || !data.token) {
      return { error: data.reason || 'Authentication failed' }
    }

    const historicalHost =
      normalizeHistoricalHost(data.tradingRestReportHost) ||
      parseHistoricalHostFromTradingWss(data.tradingWss || data.tradingWssEndpoint) ||
      parseHistoricalHostFromTradingWss(response.headers.get('wss'))

    if (!historicalHost) {
      dxLogger.warn('Could not derive historical host from auth response')
    }

    dxLogger.info('Auth successful')

    const reportAccessToken = data.tradingRestReportToken || data.token
    const accounts = historicalHost
      ? await getDxFeedAccounts(reportAccessToken, historicalHost)
      : []
    const accountNumbers = accounts.map(
      (a) => a.accountHeader || a.accountReference || a.accountId.toString(),
    )

    const credentials: DxFeedStoredCredentials = {
      accessToken: reportAccessToken,
      historicalHost,
      accountNumbers,
    }

    const storeResult = await storeDxFeedToken(JSON.stringify(credentials), login)
    if (storeResult.error) {
      dxLogger.warn('Failed to store token')
    }

    return { success: true }
  } catch (error) {
    dxLogger.error('Authentication error:', error)
    return { error: 'Failed to authenticate with DxFeed' }
  }
}

async function getDxFeedAccounts(
  accessToken: string,
  historicalHost: string,
): Promise<DxFeedTradingAccount[]> {
  try {
    if (!historicalHost) {
      dxLogger.error('No historical host provided')
      return []
    }

    const baseUrl = historicalHost.endsWith('/') ? historicalHost.slice(0, -1) : historicalHost
    const url = `${baseUrl}/api/historical/TradingAccount/List`

    dxLogger.debug('Fetching accounts from:', url)

    const response = await fetch(url, {
      headers: buildHistoricalAuthHeaders(accessToken),
    })

    if (!response.ok) {
      const text = await response.text()
      dxLogger.warn(`Failed to fetch accounts (status ${response.status}): ${text}`)
      return []
    }

    const data: DxFeedAccountListResponse | DxFeedTradingAccount[] = await response.json()
    return extractArrayPayload<DxFeedTradingAccount>(data)
  } catch (error) {
    dxLogger.error('Error fetching DxFeed accounts:', error)
    return []
  }
}

function extractInstrumentSymbol(contract: DxFeedReportTrade['contract']): string {
  if (!contract) return 'Unknown'

  const raw = (contract.symbol || contract.contractName || '').toUpperCase()
  const withoutExchange = raw.split(':')[0] ?? raw
  const clean = withoutExchange.startsWith('/') ? withoutExchange.slice(1) : withoutExchange

  const monthCodeMatch = clean.match(/^([A-Z]+?)[FGHJKMNQUVXZ]\d+$/i)
  if (monthCodeMatch) {
    return monthCodeMatch[1] || clean
  }

  const lettersOnly = clean.replace(/[^A-Z]/g, '')
  return lettersOnly || 'Unknown'
}

function buildTradesFromDxFeedReport(
  reportTrades: DxFeedReportTrade[],
  accountLabel: string,
  userId: string,
): any[] {
  const trades: any[] = []

  for (const rt of reportTrades) {
    try {
      if (rt.exitDate === 0 || rt.exitDate == null) {
        dxLogger.debug(`Skipping open position tradeId=${rt.tradeId} (exitDate=0)`)
        continue
      }

      const instrument = extractInstrumentSymbol(rt.contract)
      const side = rt.quantity > 0 ? 'Long' : 'Short'
      const quantity = Math.abs(rt.quantity)

      const entryDate = new Date(rt.entryDate)
      const exitDate = new Date(rt.exitDate)
      const durationSeconds = Math.max(0, Math.round((exitDate.getTime() - entryDate.getTime()) / 1000))

      const pnl = rt.netPl
      const commission = rt.grossPl - rt.netPl

      const tradeData = {
        accountNumber: accountLabel,
        entryId: `dxfeed_${rt.tradeId}_entry`,
        closeId: `dxfeed_${rt.tradeId}_exit`,
        instrument,
        entryPrice: rt.entryPrice.toString(),
        closePrice: rt.exitPrice.toString(),
        entryDate: formatTimestamp(entryDate.toISOString()),
        closeDate: formatTimestamp(exitDate.toISOString()),
        quantity,
        side,
        userId,
      }

      const trade = createTradeWithDefaults({
        id: generateDeterministicTradeId(tradeData),
        accountNumber: accountLabel,
        quantity,
        entryId: `dxfeed_${rt.tradeId}_entry`,
        closeId: `dxfeed_${rt.tradeId}_exit`,
        instrument,
        entryPrice: rt.entryPrice.toString(),
        closePrice: rt.exitPrice.toString(),
        entryDate: formatTimestamp(entryDate.toISOString()),
        closeDate: formatTimestamp(exitDate.toISOString()),
        pnl,
        timeInPosition: durationSeconds,
        userId,
        side,
        commission: Math.abs(commission),
        tags: ['dxfeed'],
      })

      trades.push(trade)

      dxLogger.debug(`Created trade: ${instrument} ${side} ${quantity} @ ${rt.entryPrice} -> ${rt.exitPrice} = $${pnl.toFixed(2)}`)
    } catch (error) {
      dxLogger.error(`Error processing DxFeed trade ${rt.tradeId}:`, error)
    }
  }

  return trades
}

export async function getDxFeedTrades(
  initialTokenJson: string,
  options?: { userId?: string },
): Promise<DxFeedTradesResult> {
  if (DIRECT_SYNC_STATUS.isPaused) {
    void initialTokenJson
    void options
    return { error: directSyncUnderDevelopmentMessage('DxFeed') }
  }

  try {
    const credentials = parseStoredCredentials(initialTokenJson)
    if (!credentials) {
      return { error: 'Invalid stored DxFeed credentials' }
    }

    const { accessToken, historicalHost } = credentials
    if (!historicalHost) {
      return { error: 'No historical API host found in stored credentials' }
    }

    let userId = options?.userId ?? null
    if (!userId) {
      const { internalUserId } = await getResolvedUserIdentity()
      userId = internalUserId
    }

    let storedTokenJson = initialTokenJson
    const baseUrl = historicalHost.endsWith('/') ? historicalHost.slice(0, -1) : historicalHost

    dxLogger.info('Fetching DxFeed accounts...')
    const accounts = await getDxFeedAccounts(accessToken, historicalHost)

    const accountNumbers = accounts.map(
      (a) => a.accountHeader || a.accountReference || a.accountId.toString(),
    )
    if (accountNumbers.length > 0) {
      const updatedCreds: DxFeedStoredCredentials = { ...credentials, accountNumbers }
      const updatedJson = JSON.stringify(updatedCreds)
      await updateStoredCredentials(userId, storedTokenJson, updatedJson)
      storedTokenJson = updatedJson
    }

    if (accounts.length === 0) {
      await updateLastSyncedAt(userId, storedTokenJson)
      return { processedTrades: [], savedCount: 0, tradesCount: 0 }
    }

    dxLogger.info(`Found ${accounts.length} accounts, fetching trades...`)

    const allTrades: any[] = []

    for (const account of accounts) {
      const accountLabel = account.accountHeader || account.accountReference || account.accountId.toString()
      const historicalAccountId = account.accountReference || account.accountId.toString()

      const endDt = new Date()
      const startDt = new Date(endDt.getTime() - DXFEED_HISTORY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)

      const tradesUrl = new URL(
        `${baseUrl}/api/historical/TradingAccount/Trades/${historicalAccountId}`,
      )
      tradesUrl.searchParams.set('startDt', startDt.toISOString())
      tradesUrl.searchParams.set('endDt', endDt.toISOString())

      const response = await fetch(tradesUrl.toString(), {
        headers: buildHistoricalAuthHeaders(accessToken),
      })

      if (!response.ok) {
        const text = await response.text()
        dxLogger.warn(
          `Failed to fetch trades for account ${accountLabel} (status ${response.status}): ${text}`,
        )
        continue
      }

      const data: DxFeedTradesResponse | DxFeedReportTrade[] | Array<{ message?: string }> =
        await response.json()
      const apiError = extractApiErrorMessage(data)
      if (apiError) {
        dxLogger.warn(`DxFeed returned an error for account ${accountLabel}: ${apiError}`)
        continue
      }

      const reportTrades = extractArrayPayload<DxFeedReportTrade>(data)

      dxLogger.info(`Received ${reportTrades.length} trades for account ${accountLabel}`)

      const trades = buildTradesFromDxFeedReport(reportTrades, accountLabel, userId)
      allTrades.push(...trades)
    }

    await updateLastSyncedAt(userId, storedTokenJson)

    if (allTrades.length === 0) {
      dxLogger.info('No trades to save')
      return { processedTrades: [], savedCount: 0, tradesCount: 0 }
    }

    dxLogger.info(`Saving ${allTrades.length} trades...`)
    const saveResult = await saveTradesAction(allTrades)

    if (saveResult.error) {
      if (saveResult.error === 'DUPLICATE_TRADES') {
        return {
          error: 'DUPLICATE_TRADES',
          processedTrades: allTrades,
          tradesCount: allTrades.length,
        }
      }
      dxLogger.error(`Failed to save trades: ${saveResult.error}`)
      return {
        error: `Failed to save trades: ${saveResult.error}`,
        processedTrades: allTrades,
        tradesCount: allTrades.length,
      }
    }

    dxLogger.info(`Saved ${saveResult.numberOfTradesAdded} trades`)

    return {
      processedTrades: allTrades,
      savedCount: saveResult.numberOfTradesAdded,
      tradesCount: allTrades.length,
    }
  } catch (error) {
    dxLogger.error('Failed to get DxFeed trades:', error)
    return { error: 'Failed to get trades' }
  }
}

async function updateLastSyncedAt(userId: string, storedTokenJson: string) {
  await db.update(schema.Synchronization)
    .set({ lastSyncedAt: new Date() })
    .where(and(
      eq(schema.Synchronization.userId, userId),
      eq(schema.Synchronization.service, 'dxfeed'),
      eq(schema.Synchronization.token, storedTokenJson),
    ))
}

async function updateStoredCredentials(userId: string, oldTokenJson: string, newTokenJson: string) {
  await db.update(schema.Synchronization)
    .set({ token: newTokenJson })
    .where(and(
      eq(schema.Synchronization.userId, userId),
      eq(schema.Synchronization.service, 'dxfeed'),
      eq(schema.Synchronization.token, oldTokenJson),
    ))
}

async function storeDxFeedToken(
  tokenJson: string,
  accountId: string = 'default',
) {
  try {
    const { internalUserId } = await getResolvedUserIdentity()
    if (!internalUserId) {
      return { error: 'User not authenticated' }
    }

    const existing = await db.query.Synchronization.findFirst({
      where: (table, { eq, and }) => and(
        eq(table.userId, internalUserId),
        eq(table.service, 'dxfeed'),
        eq(table.accountId, accountId),
      ),
    })

    if (existing) {
      await db.update(schema.Synchronization)
        .set({ token: tokenJson, lastSyncedAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.Synchronization.id, existing.id))
    } else {
      await db.insert(schema.Synchronization).values({
        userId: internalUserId,
        service: 'dxfeed',
        accountId,
        token: tokenJson,
        lastSyncedAt: new Date(),
      })
    }

    return { success: true }
  } catch (error) {
    dxLogger.error('Failed to store DxFeed token:', error)
    return { error: 'Failed to store token' }
  }
}

export async function getDxFeedToken(accountId: string = 'default') {
  try {
    const { internalUserId } = await getResolvedUserIdentity()
    if (!internalUserId) {
      return { error: 'User not authenticated' }
    }

    const syncData = await db.query.Synchronization.findFirst({
      where: (table, { eq, and }) => and(
        eq(table.userId, internalUserId),
        eq(table.service, 'dxfeed'),
        eq(table.accountId, accountId),
      ),
    })

    if (!syncData?.token) {
      return { error: 'No DxFeed token found' }
    }

    return {
      storedTokenJson: syncData.token,
      accountId: syncData.accountId,
    }
  } catch (error) {
    dxLogger.error('Failed to get DxFeed token:', error)
    return { error: 'Failed to get token' }
  }
}

export async function removeDxFeedToken(accountId?: string) {
  try {
    const { internalUserId } = await getResolvedUserIdentity()
    if (!internalUserId) {
      return { error: 'User not authenticated' }
    }

    const conditions = [
      eq(schema.Synchronization.userId, internalUserId),
      eq(schema.Synchronization.service, 'dxfeed'),
    ]
    if (accountId) {
      conditions.push(eq(schema.Synchronization.accountId, accountId))
    }

    await db.delete(schema.Synchronization).where(and(...conditions))

    return { success: true }
  } catch (error) {
    dxLogger.error('Failed to remove DxFeed token:', error)
    return { error: 'Failed to remove token' }
  }
}

export async function getDxFeedSynchronizations() {
  try {
    const { internalUserId } = await getResolvedUserIdentity()
    if (!internalUserId) {
      return { error: 'User not authenticated' }
    }

    const synchronizations = await db.query.Synchronization.findMany({
      where: (table, { eq, and }) => and(
        eq(table.userId, internalUserId),
        eq(table.service, 'dxfeed'),
      ),
      orderBy: (table, { desc }) => [desc(table.lastSyncedAt)],
    })

    return { synchronizations }
  } catch (error) {
    dxLogger.error('Failed to get DxFeed synchronizations:', error)
    return { error: 'Failed to get synchronizations' }
  }
}

export async function updateDxFeedDailySyncTimeAction(
  accountId: string,
  utcTimeString: string | null,
): Promise<{ success: boolean; error?: string }> {
  if (DIRECT_SYNC_STATUS.isPaused) {
    void accountId
    void utcTimeString
    return { success: false, error: directSyncUnderDevelopmentMessage('DxFeed') }
  }

  try {
    const { internalUserId } = await getResolvedUserIdentity()
    if (!internalUserId) {
      return { success: false, error: 'User not authenticated' }
    }

    let syncDateTime: Date | null = null
    if (utcTimeString) {
      syncDateTime = new Date(utcTimeString)
    }

    await db.update(schema.Synchronization)
      .set({ dailySyncTime: syncDateTime })
      .where(and(
        eq(schema.Synchronization.userId, internalUserId),
        eq(schema.Synchronization.service, 'dxfeed'),
        eq(schema.Synchronization.accountId, accountId),
      ))

    return { success: true }
  } catch (error) {
    dxLogger.error('Error updating daily sync time:', error)
    return { success: false, error: 'Failed to update daily sync time' }
  }
}
