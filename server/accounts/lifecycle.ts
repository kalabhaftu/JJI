import 'server-only'

import { and, eq } from 'drizzle-orm'

import { logActivity } from '@/lib/activity-logger'
import { recordAuditEvent } from '@/lib/audit-logger'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { DomainError } from '@/lib/domain-error'
import { reportError } from '@/lib/observability/report-error'
import { invalidateUserAccountCaches } from '@/server/accounts/cache'

export interface AccountLifecycleContext {
  requestId?: string
  ipAddress?: string | null
  source: 'api' | 'background-job'
}

export interface CreateLiveAccountCommand {
  name: string
  number: string
  startingBalance: number
  broker: string
  isOnboardingSample?: boolean
}

export interface UpdateLiveAccountCommand {
  name?: string
  number?: string
  startingBalance?: number | string
  broker?: string
  isArchived?: boolean
}

export async function createLiveAccountForUser(
  userId: string,
  command: CreateLiveAccountCommand,
  context: AccountLifecycleContext,
) {
  const name = command.name?.trim()
  const number = command.number?.trim()
  const broker = command.broker?.trim()
  const startingBalance = Number(command.startingBalance)
  if (!name || !number || !broker || !Number.isFinite(startingBalance)) {
    throw new DomainError(
      'Valid name, number, starting balance, and broker are required',
      'VALIDATION_ERROR',
    )
  }

  const existing = await db.query.Account.findFirst({
    where: (table, operators) => operators.and(
      operators.eq(table.number, number),
      operators.eq(table.userId, userId),
    ),
    columns: { id: true },
  })
  if (existing) {
    throw new DomainError(
      'Account number already exists',
      'ACCOUNT_NUMBER_CONFLICT',
      409,
    )
  }

  const account = await db.transaction(async (tx) => {
    const [created] = await tx.insert(schema.Account).values({
      id: crypto.randomUUID(),
      number,
      name,
      startingBalance,
      broker,
      userId,
      isOnboardingSample: command.isOnboardingSample ?? false,
    }).returning()
    if (!created) throw new Error('Account insert returned no record')

    await recordAuditEvent({
      userId,
      action: 'ACCOUNT_CREATED',
      entityType: 'Account',
      entityId: created.id,
      source: context.source,
      requestId: context.requestId ?? null,
      ipAddress: context.ipAddress ?? null,
      afterData: {
        number: created.number,
        name: created.name,
        broker: created.broker,
        startingBalance: created.startingBalance,
      },
    }, tx as never)
    return created
  })

  await invalidateUserAccountCaches(userId, context.requestId)
  return account
}

