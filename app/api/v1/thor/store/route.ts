import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { saveTradesForUser } from '@/server/trades/save';
import { eq, and, gte, lte, desc, count } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { consumeRateLimitKey, thorLimiter } from '@/lib/rate-limiter';
import { getClientIp } from '@/lib/security/client-ip';

// Common authentication function to use across all methods
async function authenticateRequest(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const { allowed } = await consumeRateLimitKey(`thor:${ip}`, thorLimiter);
  if (!allowed) {
    return {
      authenticated: false,
      error: {
        message: 'Rate limit exceeded. Too many requests.',
        status: 429
      }
    };
  }

  const authHeader = req.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { 
      authenticated: false, 
      error: {
        message: 'No valid authorization token found',
        status: 401
      }
    };
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    // Verify the token by finding the user
    const user = await db.query.User.findFirst({
      where: eq(schema.User.thorToken as any, token)
    });
    
    if (!user) {
      return { 
        authenticated: false, 
        error: {
          message: 'No user found with the provided token',
          status: 401
        }
      };
    }
    
    return { authenticated: true, user };
  } catch (error) {
    return {
      authenticated: false,
      error: {
        message: 'Database error during authentication',
        status: 500
      }
    };
  }
}

interface ThorTrade {
  symbol: string
  pnl: number
  pnltick: number
  entry_time: string
  exit_time: string
  entry_price: number
  exit_price: number
  quantity: number
  side: 'Buy' | 'Sell'
  is_shared: boolean
}

interface ThorDate {
  date: string
  trades: ThorTrade[]
}

interface ThorRequest {
  account_id: string
  dates: ThorDate[]
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    
    if (!auth.authenticated) {
      return NextResponse.json({ 
        error: 'Unauthorized', 
        message: auth.error?.message 
      }, { status: auth.error?.status || 401 });
    }
    
    const user = auth.user!;
    const data: ThorRequest = await req.json();
    
    // Transform the data to match the Trade schema
    const trades: any[] = data.dates.flatMap(dateData => 
      dateData.trades.map(trade => {
        const entryTime = new Date(trade.entry_time)
        const exitTime = new Date(trade.exit_time)
        const timeInPosition = Math.round((exitTime.getTime() - entryTime.getTime()) / 1000) // in seconds

        return {
          id: `${dateData.date}-${trade.symbol}-${trade.entry_time}-${trade.quantity}`,
          userId: user.id,
          accountNumber: data.account_id,
          instrument: trade.symbol.slice(0, -2),
          entryDate: entryTime.toISOString(),
          closeDate: exitTime.toISOString(),
          entryPrice: trade.entry_price.toString(),
          closePrice: trade.exit_price.toString(),
          quantity: Math.abs(trade.quantity),
          side: trade.quantity > 0 ? 'Long' : 'Short',
          pnl: trade.pnl,
          timeInPosition,
          commission: 0,
          tags: [],
          comment: null,
          videoUrl: null,
          entryId: null,
          closeId: null,
          imageBase64: null,
          imageBase64Second: null,
          createdAt: new Date(),
        }
      })
    )

    const requestId = req.headers.get('x-request-id')
    const result = await saveTradesForUser(user.id, trades as any[], {
      source: 'api',
      ...(requestId ? { requestId } : {}),
    })

    if (result.error && result.error !== 'DUPLICATE_TRADES') {
      return NextResponse.json(
        { error: result.error, details: result.details },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      tradesAdded: result.numberOfTradesAdded,
    })

  } catch (error) {
    logger.error('[thor/store] Error processing request: ' + error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    
    if (!auth.authenticated) {
      return NextResponse.json({ 
        error: 'Unauthorized', 
        message: auth.error?.message 
      }, { status: auth.error?.status || 401 });
    }
    
    const user = auth.user!;
    
    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const accountNumber = searchParams.get('accountNumber');
    
    if (!accountNumber) {
      return NextResponse.json({ 
        error: 'Bad Request', 
        message: 'accountNumber parameter is required' 
      }, { status: 400 });
    }
    
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;
    const fromDate = searchParams.get('from');
    const toDate = searchParams.get('to');
    
    // Build conditions
    const conditions = [
      eq(schema.Trade.userId, user.id),
      eq(schema.Trade.accountNumber, accountNumber)
    ];
    
    if (fromDate) {
      conditions.push(gte(schema.Trade.entryDate, new Date(fromDate).toISOString()));
    }
    
    if (toDate) {
      conditions.push(lte(schema.Trade.entryDate, new Date(toDate).toISOString()));
    }
    
    // Get trades
    const trades = await db.query.Trade.findMany({
      where: (table, { and }) => and(...conditions),
      orderBy: (table, { desc }) => [desc(table.entryDate)],
      limit,
      offset
    });
    
    // Get total count for pagination
    const totalCountResult = await db.select({ count: count() })
      .from(schema.Trade)
      .where(and(...conditions));
    const totalCount = totalCountResult[0]?.count || 0;
    
    return NextResponse.json({ 
      success: true, 
      data: {
        trades,
        pagination: {
          total: totalCount,
          limit,
          offset
        }
      }
    }, { status: 200 });
    
  } catch (error) {
    logger.error('[thor/store] Error retrieving trades: ' + error);
    return NextResponse.json({ 
      error: 'Failed to retrieve trades', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    
    if (!auth.authenticated) {
      return NextResponse.json({ 
        error: 'Unauthorized', 
        message: auth.error?.message 
      }, { status: auth.error?.status || 401 });
    }
    
    const user = auth.user!;
    
    // Get accountNumber from query parameters
    const searchParams = req.nextUrl.searchParams;
    const accountNumber = searchParams.get('accountNumber');
    
    if (!accountNumber) {
      return NextResponse.json({ 
        error: 'Bad Request', 
        message: 'accountNumber parameter is required' 
      }, { status: 400 });
    }
    
    // Delete trades for this user and specific account
    const result = await db.delete(schema.Trade)
      .where(and(
        eq(schema.Trade.userId, user.id),
        eq(schema.Trade.accountNumber, accountNumber)
      ))
      .returning();
    
    return NextResponse.json({
      success: true,
      message: `${result.length} trades deleted successfully for account ${accountNumber}`
    }, { status: 200 });
    
  } catch (error) {
    logger.error('[thor/store] Error deleting trades: ' + error);
    return NextResponse.json({ 
      error: 'Failed to delete trades', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
