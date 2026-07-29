import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import { reportApiHandlerError } from '@/lib/api/canonical-handler'
import { PassThrough } from 'stream'
import { USER_SETTINGS_SELECT, mergeUserSettings } from '@/lib/user-settings'
import { eq, and, or, inArray, gte, lte, type SQL } from 'drizzle-orm'

import { fetchTrustedExportImage } from '@/lib/security/export-media'
import { z } from 'zod'

interface ArchiveError extends Error {
  code?: string
}

type ArchiveStream = Omit<NodeJS.ReadWriteStream, 'on'> & {
  append(source: Buffer | string, data: { name: string }): ArchiveStream
  finalize(): Promise<void>
  on(event: 'warning' | 'error', listener: (error: ArchiveError) => void): ArchiveStream
}

// Helper to sanitize and transform data
const sanitizeUser = (data: any) => {
  const { id, userId, auth_user_id, ...rest } = data
  return numberValuesToString(rest)
}

// Convert bigints/decimals to string/number if needed (though simple objects usually fine)
const numberValuesToString = (obj: any) => {
  return obj // Assuming standard JSON safe
}

const exportFiltersSchema = z.object({
  from: z.string().max(64).refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid from date').optional(),
  to: z.string().max(64).refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid to date').optional(),
  accountIds: z.array(z.string().min(1).max(256)).max(100).optional(),
  instruments: z.array(z.string().min(1).max(128)).max(100).optional(),
}).strict()

