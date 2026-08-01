import { Suspense } from 'react'
import { BacktestingClient } from './components/backtesting-client'
import { BacktestTrade } from '@/types/backtesting-types'
import { getUserId } from '@/server/auth/identity'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { BacktestingPageSkeleton } from './components/backtesting-page-skeleton'

// Enable ISR with 5 minute revalidation
export const revalidate = 300
// Note: PPR requires Next.js canary
// export const experimental_ppr = true

async function getBacktests(): Promise<BacktestTrade[]> {
  try {
    const userId = await getUserId()
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout
    
    try {
      const backtests = await db.query.BacktestTrade.findMany({
        where: (bt, { eq }) => eq(bt.userId, userId),
        orderBy: (bt, { desc }) => [desc(bt.createdAt)],
      })
      
      clearTimeout(timeoutId)

      return backtests.map((bt: typeof backtests[number]) => ({
        id: bt.id,
        pair: bt.pair,
        direction: bt.direction,
        outcome: bt.outcome,
        session: bt.session,
        model: bt.model,
        customModel: bt.customModel || "",
        riskRewardRatio: bt.riskRewardRatio,
        riskPoints: bt.riskPoints,
        rewardPoints: bt.rewardPoints,
        entryPrice: bt.entryPrice,
        stopLoss: bt.stopLoss,
        takeProfit: bt.takeProfit,
        exitPrice: bt.exitPrice,
        pnl: bt.pnl,
        images: [
          bt.imageOne,
          bt.imageTwo,
          bt.imageThree,
          bt.imageFour,
          bt.imageFive,
          bt.imageSix,
        ].filter(Boolean) as string[],
        cardPreviewImage: bt.cardPreviewImage || undefined,
        notes: bt.notes || undefined,
        tags: bt.tags || undefined,
        dateExecuted: bt.dateExecuted,
        backtestDate: bt.backtestDate || undefined,
        createdAt: bt.createdAt,
        updatedAt: bt.updatedAt,
      } as BacktestTrade))
    } catch (dbError) {
      clearTimeout(timeoutId)
      throw dbError
    }
  } catch (error) {
    
    return []
  }
}

export default async function BacktestingPage() {
  const backtests = await getBacktests()

  return (
    <Suspense fallback={<BacktestingPageSkeleton />}>
      <BacktestingClient initialBacktests={backtests} />
    </Suspense>
  )
}
