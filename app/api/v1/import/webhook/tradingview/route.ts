import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { logger } from '@/lib/logger'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'
import { recordAuditEvent } from '@/lib/audit-logger'

export const dynamic = 'force-dynamic'

const MAX_WEBHOOK_BODY_BYTES = 64 * 1024
const MAX_PRICE = 1_000_000_000
const MAX_QUANTITY = 1_000_000_000
const MAX_PNL = 1_000_000_000

const numericField = z.coerce.number().finite().min(0).max(MAX_PRICE)
const optionalNumericField = z.preprocess(
  (val) => (val === '' || val === null || val === undefined) ? null : val,
  z.coerce.number().finite().min(0).max(MAX_PRICE).optional().nullable()
)

const tradingViewPayloadSchema = z.object({
  token: z.string().trim().min(16).max(256).optional(),
  symbol: z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9._:-]+$/),
  side: z.string().trim().transform((value) => value.toUpperCase()).pipe(z.enum(['BUY', 'SELL', 'LONG', 'SHORT'])),
  entry_price: numericField,
  close_price: numericField,
  quantity: z.coerce.number().finite().gt(0).max(MAX_QUANTITY).optional().default(1),
  pnl: z.coerce.number().finite().min(-MAX_PNL).max(MAX_PNL).optional().default(0),
  entry_time: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? undefined : val,
    z.string().optional()
  ),
  close_time: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? undefined : val,
    z.string().optional()
  ),
  stop_loss: optionalNumericField,
  take_profit: optionalNumericField,
  comment: z.string().trim().max(500).optional(),
}).strict()

function parseWebhookDate(value: string | undefined) {
  const date = value ? new Date(value) : new Date()
  const now = Date.now()
  const earliest = Date.UTC(2000, 0, 1)
  const latest = now + 24 * 60 * 60 * 1000

  if (!Number.isFinite(date.getTime()) || date.getTime() < earliest || date.getTime() > latest) {
    throw new Error('Invalid trade timestamp')
  }

  return date
}

export async function POST(req: NextRequest) {
  const requestId = resolveRequestId(req.headers)
  const rl = await applyApiRoutePolicy(req, 'trusted-signed')
  if (rl) return rl

  try {
    const rawBody = await req.text()
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_WEBHOOK_BODY_BYTES) {
      return createErrorResponse('Payload too large', 413, undefined, 'PAYLOAD_TOO_LARGE')
    }

    let body: unknown
    try {
      body = JSON.parse(rawBody)
     } catch {
       return createErrorResponse('Invalid JSON body', 400, undefined, 'INVALID_JSON')
     }

    const parsed = tradingViewPayloadSchema.safeParse(body)
    if (!parsed.success) {
      return createErrorResponse('Validation failed', 400, parsed.error.flatten(), 'VALIDATION_ERROR')
    }

    const payload = parsed.data
    const entryDate = parseWebhookDate(payload.entry_time)
    const closeDate = parseWebhookDate(payload.close_time)

    if (closeDate.getTime() < entryDate.getTime()) {
      return createErrorResponse('close_time must be after entry_time', 400, undefined, 'INVALID_TRADE_TIME_RANGE')
    }

    const url = new URL(req.url)
    const urlToken = url.searchParams.get('token')
    const token = payload.token || urlToken

    if (!token || typeof token !== 'string' || token.trim().length < 16 || token.trim().length > 256) {
      return createErrorResponse('Valid webhook token is required in query parameter or request body', 400, undefined, 'TOKEN_REQUIRED')
    }

    const userSettings = await db.query.UserSettings.findFirst({
      where: (table, { eq }) => eq(table.webhookToken, token.trim()),
      columns: { userId: true },
    }).catch(() => null)

    if (!userSettings) {
      return createErrorResponse('Invalid or expired webhook token', 401, undefined, 'INVALID_WEBHOOK_TOKEN')
    }

    const defaultAccount = await db.query.Account.findFirst({
      where: (table, { eq, and }) => and(
        eq(table.userId, userSettings.userId),
        eq(table.isArchived, false)
      ),
      orderBy: (table, { asc }) => [asc(table.createdAt)],
      columns: { id: true, number: true },
    })

    if (!defaultAccount) {
      return createErrorResponse('No account found - create an account first', 422, undefined, 'ACCOUNT_REQUIRED')
    }

    const tradeId = nanoid()
    const symbol = payload.symbol.toUpperCase()
    const entryIso = entryDate.toISOString()
    const closeIso = closeDate.toISOString()
    const tradeIdentityKey = `tv-${symbol}-${entryIso}-${tradeId}`

    await db.transaction(async (tx) => {
      await tx.insert(schema.Trade).values({
        id: tradeId,
        userId: userSettings.userId,
        accountId: defaultAccount.id,
        accountNumber: defaultAccount.number,
        instrument: symbol,
        symbol,
        side: payload.side,
        entryPrice: String(payload.entry_price),
        closePrice: String(payload.close_price),
        entryPriceValue: payload.entry_price,
        closePriceValue: payload.close_price,
        quantity: payload.quantity,
        pnl: payload.pnl,
        entryDate: entryIso,
        closeDate: closeIso,
        entryTime: entryDate,
        exitTime: closeDate,
        stopLoss: payload.stop_loss ? String(payload.stop_loss) : null,
        stopLossValue: payload.stop_loss ?? null,
        takeProfit: payload.take_profit ? String(payload.take_profit) : null,
        takeProfitValue: payload.take_profit ?? null,
        comment: payload.comment || 'Imported via TradingView webhook',
        tradeIdentityKey,
        timeInPosition: Math.max(0, Math.floor((closeDate.getTime() - entryDate.getTime()) / 1000)),
      } as any)
      await recordAuditEvent({
        userId: userSettings.userId,
        action: 'TRADE_CREATED',
        entityType: 'Trade',
        entityId: tradeId,
        source: 'api',
        requestId,
        afterData: {
          source: 'tradingview-webhook',
          accountId: defaultAccount.id,
          instrument: symbol,
          side: payload.side,
          quantity: payload.quantity,
          pnl: payload.pnl,
        },
      }, tx as never)
    })

    return createSuccessResponse({ tradeId }, `Trade imported: ${symbol} ${payload.side}`)
  } catch (err: any) {
    reportError(err, {
      surface: 'api',
      operation: 'import-tradingview-webhook',
      route: new URL(req.url).pathname,
      requestId,
    })
    return createErrorResponse('Internal server error', 500)
  }
}

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: 'Method not allowed',
      info: 'Send a POST request with your TradingView alert payload. Get your unique webhook URL from Settings → Import → TradingView Webhook.',
    },
    { status: 405 }
  )
}
