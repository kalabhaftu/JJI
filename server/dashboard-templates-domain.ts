import { and, asc, desc, eq } from 'drizzle-orm'

import { recordAuditEvent } from '@/lib/audit-logger'
import { cloneDefaultTemplateLayout } from '@/lib/dashboard/default-template-layout'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import type {
  DashboardTemplate,
  WidgetLayout,
} from '@/lib/dashboard/template-types'

interface MutationContext {
  requestId?: string
  ipAddress?: string | null
  source: 'api' | 'server-action'
}

function canonicalLayout(): WidgetLayout[] {
  return cloneDefaultTemplateLayout() as WidgetLayout[]
}

function serializeTemplate(template: any): DashboardTemplate {
  return JSON.parse(JSON.stringify({
    ...template,
    layout: template.isDefault
      ? canonicalLayout()
      : template.layout as WidgetLayout[],
  }))
}

export async function listDashboardTemplatesForUser(
  userId: string,
): Promise<{ templates: DashboardTemplate[]; activeTemplate: DashboardTemplate }> {
  let rows = await db.query.DashboardTemplate.findMany({
    where: (table, operators) => operators.eq(table.userId, userId),
    orderBy: (table) => [
      desc(table.isDefault),
      desc(table.isActive),
      asc(table.createdAt),
    ],
  })

  if (rows.length === 0) {
    const [created] = await db.insert(schema.DashboardTemplate).values({
      id: crypto.randomUUID(),
      userId,
      name: 'Default',
      isDefault: true,
      isActive: true,
      layout: canonicalLayout() as any,
      updatedAt: new Date(),
    }).returning()
    if (!created) throw new Error('Failed to create default template')
    rows = [created]
  }

  const templates = rows.map(serializeTemplate)
  const activeTemplate = templates.find((template) => template.isActive)
    ?? templates.find((template) => template.isDefault)
    ?? templates[0]
  if (!activeTemplate) throw new Error('No dashboard template available')

  return { templates, activeTemplate }
}

export async function createDashboardTemplateForUser(
  userId: string,
  name: string,
  context: MutationContext,
): Promise<DashboardTemplate> {
  const normalizedName = name.trim()
  if (!normalizedName || normalizedName.length > 100) {
    throw new Error('Template name is required')
  }

  const existing = await db.query.DashboardTemplate.findFirst({
    where: (table, operators) => operators.and(
      operators.eq(table.userId, userId),
      operators.eq(table.name, normalizedName),
    ),
    columns: { id: true },
  })
  if (existing) throw new Error(`A template with the name "${normalizedName}" already exists.`)

  const created = await db.transaction(async (tx) => {
    await tx.update(schema.DashboardTemplate)
      .set({ isActive: false })
      .where(and(
        eq(schema.DashboardTemplate.userId, userId),
        eq(schema.DashboardTemplate.isActive, true),
      ))
    const [template] = await tx.insert(schema.DashboardTemplate).values({
      id: crypto.randomUUID(),
      userId,
      name: normalizedName,
      isActive: true,
      isDefault: false,
      layout: canonicalLayout() as any,
      updatedAt: new Date(),
    }).returning()
    if (!template) throw new Error('Failed to create template')
    await recordAuditEvent({
      userId,
      action: 'DASHBOARD_TEMPLATE_CREATED',
      entityType: 'DashboardTemplate',
      entityId: template.id,
      source: context.source,
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      afterData: { name: normalizedName },
    }, tx as never)
    return template
  })

  return serializeTemplate(created)
}

export async function deleteDashboardTemplateForUser(
  userId: string,
  templateId: string,
  context: MutationContext,
): Promise<void> {
  const template = await db.query.DashboardTemplate.findFirst({
    where: (table, operators) => operators.and(
      operators.eq(table.id, templateId),
      operators.eq(table.userId, userId),
    ),
  })
  if (!template) throw new Error('Template not found')
  if (template.isDefault) throw new Error('Cannot delete default template')

  await db.transaction(async (tx) => {
    if (template.isActive) {
      await tx.update(schema.DashboardTemplate)
        .set({ isActive: true })
        .where(and(
          eq(schema.DashboardTemplate.userId, userId),
          eq(schema.DashboardTemplate.isDefault, true),
        ))
    }
    await tx.delete(schema.DashboardTemplate).where(and(
      eq(schema.DashboardTemplate.id, templateId),
      eq(schema.DashboardTemplate.userId, userId),
    ))
    await recordAuditEvent({
      userId,
      action: 'DASHBOARD_TEMPLATE_DELETED',
      entityType: 'DashboardTemplate',
      entityId: templateId,
      source: context.source,
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      beforeData: { name: template.name, wasActive: template.isActive },
      afterData: null,
    }, tx as never)
  })
}

export async function switchDashboardTemplateForUser(
  userId: string,
  templateId: string,
  context: MutationContext,
): Promise<DashboardTemplate> {
  const updated = await db.transaction(async (tx) => {
    const target = await tx.query.DashboardTemplate.findFirst({
      where: (table, operators) => operators.and(
        operators.eq(table.id, templateId),
        operators.eq(table.userId, userId),
      ),
    })
    if (!target) throw new Error('Template not found')

    await tx.update(schema.DashboardTemplate)
      .set({ isActive: false })
      .where(and(
        eq(schema.DashboardTemplate.userId, userId),
        eq(schema.DashboardTemplate.isActive, true),
      ))
    const [template] = await tx.update(schema.DashboardTemplate)
      .set({ isActive: true })
      .where(and(
        eq(schema.DashboardTemplate.id, templateId),
        eq(schema.DashboardTemplate.userId, userId),
      ))
      .returning()
    if (!template) throw new Error('Template not found')
    await recordAuditEvent({
      userId,
      action: 'DASHBOARD_TEMPLATE_ACTIVATED',
      entityType: 'DashboardTemplate',
      entityId: templateId,
      source: context.source,
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      afterData: { name: template.name },
    }, tx as never)
    return template
  })

  return serializeTemplate(updated)
}

export async function updateDashboardTemplateLayoutForUser(
  userId: string,
  templateId: string,
  layout: WidgetLayout[],
  context: MutationContext,
): Promise<DashboardTemplate> {
  if (!Array.isArray(layout) || layout.length > 100) {
    throw new Error('Invalid dashboard layout')
  }

  const updated = await db.transaction(async (tx) => {
    const target = await tx.query.DashboardTemplate.findFirst({
      where: (table, operators) => operators.and(
        operators.eq(table.id, templateId),
        operators.eq(table.userId, userId),
      ),
    })
    if (!target) throw new Error('Template not found')
    if (target.isDefault) throw new Error('Cannot modify default template layout')

    const [template] = await tx.update(schema.DashboardTemplate)
      .set({ layout: layout as any, updatedAt: new Date() })
      .where(and(
        eq(schema.DashboardTemplate.id, templateId),
        eq(schema.DashboardTemplate.userId, userId),
      ))
      .returning()
    if (!template) throw new Error('Template not found')
    await recordAuditEvent({
      userId,
      action: 'DASHBOARD_TEMPLATE_LAYOUT_UPDATED',
      entityType: 'DashboardTemplate',
      entityId: templateId,
      source: context.source,
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      afterData: { widgetCount: layout.length },
    }, tx as never)
    return template
  })

  return serializeTemplate(updated)
}
