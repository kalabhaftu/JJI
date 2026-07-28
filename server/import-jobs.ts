import JSZip from 'jszip'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { getSupabaseAdminClient } from '@/server/supabase-admin'
import { downloadImportObject, uploadImportObject } from '@/server/import-object-store'
import { buildUserSettingsUpdateData, extractUserSettingsWriteData, pickSettingsPatch } from '@/lib/user-settings'
import { buildSyntheticExecutionsFromTrade, buildTradePersistenceData } from '@/lib/trade-core'
import { eq, and, or, inArray, desc, asc } from 'drizzle-orm'
import { validateImportArchive } from '@/lib/security/import-archive'
import { claimImportJob, updateClaimedImportJob } from '@/server/import-job-runtime'

const TRADE_CHUNK_SIZE = 25
const BACKTEST_CHUNK_SIZE = 25
const MAX_IMAGE_BYTES = 12 * 1024 * 1024
const MAX_IMPORT_ITEMS = 100_000

type ImportJobStage = 'queued' | 'preparing' | 'trades' | 'backtests' | 'completed' | 'failed' | 'cancelled'

interface ImportJobState {
  phase: 'preparing' | 'trades' | 'backtests' | 'completed'
  tradeIndex: number
  backtestIndex: number
  imported: number
  skipped: number
}

const DEFAULT_JOB_STATE: ImportJobState = {
  phase: 'preparing',
  tradeIndex: 0,
  backtestIndex: 0,
  imported: 0,
  skipped: 0,
}

function parseJobState(state: unknown): ImportJobState {
  if (!state || typeof state !== 'object') return { ...DEFAULT_JOB_STATE }

  const obj = state as Partial<ImportJobState>
  return {
    phase: obj.phase ?? 'preparing',
    tradeIndex: Number.isFinite(obj.tradeIndex) ? Number(obj.tradeIndex) : 0,
    backtestIndex: Number.isFinite(obj.backtestIndex) ? Number(obj.backtestIndex) : 0,
    imported: Number.isFinite(obj.imported) ? Number(obj.imported) : 0,
    skipped: Number.isFinite(obj.skipped) ? Number(obj.skipped) : 0,
  }
}

function toBuffer(data: unknown): Buffer {
  if (Buffer.isBuffer(data)) return data
  if (data instanceof Uint8Array) return Buffer.from(data)
  if (Array.isArray(data)) return Buffer.from(data)
  throw new Error('Invalid import file data')
}

async function loadImportPayload(fileData: unknown, fileObjectPath: string | null) {
  return fileObjectPath ? downloadImportObject(fileObjectPath) : toBuffer(fileData)
}

function findImageFile(zipFiles: { [key: string]: JSZip.JSZipObject }, folder: string, id: string, suffix: string) {
  const extensions = ['png', 'jpg', 'jpeg', 'webp', 'gif']
  for (const ext of extensions) {
    const path = `images/${folder}/${id}_${suffix}.${ext}`
    if (zipFiles[path]) return { file: zipFiles[path], ext }
  }
  return null
}

function computeProcessingProgress(totalItems: number, processedItems: number): number {
  if (totalItems <= 0) return 95
  const clamped = Math.max(0, Math.min(processedItems, totalItems))
  return Math.min(95, 10 + Math.floor((clamped / totalItems) * 85))
}

async function uploadImage(
  zip: JSZip,
  internalUserId: string,
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  zipFolder: string,
  originalId: string,
  suffix: string,
  newId: string,
) {
  const result = findImageFile(zip.files, zipFolder, originalId, suffix)
  if (!result) return null

  const buffer = await result.file.async('arraybuffer')
  if (buffer.byteLength > MAX_IMAGE_BYTES) throw new Error('A backup image exceeds the size limit')
  const path = `trades/${internalUserId}/${newId}/${suffix}.${result.ext}`

  const { data: uploadData, error } = await supabase.storage
    .from('trade-images')
    .upload(path, buffer, {
      contentType: `image/${result.ext}`,
      upsert: true,
    })

  if (error || !uploadData) return null

  return `storage://trade-images/${path}`
}

