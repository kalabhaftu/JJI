import { relations } from 'drizzle-orm';
import { pgTable, uuid, text, integer, boolean, timestamp, jsonb, doublePrecision, json } from 'drizzle-orm/pg-core';
import { AdminFeatureFlag, AdminSharingPolicy, User, UserSettings, ImportJob, Notification, Feedback, UserGeoLog, SharedReport, Subscription, Synchronization } from './users';
import { Trade, TradeExecution, TradeTag } from './trades';

export const TradingModel = pgTable('TradingModel', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('userId').notNull().references(() => User.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  rules: jsonb('rules').default('[]'),
  setups: jsonb('setups').default('[]'),
  notes: text('notes'),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull().$onUpdateFn(() => new Date()),
});

export type TradingModelType = typeof TradingModel.$inferSelect;
export type NewTradingModel = typeof TradingModel.$inferInsert;

export const ActivityLog = pgTable('ActivityLog', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('userId').notNull().references(() => User.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: text('entityId'),
  metadata: jsonb('metadata'),
  ipAddress: text('ipAddress'),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow(),
});

export type ActivityLogType = typeof ActivityLog.$inferSelect;
export type NewActivityLog = typeof ActivityLog.$inferInsert;

export const UserGoal = pgTable('UserGoal', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('userId').notNull().references(() => User.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  metric: text('metric').notNull(),
  targetValue: doublePrecision('targetValue').notNull(),
  currentValue: doublePrecision('currentValue').default(0),
  period: text('period').notNull(),
  startDate: timestamp('startDate', { withTimezone: true, mode: 'date' }).notNull(),
  endDate: timestamp('endDate', { withTimezone: true, mode: 'date' }),
  isCompleted: boolean('isCompleted').default(false),
  completedAt: timestamp('completedAt', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull().$onUpdateFn(() => new Date()),
});

export type UserGoalType = typeof UserGoal.$inferSelect;
export type NewUserGoal = typeof UserGoal.$inferInsert;

export const TradingModelRelations = relations(TradingModel, ({ one, many }) => ({
  User: one(User, {
    fields: [TradingModel.userId],
    references: [User.id]
  }),
  Trade: many(Trade),
}));

export const ActivityLogRelations = relations(ActivityLog, ({ one, many }) => ({
  User: one(User, {
    fields: [ActivityLog.userId],
    references: [User.id]
  }),
}));

export const UserGoalRelations = relations(UserGoal, ({ one, many }) => ({
  User: one(User, {
    fields: [UserGoal.userId],
    references: [User.id]
  }),
}));
