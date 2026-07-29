import { NextResponse } from 'next/server';
import yahooFinance from 'yahoo-finance2';
import { getUserIdSafe } from '@/server/auth';

export async function GET(request: Request) {
  try {
    const userId = await getUserIdSafe();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const symbol = searchParams.get('symbol')
    const period1 = searchParams.get('period1')
    const period2 = searchParams.get('period2')
    const interval = searchParams.get('interval') || '1m'

    if (!symbol || !period1 || !period2) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    // Map common futures/indices symbols to Yahoo Finance symbols
    let yfSymbol = symbol.toUpperCase()
    const symbolMap: Record<string, string> = {
      'ES': 'ES=F',
      'NQ': 'NQ=F',
      'YM': 'YM=F',
      'RTY': 'RTY=F',
      'MES': 'MES=F',
      'MNQ': 'MNQ=F',
      'MYM': 'MYM=F',
      'M2K': 'M2K=F',
      'CL': 'CL=F',
      'GC': 'GC=F',
      'EURUSD': 'EURUSD=X',
      'GBPUSD': 'GBPUSD=X',
      'USDJPY': 'USDJPY=X',
      'SPX': '^GSPC',
      'NDX': '^NDX',
    }
    
    const mappedSymbol = symbolMap[yfSymbol]
    if (mappedSymbol) {
      yfSymbol = mappedSymbol
    } else if (yfSymbol.includes('/')) { // e.g. BTC/USD -> BTC-USD
      yfSymbol = yfSymbol.replace('/', '-')
    }

    const queryOptions = {
      period1: new Date(period1),
      period2: new Date(period2),
      interval: interval as any,
    }

    const result = await yahooFinance.chart(yfSymbol, queryOptions)

    if (!result || !result.quotes || result.quotes.length === 0) {
      return NextResponse.json({ error: 'No data found' }, { status: 404 })
    }

    const ohlcData = result.quotes.map(quote => ({
      time: Math.floor(new Date(quote.date).getTime() / 1000),
      open: quote.open,
      high: quote.high,
      low: quote.low,
      close: quote.close,
      volume: quote.volume
    })).filter(quote => quote.open != null && quote.close != null)

    return NextResponse.json(ohlcData)

  } catch (error: any) {
    console.error('Yahoo Finance API Error:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch market data' }, { status: 500 })
  }
}