async function uploadTradeImages(
  zip: JSZip,
  internalUserId: string,
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  trade: any,
  newId: string,
) {
  const suffixes = ['1', '2', '3', '4', '5', '6', 'preview']
  const results: Record<string, string> = {}

  for (const suffix of suffixes) {
    const field =
      suffix === 'preview'
        ? 'cardPreviewImage'
        : `image${['One', 'Two', 'Three', 'Four', 'Five', 'Six'][parseInt(suffix, 10) - 1]}`

    const url = await uploadImage(
      zip,
      internalUserId,
      supabase,
      'trades',
      trade.originalId || trade.id,
      suffix,
      newId,
    )

    if (url) results[field] = url
  }

  return results
}

async function uploadBacktestImages(
  zip: JSZip,
  internalUserId: string,
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  backtestTrade: any,
  newId: string,
) {
  const suffixes = ['1', '2', '3', '4', '5', '6', 'preview']
  const results: Record<string, string> = {}

  for (const suffix of suffixes) {
    const field =
      suffix === 'preview'
        ? 'cardPreviewImage'
        : `image${['One', 'Two', 'Three', 'Four', 'Five', 'Six'][parseInt(suffix, 10) - 1]}`

    const url = await uploadImage(
      zip,
      internalUserId,
      supabase,
      'backtest',
      backtestTrade.id,
      suffix,
      newId,
    )

    if (url) results[field] = url
  }

  return results
}

async function resolveLookupMaps(data: any, internalUserId: string) {
  const accountNumbers: string[] = Array.from(
    new Set((data.accounts || []).map((account: any) => account.number).filter(Boolean)),
  )

  const modelNames: string[] = Array.from(
    new Set((data.tradingModels || []).map((model: any) => model.name).filter(Boolean)),
  )

  const phaseIds: string[] = Array.from(
    new Set(
      (data.masterAccounts || [])
        .flatMap((master: any) => master?.PhaseAccount || [])
        .map((phase: any) => phase?.phaseId)
        .filter((phaseId: any) => typeof phaseId === 'string' && phaseId.trim().length > 0),
    ),
  )

  const [accounts, models, phaseAccounts] = await Promise.all([
    accountNumbers.length
      ? db.query.Account.findMany({
          where: (table, { inArray }) => and(eq(table.userId, internalUserId), inArray(table.number, accountNumbers)),
          columns: { id: true, number: true },
        })
      : [],
    modelNames.length
      ? db.query.TradingModel.findMany({
          where: (table, { inArray }) => and(eq(table.userId, internalUserId), inArray(table.name, modelNames)),
          columns: { id: true, name: true },
        })
      : [],
    phaseIds.length
      ? db.query.PhaseAccount.findMany({
          where: (table, { inArray }) => and(inArray(table.phaseId, phaseIds), eq(schema.MasterAccount.userId, internalUserId)),
          columns: { id: true, phaseId: true },
          with: { MasterAccount: true },
        })
      : [],
  ])

  const accountMap = new Map<string, string>()
  accounts.forEach((account) => accountMap.set(account.number, account.id))

  const modelNameMap = new Map<string, string>()
  models.forEach((model) => modelNameMap.set(model.name, model.id))

  const phaseMap = new Map<string, string>()
  phaseAccounts.forEach((phase) => {
    if (phase.phaseId) {
      phaseMap.set(phase.phaseId, phase.id)
    }
  })

  return { accountMap, modelNameMap, phaseMap }
}

