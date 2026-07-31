import { NextRequest, NextResponse } from 'next/server'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import { db } from '@/lib/db/client'
import { format } from 'date-fns'
import { USER_SETTINGS_SELECT, mergeUserSettings } from '@/lib/user-settings'

export async function GET(request: NextRequest) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    const internalUserId = identity.internalUserId

    // Fetch all user data in parallel
    const [
      user,
      accounts,
      trades,
      groups,
      masterAccounts,
      dailyNotes,
      backtestTrades,
      tags,
      liveAccountTransactions
    ] = await Promise.all([
      db.query.User.findFirst({
        where: (table, { eq }) => eq(table.id, internalUserId),
        with: {
          settings: true
        }
      }),
      db.query.Account.findMany({
        where: (table, { eq }) => eq(table.userId, internalUserId)
      }),
      db.query.Trade.findMany({
        where: (table, { eq }) => eq(table.userId, internalUserId)
      }),
      // Groups removed - no longer used
      Promise.resolve([]),
      db.query.MasterAccount.findMany({
        where: (table, { eq }) => eq(table.userId, internalUserId),
        with: {
          PhaseAccount: {
            with: {
              Trade: true,
              BreachRecord: true,
              Payout: true,
              DailyAnchor: true
            }
          },
          Payout: true
        }
      }),
      db.query.DailyNote.findMany({
        where: (table, { eq }) => eq(table.userId, internalUserId)
      }),
      db.query.BacktestTrade.findMany({
        where: (table, { eq }) => eq(table.userId, internalUserId)
      }),
      db.query.TradeTag.findMany({
        where: (table, { eq }) => eq(table.userId, internalUserId)
      }),
      db.query.LiveAccountTransaction.findMany({
        where: (table, { eq }) => eq(table.userId, internalUserId)
      })
    ])

    // Build comprehensive backup object
    const backupData = {
      metadata: {
        backupVersion: '1.0',
        exportedAt: new Date().toISOString(),
        platform: 'JJI',
        userId: identity.authUserId,
        userEmail: user?.email || 'unknown',
        note: 'This backup is for archival purposes only. It cannot be reimported.'
      },
      user: user ? {
        email: user.email,
        ...mergeUserSettings(user as any, (user as any).settings)
      } : null,
      statistics: {
        totalAccounts: accounts.length,
        totalTrades: trades.length,
        totalGroups: groups.length,
        totalPropFirmAccounts: masterAccounts.length,
        totalBacktestTrades: backtestTrades.length,
        totalTags: tags.length,
        totalPnL: trades.reduce(
          (sum: number, t: typeof trades[number]) => sum + (t.pnl || 0),
          0
        ),
        totalFees: trades.reduce(
          (sum: number, t: typeof trades[number]) => sum + (t.commission || 0),
          0
        ),
      },
      accounts: accounts.map((acc: typeof accounts[number]) => ({
        id: acc.id,
        number: acc.number,
        name: acc.name,
        broker: acc.broker,
        startingBalance: acc.startingBalance,
        groupName: null, // Groups removed - no longer used
        createdAt: acc.createdAt,
        isArchived: acc.isArchived
      })),
      propFirmAccounts: masterAccounts.map((master: typeof masterAccounts[number]) => ({
        id: master.id,
        accountName: master.accountName,
        propFirmName: master.propFirmName,
        accountSize: master.accountSize,
        evaluationType: master.evaluationType,
        status: master.status,
        currentPhase: master.currentPhase,
        createdAt: master.createdAt,
        phases: master.PhaseAccount.map(
          (phase: (typeof master.PhaseAccount)[number]) => ({
            phaseNumber: phase.phaseNumber,
            phaseId: phase.phaseId,
            status: phase.status,
            profitTargetPercent: phase.profitTargetPercent,
            dailyDrawdownPercent: phase.dailyDrawdownPercent,
            maxDrawdownPercent: phase.maxDrawdownPercent,
            profitSplitPercent: phase.profitSplitPercent,
            tradeCount: phase.Trade.length,
            breaches: phase.BreachRecord.map((b: (typeof phase.BreachRecord)[number]) => ({
              type: b.breachType,
              amount: b.breachAmount,
              date: b.breachTime,
            })),
            payouts: phase.Payout.map((p: (typeof phase.Payout)[number]) => ({
              amount: p.amount,
              status: p.status,
              requestDate: p.requestDate,
              paidDate: p.paidDate,
            })),
          })
        ),
      })),
      trades: trades.map((t: typeof trades[number]) => ({
        id: t.id,
        accountNumber: t.accountNumber,
        instrument: t.instrument,
        side: t.side,
        quantity: t.quantity,
        entryDate: t.entryDate,
        closeDate: t.closeDate,
        entryPrice: t.entryPrice,
        closePrice: t.closePrice,
        pnl: t.pnl,
        commission: t.commission,
        timeInPosition: t.timeInPosition,
        comment: t.comment,
        cardPreviewImage: t.cardPreviewImage,
        cardPreviewTransform: t.cardPreviewTransform,
        tags: t.tags || []
      })),
      groups: [], // Groups removed - no longer used
      tags: tags.map((t: typeof tags[number]) => ({
        id: t.id,
        name: t.name,
        color: t.color,
        createdAt: t.createdAt
      })),
      dailyNotes: dailyNotes.map((n: typeof dailyNotes[number]) => ({
        date: n.date,
        note: n.note,
        emotion: n.emotion
      })),
      backtestTrades: backtestTrades.map((bt: typeof backtestTrades[number]) => ({
        id: bt.id,
        pair: bt.pair,
        direction: bt.direction,
        outcome: bt.outcome,
        session: bt.session,
        model: bt.model,
        pnl: bt.pnl,
        riskRewardRatio: bt.riskRewardRatio,
        dateExecuted: bt.dateExecuted,
        notes: bt.notes
      })),
      transactions: liveAccountTransactions.map((t: typeof liveAccountTransactions[number]) => ({
        accountId: t.accountId,
        type: t.type,
        amount: t.amount,
        date: t.createdAt
      }))
    }

    // Generate filename
    const timestamp = format(new Date(), 'yyyy-MM-dd_HHmmss')
    const filename = `jji-backup-${timestamp}.json`

    return new NextResponse(JSON.stringify(backupData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache'
      }
    })

  } catch (error) {
    logger.error({ error, layer: 'Backup' }, 'Backup generation failed')
    return NextResponse.json(
      { success: false, error: 'Failed to generate backup' },
      { status: 500 }
    )
  }
}