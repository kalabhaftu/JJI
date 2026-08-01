import { createOpenAI } from "@ai-sdk/openai";
import { streamObject } from "ai";
import { NextRequest } from "next/server";
import { tradeSchema } from "./schema";
import { z } from "zod";
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { logger } from '@/lib/logger'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { hasCurrentAiDataConsent } from '@/lib/services/ai-consent'
import { NextResponse } from 'next/server'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'

export const maxDuration = 30;

// Initialize xAI provider (OpenAI-compatible)
const xai = createOpenAI({
  apiKey: process.env.XAI_API_KEY || '',
  baseURL: process.env.XAI_BASE_URL || 'https://api.x.ai/v1',
});

const requestSchema = z.object({
  headers: z.array(z.string().min(1).max(128)).min(1).max(100),
  rows: z.array(z.array(z.string().max(512)).max(100)).max(100, "Too many rows to process")
}).strict();

export async function POST(req: NextRequest) {
  const requestId = resolveRequestId(req.headers)
  // Apply rate limiting
  const rateLimitResult = await applyApiRoutePolicy(req);
  if (rateLimitResult) return rateLimitResult;

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!(await hasCurrentAiDataConsent(identity.internalUserId))) {
      return NextResponse.json({ error: 'AI data processing consent is required', code: 'AI_DATA_CONSENT_REQUIRED' }, { status: 412 })
    }

    const body = await req.json();
    const { headers, rows } = requestSchema.parse(body);

    const result = streamObject({
      model: xai(process.env.XAI_MODEL || "grok-4-1-fast-reasoning"),
      schema: tradeSchema,
      output: 'array',
      system: `You are an elite trade data processing AI. Your job is to accurately parse and normalize trading data from various platforms into a standardized format.

## INSTRUMENT NORMALIZATION RULES (CRITICAL):
1. **Futures contracts**: Strip expiration codes and exchange suffixes
   - "ESH5" / "ESH25" / "ES.H25" / "ESH5@CME" → "ES"
   - "NQM5" / "NQM25" / "NQ.M25" → "NQ"
   - "MESH5" / "MES.H25" → "MES"
   - "MNQH5" / "MNQ.H25" → "MNQ"
   - "ZNH5" / "ZN@CBOT" → "ZN"
   - "GCJ5" / "GC.J25" → "GC"
   - "CLK5" / "CL.K25" → "CL"
2. **Forex pairs**: Keep as-is (EURUSD, GBPUSD, XAUUSD, USDJPY, etc.)
3. **Indices**: Normalize to short form (US500 → US500, SPX500 → US500)
4. **Crypto**: Keep pair format (BTCUSD, ETHUSD, etc.)

## SIDE/DIRECTION NORMALIZATION:
Map ANY of these to 'long': BUY, Buy, buy, LONG, Long, long, B, b, 1, "Market pos. = Long"
Map ANY of these to 'short': SELL, Sell, sell, SHORT, Short, short, S, s, -1, "Market pos. = Short"

## DATE/TIME PARSING:
Handle ALL common formats and convert to ISO 8601:
- "2025-06-03T13:33:12.172" → keep as-is
- "06/03/2025 13:33:12" → "2025-06-03T13:33:12"
- "03.06.2025 13:33:12" → "2025-06-03T13:33:12"
- "2025/06/03 13:33" → "2025-06-03T13:33:00"
- Unix timestamps (1717423992) → convert to ISO

## NUMERIC PARSING:
- Remove currency symbols: "$1,234.56" → 1234.56
- Handle parentheses for negatives: "(500.00)" → -500
- Preserve decimal precision
- PRESERVE negative quantities exactly (valid for short positions)

## P&L CALCULATION:
If P&L column exists, use it directly. If not, calculate from:
- Long: (closePrice - entryPrice) * quantity
- Short: (entryPrice - closePrice) * quantity

## DURATION CALCULATION:
Calculate timeInPosition in seconds from entryDate and closeDate.
If only one timestamp exists, set to 0.

## REQUIRED FIELDS (must have values):
- instrument (normalized symbol)
- side ('long' or 'short')
- entryDate (ISO string)
- closeDate (ISO string, can equal entryDate for scalps)
- entryPrice (string)
- closePrice (string)
- quantity (number, preserve sign)
- pnl (number)
- commission (number, default 0)

## OPTIONAL FIELDS (include if present):
- stopLoss, takeProfit (string - price levels)
- closeReason (string - "User", "Stop Loss", "Take Profit", "Partial Close", etc.)
- entryId (string - unique trade identifier)
- symbol (string - original symbol from CSV)

## FORBIDDEN:
- NEVER include accountNumber - account linking is handled separately by the UI
- NEVER fabricate data that doesn't exist in the source
- NEVER skip rows unless completely unparseable`,
      prompt: `Parse and normalize the following ${rows.length} trades.

HEADERS: ${headers.join(" | ")}

DATA:
${rows.map((row: string[], i: number) => `Row ${i + 1}: ${row.join(" | ")}`).join("\n")}

Return an array of normalized trade objects. Process ALL rows.`,
      temperature: 0.05,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({ error: error.errors }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    reportError(error, {
      surface: 'api',
      operation: 'stream-ai-trade-format',
      route: req.nextUrl.pathname,
      requestId,
    })
    return new Response(JSON.stringify({ error: "Invalid request format" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}
