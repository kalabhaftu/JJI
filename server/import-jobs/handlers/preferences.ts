import { and, eq } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import {
  buildUserSettingsUpdateData,
  extractUserSettingsWriteData,
  pickSettingsPatch,
} from '@/lib/user-settings'
import type { ImportPreparationHandler } from '@/server/import-jobs/preparation-types'

export const prepareUser: ImportPreparationHandler = async (
  data,
  internalUserId,
) => {
  if (!data.user) return

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
    await tx.update(schema.User)
      .set({
        firstName: data.user.firstName,
        lastName: data.user.lastName,
      })
      .where(eq(schema.User.id, internalUserId))

    const existingSettings = await tx.query.UserSettings.findFirst({
      where: (table, operators) => operators.eq(table.userId, internalUserId),
    })
    if (existingSettings) {
      await tx.update(schema.UserSettings)
        .set(buildUserSettingsUpdateData(settingsPatch))
        .where(eq(schema.UserSettings.userId, internalUserId))
    } else {
      await tx.insert(schema.UserSettings).values({
        userId: internalUserId,
        ...extractUserSettingsWriteData(settingsPatch),
        updatedAt: new Date(),
      })
    }
  })
}

export const prepareTradeTags: ImportPreparationHandler = async (
  data,
  internalUserId,
) => {
  for (const tag of data.tradeTags ?? []) {
    if (!tag?.name) continue
    const existing = await db.query.TradeTag.findFirst({
      where: (table, operators) => operators.and(
        operators.eq(table.name, tag.name),
        operators.eq(table.userId, internalUserId),
      ),
    })
    if (existing) {
      await db.update(schema.TradeTag)
        .set({ color: tag.color })
        .where(and(
          eq(schema.TradeTag.name, tag.name),
          eq(schema.TradeTag.userId, internalUserId),
        ))
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

export const prepareTradingModels: ImportPreparationHandler = async (
  data,
  internalUserId,
) => {
  for (const model of data.tradingModels ?? []) {
    if (!model?.name) continue
    const existing = await db.query.TradingModel.findFirst({
      where: (table, operators) => operators.and(
        operators.eq(table.userId, internalUserId),
        operators.eq(table.name, model.name),
      ),
    })
    if (existing) {
      await db.update(schema.TradingModel)
        .set({ rules: model.rules, notes: model.notes })
        .where(and(
          eq(schema.TradingModel.userId, internalUserId),
          eq(schema.TradingModel.name, model.name),
        ))
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

export const prepareDashboardTemplates: ImportPreparationHandler = async (
  data,
  internalUserId,
) => {
  for (const template of data.dashboardTemplates ?? []) {
    if (!template?.name) continue
    const existing = await db.query.DashboardTemplate.findFirst({
      where: (table, operators) => operators.and(
        operators.eq(table.userId, internalUserId),
        operators.eq(table.name, template.name),
      ),
    })
    if (existing) {
      await db.update(schema.DashboardTemplate)
        .set({
          layout: template.layout,
          isActive: template.isActive,
          isDefault: template.isDefault,
        })
        .where(and(
          eq(schema.DashboardTemplate.userId, internalUserId),
          eq(schema.DashboardTemplate.name, template.name),
        ))
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
