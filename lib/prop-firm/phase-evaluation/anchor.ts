import { getDateInTimezone, getNetPnl } from '@/lib/prop-firm/phase-evaluation/breach'
import type { PhaseTradeInput } from '@/lib/prop-firm/phase-evaluation/types'

export function getDailyAnchorDate(
  evaluatedAt: Date,
  timezone: string,
): Date {
  const date = getDateInTimezone(evaluatedAt, timezone)
  return new Date(`${date}T00:00:00.000Z`)
}

export function calculateDailyAnchorEquity(
  accountSize: number,
  tradesBeforeAnchor: PhaseTradeInput[],
): number {
  return accountSize + tradesBeforeAnchor.reduce(
    (sum, trade) => sum + getNetPnl(trade),
    0,
  )
}

export function resolveDailyAnchorValue(
  insertedAnchor: number | null | undefined,
  concurrentAnchor: number | null | undefined,
  fallbackBalance: number,
): number {
  return insertedAnchor ?? concurrentAnchor ?? fallbackBalance
}
