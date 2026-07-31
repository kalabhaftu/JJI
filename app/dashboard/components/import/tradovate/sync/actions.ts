'use server'

import { saveTradesAction } from '@/server/database'
import type { TradeType } from '@/lib/db/schema/trades';

import crypto from 'crypto'
import { generateDeterministicTradeId } from '@/lib/trade-id-utils'
import { getTickDetails, type TickDetails } from '@/server/tick-details'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { formatTimestamp, formatDateToTimestamp } from '@/lib/date-utils'
import { createTradeWithDefaults } from '@/lib/trade-factory'
import { getResolvedUserIdentity } from '@/server/user-identity'
import { DEFAULT_INCLUDED_FEE_TYPES, type TradovateIncludedFeeTypes } from './fee-types'
import { logger as baseLogger } from '@/lib/logger';
import { DIRECT_SYNC_STATUS, directSyncUnderDevelopmentMessage } from '@/lib/integrations/direct-sync-status'


function formatDateForAPI(date: Date): string {
  return formatDateToTimestamp(date)
}


function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}sec`
  }
  
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  
  if (remainingSeconds === 0) {
    return `${minutes}min`
  }
  
  return `${minutes}min ${remainingSeconds}sec`
}

// Environment variables for Tradovate OAuth
const TRADOVATE_CLIENT_ID = process.env.TRADOVATE_CLIENT_ID
const TRADOVATE_CLIENT_SECRET = process.env.TRADOVATE_CLIENT_SECRET
const TRADOVATE_REDIRECT_URI = process.env.TRADOVATE_REDIRECT_URI

// Debug mode configuration - enabled in development or when explicitly set
const DEBUG_MODE = process.env.NODE_ENV === 'development' || process.env.TRADOVATE_DEBUG === 'true'

// Logger utility for conditional logging
const logger = {
  debug: (message: string, data?: any) => {
    if (DEBUG_MODE) {
      baseLogger.info(`[TRADOVATE-DEBUG] ${message}`, data)
    }
  },
  info: (message: string, data?: any) => {
    baseLogger.info(`[TRADOVATE] ${message}`, data)
  },
  warn: (message: string, error?: any) => {
    baseLogger.warn(`[TRADOVATE] ${message}`, error)
  },
  error: (message: string, error?: any) => {
    baseLogger.error(`[TRADOVATE] ${message}`, error)
  }
}

// Environment URLs - demo only
const TRADOVATE_ENVIRONMENTS = {
  demo: {
    auth: 'https://trader.tradovate.com', // OAuth authorization
    api: 'https://demo.tradovateapi.com'   // API calls
  }
}

interface TradovateAccount {
  id: number
  name: string
  nickname: string
  accountType: string
  active: boolean
  clearingHouse: string
  riskCategoryId: number
  autoLiqProfileId: number
  marginCalculationType: string
  legalStatus: string
  nickname2?: string
}

interface TradovateTokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  scope: string
}

interface TradovateOAuthResult {
  accessToken?: string
  refreshToken?: string
  expiresAt?: string
  error?: string
  authUrl?: string
  state?: string
  accountId?: string
}

interface TradovateAccountsResult {
  accounts?: TradovateAccount[]
  error?: string
}

interface TradovateContract {
  id: number
  name: string
  symbol: string
  description?: string
}

interface TradovateFillFee {
  id: number
  clearingFee: number
  clearingCurrencyId: number
  exchangeFee: number
  exchangeCurrencyId: number
  nfaFee: number
  nfaCurrencyId: number
  brokerageFee: number
  brokerageCurrencyId: number
  commission: number
  commissionCurrencyId: number
  orderRoutingFee: number
  orderRoutingCurrencyId: number
}

interface TradovateFillPair {
  id: number
  positionId: number
  buyFillId: number
  sellFillId: number
  qty: number
  buyPrice: number
  sellPrice: number
  active: boolean
}

interface Fill {
  details: any
  commission: number
}

function getTotalFeeFromFillFee(fee: TradovateFillFee, includedFeeTypes: TradovateIncludedFeeTypes | boolean): number {
  if (includedFeeTypes === true) {
    return (
      Number(fee.commission ?? 0) +
      Number(fee.exchangeFee ?? 0) +
      Number(fee.clearingFee ?? 0) +
      Number(fee.nfaFee ?? 0) +
      Number(fee.brokerageFee ?? 0) +
      Number(fee.orderRoutingFee ?? 0)
    )
  }
  const types = typeof includedFeeTypes === 'object' ? includedFeeTypes : { commission: true }
  let total = 0
  if (types.commission) total += Number(fee.commission ?? 0)
  if (types.exchangeFee) total += Number(fee.exchangeFee ?? 0)
  if (types.clearingFee) total += Number(fee.clearingFee ?? 0)
  if (types.nfaFee) total += Number(fee.nfaFee ?? 0)
  if (types.brokerageFee) total += Number(fee.brokerageFee ?? 0)
  if (types.orderRoutingFee) total += Number(fee.orderRoutingFee ?? 0)
  return total
}

interface TradovateTradesResult {
  processedTrades?: TradeType[]
  savedCount?: number
  ordersCount?: number
  error?: string
}


async function getContractById(accessToken: string, contractId: number): Promise<TradovateContract | null> {
  try {
    const apiBaseUrl = TRADOVATE_ENVIRONMENTS.demo.api
    const params = new URLSearchParams({ id: String(contractId) }).toString()
    const response = await fetch(`${apiBaseUrl}/v1/contract/item?${params}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      logger.warn(`Failed to fetch contract ${contractId}: ${response.status} ${response.statusText}`)
      return null
    }
    
    return await response.json()
  } catch (error) {
    logger.warn(`Error fetching contract ${contractId}:`, error)
    return null
  }
}


