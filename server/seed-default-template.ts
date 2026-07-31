'use server'

import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { getInternalUserId } from './user-identity'
import { cloneDefaultTemplateLayout } from '@/lib/dashboard/default-template-layout'
import { eq } from 'drizzle-orm'
import logger from '@/lib/logger'

export async function ensureActiveTemplateForUser(userId: string, client: any = db) {
  return client.transaction(async (tx: any) => {
    const activeTemplate = await tx.query.DashboardTemplate.findFirst({
      where: (table: any, { eq, and }: any) => and(eq(table.userId, userId), eq(table.isActive, true)),
      columns: {
        id: true,
        userId: true,
        name: true,
        isDefault: true,
        isActive: true,
        layout: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (activeTemplate) return activeTemplate

    const defaultTemplate = await tx.query.DashboardTemplate.findFirst({
      where: (table: any, { eq, and }: any) => and(eq(table.userId, userId), eq(table.isDefault, true)),
      columns: {
        id: true,
        userId: true,
        name: true,
        isDefault: true,
        isActive: true,
        layout: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (defaultTemplate) {
      return (await tx.update(schema.DashboardTemplate).set({ isActive: true }).where(eq(schema.DashboardTemplate.id, defaultTemplate.id)).returning())[0]
    }

    const firstTemplate = await tx.query.DashboardTemplate.findFirst({
      where: (table: any, { eq }: any) => eq(table.userId, userId),
      orderBy: (table: any, { asc }: any) => [asc(table.createdAt)],
      columns: {
        id: true,
        userId: true,
        name: true,
        isDefault: true,
        isActive: true,
        layout: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (firstTemplate) {
      return (await tx.update(schema.DashboardTemplate).set({ isActive: true }).where(eq(schema.DashboardTemplate.id, firstTemplate.id)).returning())[0]
    }

    return (await tx.insert(schema.DashboardTemplate).values({
      id: crypto.randomUUID(),
      updatedAt: new Date(),
      userId,
      name: 'Default',
      isDefault: true,
      isActive: true,
      layout: cloneDefaultTemplateLayout() as any,
    }).returning())[0]
  })
}

export async function ensureDefaultTemplate() {
  try {
    const userId = await getInternalUserId()
    const userExists = await db.query.User.findFirst({
      where: (table: any, { eq }: any) => eq(table.id, userId),
      columns: { id: true },
    })

    if (!userExists) return

    await ensureActiveTemplateForUser(userId)
  } catch (error: any) {
    if (error?.code === 'P2002') return
    logger.warn({ error: error?.message }, 'Default dashboard template initialization failed', 'server')
  }
}
