import { type InferSelectModel } from 'drizzle-orm'
import { Trade as schemaTrade } from '@/lib/db/schema'

export type Trade = InferSelectModel<typeof schemaTrade>

export interface ExtendedTrade extends Omit<Trade, 'chartLinks'> {
    tags: string[] | any; // Handling the array/string ambiguity from the audit report
    selectedNews: string | null;
    selectedRules: string[] | null;
    chartLinks: string[];
    marketBias: MarketBias | null;
}

export type MarketBias = 'BULLISH' | 'BEARISH' | 'UNDECIDED'

export type TradeOutcome = 'GOOD_WIN' | 'BAD_WIN' | 'GOOD_BE' | 'BAD_BE' | 'GOOD_LOSS' | 'BAD_LOSS'
