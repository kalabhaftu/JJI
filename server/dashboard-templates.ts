'use server'
import logger from '@/lib/logger';

import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { revalidatePath } from 'next/cache'
import { getInternalUserId } from './user-identity'
import { safeDbOperation } from './auth'
import { cloneDefaultTemplateLayout } from '@/lib/dashboard/default-template-layout'
import { eq, and } from 'drizzle-orm'

export interface WidgetLayout {
  i: string
  type: string
  size: string
  x: number
  y: number
  w: number
  h: number
}

export interface DashboardTemplate {
  id: string
  userId: string
  name: string
  isDefault: boolean | null
  isActive: boolean | null
  layout: WidgetLayout[]
  createdAt: Date | null
  updatedAt: Date
}

const getCanonicalDefaultLayout = (): WidgetLayout[] =>
  cloneDefaultTemplateLayout() as WidgetLayout[]

async function getDefaultLayout(): Promise<WidgetLayout[]> {
  return getCanonicalDefaultLayout()
}

export async function getUserTemplates(): Promise<DashboardTemplate[]> {
  const userId = await getInternalUserId()

  const templates = await safeDbOperation(
    () => db.query.DashboardTemplate.findMany({
      where: (table, { eq }) => eq(table.userId, userId),
      orderBy: (table, { desc, asc }) => [
        desc(table.isDefault),
        desc(table.isActive),
        asc(table.createdAt),
      ],
    }),
    [] // Return empty array if database is unavailable
  )

  return (templates || []).map((t: any) => JSON.parse(JSON.stringify({
    ...t,
    layout: t.isDefault ? getCanonicalDefaultLayout() : (t.layout as unknown as WidgetLayout[]),
  })))
}

export async function getActiveTemplate(): Promise<DashboardTemplate | null> {
  try {
    const userId = await getInternalUserId()
    if (!userId) return null

    const template = await safeDbOperation(
      () => db.query.DashboardTemplate.findFirst({
        where: (table, { eq, and }) => and(
          eq(table.userId, userId),
          eq(table.isActive, true),
        ),
      }),
      null
    )

    if (!template) return null

    // If it's the default template, always return the canonical default layout
    if (template.isDefault) {
      return JSON.parse(JSON.stringify({
        ...template,
        layout: getCanonicalDefaultLayout(),
      }))
    }

    return JSON.parse(JSON.stringify({
      ...template,
      layout: template.layout as unknown as WidgetLayout[],
    }))
  } catch (error) {
    logger.error({ event: 'system_error', error: error }, 'getActiveTemplate failed:')
    return null
  }
}

async function initializeDefaultTemplate(userId: string): Promise<DashboardTemplate> {
  const existingDefault = await safeDbOperation(
    () => db.query.DashboardTemplate.findFirst({
      where: (table, { eq, and }) => and(
        eq(table.userId, userId),
        eq(table.isDefault, true),
      ),
    }),
    null
  )

  if (existingDefault) {
    return {
      ...existingDefault,
      layout: existingDefault.layout as unknown as WidgetLayout[],
    }
  }

  const layout = await getDefaultLayout()

  const template = await safeDbOperation(async () => {
    const res = await db.insert(schema.DashboardTemplate).values({
      id: crypto.randomUUID(),
      updatedAt: new Date(),
      userId,
      name: 'Default',
      isDefault: true,
      isActive: true,
      layout: layout as any,
    }).returning()
    return res[0]
  }, null)

  if (!template) {
    throw new Error('Failed to create default template')
  }

  return {
    ...template,
    layout: template.layout as unknown as WidgetLayout[],
  }
}

export async function createTemplate(name: string): Promise<DashboardTemplate> {
  try {
    const userId = await getInternalUserId()
    if (!userId) throw new Error('Authentication required')

    const existing = await safeDbOperation(
      () => db.query.DashboardTemplate.findFirst({
        where: (table, { eq, and }) => and(
          eq(table.userId, userId),
          eq(table.name, name),
        ),
      }),
      null
    )

    if (existing) {
      throw new Error(`A template with the name "${name}" already exists.`)
    }

    await safeDbOperation(() =>
      db.update(schema.DashboardTemplate).set({ isActive: false }).where(and(eq(schema.DashboardTemplate.userId, userId), eq(schema.DashboardTemplate.isActive, true)))
    )

    const template = await safeDbOperation(async () => {
      const res = await db.insert(schema.DashboardTemplate).values({
        id: crypto.randomUUID(),
        userId,
        name,
        isActive: true,
        isDefault: false,
        layout: getCanonicalDefaultLayout() as any,
        updatedAt: new Date()
      }).returning()
      return res[0]
    })

    if (!template) {
      throw new Error('Failed to create template record')
    }

    revalidatePath('/dashboard')

    // Explicitly serialize to plain object for Vercel stability
    return JSON.parse(JSON.stringify({
      ...template,
      layout: template.layout as unknown as WidgetLayout[],
    }))
  } catch (error) {
    logger.error({ event: 'system_error', error: error }, 'createTemplate failed:')
    throw error // Re-throw for client-side catch
  }
}