async function runPreparation(data: any, internalUserId: string) {
  if (data.user) {
    const settingsPatch = pickSettingsPatch({
      timezone: data.user.timezone,
      theme: data.user.theme,
      accountFilterSettings: data.user.accountFilterSettings,
      aiSettings: data.user.aiSettings,
      backtestInputMode: data.user.backtestInputMode,
      accentPack: data.user.accentPack,
      autoAdjustAccountDate: data.user.autoAdjustAccountDate,
      breakEvenThreshold: data.user.breakEvenThreshold,
      pnlDisplayMode: data.user.pnlDisplayMode,
    })

    await db.transaction(async (tx) => {
      await tx.update(schema.User).set({
        firstName: data.user.firstName,
        lastName: data.user.lastName,
      }).where(eq(schema.User.id, internalUserId))

      const existingSettings = await tx.query.UserSettings.findFirst({ where: (table, { eq }) => eq(table.userId, internalUserId) })
      if (existingSettings) {
        await tx.update(schema.UserSettings).set(buildUserSettingsUpdateData(settingsPatch)).where(eq(schema.UserSettings.userId, internalUserId))
      } else {
        await tx.insert(schema.UserSettings).values({
          userId: internalUserId,
          ...extractUserSettingsWriteData(settingsPatch),
          updatedAt: new Date(),
        })
      }
    })
  }

  if (data.tradeTags) {
    for (const tag of data.tradeTags) {
      const existing = await db.query.TradeTag.findFirst({ where: (table, { and, eq }) => and(eq(table.name, tag.name), eq(table.userId, internalUserId)) })
      if (existing) {
        await db.update(schema.TradeTag).set({ color: tag.color }).where(and(eq(schema.TradeTag.name, tag.name), eq(schema.TradeTag.userId, internalUserId)))
      } else {
        await db.insert(schema.TradeTag).values({
          id: crypto.randomUUID(),
          userId: internalUserId,
          name: tag.name,
          color: tag.color,
          updatedAt: new Date(),
        })
      }
    }
  }

  if (data.tradingModels) {
    for (const model of data.tradingModels) {
      const existing = await db.query.TradingModel.findFirst({ where: (table, { and, eq }) => and(eq(table.userId, internalUserId), eq(table.name, model.name)) })
      if (existing) {
        await db.update(schema.TradingModel).set({ rules: model.rules, notes: model.notes }).where(and(eq(schema.TradingModel.userId, internalUserId), eq(schema.TradingModel.name, model.name)))
      } else {
        await db.insert(schema.TradingModel).values({
          id: crypto.randomUUID(),
          userId: internalUserId,
          name: model.name,
          rules: model.rules ?? [],
          notes: model.notes,
          updatedAt: new Date(),
        })
      }
    }
  }

  if (data.dashboardTemplates) {
    for (const template of data.dashboardTemplates) {
      const existing = await db.query.DashboardTemplate.findFirst({ where: (table, { and, eq }) => and(eq(table.userId, internalUserId), eq(table.name, template.name)) })
      if (existing) {
        await db.update(schema.DashboardTemplate).set({ layout: template.layout, isActive: template.isActive, isDefault: template.isDefault }).where(and(eq(schema.DashboardTemplate.userId, internalUserId), eq(schema.DashboardTemplate.name, template.name)))
      } else {
        await db.insert(schema.DashboardTemplate).values({
          id: crypto.randomUUID(),
          userId: internalUserId,
          name: template.name,
          layout: template.layout,
          isActive: template.isActive,
          isDefault: template.isDefault,
          updatedAt: new Date(),
        })
      }
    }
  }

  const accountMap = new Map<string, string>()
  if (data.accounts) {
    for (const account of data.accounts) {
      const existing = await db.query.Account.findFirst({ where: (table, { and, eq }) => and(eq(table.number, account.number), eq(table.userId, internalUserId)) })
      let target
      if (existing) {
        target = (await db.update(schema.Account).set({
          name: account.name,
          broker: account.broker,
          startingBalance: account.startingBalance,
          isArchived: account.isArchived,
        }).where(and(eq(schema.Account.number, account.number), eq(schema.Account.userId, internalUserId))).returning())[0]
      } else {
        target = (await db.insert(schema.Account).values({
          id: crypto.randomUUID(),
          userId: internalUserId,
          number: account.number,
          name: account.name,
          broker: account.broker,
          startingBalance: account.startingBalance || 0,
          isArchived: account.isArchived || false,
          updatedAt: new Date(),
        }).returning())[0]
      }
      if (!target) continue
      accountMap.set(account.number, target.id)
    }
  }

  const phaseMap = new Map<string, string>()
  const phaseNumberMap = new Map<string, string>()
  const masterMap = new Map<string, string>()

  if (data.masterAccounts) {
    for (const masterAccount of data.masterAccounts) {
      const existingMaster = await db.query.MasterAccount.findFirst({ where: (table, { and, eq }) => and(eq(table.userId, internalUserId), eq(table.accountName, masterAccount.accountName)) })
      let targetMasterAccount
      if (existingMaster) {
        targetMasterAccount = (await db.update(schema.MasterAccount).set({
          propFirmName: masterAccount.propFirmName,
          accountSize: masterAccount.accountSize,
          evaluationType: masterAccount.evaluationType,
          currentPhase: masterAccount.currentPhase,
          status: masterAccount.status,
          isArchived: masterAccount.isArchived,
        }).where(and(eq(schema.MasterAccount.userId, internalUserId), eq(schema.MasterAccount.accountName, masterAccount.accountName))).returning())[0]
      } else {
        targetMasterAccount = (await db.insert(schema.MasterAccount).values({
          id: crypto.randomUUID(),
          userId: internalUserId,
          accountName: masterAccount.accountName,
          propFirmName: masterAccount.propFirmName,
          accountSize: masterAccount.accountSize,
          evaluationType: masterAccount.evaluationType,
          currentPhase: masterAccount.currentPhase,
          status: masterAccount.status,
          isArchived: masterAccount.isArchived,
        }).returning())[0]
      }

      if (!targetMasterAccount) continue

      masterMap.set(masterAccount.accountName, targetMasterAccount.id)

      if (masterAccount.PhaseAccount) {
        for (const phase of masterAccount.PhaseAccount) {
          const existingPhase = await db.query.PhaseAccount.findFirst({ where: (table, { and, eq }) => and(eq(table.masterAccountId, targetMasterAccount.id), eq(table.phaseNumber, phase.phaseNumber)) })
          let targetPhase
          if (existingPhase) {
            targetPhase = (await db.update(schema.PhaseAccount).set({
              phaseId: phase.phaseId,
              status: phase.status,
              profitTargetPercent: phase.profitTargetPercent,
              dailyDrawdownPercent: phase.dailyDrawdownPercent,
              maxDrawdownPercent: phase.maxDrawdownPercent,
              startDate: phase.startDate ? new Date(phase.startDate) : undefined,
            }).where(and(eq(schema.PhaseAccount.masterAccountId, targetMasterAccount.id), eq(schema.PhaseAccount.phaseNumber, phase.phaseNumber))).returning())[0]
          } else {
            targetPhase = (await db.insert(schema.PhaseAccount).values({
              id: crypto.randomUUID(),
              masterAccountId: targetMasterAccount.id,
              phaseNumber: phase.phaseNumber,
              phaseId: phase.phaseId,
              profitTargetPercent: phase.profitTargetPercent,
              dailyDrawdownPercent: phase.dailyDrawdownPercent,
              maxDrawdownPercent: phase.maxDrawdownPercent,
              status: phase.status,
              startDate: phase.startDate ? new Date(phase.startDate) : undefined,
            }).returning())[0]
          }

          if (!targetPhase) continue

          if (phase.phaseId) {
            phaseMap.set(phase.phaseId, targetPhase.id)
          }

          phaseNumberMap.set(`${masterAccount.accountName}:${phase.phaseNumber}`, targetPhase.id)
        }
      }
    }
  }

  if (data.journalTemplates) {
    for (const template of data.journalTemplates) {
      if (!template?.name) continue
      const existing = await db.query.JournalTemplate.findFirst({ where: (table, { and, eq }) => and(eq(table.userId, internalUserId), eq(table.name, template.name)) })
      if (existing) {
        await db.update(schema.JournalTemplate).set({ content: template.content }).where(and(eq(schema.JournalTemplate.userId, internalUserId), eq(schema.JournalTemplate.name, template.name)))
      } else {
        await db.insert(schema.JournalTemplate).values({
          id: crypto.randomUUID(),
          userId: internalUserId,
          name: template.name,
          content: template.content,
          updatedAt: new Date(),
        })
      }
    }
  }

  if (data.weeklyAIReviews) {
    for (const review of data.weeklyAIReviews) {
      if (!review?.weekStart) continue
      const existing = await db.query.WeeklyAIReview.findFirst({ where: (table, { and, eq }) => and(eq(table.userId, internalUserId), eq(table.weekStart, new Date(review.weekStart))) })
      if (existing) {
        await db.update(schema.WeeklyAIReview).set({
          weekEnd: review.weekEnd ? new Date(review.weekEnd) : undefined,
          stats: review.stats,
          summary: review.summary,
          highlights: review.highlights ?? [],
          lowlights: review.lowlights ?? [],
          focusNextWeek: review.focusNextWeek,
          grade: review.grade,
        }).where(and(eq(schema.WeeklyAIReview.userId, internalUserId), eq(schema.WeeklyAIReview.weekStart, new Date(review.weekStart))))
      } else {
        await db.insert(schema.WeeklyAIReview).values({
          id: crypto.randomUUID(),
          userId: internalUserId,
          weekStart: new Date(review.weekStart),
          weekEnd: review.weekEnd ? new Date(review.weekEnd) : new Date(review.weekStart),
          stats: review.stats,
          summary: review.summary,
          highlights: review.highlights ?? [],
          lowlights: review.lowlights ?? [],
          focusNextWeek: review.focusNextWeek,
          grade: review.grade,
        })
      }
    }
  }

  if (data.userGoals) {
    for (const goal of data.userGoals) {
      if (!goal?.title) continue
      const existing = await db.query.UserGoal.findFirst({
        where: (table, { and, eq }) => and(
          eq(table.userId, internalUserId),
          eq(table.title, goal.title),
          eq(table.metric, goal.metric),
          eq(table.period, goal.period),
          goal.startDate ? eq(table.startDate, new Date(goal.startDate)) : undefined,
        ),
      })

      if (!existing) {
        await db.insert(schema.UserGoal).values({
          id: crypto.randomUUID(),
          userId: internalUserId,
          title: goal.title,
          metric: goal.metric,
          targetValue: goal.targetValue,
          currentValue: goal.currentValue ?? 0,
          period: goal.period,
          startDate: goal.startDate ? new Date(goal.startDate) : new Date(),
          endDate: goal.endDate ? new Date(goal.endDate) : null,
          isCompleted: Boolean(goal.isCompleted),
          completedAt: goal.completedAt ? new Date(goal.completedAt) : null,
          updatedAt: new Date(),
        })
      }
    }
  }

  if (data.notifications) {
    for (const notification of data.notifications) {
      if (!notification?.title || !notification?.createdAt) continue
      const existing = await db.query.Notification.findFirst({
        where: (table, { and, eq }) => and(
          eq(table.userId, internalUserId),
          eq(table.title, notification.title),
          eq(table.type, notification.type),
          eq(table.createdAt, new Date(notification.createdAt)),
        ),
      })

      if (!existing) {
        await db.insert(schema.Notification).values({
          id: crypto.randomUUID(),
          userId: internalUserId,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          priority: notification.priority,
          isRead: Boolean(notification.isRead),
          actionRequired: Boolean(notification.actionRequired),
          invalidationKey: notification.invalidationKey,
          data: notification.data,
          createdAt: new Date(notification.createdAt),
          updatedAt: new Date(),
        })
      }
    }
  }

  if (data.liveAccountTransactions) {
    for (const transaction of data.liveAccountTransactions) {
      const targetAccountId = accountMap.get(transaction.accountNumber)
      if (!targetAccountId) continue

      const existing = await db.query.LiveAccountTransaction.findFirst({
        where: (table, { and, eq }) => and(
          eq(table.accountId, targetAccountId),
          eq(table.amount, transaction.amount),
          eq(table.createdAt, new Date(transaction.createdAt)),
        ),
      })

      if (!existing) {
        await db.insert(schema.LiveAccountTransaction).values({
          id: crypto.randomUUID(),
          accountId: targetAccountId,
          userId: internalUserId,
          type: transaction.type,
          amount: transaction.amount,
          description: transaction.description,
          createdAt: new Date(transaction.createdAt),
        })
      }
    }
  }

  if (data.breachRecords) {
    for (const breachRecord of data.breachRecords) {
      const targetPhaseId =
        phaseMap.get(breachRecord.phaseId) ??
        (breachRecord.accountName && breachRecord.phaseNumber != null
          ? phaseNumberMap.get(`${breachRecord.accountName}:${breachRecord.phaseNumber}`)
          : undefined)
      if (!targetPhaseId) continue

      const existing = await db.query.BreachRecord.findFirst({
        where: (table, { and, eq }) => and(
          eq(table.phaseAccountId, targetPhaseId),
          eq(table.breachType, breachRecord.breachType),
          eq(table.breachTime, new Date(breachRecord.breachTime)),
        ),
      })

      if (!existing) {
        await db.insert(schema.BreachRecord).values({
          id: crypto.randomUUID(),
          phaseAccountId: targetPhaseId,
          breachType: breachRecord.breachType,
          breachAmount: breachRecord.breachAmount,
          breachTime: new Date(breachRecord.breachTime),
          currentEquity: breachRecord.currentEquity,
          accountSize: breachRecord.accountSize,
          dailyStartBalance: breachRecord.dailyStartBalance,
          highWaterMark: breachRecord.highWaterMark,
          notes: breachRecord.notes,
          updatedAt: new Date(),
        }).onConflictDoNothing({
          target: [schema.BreachRecord.phaseAccountId, schema.BreachRecord.breachType],
        })
      }
    }
  }

  if (data.dailyAnchors) {
    for (const anchor of data.dailyAnchors) {
      const targetPhaseId =
        phaseMap.get(anchor.phaseId) ??
        (anchor.accountName && anchor.phaseNumber != null
          ? phaseNumberMap.get(`${anchor.accountName}:${anchor.phaseNumber}`)
          : undefined)
      if (!targetPhaseId) continue

      const existing = await db.query.DailyAnchor.findFirst({ where: (table, { and, eq }) => and(eq(table.phaseAccountId, targetPhaseId), eq(table.date, new Date(anchor.date))) })
      if (existing) {
        await db.update(schema.DailyAnchor).set({ anchorEquity: anchor.anchorEquity }).where(and(eq(schema.DailyAnchor.phaseAccountId, targetPhaseId), eq(schema.DailyAnchor.date, new Date(anchor.date))))
      } else {
        await db.insert(schema.DailyAnchor).values({
          id: crypto.randomUUID(),
          phaseAccountId: targetPhaseId,
          date: new Date(anchor.date),
          anchorEquity: anchor.anchorEquity,
        })
      }
    }
  }

  if (data.payouts) {
    for (const payout of data.payouts) {
      const targetMasterId = masterMap.get(payout.accountName)
      const targetPhaseId = payout.phaseId
        ? phaseMap.get(payout.phaseId) ??
          (payout.accountName && payout.phaseNumber != null
            ? phaseNumberMap.get(`${payout.accountName}:${payout.phaseNumber}`)
            : null)
        : payout.accountName && payout.phaseNumber != null
          ? phaseNumberMap.get(`${payout.accountName}:${payout.phaseNumber}`)
          : null
      if (!targetMasterId || !targetPhaseId) continue

      const existing = await db.query.Payout.findFirst({
        where: (table, { and, eq }) => and(
          eq(table.masterAccountId, targetMasterId),
          eq(table.phaseAccountId, targetPhaseId),
          eq(table.amount, payout.amount),
          eq(table.requestDate, new Date(payout.requestDate)),
        ),
      })

      if (!existing) {
        await db.insert(schema.Payout).values({
          id: crypto.randomUUID(),
          masterAccountId: targetMasterId,
          phaseAccountId: targetPhaseId,
          amount: payout.amount,
          status: payout.status,
          requestDate: new Date(payout.requestDate),
          approvedDate: payout.approvedDate ? new Date(payout.approvedDate) : null,
          paidDate: payout.paidDate ? new Date(payout.paidDate) : null,
          rejectedDate: payout.rejectedDate ? new Date(payout.rejectedDate) : null,
          notes: payout.notes,
          rejectionReason: payout.rejectionReason,
          updatedAt: new Date(),
        })
      }
    }
  }
}

