'use server'

import YahooFinance from 'yahoo-finance2'
import { YAHOO_FINANCE_SYMBOL_MAP, FOREX_PAIRS } from '@/lib/constants'
import { YahooFinanceQuote } from '@/types/yahoo-finance'
import { getUserId } from '@/server/auth'
import { getCached, setCached, CachePrefix, CacheTTL } from '@/lib/cache/unified-cache'
import { logger } from '@/lib/logger';

const yahooFinance = new YahooFinance()

/**
 * Manual fetch wrapper to bypass IP blocks/rate limits by spoofing browser headers.
 */
async function fetchMarketDataManual(symbol: string, options: any): Promise<any> {
    const { period1, period2, interval } = options;
    const p1 = Math.floor(new Date(period1).getTime() / 1000);
    const p2 = Math.floor(new Date(period2).getTime() / 1000);
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?useYfid=true&interval=${interval}&includePrePost=true&events=div%7Csplit%7Cearn&lang=en-US&period1=${p1}&period2=${p2}`;

    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Browser/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
        },
        next: { revalidate: 300 } // Cache for 5 mins at Next.js level
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text.substring(0, 100)}`);
    }

    return await response.json();
}

// Global map to join concurrent identical requests in the same process
const inFlightRequests = new Map<string, Promise<{ data: CandleData[], error?: string }>>()

export interface CandleData {
    time: number
    open: number
    high: number
    low: number
    close: number
}

/**
 * Supported Yahoo Finance Intervals:
 * Intraday: 1m (7d limit), 2m, 5m, 15m, 30m, 60m, 90m (60d limit)
 * Hour: 1h (730d limit)
 * Daily+: 1d, 5d, 1wk, 1mo, 3mo
 */