async function getFillFeesByIds(accessToken: string, fillIds: number[]): Promise<TradovateFillFee[]> {
  try {
    if (fillIds.length === 0) return []
    
    const apiBaseUrl = TRADOVATE_ENVIRONMENTS.demo.api
    const BATCH_SIZE = 5
    
    const fees: TradovateFillFee[] = []
    
    for (let i = 0; i < fillIds.length; i += BATCH_SIZE) {
      const batch = fillIds.slice(i, i + BATCH_SIZE)
      
      try {
        const idsParam = batch.join(',')
        const response = await fetch(`${apiBaseUrl}/v1/fillFee/items?ids=${idsParam}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        })
        
        if (response.ok) {
          const batchFees = await response.json()
          if (Array.isArray(batchFees)) {
            fees.push(...batchFees)
          }
        } else {
          logger.warn(`Batch fill fees request failed (${response.status}), falling back to individual requests`)
          const batchPromises = batch.map(async (fillId) => {
            try {
              return await getFillFeeById(accessToken, fillId)
            } catch (error) {
              logger.warn(`Failed to fetch fill fee ${fillId}:`, error)
              return null
            }
          })
          
          const batchResults = await Promise.all(batchPromises)
          fees.push(...batchResults.filter(fee => fee !== null) as TradovateFillFee[])
        }
      } catch (batchError) {
        logger.warn(`Batch fill fees request error, falling back to individual requests:`, batchError)
        const batchPromises = batch.map(async (fillId) => {
          try {
            return await getFillFeeById(accessToken, fillId)
          } catch (error) {
            logger.warn(`Failed to fetch fill fee ${fillId}:`, error)
            return null
          }
        })
        
        const batchResults = await Promise.all(batchPromises)
        fees.push(...batchResults.filter(fee => fee !== null) as TradovateFillFee[])
      }
      
      if (i + BATCH_SIZE < fillIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    
    return fees
  } catch (error) {
    logger.warn(`Error fetching fill fees:`, error)
    return []
  }
}


async function getFillFeeById(accessToken: string, fillId: number): Promise<TradovateFillFee | null> {
  try {
    const apiBaseUrl = TRADOVATE_ENVIRONMENTS.demo.api
    const params = new URLSearchParams({ id: String(fillId) }).toString()
    const response = await fetch(`${apiBaseUrl}/v1/fillFee/item?${params}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      logger.warn(`Failed to fetch fill fee ${fillId}:`, { status: response.status, statusText: response.statusText })
      return null
    }
    
    return await response.json()
  } catch (error) {
    logger.warn(`Error fetching fill fee ${fillId}:`, error)
    return null
  }
}


async function getFillPairs(accessToken: string): Promise<TradovateFillPair[]> {
  try {
    const apiBaseUrl = TRADOVATE_ENVIRONMENTS.demo.api
    const response = await fetch(`${apiBaseUrl}/v1/fillPair/list`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      logger.warn(`Failed to fetch fill pairs: ${response.status} ${response.statusText}`)
      return []
    }
    
    const fillPairs = await response.json()
    return Array.isArray(fillPairs) ? fillPairs : []
  } catch (error) {
    logger.warn(`Error fetching fill pairs:`, error)
    return []
  }
}


async function getFillsByIds(accessToken: string, fillIds: number[]): Promise<any[]> {
  try {
    if (fillIds.length === 0) return []
    
    const apiBaseUrl = TRADOVATE_ENVIRONMENTS.demo.api
    const BATCH_SIZE = 5
    
    const fills: any[] = []
    
    for (let i = 0; i < fillIds.length; i += BATCH_SIZE) {
      const batch = fillIds.slice(i, i + BATCH_SIZE)
      
      try {
        const idsParam = batch.join(',')
        const response = await fetch(`${apiBaseUrl}/v1/fill/items?ids=${idsParam}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        })
        
        if (response.ok) {
          const batchFills = await response.json()
          if (Array.isArray(batchFills)) {
            fills.push(...batchFills)
          }
        } else {
          logger.warn(`Batch fills request failed (${response.status}), falling back to individual requests`)
          const batchPromises = batch.map(async (fillId) => {
            try {
              return await getFillById(accessToken, fillId)
            } catch (error) {
              logger.warn(`Failed to fetch fill ${fillId}:`, error)
              return null
            }
          })
          
          const batchResults = await Promise.all(batchPromises)
          fills.push(...batchResults.filter(fill => fill !== null))
        }
      } catch (batchError) {
        logger.warn(`Batch fills request error, falling back to individual requests:`, batchError)
        const batchPromises = batch.map(async (fillId) => {
          try {
            return await getFillById(accessToken, fillId)
          } catch (error) {
            logger.warn(`Failed to fetch fill ${fillId}:`, error)
            return null
          }
        })
        
        const batchResults = await Promise.all(batchPromises)
        fills.push(...batchResults.filter(fill => fill !== null))
      }
      
      if (i + BATCH_SIZE < fillIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    
    return fills
  } catch (error) {
    logger.warn(`Error fetching fills:`, error)
    return []
  }
}


async function getFillById(accessToken: string, fillId: number): Promise<any | null> {
  try {
    const apiBaseUrl = TRADOVATE_ENVIRONMENTS.demo.api
    const params = new URLSearchParams({ id: String(fillId) }).toString()
    const response = await fetch(`${apiBaseUrl}/v1/fill/item?${params}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      logger.warn(`Failed to fetch fill ${fillId}:`, { status: response.status, statusText: response.statusText })
      return null
    }
    
    return await response.json()
  } catch (error) {
    logger.warn(`Error fetching fill ${fillId}:`, error)
    return null
  }
}


async function getOrdersByIds(accessToken: string, orderIds: number[]): Promise<any[]> {
  try {
    if (orderIds.length === 0) return []
    
    const apiBaseUrl = TRADOVATE_ENVIRONMENTS.demo.api
    const BATCH_SIZE = 5
    
    const orders: any[] = []
    
    for (let i = 0; i < orderIds.length; i += BATCH_SIZE) {
      const batch = orderIds.slice(i, i + BATCH_SIZE)
      
      try {
        const idsParam = batch.join(',')
        const response = await fetch(`${apiBaseUrl}/v1/order/items?ids=${idsParam}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        })
        
        if (response.ok) {
          const batchOrders = await response.json()
          if (Array.isArray(batchOrders)) {
            orders.push(...batchOrders)
          }
        } else {
          logger.warn(`Batch orders request failed (${response.status}), falling back to individual requests`)
          const batchPromises = batch.map(async (orderId) => {
            try {
              return await getOrderById(accessToken, orderId)
            } catch (error) {
              logger.warn(`Failed to fetch order ${orderId}:`, error)
              return null
            }
          })
          
          const batchResults = await Promise.all(batchPromises)
          orders.push(...batchResults.filter(order => order !== null))
        }
      } catch (batchError) {
        logger.warn(`Batch orders request error, falling back to individual requests:`, batchError)
        const batchPromises = batch.map(async (orderId) => {
          try {
            return await getOrderById(accessToken, orderId)
          } catch (error) {
            logger.warn(`Failed to fetch order ${orderId}:`, error)
            return null
          }
        })
        
        const batchResults = await Promise.all(batchPromises)
        orders.push(...batchResults.filter(order => order !== null))
      }
      
      if (i + BATCH_SIZE < orderIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    
    return orders
  } catch (error) {
    logger.warn(`Error fetching orders:`, error)
    return []
  }
}


async function getOrderById(accessToken: string, orderId: number): Promise<any | null> {
  try {
    const apiBaseUrl = TRADOVATE_ENVIRONMENTS.demo.api
    const params = new URLSearchParams({ id: String(orderId) }).toString()
    const response = await fetch(`${apiBaseUrl}/v1/order/item?${params}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      logger.warn(`Failed to fetch order ${orderId}:`, { status: response.status, statusText: response.statusText })
      return null
    }
    
    return await response.json()
  } catch (error) {
    logger.warn(`Error fetching order ${orderId}:`, error)
    return null
  }
}

interface TradovateUser {
  id: number
  name: string
  timestamp: string
  email: string
  status: string
  professional: boolean
  organizationId: number
  introducingPartnerId: number
}

interface TradovateUserListResponse {
  errorText?: string
  data?: TradovateUser[]
}

async function getTradovateUsername(accessToken: string): Promise<string> {
  const apiBaseUrl = TRADOVATE_ENVIRONMENTS.demo.auth
  const response = await fetch(`${apiBaseUrl}/v1/user/list`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch user list: ${response.status} ${response.statusText}`)
  }

  const data: TradovateUserListResponse = await response.json()
  
  if (data.errorText) {
    throw new Error(`Tradovate API error: ${data.errorText}`)
  }

  if (!data.data || data.data.length === 0) {
    throw new Error('No user data found in response')
  }

  const user = data.data[0]
  if (!user || !user.name) {
    throw new Error('User name not found in response')
  }

  return user.name
}

export async function initiateTradovateOAuth(accountId: string = 'default'): Promise<TradovateOAuthResult> {
  if (DIRECT_SYNC_STATUS.isPaused) {
    void accountId
    return { error: directSyncUnderDevelopmentMessage('Tradovate') }
  }

  try {
    if (!TRADOVATE_CLIENT_ID || !TRADOVATE_REDIRECT_URI) {
      return { error: 'Tradovate OAuth credentials not configured' }
    }

    const state = crypto.randomBytes(32).toString('hex')
    
    const { internalUserId } = await getResolvedUserIdentity()
    if (!internalUserId) {
      return { error: 'User not authenticated' }
    }

    const authBaseUrl = TRADOVATE_ENVIRONMENTS.demo.auth
    const authUrl = new URL(`${authBaseUrl}/oauth`)
    authUrl.searchParams.append('response_type', 'code')
    authUrl.searchParams.append('client_id', TRADOVATE_CLIENT_ID)
    authUrl.searchParams.append('redirect_uri', TRADOVATE_REDIRECT_URI)
    authUrl.searchParams.append('scope', 'read write')
    authUrl.searchParams.append('state', state)

    return { authUrl: authUrl.toString(), state }
  } catch (error) {
    logger.error('Failed to initiate Tradovate OAuth:', error)
    return { error: 'Failed to initiate OAuth flow' }
  }
}

async function getPropfirmName(accessToken: string): Promise<string> {
  const apiBaseUrl = TRADOVATE_ENVIRONMENTS.demo.api
  const response = await fetch(`${apiBaseUrl}/v1/organization/list`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch organization: ${response.status} ${response.statusText}`)
  }

  const organizations = await response.json() as { id: number; name: string }[]
  if (organizations && organizations.length > 0) {
    return organizations[0]!.name
  }
  throw new Error('No organization found')
}

export async function handleTradovateCallback(code: string, state: string): Promise<TradovateOAuthResult> {
  if (DIRECT_SYNC_STATUS.isPaused) {
    void code
    void state
    return { error: directSyncUnderDevelopmentMessage('Tradovate') }
  }

  try {
    if (!TRADOVATE_CLIENT_ID || !TRADOVATE_CLIENT_SECRET || !TRADOVATE_REDIRECT_URI) {
      return { error: 'Tradovate OAuth credentials not configured' }
    }

    const { internalUserId } = await getResolvedUserIdentity()
    if (!internalUserId) {
      return { error: 'User not authenticated' }
    }

    const apiBaseUrl = TRADOVATE_ENVIRONMENTS.demo.api
    
    const tokenResponse = await fetch(`${apiBaseUrl}/auth/oauthtoken`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${TRADOVATE_CLIENT_ID}:${TRADOVATE_CLIENT_SECRET}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: TRADOVATE_REDIRECT_URI,
        client_id: TRADOVATE_CLIENT_ID
      })
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      logger.error('Token exchange failed:', { status: tokenResponse.status, errorText })
      return { error: `Failed to exchange code for tokens: ${tokenResponse.status}` }
    }

    let tokens: TradovateTokenResponse = await tokenResponse.json()

    if (!tokens || !tokens.access_token || !tokens.refresh_token || !tokens.expires_in) {
      return { error: 'Invalid token response from Tradovate' }
    }
    
    const expiresAt = formatDateForAPI(new Date(Date.now() + (tokens.expires_in * 1000)))
    const propfirm = await getPropfirmName(tokens.access_token)
    
    const storeResult = await storeTradovateToken(
      tokens.access_token,
      expiresAt,
      'demo',
      propfirm
    )
    
    if (storeResult.error) {
      logger.warn('Failed to store token in database:', storeResult.error)
    }
    
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt
    }
  } catch (error) {
    logger.error('Failed to handle OAuth callback:', error)
    return { error: 'Failed to process OAuth callback' }
  }
}

async function renewTradovateAccessToken(accessToken: string, environment: 'demo' | 'live' = 'demo'): Promise<TradovateOAuthResult> {
  try {
    const apiBaseUrl = environment === 'demo' ? TRADOVATE_ENVIRONMENTS.demo.api : 'https://live.tradovateapi.com'
    
    const renewal = await fetch(`${apiBaseUrl}/auth/renewAccessToken`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!renewal.ok) {
      const errorText = await renewal.text()
      logger.error('Token renewal failed:', { status: renewal.status, errorText })
      return { error: `Failed to renew token: ${renewal.status}` };
    }

    const renewalData = await renewal.json();
    
    if (renewalData.errorText) {
      logger.error('Token renewal error:', renewalData.errorText);
      return { error: `Token renewal failed: ${renewalData.errorText}` };
    }

    const storeResult = await storeTradovateToken(renewalData.accessToken, renewalData.expirationTime, environment)
    if (storeResult.error) {
      logger.warn('Failed to update token in database:', storeResult.error)
    }

    return {
      accessToken: renewalData.accessToken,
      expiresAt: renewalData.expirationTime,
    };
  } catch (error) {
    logger.error('Failed to renew Tradovate token:', error);
    return { error: `Failed to renew token: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

async function refreshTradovateToken(refreshToken: string): Promise<TradovateOAuthResult> {
  try {
    if (!TRADOVATE_CLIENT_ID || !TRADOVATE_CLIENT_SECRET) {
      return { error: 'Tradovate OAuth credentials not configured' }
    }

    const { internalUserId } = await getResolvedUserIdentity()
    if (!internalUserId) {
      return { error: 'User not authenticated' }
    }

    const apiBaseUrl = TRADOVATE_ENVIRONMENTS.demo.api
    const tokenResponse = await fetch(`${apiBaseUrl}/auth/oauthtoken`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${TRADOVATE_CLIENT_ID}:${TRADOVATE_CLIENT_SECRET}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: TRADOVATE_CLIENT_ID
      })
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      logger.error('Token refresh failed:', { status: tokenResponse.status, errorText })
      return { error: `Failed to refresh token: ${tokenResponse.status}` }
    }

    let tokens: TradovateTokenResponse = await tokenResponse.json()

    if (!tokens || !tokens.access_token || !tokens.refresh_token || !tokens.expires_in) {
      return { error: 'Invalid refresh token response from Tradovate' }
    }
    
    const expiresAt = formatDateForAPI(new Date(Date.now() + (tokens.expires_in * 1000)))
    
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt
    }
  } catch (error) {
    logger.error('Failed to refresh Tradovate token:', error)
    return { error: 'Failed to refresh token' }
  }
}

async function testTradovateAuth(accessToken: string) {
  try {
    const apiBaseUrl = TRADOVATE_ENVIRONMENTS.demo.api
    
    const response = await fetch(`${apiBaseUrl}/v1/user/list`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    })
    
    if (response.ok) {
      const userData = await response.json()
      return { success: true, userData }
    } else {
      const errorText = await response.text()
      return { success: false, error: errorText }
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

async function getTradovateAccounts(accessToken: string): Promise<TradovateAccountsResult> {
  try {
    const apiBaseUrl = TRADOVATE_ENVIRONMENTS.demo.api
    
    const response = await fetch(`${apiBaseUrl}/v1/account/list`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      return { error: `Failed to fetch accounts: ${errorText}` }
    }

    const accounts = await response.json()
    
    if (!Array.isArray(accounts) || accounts.length === 0) {
      return { error: 'No accounts found on demo environment' }
    }
    
    return { accounts }
  } catch (error) {
    logger.error('Failed to get Tradovate accounts:', error)
    return { error: 'Failed to get accounts' }
  }
}

// Process fill pairs into trades with proper P&L calculation
async function buildTradesFromFillPairs(
  fillPairs: TradovateFillPair[],
  contracts: Map<number, TradovateContract>,
  fillsById: Map<number, Fill>,
  ordersById: Map<number, any>,
  accountsById: Map<number, TradovateAccount>,
  userId: string,
  tickDetails: TickDetails[]
): Promise<TradeType[]> {
  logger.info(`Building trades from ${fillPairs.length} fill pairs for user ${userId}`)

  const trades: TradeType[] = []

  for (const fillPair of fillPairs) {
    try {
      const buyFillData = fillsById.get(fillPair.buyFillId)
      const sellFillData = fillsById.get(fillPair.sellFillId)

      if (!buyFillData || !sellFillData) {
        continue
      }

      const buyFill = buyFillData.details
      const sellFill = sellFillData.details
      const sellOrder = ordersById.get(sellFill.orderId)

      if (!sellOrder) {
        continue
      }

      const accountId = sellOrder.accountId
      const account = accountsById.get(accountId)
      if (!account) {
        continue
      }

      const accountLabel = account.name || account.nickname || accountId.toString()
      const contract = contracts.get(buyFill.contractId)
      if (!contract) {
        continue
      }

      const rawCode = (contract.symbol || contract.name || '').toUpperCase()
      let contractSymbol = 'Unknown'
      const monthCodeMatch = rawCode.match(/^([A-Z]+?)[FGHJKMNQUVXZ][0-9]+$/i)
      if (monthCodeMatch) {
        contractSymbol = monthCodeMatch[1]!.toUpperCase()
      } else if (rawCode) {
        const lettersOnly = rawCode.replace(/[^A-Z]/g, '')
        contractSymbol = lettersOnly.slice(0, 2) || 'Unknown'
      }

      const buyTime = new Date(buyFill.timestamp)
      const sellTime = new Date(sellFill.timestamp)
      const isBuyFirst = buyTime < sellTime
      const side = isBuyFirst ? 'Long' : 'Short'
      
      const tickDetail = tickDetails.find(detail => detail.ticker === contractSymbol)
      const tickSize = tickDetail?.tickSize || 0.25
      const tickValue = tickDetail?.tickValue || 5.0
      
      const entryPrice = isBuyFirst ? fillPair.buyPrice : fillPair.sellPrice
      const exitPrice = isBuyFirst ? fillPair.sellPrice : fillPair.buyPrice
      const entryTime = isBuyFirst ? buyTime : sellTime
      const exitTime = isBuyFirst ? sellTime : buyTime
      
      const priceDifference = exitPrice - entryPrice
      const ticks = priceDifference / tickSize
      let pnl = ticks * tickValue * fillPair.qty
      
      if (!isBuyFirst) {
        pnl = -pnl
      }
      
      const durationSeconds = Math.max(0, Math.round((exitTime.getTime() - entryTime.getTime()) / 1000))

      const buyFillQty = buyFill.qty || 1
      const sellFillQty = sellFill.qty || 1
      
      const buyCommissionPerUnit = buyFillData.commission / buyFillQty
      const sellCommissionPerUnit = sellFillData.commission / sellFillQty
      
      const buyCommission = buyCommissionPerUnit * fillPair.qty
      const sellCommission = sellCommissionPerUnit * fillPair.qty
      const totalCommission = Number((buyCommission + sellCommission).toFixed(2))
      
      const netPnl = pnl

      const tradeData = {
        accountNumber: accountLabel,
        entryId: isBuyFirst ? `fill_${fillPair.buyFillId}` : `fill_${fillPair.sellFillId}`,
        closeId: isBuyFirst ? `fill_${fillPair.sellFillId}` : `fill_${fillPair.buyFillId}`,
        instrument: contractSymbol,
        entryPrice: entryPrice.toString(),
        closePrice: exitPrice.toString(),
        entryDate: formatTimestamp(entryTime.toISOString()),
        closeDate: formatTimestamp(exitTime.toISOString()),
        quantity: fillPair.qty,
        side: side,
        userId: userId
      }

      const trade = createTradeWithDefaults({
        id: generateDeterministicTradeId(tradeData),
        accountNumber: accountLabel,
        quantity: fillPair.qty,
        entryId: isBuyFirst ? `fill_${fillPair.buyFillId}` : `fill_${fillPair.sellFillId}`,
        closeId: isBuyFirst ? `fill_${fillPair.sellFillId}` : `fill_${fillPair.buyFillId}`,
        instrument: contractSymbol,
        entryPrice: entryPrice.toString(),
        closePrice: exitPrice.toString(),
        entryDate: formatTimestamp(entryTime.toISOString()),
        closeDate: formatTimestamp(exitTime.toISOString()),
        pnl: netPnl,
        timeInPosition: durationSeconds,
        userId: userId,
        side: side,
        commission: totalCommission,
        tags: ['tradovate'],
      })

      trades.push(trade)
    } catch (error) {
      logger.error(`Error processing fill pair ${fillPair.id}:`, error)
    }
  }

  return trades
}

import { encrypt } from '@/lib/security/encryption';

async function storeTradovateToken(
  accessToken: string,
  expiresAt: string,
  environment: 'demo' | 'live' = 'demo',
  accountId: string = 'default'
) {
  try {
    const { internalUserId } = await getResolvedUserIdentity()
    if (!internalUserId) {
      return { error: 'User not authenticated' }
    }

    const encryptedToken = encrypt(accessToken);

    const existing = await db.query.Synchronization.findFirst({
      where: (table, { eq, and }) => and(
        eq(table.userId, internalUserId),
        eq(table.service, 'tradovate'),
        eq(table.accountId, accountId)
      )
    })

    if (existing) {
      await db.update(schema.Synchronization)
        .set({
          token: encryptedToken,
          tokenExpiresAt: new Date(expiresAt),
          lastSyncedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(schema.Synchronization.id, existing.id))
    } else {
      await db.insert(schema.Synchronization).values({
        userId: internalUserId,
        service: 'tradovate',
        accountId: accountId,
        token: encryptedToken,
        tokenExpiresAt: new Date(expiresAt),
        lastSyncedAt: new Date()
      })
    }

    return { success: true }
  } catch (error) {
    logger.error('Failed to store Tradovate token:', error)
    return { error: 'Failed to store token' }
  }
}

import { decrypt } from '@/lib/security/encryption';

export async function getTradovateToken(accountId: string = 'default') {
  try {
    const { internalUserId } = await getResolvedUserIdentity()
    if (!internalUserId) {
      return { error: 'User not authenticated' }
    }

    const syncData = await db.query.Synchronization.findFirst({
      where: (table, { eq, and }) => and(
        eq(table.userId, internalUserId),
        eq(table.service, 'tradovate'),
        eq(table.accountId, accountId)
      )
    })

    if (!syncData?.token) {
      return { error: 'No Tradovate token found' }
    }

    const now = new Date()
    const expiresAt = syncData.tokenExpiresAt
    
    if (expiresAt && expiresAt <= now) {
      return { error: 'Token expired' }
    }

    const decryptedToken = decrypt(syncData.token) || syncData.token;

    const includedFeeTypes = syncData.includedFeeTypes as Record<string, boolean> | null | undefined
    return {
      accessToken: decryptedToken,
      expiresAt: syncData.tokenExpiresAt?.toISOString() || '',
      environment: 'demo',
      accountId: syncData.accountId,
      includedFeeTypes: includedFeeTypes ?? undefined
    }
  } catch (error) {
    logger.error('Failed to get Tradovate token:', error)
    return { error: 'Failed to get token' }
  }
}

export async function updateTradovateIncludedFeeTypes(
  accountId: string,
  includedFeeTypes: Record<string, boolean>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { internalUserId } = await getResolvedUserIdentity()
    if (!internalUserId) {
      return { success: false, error: 'User not authenticated' }
    }

    await db.update(schema.Synchronization)
      .set({ includedFeeTypes })
      .where(and(
        eq(schema.Synchronization.userId, internalUserId),
        eq(schema.Synchronization.service, 'tradovate'),
        eq(schema.Synchronization.accountId, accountId)
      ))

    return { success: true }
  } catch (error) {
    logger.error('Failed to update Tradovate fee config:', error)
    return { success: false, error: 'Failed to update fee config' }
  }
}

export async function removeTradovateToken(accountId?: string) {
  try {
    const { internalUserId } = await getResolvedUserIdentity()
    if (!internalUserId) {
      return { error: 'User not authenticated' }
    }

    const conditions = [
      eq(schema.Synchronization.userId, internalUserId),
      eq(schema.Synchronization.service, 'tradovate')
    ]
    if (accountId) {
      conditions.push(eq(schema.Synchronization.accountId, accountId))
    }

    await db.delete(schema.Synchronization).where(and(...conditions))

    return { success: true }
  } catch (error) {
    logger.error('Failed to remove Tradovate token:', error)
    return { error: 'Failed to remove token' }
  }
}

export async function getTradovateSynchronizations() {
  try {
    const { internalUserId } = await getResolvedUserIdentity()
    if (!internalUserId) {
      return { error: 'User not authenticated' }
    }

    const synchronizations = await db.query.Synchronization.findMany({
      where: (table, { and, eq }) => and(
        eq(table.userId, internalUserId),
        eq(table.service, 'tradovate')
      ),
      orderBy: (table, { desc }) => [desc(table.lastSyncedAt)]
    })

    return { synchronizations }
  } catch (error) {
    logger.error('TRADOVATE SYNC: Failed to get Tradovate synchronizations:', error)
    return { error: 'Failed to get synchronizations' }
  }
}

async function setCustomTradovateToken(
  accessToken: string,
  expiresAt: string,
  accountId: string = 'custom',
  environment: 'demo' | 'live' = 'demo'
) {
  try {
    const { internalUserId } = await getResolvedUserIdentity()
    if (!internalUserId) {
      return { error: 'User not authenticated' }
    }

    if (!accessToken || accessToken.length < 10) {
      return { error: 'Invalid access token format' }
    }

    const expirationDate = new Date(expiresAt)
    if (isNaN(expirationDate.getTime())) {
      return { error: 'Invalid expiration date format' }
    }

    const result = await storeTradovateToken(accessToken, expiresAt, environment, accountId)
    if (result.error) {
      return result
    }

    return { 
      success: true, 
      message: `Custom token set for account ${accountId}`,
      accountId,
      expiresAt: expirationDate.toISOString()
    }
  } catch (error) {
    logger.error('Failed to set custom Tradovate token:', error)
    return { error: 'Failed to set custom token' }
  }
}

async function testCustomTradovateToken(
  accessToken: string,
  environment: 'demo' | 'live' = 'demo'
) {
  try {
    if (!accessToken || accessToken.length < 10) {
      return { error: 'Invalid access token format' }
    }

    const apiBaseUrl = environment === 'demo' ? TRADOVATE_ENVIRONMENTS.demo.api : 'https://live.tradovateapi.com'
    
    const response = await fetch(`${apiBaseUrl}/v1/user/list`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    })

    if (response.ok) {
      const userData = await response.json()
      return { 
        success: true, 
        message: 'Token is valid and working',
        environment,
        userData: Array.isArray(userData) ? userData.length : 1
      }
    } else {
      const errorText = await response.text()
      return { 
        error: `Token test failed: ${response.status}`,
        details: errorText
      }
    }
  } catch (error) {
    logger.error('Failed to test custom Tradovate token:', error)
    return { error: `Failed to test token: ${error instanceof Error ? error.message : 'Unknown error'}` }
  }
}

async function updateLastSyncedAt(userId: string, accountId?: string) {
  const conditions = [
    eq(schema.Synchronization.userId, userId),
    eq(schema.Synchronization.service, 'tradovate')
  ];
  if (accountId) conditions.push(eq(schema.Synchronization.accountId, accountId));

  return await db.update(schema.Synchronization)
    .set({ lastSyncedAt: new Date() })
    .where(and(...conditions))
}

export async function getTradovateTrades(
  accessToken: string,
  options?: { userId?: string; accountId?: string; includeAllFees?: boolean; includedFeeTypes?: TradovateIncludedFeeTypes }
): Promise<TradovateTradesResult> {
  if (DIRECT_SYNC_STATUS.isPaused) {
    void accessToken
    void options
    return { error: directSyncUnderDevelopmentMessage('Tradovate') }
  }

  try {
    const includedFeeTypes: TradovateIncludedFeeTypes | boolean =
      options?.includedFeeTypes ?? (options?.includeAllFees ? true : DEFAULT_INCLUDED_FEE_TYPES)

    let userId = options?.userId ?? null
    if (!userId) {
      const { internalUserId } = await getResolvedUserIdentity()
      userId = internalUserId
    }

    const apiBaseUrl = TRADOVATE_ENVIRONMENTS.demo.api

    const fillPairs = await getFillPairs(accessToken)
    
    if (fillPairs.length === 0) {
      await updateLastSyncedAt(userId, options?.accountId)
      return { processedTrades: [], savedCount: 0, ordersCount: 0 }
    }

    const accountsRes = await fetch(`${apiBaseUrl}/v1/account/list`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    })
    const accounts: TradovateAccount[] = accountsRes.ok ? await accountsRes.json() : []
    const accountsById = new Map<number, TradovateAccount>()
    accounts.forEach(account => accountsById.set(account.id, account))

    const allFillIds = new Set<number>()
    fillPairs.forEach(pair => {
      allFillIds.add(pair.buyFillId)
      allFillIds.add(pair.sellFillId)
    })

    const [allFills, allFees] = await Promise.all([
      getFillsByIds(accessToken, Array.from(allFillIds)),
      getFillFeesByIds(accessToken, Array.from(allFillIds))
    ])

    const fillsById = new Map<number, Fill>()
    const feesById = new Map<number, TradovateFillFee>()
    const uniqueContractIds = new Set<number>()
    const uniqueOrderIds = new Set<number>()

    allFills.forEach(fill => {
      fillsById.set(fill.id, { details: fill, commission: 0 })
      uniqueContractIds.add(fill.contractId)
      uniqueOrderIds.add(fill.orderId)
    })

    allFees.forEach(fee => {
      feesById.set(fee.id, fee)
      const fill = fillsById.get(fee.id)
      if (fill) {
        fill.commission = getTotalFeeFromFillFee(fee, includedFeeTypes)
      }
    })

    const contracts = new Map<number, TradovateContract>()
    const contractPromises = Array.from(uniqueContractIds).map(async (contractId) => {
      try {
        const contract = await getContractById(accessToken, contractId)
        if (contract) {
          contracts.set(contractId, contract)
        }
      } catch (error) {
        logger.warn(`Failed to fetch contract ${contractId}:`, error)
      }
    })
    await Promise.all(contractPromises)

    const sellOrderIds = new Set<number>()
    fillPairs.forEach(pair => {
      const sellFill = fillsById.get(pair.sellFillId)
      if (sellFill) {
        sellOrderIds.add(sellFill.details.orderId)
      }
    })

    const sellOrders = await getOrdersByIds(accessToken, Array.from(sellOrderIds))
    const ordersById = new Map<number, any>()
    sellOrders.forEach(order => {
      ordersById.set(order.id, order)
    })

    const tickDetails = await getTickDetails()

    const processedTrades = await buildTradesFromFillPairs(fillPairs, contracts, fillsById, ordersById, accountsById, userId, tickDetails)
    
    await updateLastSyncedAt(userId, options?.accountId)

    if (processedTrades.length === 0) {
      return { processedTrades: [], savedCount: 0 }
    }

    const saveResult = await saveTradesAction(processedTrades)
    
    if (saveResult.error) {
      if (saveResult.error === "DUPLICATE_TRADES") {
        return { 
          error: "DUPLICATE_TRADES",
          processedTrades: processedTrades,
          ordersCount: fillPairs.length * 2
        }
      }
      return { 
        error: `Failed to save trades: ${saveResult.error}`,
        processedTrades: processedTrades,
        ordersCount: fillPairs.length * 2
      }
    }

    return { 
      processedTrades: processedTrades,
      savedCount: saveResult.numberOfTradesAdded,
      ordersCount: fillPairs.length * 2
    }
  } catch (error) {
    logger.error('Failed to get Tradovate trades:', error)
    return { error: 'Failed to get trades' }
  }
}

export async function updateDailySyncTimeAction(
  accountId: string,
  utcTimeString: string | null
): Promise<{ success: boolean; error?: string }> {
  if (DIRECT_SYNC_STATUS.isPaused) {
    void accountId
    void utcTimeString
    return { success: false, error: directSyncUnderDevelopmentMessage('Tradovate') }
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
        eq(schema.Synchronization.service, 'tradovate'),
        eq(schema.Synchronization.accountId, accountId)
      ))
    
    return { success: true }
  } catch (error) {
    logger.error('Error updating daily sync time:', error)
    return { success: false, error: 'Failed to update daily sync time' }
  }
}
