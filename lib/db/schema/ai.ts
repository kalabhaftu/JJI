import { relations } from 'drizzle-orm';
import { pgTable, uuid, text, integer, boolean, timestamp, jsonb, doublePrecision, json, uniqueIndex } from 'drizzle-orm/pg-core';
import { User } from './users';


export const WeeklyAIReview = pgTable('WeeklyAIReview', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('userId').notNull().references(() => User.id, { onDelete: 'cascade' }),
  weekStart: timestamp('weekStart', { withTimezone: true, mode: 'date' }).notNull(),
  weekEnd: timestamp('weekEnd', { withTimezone: true, mode: 'date' }).notNull(),
  summary: text('summary').notNull(),
  highlights: jsonb('highlights').default('[]'),
  lowlights: jsonb('lowlights').default('[]'),
  stats: jsonb('stats').default('{}'),
  grade: text('grade').default(''),
  focusNextWeek: text('focus_next_week'),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => ({
  userWeekUnique: uniqueIndex('WeeklyAIReview_userId_weekStart_key').on(table.userId, table.weekStart),
}));

export type WeeklyAIReviewType = typeof WeeklyAIReview.$inferSelect;
export type NewWeeklyAIReview = typeof WeeklyAIReview.$inferInsert;

export const AIChat = pgTable('AIChat', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('userId').notNull().references(() => User.id, { onDelete: 'cascade' }),
  title: text('title').default('New Conversation'),
  isPinned: boolean('isPinned').default(false),
  isArchived: boolean('isArchived').default(false),
  isDeleted: boolean('isDeleted').default(false),
  accounts: text('accounts').array().notNull(),
  dateRange: text('dateRange').notNull(),
  customFrom: timestamp('customFrom', { withTimezone: true, mode: 'date' }),
  customTo: timestamp('customTo', { withTimezone: true, mode: 'date' }),
  dataSources: text('dataSources').array().notNull(),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull().$onUpdateFn(() => new Date()),
});

export type AIChatType = typeof AIChat.$inferSelect;
export type NewAIChat = typeof AIChat.$inferInsert;

export const AISavedInsight = pgTable('AISavedInsight', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('userId').notNull().references(() => User.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  content: text('content').notNull(),
  category: text('category').default('insight'),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull().$onUpdateFn(() => new Date()),
});

export type AISavedInsightType = typeof AISavedInsight.$inferSelect;
export type NewAISavedInsight = typeof AISavedInsight.$inferInsert;

export const WeeklyAIReviewRelations = relations(WeeklyAIReview, ({ one, many }) => ({
  User: one(User, {
    fields: [WeeklyAIReview.userId],
    references: [User.id]
  }),
}));

export const AIChatRelations = relations(AIChat, ({ one, many }) => ({
  User: one(User, {
    fields: [AIChat.userId],
    references: [User.id]
  }),
  messages: many(AIChatMessage),
}));

export const AISavedInsightRelations = relations(AISavedInsight, ({ one, many }) => ({
  User: one(User, {
    fields: [AISavedInsight.userId],
    references: [User.id]
  }),
}));

export const AIChatMessage = pgTable('AIChatMessage', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  chatId: text('chatId').notNull().references(() => AIChat.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow(),
});

export type AIChatMessageType = typeof AIChatMessage.$inferSelect;
export type NewAIChatMessage = typeof AIChatMessage.$inferInsert;

export const AdminAISetting = pgTable('AdminAISetting', {
  id: text('id').primaryKey().default('global'),
  enabled: boolean('enabled').default(true),
  demoModeEnabled: boolean('demoModeEnabled').default(true),
  freePlanAccess: boolean('freePlanAccess').default(false),
  paidPlanAccess: boolean('paidPlanAccess').default(true),
  adminAccess: boolean('adminAccess').default(true),
  maxContextSize: integer('maxContextSize').default(32768),
  maxMessagesPerDay: integer('maxMessagesPerDay').default(50),
  maxTokensPerResponse: integer('maxTokensPerResponse').default(2048),
  conversationRetentionDays: integer('conversationRetentionDays').default(30),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull().$onUpdateFn(() => new Date()),
});

export type AdminAISettingType = typeof AdminAISetting.$inferSelect;
export type NewAdminAISetting = typeof AdminAISetting.$inferInsert;

export const AIChatUsageLog = pgTable('AIChatUsageLog', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('userId').notNull().references(() => User.id, { onDelete: 'cascade' }),
  chatId: text('chatId'),
  promptTokens: integer('promptTokens').default(0),
  completionTokens: integer('completionTokens').default(0),
  totalTokens: integer('totalTokens').default(0),
  estimatedCost: doublePrecision('estimatedCost').default(0),
  responseTimeMs: integer('responseTimeMs').default(0),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow(),
});

export type AIChatUsageLogType = typeof AIChatUsageLog.$inferSelect;
export type NewAIChatUsageLog = typeof AIChatUsageLog.$inferInsert;

export const AIChatMessageRelations = relations(AIChatMessage, ({ one, many }) => ({
  Chat: one(AIChat, {
    fields: [AIChatMessage.chatId],
    references: [AIChat.id]
  }),
}));