export async function updateLiveAccountForUser(
  userId: string,
  accountId: string,
  command: UpdateLiveAccountCommand,
  context: AccountLifecycleContext,
) {
  const existing = await db.query.Account.findFirst({
    where: (table, operators) => operators.and(
      operators.eq(table.id, accountId),
      operators.eq(table.userId, userId),
    ),
  })
  if (!existing) throw new DomainError('Account not found', 'NOT_FOUND', 404)

  const updateData: Partial<typeof schema.Account.$inferInsert> = {}
  if (typeof command.isArchived === 'boolean') {
    updateData.isArchived = command.isArchived
  }
  if (command.name !== undefined) {
    const name = command.name.trim()
    if (!name) throw new DomainError('Name is required', 'VALIDATION_ERROR')
    updateData.name = name
  }
  if (!existing.isConfigured) {
    if (command.startingBalance !== undefined) {
      const startingBalance = Number(command.startingBalance)
      if (!Number.isFinite(startingBalance)) {
        throw new DomainError(
          'Starting balance must be a valid number',
          'VALIDATION_ERROR',
        )
      }
      updateData.startingBalance = startingBalance
    }
    if (command.number !== undefined) {
      const number = command.number.trim()
      if (!number) {
        throw new DomainError('Account number is required', 'VALIDATION_ERROR')
      }
      const duplicate = await db.query.Account.findFirst({
        where: (table, operators) => operators.and(
          operators.eq(table.userId, userId),
          operators.eq(table.number, number),
        ),
        columns: { id: true },
      })
      if (duplicate && duplicate.id !== accountId) {
        throw new DomainError(
          'Account number already exists',
          'ACCOUNT_NUMBER_CONFLICT',
          409,
        )
      }
      updateData.number = number
    }
    if (command.broker !== undefined) {
      const broker = command.broker.trim()
      if (!broker) {
        throw new DomainError('Broker is required', 'VALIDATION_ERROR')
      }
      updateData.broker = broker
    }
    if (
      command.startingBalance !== undefined
      || command.number !== undefined
      || command.broker !== undefined
    ) {
      updateData.isConfigured = true
    }
  }

  const updatedFields = Object.keys(updateData)
  if (updatedFields.length === 0) return {
    account: existing,
    action: 'ACCOUNT_RENAMED',
    updatedFields,
  }

  const account = await db.transaction(async (tx) => {
    const [updated] = await tx.update(schema.Account)
      .set(updateData)
      .where(and(
        eq(schema.Account.id, accountId),
        eq(schema.Account.userId, userId),
      ))
      .returning()
    if (!updated) throw new DomainError('Account not found', 'NOT_FOUND', 404)

    await recordAuditEvent({
      userId,
      action: 'ACCOUNT_UPDATED',
      entityType: 'Account',
      entityId: accountId,
      source: context.source,
      requestId: context.requestId ?? null,
      ipAddress: context.ipAddress ?? null,
      beforeData: {
        number: existing.number,
        name: existing.name,
        broker: existing.broker,
        startingBalance: existing.startingBalance,
        isArchived: existing.isArchived,
      },
      afterData: {
        number: updated.number,
        name: updated.name,
        broker: updated.broker,
        startingBalance: updated.startingBalance,
        isArchived: updated.isArchived,
        updatedFields,
      },
    }, tx as never)
    return updated
  })

  const action = typeof command.isArchived === 'boolean'
    ? command.isArchived
      ? 'ACCOUNT_ARCHIVED'
      : 'ACCOUNT_UNARCHIVED'
    : existing.isConfigured
      ? 'ACCOUNT_RENAMED'
      : 'ACCOUNT_CONFIGURED'
  logActivity({
    userId,
    action,
    entity: 'Account',
    entityId: accountId,
    metadata: { updatedFields, accountNumber: account.number },
    ipAddress: context.ipAddress ?? null,
    requestId: context.requestId ?? null,
  })
  await invalidateUserAccountCaches(userId, context.requestId)
  return { account, action, updatedFields }
}

export async function deleteLiveAccountForUser(
  userId: string,
  accountId: string,
  context: AccountLifecycleContext,
) {
  const existing = await db.query.Account.findFirst({
    where: (table, operators) => operators.and(
      operators.eq(table.id, accountId),
      operators.eq(table.userId, userId),
    ),
  })
  if (!existing) throw new DomainError('Account not found', 'NOT_FOUND', 404)

  const trades = await db.query.Trade.findMany({
    where: (table, operators) => operators.and(
      operators.eq(table.accountId, accountId),
      operators.eq(table.userId, userId),
    ),
    columns: {
      imageOne: true,
      imageTwo: true,
      imageThree: true,
      imageFour: true,
      imageFive: true,
      imageSix: true,
      cardPreviewImage: true,
    },
  })
  const imageUrls = trades.flatMap((trade) => [
    trade.imageOne,
    trade.imageTwo,
    trade.imageThree,
    trade.imageFour,
    trade.imageFive,
    trade.imageSix,
    trade.cardPreviewImage,
  ]).filter((url): url is string => Boolean(url))

  await db.transaction(async (tx) => {
    const deleted = await tx.delete(schema.Account)
      .where(and(
        eq(schema.Account.id, accountId),
        eq(schema.Account.userId, userId),
      ))
      .returning({ id: schema.Account.id })
    if (deleted.length === 0) {
      throw new DomainError('Account not found', 'NOT_FOUND', 404)
    }
    await recordAuditEvent({
      userId,
      action: 'ACCOUNT_DELETED',
      entityType: 'Account',
      entityId: accountId,
      source: context.source,
      requestId: context.requestId ?? null,
      ipAddress: context.ipAddress ?? null,
      beforeData: {
        number: existing.number,
        name: existing.name,
        broker: existing.broker,
        startingBalance: existing.startingBalance,
      },
    }, tx as never)
  })

  logActivity({
    userId,
    action: 'ACCOUNT_DELETED',
    entity: 'Account',
    entityId: accountId,
    metadata: { accountNumber: existing.number },
    ipAddress: context.ipAddress ?? null,
    requestId: context.requestId ?? null,
  })
  await invalidateUserAccountCaches(userId, context.requestId)

  if (imageUrls.length > 0) {
    try {
      const { deletePublicStorageUrls } = await import('@/server/storage-admin')
      await deletePublicStorageUrls(imageUrls)
    } catch (error) {
      reportError(error, {
        surface: 'server',
        operation: 'delete-account-trade-images',
        userId,
        entityId: accountId,
        ...(context.requestId ? { requestId: context.requestId } : {}),
        extra: { imageCount: imageUrls.length },
      })
    }
  }
}