async function updateJob(jobId: string, internalUserId: string, workerToken: string, data: Record<string, any>) {
  return updateClaimedImportJob({ jobId, internalUserId, workerToken, data })
}

export function serializeImportJob(job: any) {
  if (!job) return null

  return {
    id: job.id,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    totalItems: job.totalItems,
    processedItems: job.processedItems,
    importedCount: job.importedCount,
    skippedCount: job.skippedCount,
    fileName: job.fileName,
    fileSize: job.fileSize,
    cancelRequested: job.cancelRequested,
    error: job.error,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  }
}

export async function getImportJobForUser(jobId: string, internalUserId: string) {
  return db.query.ImportJob.findFirst({
    where: (table, { and, eq }) => and(eq(table.id, jobId), eq(table.userId, internalUserId)),
    columns: {
      id: true,
      userId: true,
      status: true,
      stage: true,
      progress: true,
      totalItems: true,
      processedItems: true,
      importedCount: true,
      skippedCount: true,
      fileName: true,
      fileSize: true,
      cancelRequested: true,
      error: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  })
}

export async function createImportJob(params: {
  internalUserId: string
  fileName: string
  fileSize: number
  fileData: ArrayBuffer
}) {
  const jobId = crypto.randomUUID()
  const fileObjectPath = await uploadImportObject({
    internalUserId: params.internalUserId,
    jobId,
    data: Buffer.from(params.fileData),
    contentType: 'application/zip',
  })

  const job = (await db.insert(schema.ImportJob).values({
    id: jobId,
    userId: params.internalUserId,
    status: 'queued',
    stage: 'queued',
    progress: 0,
    fileName: params.fileName,
    fileSize: params.fileSize,
    fileData: null,
    fileObjectPath,
    totalItems: 0,
    processedItems: 0,
    importedCount: 0,
    skippedCount: 0,
    state: DEFAULT_JOB_STATE,
    cancelRequested: false,
    updatedAt: new Date(),
  }).returning())[0]

  return serializeImportJob(job)
}

export async function cancelImportJob(jobId: string, internalUserId: string) {
  const current = await db.query.ImportJob.findFirst({
    where: (table, { and, eq }) => and(eq(table.id, jobId), eq(table.userId, internalUserId)),
  })

  if (!current) {
    return { error: 'Import job not found', status: 404 as const }
  }

  if (current.status === 'completed' || current.status === 'failed' || current.status === 'cancelled') {
    return { job: serializeImportJob(current), status: 200 as const }
  }

  const cancelledImmediately = current.status === 'queued'

  const updated = (await db.update(schema.ImportJob).set(cancelledImmediately
    ? {
        cancelRequested: true,
        status: 'cancelled',
        stage: 'cancelled',
        progress: current.progress,
        completedAt: new Date(),
      }
    : {
        cancelRequested: true,
      }).where(and(
        eq(schema.ImportJob.id, current.id),
        eq(schema.ImportJob.userId, internalUserId),
      )).returning())[0]

  return { job: serializeImportJob(updated), status: 200 as const }
}

export async function processImportJobChunk(jobId: string, internalUserId: string, workerToken = crypto.randomUUID(), eventId?: string, skipClaim = false) {
  const claimed = skipClaim || await claimImportJob({
    jobId,
    internalUserId,
    workerToken,
    ...(eventId ? { eventId } : {}),
  })
  const job = await db.query.ImportJob.findFirst({
    where: (table, { and, eq }) => and(eq(table.id, jobId), eq(table.userId, internalUserId)),
    columns: {
      id: true,
      userId: true,
      status: true,
      stage: true,
      progress: true,
      totalItems: true,
      processedItems: true,
      importedCount: true,
      skippedCount: true,
      fileName: true,
      fileData: true,
      fileObjectPath: true,
      state: true,
      cancelRequested: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
      fileSize: true,
      error: true,
    },
  })

  if (!job) {
    return { error: 'Import job not found', status: 404 as const }
  }

  if (!claimed && job.status !== 'completed' && job.status !== 'failed' && job.status !== 'cancelled') {
    return { job: serializeImportJob(job), done: false, status: 200 as const }
  }

  if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
    return { job: serializeImportJob(job), done: true, status: 200 as const }
  }

  if (job.cancelRequested) {
    const cancelled = await updateJob(job.id, internalUserId, workerToken, {
      status: 'cancelled',
      stage: 'cancelled',
      completedAt: new Date(),
    })

    return { job: serializeImportJob(cancelled), done: true, status: 200 as const }
  }

  try {
    const zip = await JSZip.loadAsync(await loadImportPayload(job.fileData, job.fileObjectPath))
    validateImportArchive(zip)
    const manifestFile = zip.file('data.json')

    if (!manifestFile) {
      const failed = await updateJob(job.id, internalUserId, workerToken, {
        status: 'failed',
        stage: 'failed',
        error: 'Invalid export file (missing data.json)',
        completedAt: new Date(),
      })
      return { job: serializeImportJob(failed), done: true, status: 200 as const }
    }

    const manifestContent = await manifestFile.async('string')
    const data = JSON.parse(manifestContent)

    const totalItems = (data.trades?.length || 0) + (data.backtestTrades?.length || 0)
    if (!Number.isFinite(totalItems) || totalItems > MAX_IMPORT_ITEMS) {
      throw new Error('Backup contains too many import records')
    }
    let state = parseJobState(job.state)

    if (job.status === 'queued') {
      await updateJob(job.id, internalUserId, workerToken, {
        status: 'processing',
        stage: 'preparing',
        progress: 1,
        totalItems,
        startedAt: new Date(),
      })
    }

    if (state.phase === 'preparing') {
      await runPreparation(data, internalUserId)

      state.phase = 'trades'

      await updateJob(job.id, internalUserId, workerToken, {
        status: 'processing',
        stage: 'trades',
        progress: totalItems > 0 ? 10 : 95,
        totalItems,
        processedItems: 0,
        importedCount: state.imported,
        skippedCount: state.skipped,
        state,
      })
    }

    const { accountMap, modelNameMap, phaseMap } = await resolveLookupMaps(data, internalUserId)
    const supabase = getSupabaseAdminClient()

    if (state.phase === 'trades') {
      const trades = data.trades || []
      const endIndex = Math.min(trades.length, state.tradeIndex + TRADE_CHUNK_SIZE)

      for (let index = state.tradeIndex; index < endIndex; index++) {
        const trade = trades[index]
        const preparedTrade = buildTradePersistenceData({
          ...trade,
          id: crypto.randomUUID(),
          userId: internalUserId,
          quantity: parseFloat(trade.quantity || 0),
          pnl: parseFloat(trade.pnl || 0),
        } as any)

        const existing = await db.query.Trade.findFirst({
          where: (table, { and, eq }) => and(eq(table.userId, internalUserId), eq(table.tradeIdentityKey, preparedTrade.tradeIdentityKey)),
        })

        if (existing) {
          state.skipped += 1
          continue
        }

        const newId = crypto.randomUUID()
        const images = await uploadTradeImages(zip, internalUserId, supabase, trade, newId)

        const accountId = accountMap.get(trade.accountNumber) || null
        const phaseAccountId = phaseMap.get(trade.phaseId || trade.accountNumber) || null
        const modelId = trade.modelName ? modelNameMap.get(trade.modelName) : null

        const { id, userId, originalId, modelName, ...rest } = trade

        const tradeToCreate = buildTradePersistenceData({
          ...rest,
          ...images,
          id: newId,
          userId: internalUserId,
          accountId,
          phaseAccountId,
          modelId,
          quantity: parseFloat(trade.quantity || 0),
          pnl: parseFloat(trade.pnl || 0),
        } as any)

        await db.transaction(async (tx) => {
          await tx.insert(schema.Trade).values(tradeToCreate as any)

          await tx.insert(schema.TradeExecution).values(buildSyntheticExecutionsFromTrade(tradeToCreate as any) as any)
        })

        state.imported += 1
      }

      state.tradeIndex = endIndex
      if (state.tradeIndex >= trades.length) {
        state.phase = 'backtests'
      }
    }

    if (state.phase === 'backtests') {
      const backtests = data.backtestTrades || []
      const endIndex = Math.min(backtests.length, state.backtestIndex + BACKTEST_CHUNK_SIZE)

      for (let index = state.backtestIndex; index < endIndex; index++) {
        const backtestTrade = backtests[index]

        const existing = await db.query.BacktestTrade.findFirst({
          where: (table, { and, eq }) => and(
            eq(table.userId, internalUserId),
            eq(table.pair, backtestTrade.pair),
            eq(table.dateExecuted, backtestTrade.dateExecuted),
            eq(table.entryPrice, backtestTrade.entryPrice),
            eq(table.direction, backtestTrade.direction),
          ),
        })

        if (existing) {
          state.skipped += 1
          continue
        }

        const newId = crypto.randomUUID()
        const images = await uploadBacktestImages(zip, internalUserId, supabase, backtestTrade, newId)
        const { id, userId, ...rest } = backtestTrade

        await db.insert(schema.BacktestTrade).values({
          ...rest,
          ...images,
          userId: internalUserId,
          id: newId,
        })

        state.imported += 1
      }

      state.backtestIndex = endIndex
      if (state.backtestIndex >= backtests.length) {
        state.phase = 'completed'
      }
    }

    const processedItems = state.tradeIndex + state.backtestIndex

    if (state.phase === 'completed') {
      const completed = await updateJob(job.id, internalUserId, workerToken, {
        status: 'completed',
        stage: 'completed',
        progress: 100,
        processedItems,
        importedCount: state.imported,
        skippedCount: state.skipped,
        state,
        completedAt: new Date(),
      })

      return { job: serializeImportJob(completed), done: true, status: 200 as const }
    }

    const processing = await updateJob(job.id, internalUserId, workerToken, {
      status: 'processing',
      stage: state.phase,
      progress: computeProcessingProgress(totalItems, processedItems),
      totalItems,
      processedItems,
      importedCount: state.imported,
      skippedCount: state.skipped,
      state,
    })

    return {
      job: serializeImportJob(processing),
      done: false,
      status: 200 as const,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Import processing failed'
    const failed = await updateJob(job.id, internalUserId, workerToken, {
      status: 'failed',
      stage: 'failed',
      error: message.slice(0, 2000),
      completedAt: new Date(),
    })

    return { job: serializeImportJob(failed), done: true, status: 200 as const }
  }
}
