import { createOpenAI } from "@ai-sdk/openai";
import { streamObject } from "ai";
import { NextRequest } from "next/server";
import { NextResponse } from 'next/server'
import { mappingSchema } from "./schema";
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { hasCurrentAiDataConsent } from '@/lib/services/ai-consent'
import { z } from 'zod'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'


export const maxDuration = 30;


const xai = createOpenAI({
  apiKey: process.env.XAI_API_KEY || '',
  baseURL: process.env.XAI_BASE_URL || 'https://api.x.ai/v1',
});


const FIELD_HINTS = {
  instrument: ['symbol', 'ticker', 'asset', 'pair', 'contract', 'market', 'product', 'security', 'name', 'underlying', 'sym', 'instr', 'currency pair'],
  entryId: ['id', 'trade id', 'order id', 'ticket', 'position id', 'deal', 'execution id', 'ref', 'reference', 'trade number', 'order number', 'ticket number'],
  quantity: ['volume', 'qty', 'size', 'lots', 'contracts', 'amount', 'shares', 'units', 'position size', 'trade size', 'order qty'],
  entryPrice: ['open price', 'entry', 'buy price', 'avg entry', 'fill price', 'executed price', 'open', 'price open', 'entry avg', 'average entry'],
  closePrice: ['close price', 'exit', 'sell price', 'close', 'exit price', 'price close', 'avg exit', 'average exit', 'closing price'],
  entryDate: ['open time', 'entry time', 'entry date', 'date opened', 'open date', 'time open', 'trade date', 'execution time', 'buy date', 'filled at'],
  closeDate: ['close time', 'exit time', 'exit date', 'date closed', 'close date', 'time close', 'closed at', 'sell date', 'execution close time'],
  pnl: ['profit', 'p&l', 'pnl', 'net pnl', 'net profit', 'gross pnl', 'realized pnl', 'gain', 'loss', 'result', 'return', 'gross profit', 'net result'],
  timeInPosition: ['duration', 'time in trade', 'holding time', 'trade duration', 'position time', 'time held', 'hold time'],
  side: ['direction', 'type', 'action', 'buy/sell', 'long/short', 'trade type', 'order type', 'trade side', 'position type'],
  commission: ['fee', 'fees', 'comm', 'trading fee', 'brokerage', 'charges', 'costs', 'swap', 'transaction fee', 'execution fee'],
  stopLoss: ['sl', 'stop', 'stop price', 'stop loss price', 'stoploss', 'protective stop', 'stop level'],
  takeProfit: ['tp', 'target', 'take profit price', 'profit target', 'limit', 'target price', 'profit level'],
  closeReason: ['reason', 'close reason', 'exit reason', 'type', 'closure', 'trade result', 'exit type', 'closed by']
}

const mappingRequestSchema = z.object({
  fieldColumns: z.array(z.string().min(1).max(128)).min(1).max(100),
  firstRows: z.array(z.record(z.string().max(512))).max(10),
}).strict()

export async function POST(req: NextRequest) {
  const requestId = resolveRequestId(req.headers)
  const rateLimitRes = await applyApiRoutePolicy(req)
  if (rateLimitRes) return rateLimitRes

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!(await hasCurrentAiDataConsent(identity.internalUserId))) {
      return NextResponse.json({ error: 'AI data processing consent is required', code: 'AI_DATA_CONSENT_REQUIRED' }, { status: 412 })
    }

    const { fieldColumns, firstRows } = mappingRequestSchema.parse(await req.json())

    const result = streamObject({
      model: xai(process.env.XAI_MODEL || "grok-4-1-fast-reasoning"),
      schema: mappingSchema,
      system: `You are an expert CSV column mapping assistant for a professional trading journal system.
Your task is to intelligently map CSV column headers to the correct database fields.

FIELD DEFINITIONS AND VARIATIONS:
${Object.entries(FIELD_HINTS).map(([field, hints]) => `- ${field}: ${hints.join(', ')}`).join('\n')}

CRITICAL MAPPING RULES:
1. 'instrument' is the PRIMARY field for trading symbols (EURUSD, NQ, ES, XAUUSD, etc.) - always map the main symbol column here
2. 'symbol' is OPTIONAL - only use if there's a secondary symbol field; usually leave empty
3. 'entryId' maps to unique identifiers like ID, Ticket, Order Number
4. NEVER map account numbers or account-related columns - account linking is handled separately
5. Consider the DATA VALUES to help identify columns (e.g., if values look like "BUY/SELL" or "LONG/SHORT", it's 'side')
6. If a column could match multiple fields, use context from the data to decide
7. Omit mapping if genuinely uncertain - do not guess

PLATFORM-SPECIFIC PATTERNS:
- MetaTrader: Uses "Symbol", "Type" (for side), "Volume", "Open Time", "Close Time", "Profit"
- NinjaTrader: Uses "Instrument", "Market pos.", "Qty", "Entry time", "Exit time", "Profit"  
- Tradovate: Uses "contractId", "netPrice", "fillTime", "qty", "action"
- cTrader: Uses "Symbol", "Direction", "Volume", "Entry Time", "Close Time", "Net Profit"
- TradingView: Uses "Symbol", "Side", "Contracts", "Avg Price", "Date/Time"
- FTMO/Prop Firms: Often use "Symbol", "Type", "Lots", "Open Time", "Close Time", "Profit"`,
      prompt: `Map these CSV columns to database fields.

COLUMNS AVAILABLE:
${fieldColumns.join(", ")}

SAMPLE DATA (first few rows):
${firstRows.map((row: Record<string, string>) => JSON.stringify(row)).join("\n")}

Analyze the column names AND the sample data values to make accurate mappings. Return only confident mappings.`,
      temperature: 0.1,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'stream-ai-column-mappings',
      route: req.nextUrl.pathname,
      requestId,
    })
    return new Response(JSON.stringify({ error: "Failed to generate mappings" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