export async function createOnboardingSampleWorkspace(
  userId: string,
  context: AccountLifecycleContext,
) {
  const account = await createLiveAccountForUser(userId, {
    name: 'JJI sample workspace',
    number: `JJI-SAMPLE-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    startingBalance: 100000,
    broker: 'JJI sample',
    isOnboardingSample: true,
  }, context)

  return account
}

export async function deleteOnboardingSampleWorkspaceForUser(
  userId: string,
  accountId: string,
  context: AccountLifecycleContext,
) {
  const existing = await db.query.Account.findFirst({
    where: (table, operators) => operators.and(
      operators.eq(table.id, accountId),
      operators.eq(table.userId, userId),
      operators.eq(table.isOnboardingSample, true),
    ),
  })
  if (!existing) throw new DomainError('Sample workspace not found', 'NOT_FOUND', 404)

  const trades = await db.query.Trade.findMany({
    where: (table, operators) => operators.and(
      operators.eq(table.accountId, accountId),
      operators.eq(table.userId, userId),
    ),
    columns: {
      imageOne: true,
      imageTwo: true,
      imageThree: true,
      imageFour: true,
      imageFive: true,
      imageSix: true,
      cardPreviewImage: true,
    },
  })
  const imageUrls = trades.flatMap((trade) => [
    trade.imageOne,
    trade.imageTwo,
    trade.imageThree,
    trade.imageFour,
    trade.imageFive,
    trade.imageSix,
    trade.cardPreviewImage,
  ]).filter((url): url is string => Boolean(url))

  await db.transaction(async (tx) => {
    await tx.delete(schema.Trade).where(and(
      eq(schema.Trade.accountId, accountId),
      eq(schema.Trade.userId, userId),
    ))

    const deleted = await tx.delete(schema.Account)
      .where(and(
        eq(schema.Account.id, accountId),
        eq(schema.Account.userId, userId),
        eq(schema.Account.isOnboardingSample, true),
      ))
      .returning({ id: schema.Account.id })
    if (deleted.length === 0) throw new DomainError('Sample workspace not found', 'NOT_FOUND', 404)

    await recordAuditEvent({
      userId,
      action: 'ONBOARDING_SAMPLE_WORKSPACE_DELETED',
      entityType: 'Account',
      entityId: accountId,
      source: context.source,
      requestId: context.requestId ?? null,
      ipAddress: context.ipAddress ?? null,
      beforeData: {
        number: existing.number,
        name: existing.name,
      },
    }, tx as never)
  })

  await invalidateUserAccountCaches(userId, context.requestId)

  if (imageUrls.length > 0) {
    try {
      const { deletePublicStorageUrls } = await import('@/server/storage-admin')
      await deletePublicStorageUrls(imageUrls)
    } catch (error) {
      reportError(error, {
        surface: 'server',
        operation: 'delete-onboarding-sample-trade-images',
        userId,
        entityId: accountId,
        ...(context.requestId ? { requestId: context.requestId } : {}),
        extra: { imageCount: imageUrls.length },
      })
    }
  }
}