export async function POST(request: NextRequest) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const internalUserId = identity.internalUserId

    // Parse Filters
    let filters: z.infer<typeof exportFiltersSchema> = {}
    if (request.headers.get('content-type')?.includes('application/json')) {
      try {
        filters = exportFiltersSchema.parse(await request.json())
      } catch (e) {
        return NextResponse.json({ error: 'Invalid export filters' }, { status: 400 })
      }
    }

    const tradeConditions: SQL[] = [eq(schema.Trade.userId, internalUserId)]
    if (filters.from) tradeConditions.push(gte(schema.Trade.entryDate, filters.from))
    if (filters.to) tradeConditions.push(lte(schema.Trade.entryDate, filters.to))
    if (filters.accountIds?.length) {
      tradeConditions.push(or(
        inArray(schema.Trade.accountId, filters.accountIds),
        inArray(schema.Trade.phaseAccountId, filters.accountIds)
      )!)
    }
    if (filters.instruments?.length) {
      tradeConditions.push(inArray(schema.Trade.instrument, filters.instruments))
    }

    const ownedMasterAccountIds = db
      .select({ id: schema.MasterAccount.id })
      .from(schema.MasterAccount)
      .where(eq(schema.MasterAccount.userId, internalUserId))
    const ownedPhaseAccountIds = db
      .select({ id: schema.PhaseAccount.id })
      .from(schema.PhaseAccount)
      .innerJoin(
        schema.MasterAccount,
        eq(schema.PhaseAccount.masterAccountId, schema.MasterAccount.id)
      )
      .where(eq(schema.MasterAccount.userId, internalUserId))

    // Fetch absolutely everything for this user
    const [
      dbUser,
      accounts,
      masterAccounts,
      tradingModels,
      tradeTags,
      dailyNotes,
      weeklyReviews,
      trades,
      backtestTrades,
      dashboards,
      transactions,
      breachRecords,
      dailyAnchors,
      payouts,
      journalTemplates,
      notifications,
      weeklyAIReviews,
      userGoals,
      sharedReports,
      feedback,
      userGeoLogs,
      promoRedemptions
    ] = await Promise.all([
      db.query.User.findFirst({ 
        where: (table: any, { eq }: any) => eq(table.id, internalUserId),
        columns: {
          id: true,
          firstName: true,
          lastName: true,
        },
        with: {
          settings: {
            columns: USER_SETTINGS_SELECT
          }
        }
      } as any),
      db.query.Account.findMany({ where: (table, { eq }) => eq(table.userId, internalUserId) }),
      db.query.MasterAccount.findMany({
        where: (table, { eq }) => eq(table.userId, internalUserId),
        with: { PhaseAccount: true }
      }),
      db.query.TradingModel.findMany({ where: (table, { eq }) => eq(table.userId, internalUserId) }),
      db.query.TradeTag.findMany({ where: (table, { eq }) => eq(table.userId, internalUserId) }),
      db.query.DailyNote.findMany({ where: (table, { eq }) => eq(table.userId, internalUserId) }),
      db.query.WeeklyReview.findMany({ where: (table, { eq }) => eq(table.userId, internalUserId) }),
      db.query.Trade.findMany({ where: () => and(...tradeConditions) }),
      db.query.BacktestTrade.findMany({ where: (table, { eq }) => eq(table.userId, internalUserId) }),
      db.query.DashboardTemplate.findMany({ where: (table, { eq }) => eq(table.userId, internalUserId) }),
      db.query.LiveAccountTransaction.findMany({ where: (table, { eq }) => eq(table.userId, internalUserId) }),
      db.query.BreachRecord.findMany({
        where: (table) => inArray(table.phaseAccountId, ownedPhaseAccountIds),
        with: {
          PhaseAccount: {
            columns: {
              phaseId: true,
              phaseNumber: true,
            },
            with: {
              MasterAccount: { columns: { accountName: true } },
            },
          },
        },
      }),
      db.query.DailyAnchor.findMany({
        where: (table) => inArray(table.phaseAccountId, ownedPhaseAccountIds),
        with: {
          PhaseAccount: {
            columns: {
              phaseId: true,
              phaseNumber: true,
            },
            with: {
              MasterAccount: { columns: { accountName: true } },
            },
          },
        },
      }),
      db.query.Payout.findMany({
        where: (table) => inArray(table.masterAccountId, ownedMasterAccountIds),
        with: {
          MasterAccount: { columns: { accountName: true } },
          PhaseAccount: {
            columns: {
              phaseId: true,
              phaseNumber: true,
            },
            with: {
              MasterAccount: { columns: { accountName: true } },
            },
          },
        },
      }),
      db.query.JournalTemplate.findMany({ where: (table, { eq }) => eq(table.userId, internalUserId) }),
      db.query.Notification.findMany({ where: (table, { eq }) => eq(table.userId, internalUserId) }),
      db.query.WeeklyAIReview.findMany({ where: (table, { eq }) => eq(table.userId, internalUserId) }),
      db.query.UserGoal.findMany({ where: (table, { eq }) => eq(table.userId, internalUserId) }),
      db.query.SharedReport.findMany({ where: (table, { eq }) => eq(table.userId, internalUserId) }),
      db.query.Feedback.findMany({ where: (table, { eq }) => eq(table.userId, internalUserId) }),
      db.query.UserGeoLog.findMany({ where: (table, { eq }) => eq(table.userId, internalUserId) }),
      db.query.PromoRedemption.findMany({ where: (table, { eq }) => eq(table.userId, internalUserId) })
    ])

    const modelMap = new Map(
      tradingModels.map((m: typeof tradingModels[number]) => [m.id, m.name])
    )

    const manifest = {
      version: '3.0',
      exportedAt: new Date().toISOString(),
      user: dbUser ? mergeUserSettings(dbUser as any, (dbUser as any).settings) : null,
      accounts: accounts.map(sanitizeUser),
      masterAccounts: masterAccounts.map((ma: any) => ({
        ...sanitizeUser(ma),
        PhaseAccount: ma.PhaseAccount.map((p: any) => {
          const { id, masterAccountId, ...rest } = p
          return rest
        }),
      })),
      tradingModels: tradingModels.map(sanitizeUser),
      tradeTags: tradeTags.map(sanitizeUser),
      dailyNotes: dailyNotes.map(sanitizeUser),
      weeklyReviews: weeklyReviews.map(sanitizeUser),
      trades: trades.map((t: any) => {
        const { id, userId, accountId, phaseAccountId, modelId, ...rest } = t
        return {
          ...rest,
          originalId: id,
          modelName: modelId ? modelMap.get(modelId) : null,
        }
      }),
      backtestTrades: backtestTrades.map(sanitizeUser),
      dashboardTemplates: dashboards.map(sanitizeUser),
      liveAccountTransactions: transactions.map(sanitizeUser),
      breachRecords: breachRecords.map((br: any) => {
        const { id, phaseAccountId, PhaseAccount, ...rest } = br
        return {
          ...rest,
          phaseId: PhaseAccount?.phaseId,
          phaseNumber: PhaseAccount?.phaseNumber,
          accountName: PhaseAccount?.MasterAccount?.accountName,
        }
      }),
      dailyAnchors: dailyAnchors.map((da: any) => {
        const { id, phaseAccountId, PhaseAccount, ...rest } = da
        return {
          ...rest,
          phaseId: PhaseAccount?.phaseId,
          phaseNumber: PhaseAccount?.phaseNumber,
          accountName: PhaseAccount?.MasterAccount?.accountName,
        }
      }),
      payouts: payouts.map((p: any) => {
        const { id, masterAccountId, phaseAccountId, MasterAccount, PhaseAccount, ...rest } = p
        return {
          ...rest,
          accountName: MasterAccount?.accountName ?? PhaseAccount?.MasterAccount?.accountName,
          phaseId: PhaseAccount?.phaseId,
          phaseNumber: PhaseAccount?.phaseNumber,
        }
      }),
      journalTemplates: journalTemplates.map(sanitizeUser),
      notifications: notifications.map((notification: any) => {
        const { id, userId, ...rest } = notification
        return rest
      }),
      weeklyAIReviews: weeklyAIReviews.map(sanitizeUser),
      userGoals: userGoals.map(sanitizeUser),
      sharedReports: sharedReports.map((report: any) => {
        const { id, userId, slug, viewCount, lastViewedAt, ...rest } = report
        return rest
      }),
      feedback: feedback.map((item: any) => {
        const { id, userId, email, ipAddress, userAgent, ...rest } = item
        return rest
      }),
      userGeoLogs: userGeoLogs.map((log: any) => {
        const { id, userId, ipAddress, userAgent, ...rest } = log
        return rest
      }),
      promoRedemptions: promoRedemptions.map((redemption: any) => {
        const { id, userId, promoCodeId, ...rest } = redemption
        return rest
      })
    }

    // Set up Archive Stream
    const stream = new PassThrough()
    // Archiver 8 is ESM-only, while its current DefinitelyTyped package still
    // describes the removed callable default export.
    const archiverRuntime = await import('archiver') as unknown as {
      ZipArchive: new (options?: { zlib?: { level?: number } }) => ArchiveStream
    }
    const archive = new archiverRuntime.ZipArchive({ zlib: { level: 9 } })

    // Log archive warnings/errors
    archive.on('warning', (err) => {
      logger.warn('Archive warning: ' + (err instanceof Error ? err.message : String(err)))
    })
    archive.on('error', (err) => {
      reportApiHandlerError(request, err, 'stream-user-data-export')
      stream.destroy(err) // Kill the stream
    })

    // Pipe archive to response stream
    archive.pipe(stream)

    // Execute heavy lifting asynchronously
    const processArchive = async () => {
      try {
        // 1. Add Manifest
        archive.append(JSON.stringify(manifest, null, 2), { name: 'data.json' })

        // 2. Fetch images only from this project's Supabase Storage origin.
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const MAX_TOTAL_MEDIA_BYTES = 100 * 1024 * 1024
        let archivedMediaBytes = 0

        const appendImageWithinBudget = (image: { buffer: Buffer; extension: string }, name: string) => {
          if (archivedMediaBytes + image.buffer.byteLength > MAX_TOTAL_MEDIA_BYTES) return false
          archivedMediaBytes += image.buffer.byteLength
          archive.append(image.buffer, { name: `${name}.${image.extension}` })
          return true
        }

        // We process trades in chunks to avoid blowing up memory or connections
        const CHUNK_SIZE = 5
        const allTradesWithImages = trades.filter(
          (t: typeof trades[number]) =>
            t.imageOne ||
            t.imageTwo ||
            t.imageThree ||
            t.imageFour ||
            t.imageFive ||
            t.imageSix ||
            t.cardPreviewImage
        )

        // Helper to process a single trade's images
        const processTradeImages = async (trade: any) => {
          const images = [
            { url: trade.imageOne, suffix: '1' },
            { url: trade.imageTwo, suffix: '2' },
            { url: trade.imageThree, suffix: '3' },
            { url: trade.imageFour, suffix: '4' },
            { url: trade.imageFive, suffix: '5' },
            { url: trade.imageSix, suffix: '6' },
            { url: trade.cardPreviewImage, suffix: 'preview' },
          ]

          for (const img of images) {
            if (img.url && supabaseUrl) {
              const image = await fetchTrustedExportImage(img.url, supabaseUrl)
              if (image) {
                appendImageWithinBudget(image, `images/trades/${trade.id}_${img.suffix}`)
              }
            }
          }
        }

        // Chunk processing
        for (let i = 0; i < allTradesWithImages.length; i += CHUNK_SIZE) {
          const chunk = allTradesWithImages.slice(i, i + CHUNK_SIZE)
          await Promise.all(chunk.map(processTradeImages))
          // Small delay to yield event loop if needed?
        }

        // Process Backtest images
        const backtestsWithImages = backtestTrades.filter(
          (t: typeof backtestTrades[number]) =>
            t.imageOne ||
            t.imageTwo ||
            t.imageThree ||
            t.imageFour ||
            t.imageFive ||
            t.imageSix ||
            t.cardPreviewImage
        )
        const processBacktestImages = async (trade: any) => {
          const images = [
            { url: trade.imageOne, suffix: '1' },
            { url: trade.imageTwo, suffix: '2' },
            { url: trade.imageThree, suffix: '3' },
            { url: trade.imageFour, suffix: '4' },
            { url: trade.imageFive, suffix: '5' },
            { url: trade.imageSix, suffix: '6' },
            { url: trade.cardPreviewImage, suffix: 'preview' },
          ]
          for (const img of images) {
            if (img.url && supabaseUrl) {
              const image = await fetchTrustedExportImage(img.url, supabaseUrl)
              if (image) {
                appendImageWithinBudget(image, `images/backtest/${trade.id}_${img.suffix}`)
              }
            }
          }
        }

        for (let i = 0; i < backtestsWithImages.length; i += CHUNK_SIZE) {
          const chunk = backtestsWithImages.slice(i, i + CHUNK_SIZE)
          await Promise.all(chunk.map(processBacktestImages))
        }

        await archive.finalize()
      } catch (error) {
        reportApiHandlerError(request, error, 'build-user-data-export')
        stream.destroy(error as Error)
      }
    }

    // Fire and forget
    processArchive()

    return new NextResponse(stream as any, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="jji-export-${new Date().toISOString().split('T')[0]}.zip"`
      }
    })

  } catch (error) {
    reportApiHandlerError(request, error, 'initialize-user-data-export')
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