export async function getMarketData(
    rawSymbol: string,
    interval: '1m' | '2m' | '5m' | '15m' | '30m' | '1h' | '1d' = '5m',
    startDate?: Date,
    endDate?: Date,
    tradeId?: string,
    forceRefresh: boolean = false
): Promise<{ data: CandleData[], error?: string }> {
    // NORMALIZE SYMBOL: Strip broker suffixes (e.g. XAUUSDm -> XAUUSD, NAS100.x -> NAS100)
    // 1. Remove trailing lowercase letters (often broker suffixes like 'm', 'c', 'pro')
    // 2. Remove anything after a dot or underscore if it looks like a suffix
    let symbol = rawSymbol.trim();

    // If it's not a pair that is naturally mixed case or lowercase (crypto/forex are usually uppercase)
    // We assume the base symbol should be uppercase.

    // Regex to capture the base symbol:
    // ^([A-Z0-9]+) -> Starts with uppercase alphanumerics
    // (?:[._][a-zA-Z0-9]+)? -> Optional suffix starting with . or _
    // [a-z]*$ -> Optional trailing lowercase letters directly attached

    // Simple heuristic: If it ends with lowercase letters, strip them.
    // E.g. XAUUSDm -> XAUUSD
    if (/[A-Z]+[a-z]+$/.test(symbol)) {
        symbol = symbol.replace(/[a-z]+$/, '');
    }

    if (symbol.includes('.') || symbol.includes('_')) {
        symbol = symbol.split(/[._]/)[0] ?? symbol;
    }

    symbol = symbol.toUpperCase();

    const startStr = startDate ? startDate.toISOString().split('T')[0] : 'default'
    const endStr = endDate ? endDate.toISOString().split('T')[0] : 'now'
    const requestKey = `${symbol}:${startStr}:${endStr}:${interval}`

    // JOIN CONCURRENT REQUESTS
    if (inFlightRequests.has(requestKey) && !forceRefresh) {
        return inFlightRequests.get(requestKey)!
    }

    const fetchPromise = (async () => {
        try {
            // DB Connectivity Check wrap to prevent hard crashes if Supabase is down
            try {
                await getUserId()
            } catch (dbError: any) {
                logger.error(`[DB_CHECK_FAILED] ${dbError.message}`);
                if (dbError.message?.includes('P1001') || dbError.message?.includes('Can\'t reach database')) {
                    logger.warn('Proceeding with market data fetch despite potential DB connection issue...');
                } else {
                    throw dbError;
                }
            }

            // Map common symbols to Yahoo Finance tickers
            let querySymbol = symbol.toUpperCase()

            if (YAHOO_FINANCE_SYMBOL_MAP[querySymbol]) {
                querySymbol = YAHOO_FINANCE_SYMBOL_MAP[querySymbol] ?? querySymbol
            }

            if (querySymbol.length === 6 && FOREX_PAIRS.includes(querySymbol)) {
                querySymbol = `${querySymbol}=X`
            }

            if (querySymbol.endsWith('USDT')) querySymbol = `${querySymbol.replace('USDT', '-USD')}`
            else if (querySymbol === 'BTC') querySymbol = 'BTC-USD'
            else if (querySymbol === 'ETH') querySymbol = 'ETH-USD'

            // TIMEFRAME LIMITS & FALLBACKS
            const now = new Date()
            const diffDays = (now.getTime() - (startDate?.getTime() || now.getTime())) / (1000 * 60 * 60 * 24)

            // Dynamic intervals based on user requested list and Yahoo limits
            let intervalsToTry: string[] = []

            if (diffDays <= 7) {
                intervalsToTry = ['1m', '2m', '5m', '15m', '30m', '1h', '1d']
            } else if (diffDays <= 60) {
                // Yahoo says 1m is 7d, but sometimes 2m works up to 60d
                intervalsToTry = ['2m', '5m', '15m', '30m', '1h', '1d']
            } else if (diffDays <= 730) {
                intervalsToTry = ['1h', '1d']
            } else {
                intervalsToTry = ['1d']
            }

            // Ensure requested interval is first if valid
            if (intervalsToTry.includes(interval) && intervalsToTry[0] !== interval) {
                intervalsToTry = [interval, ...intervalsToTry.filter(i => i !== interval)]
            }

            // Cache lookup (base key for symbol/date range)
            const baseCacheKey = `${CachePrefix.MARKET_DATA}${querySymbol}:${startStr}:${endStr}`
            try {
                const cachedData = await getCached<CandleData[]>(baseCacheKey)
                if (cachedData && cachedData.length > 0) {
                    return { data: cachedData }
                }
            } catch (cacheError) {
                logger.warn('Cache lookup failed: ' + (cacheError instanceof Error ? cacheError.message : String(cacheError)))
            }

            let lastError = ''
            for (const queryInterval of intervalsToTry) {
                try {
                    let period1 = startDate ? new Date(startDate.getTime() - 24 * 60 * 60 * 1000) : new Date('2024-01-01')
                    if (queryInterval === '1h' || queryInterval === '1d') {
                        period1 = startDate ? new Date(startDate.getTime() - 30 * 24 * 60 * 60 * 1000) : period1
                    }

                    const queryOptions = {
                        period1,
                        period2: endDate ? new Date(endDate.getTime() + 24 * 60 * 60 * 1000) : new Date(),
                        interval: queryInterval as any
                    }

                    let result: any;
                    try {
                        result = await yahooFinance.chart(querySymbol, queryOptions);
                    } catch (libError: any) {
                        // If rate limited by lib, try manual fetch with spoofed headers
                        if (libError.message?.toLowerCase().includes('429') || libError.message?.toLowerCase().includes('too many requests')) {
                            logger.warn(`[LIB_RATE_LIMIT] Switching to manual fetch for ${querySymbol} at ${queryInterval}...`);
                            result = await fetchMarketDataManual(querySymbol, queryOptions);
                        } else {
                            throw libError;
                        }
                    }

                    // Process Results (Support both lib and manual format)
                    let sourceQuotes = result?.quotes;
                    if (!sourceQuotes && result?.chart?.result?.[0]) {
                        const res = result.chart.result[0];
                        sourceQuotes = res.timestamp?.map((t: number, i: number) => ({
                            date: new Date(t * 1000),
                            open: res.indicators.quote[0].open?.[i],
                            high: res.indicators.quote[0].high?.[i],
                            low: res.indicators.quote[0].low?.[i],
                            close: res.indicators.quote[0].close?.[i],
                        })).filter((q: any) => q.open != null && q.close != null);
                    }

                    if (sourceQuotes && sourceQuotes.length > 0) {
                        const candles = sourceQuotes
                            .filter((q: any) => q.open != null && q.close != null && q.date != null)
                            .map((q: any) => ({
                                time: Math.floor(new Date(q.date).getTime() / 1000),
                                open: q.open,
                                high: q.high,
                                low: q.low,
                                close: q.close,
                            }));

                            if (candles.length > 0) {
                            const ttl = diffDays > 1 ? CacheTTL.EXTRA_LONG : CacheTTL.MEDIUM
                            await setCached(baseCacheKey, candles, ttl)
                            return { data: candles }
                        }
                    }

                    logger.warn(`[FETCH_EMPTY] ${queryInterval} on ${querySymbol}`)
                } catch (e: any) {
                    logger.error(`[FETCH_ERROR] ${queryInterval} for ${querySymbol}:`, e.message)

                    if (e.message.includes('Too Many Requests') || e.message.includes('429')) {
                        logger.warn(`[RATE_LIMIT] Yahoo is throttling both lib and manual. Cooling down for 3s...`)
                        await new Promise(resolve => setTimeout(resolve, 3000))
                        lastError = 'Rate Limit Exceeded. Waiting for fallback...'
                        continue
                    }

                    lastError = e.message
                    await new Promise(resolve => setTimeout(resolve, 1000))
                    continue
                }
            }

            return { data: [], error: lastError || 'No market data found' }

        } catch (e: any) {
            logger.error('Yahoo Finance API Error:', e)
            return { data: [], error: e.message || 'Failed to fetch market data' }
        } finally {
            // Clean up in-flight request after completion
            inFlightRequests.delete(requestKey)
        }
    })()

    inFlightRequests.set(requestKey, fetchPromise)
    return fetchPromise
}