export async function deleteTemplate(id: string): Promise<void> {
  try {
    const userId = await getInternalUserId()
    if (!userId) throw new Error('Authentication required')

    const template = await safeDbOperation(() =>
      db.query.DashboardTemplate.findFirst({
        where: (table, { eq }) => eq(table.id, id),
      })
    )

    if (!template || template.userId !== userId) {
      throw new Error('Template not found')
    }

    if (template.isDefault) {
      throw new Error('Cannot delete default template')
    }

    // If deleting active template, make default active
    if (template.isActive) {
      await safeDbOperation(() =>
        db.update(schema.DashboardTemplate).set({ isActive: true }).where(and(eq(schema.DashboardTemplate.userId, userId), eq(schema.DashboardTemplate.isDefault, true)))
      )
    }

    await safeDbOperation(() =>
      db.delete(schema.DashboardTemplate).where(and(
        eq(schema.DashboardTemplate.id, id),
        eq(schema.DashboardTemplate.userId, userId),
      ))
    )

    revalidatePath('/dashboard')
  } catch (error) {
    logger.error({ event: 'system_error', error: error }, 'deleteTemplate failed:')
    throw error
  }
}

export async function switchTemplate(id: string): Promise<DashboardTemplate> {
  try {
    const userId = await getInternalUserId()
    if (!userId) throw new Error('Authentication required')

    const template = await safeDbOperation(() => db.transaction(async (tx) => {
      // Validate ownership before changing the active template. The previous
      // order could deactivate a user's current template before rejecting an
      // ID owned by another user.
      const target = await tx.query.DashboardTemplate.findFirst({
        where: (table, { and, eq }) => and(
          eq(table.id, id),
          eq(table.userId, userId),
        ),
      })

      if (!target) return null

      await tx.update(schema.DashboardTemplate)
        .set({ isActive: false })
        .where(and(
          eq(schema.DashboardTemplate.userId, userId),
          eq(schema.DashboardTemplate.isActive, true),
        ))

      const res = await tx.update(schema.DashboardTemplate)
        .set({ isActive: true })
        .where(and(
          eq(schema.DashboardTemplate.id, id),
          eq(schema.DashboardTemplate.userId, userId),
        ))
        .returning()

      return res[0] ?? null
    }))

    if (!template) {
      throw new Error('Template not found')
    }

    revalidatePath('/dashboard')

    return JSON.parse(JSON.stringify({
      ...template,
      layout: template.isDefault ? getCanonicalDefaultLayout() : (template.layout as unknown as WidgetLayout[]),
    }))
  } catch (error) {
    logger.error({ event: 'system_error', error: error }, 'switchTemplate failed:')
    throw error
  }
}

export async function updateTemplateLayout(id: string, layout: WidgetLayout[]): Promise<DashboardTemplate> {
  try {
    const userId = await getInternalUserId()
    if (!userId) throw new Error('Authentication required')

    const template = await safeDbOperation(() =>
      db.query.DashboardTemplate.findFirst({
        where: (table, { eq }) => eq(table.id, id),
      })
    )

    if (!template || template.userId !== userId) {
      throw new Error('Template not found')
    }

    if (template.isDefault) {
      throw new Error('Cannot modify default template layout')
    }

    const updated = await safeDbOperation(async () => {
      const res = await db.update(schema.DashboardTemplate).set({
        layout: layout as any,
        updatedAt: new Date()
      }).where(and(
        eq(schema.DashboardTemplate.id, id),
        eq(schema.DashboardTemplate.userId, userId),
      )).returning()
      return res[0]
    })

    if (!updated) {
      throw new Error('Failed to update template layout')
    }

    revalidatePath('/dashboard')

    return JSON.parse(JSON.stringify({
      ...updated,
      layout: updated.layout as unknown as WidgetLayout[],
    }))
  } catch (error) {
    logger.error({ event: 'system_error', error: error }, 'updateTemplateLayout failed:')
    throw error
  }
}
