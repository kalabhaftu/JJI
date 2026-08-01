import { relations } from 'drizzle-orm';
import { pgTable, uuid, text, integer, boolean, timestamp, jsonb, doublePrecision, json, index } from 'drizzle-orm/pg-core';
import { TransactionTypeEnum, MasterAccountStatusEnum, PayoutStatusEnum, PhaseAccountStatusEnum, DrawdownTypeEnum } from './enums';
import { AdminFeatureFlag, AdminSharingPolicy, User, UserSettings, ImportJob, Notification, Feedback, UserGeoLog, SharedReport, Subscription, Synchronization } from './users';
import { DailyNote, JournalTemplate, WeeklyReview } from './journal';
import { Trade, TradeExecution, TradeTag } from './trades';
import { BreachRecord, DailyAnchor } from './prop-firm';

export const Account = pgTable('Account', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  number: text('number').notNull(),
  name: text('name'),
  broker: text('broker'),
  startingBalance: doublePrecision('startingBalance').default(0),
  userId: text('userId').notNull().references(() => User.id, { onDelete: 'cascade' }),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull().$onUpdateFn(() => new Date()),
  isArchived: boolean('isArchived').default(false),
  isConfigured: boolean('isConfigured').default(false),
  isOnboardingSample: boolean('isOnboardingSample').default(false).notNull(),
}, (table) => ({
  userNumberIdx: index('account_user_number_idx').on(table.userId, table.number),
}));

export type AccountType = typeof Account.$inferSelect;
export type NewAccount = typeof Account.$inferInsert;

export const LiveAccountTransaction = pgTable('LiveAccountTransaction', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  accountId: text('accountId').notNull().references(() => Account.id, { onDelete: 'cascade' }),
  userId: text('userId').notNull().references(() => User.id, { onDelete: 'cascade' }),
  type: TransactionTypeEnum('type').notNull(),
  amount: doublePrecision('amount').notNull(),
  description: text('description'),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow(),
});

export type LiveAccountTransactionType = typeof LiveAccountTransaction.$inferSelect;
export type NewLiveAccountTransaction = typeof LiveAccountTransaction.$inferInsert;

export const MasterAccount = pgTable('MasterAccount', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('userId').notNull().references(() => User.id, { onDelete: 'cascade' }),
  accountName: text('accountName').notNull(),
  propFirmName: text('propFirmName').notNull(),
  accountSize: doublePrecision('accountSize').notNull(),
  evaluationType: text('evaluationType').notNull(),
  currentPhase: integer('currentPhase').notNull(),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow(),
  status: MasterAccountStatusEnum('status').default('active'),
  isArchived: boolean('isArchived').default(false),
}, (table) => ({
  userStatusIdx: index('master_account_user_status_idx').on(table.userId, table.status),
}));

export type MasterAccountType = typeof MasterAccount.$inferSelect;
export type NewMasterAccount = typeof MasterAccount.$inferInsert;

export const Payout = pgTable('Payout', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  masterAccountId: text('masterAccountId').notNull().references(() => MasterAccount.id, { onDelete: 'cascade' }),
  phaseAccountId: text('phaseAccountId').notNull().references(() => PhaseAccount.id, { onDelete: 'cascade' }),
  amount: doublePrecision('amount').notNull(),
  status: PayoutStatusEnum('status').default('pending'),
  requestDate: timestamp('requestDate', { withTimezone: true, mode: 'date' }).defaultNow(),
  approvedDate: timestamp('approvedDate', { withTimezone: true, mode: 'date' }),
  paidDate: timestamp('paidDate', { withTimezone: true, mode: 'date' }),
  rejectedDate: timestamp('rejectedDate', { withTimezone: true, mode: 'date' }),
  notes: text('notes'),
  rejectionReason: text('rejectionReason'),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull().$onUpdateFn(() => new Date()),
});

export type PayoutType = typeof Payout.$inferSelect;
export type NewPayout = typeof Payout.$inferInsert;

export const PhaseAccount = pgTable('PhaseAccount', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  masterAccountId: text('masterAccountId').notNull().references(() => MasterAccount.id, { onDelete: 'cascade' }),
  phaseNumber: integer('phaseNumber').notNull(),
  phaseId: text('phaseId'),
  accountSize: doublePrecision('accountSize'),
  status: PhaseAccountStatusEnum('status').default('active'),
  profitTargetPercent: doublePrecision('profitTargetPercent').notNull(),
  dailyDrawdownPercent: doublePrecision('dailyDrawdownPercent').notNull(),
  maxDrawdownPercent: doublePrecision('maxDrawdownPercent').notNull(),
  maxDrawdownType: DrawdownTypeEnum('maxDrawdownType').default('static'),
  minTradingDays: integer('minTradingDays').default(0),
  timeLimitDays: integer('timeLimitDays'),
  consistencyRulePercent: doublePrecision('consistencyRulePercent').default(0),
  profitSplitPercent: doublePrecision('profitSplitPercent'),
  payoutCycleDays: integer('payoutCycleDays'),
  minProfitForPayout: doublePrecision('minProfitForPayout'),
  startDate: timestamp('startDate', { withTimezone: true, mode: 'date' }).defaultNow(),
  endDate: timestamp('endDate', { withTimezone: true, mode: 'date' }),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => {
  return {
    masterAccountIdIdx: index('phase_account_master_account_id_idx').on(table.masterAccountId),
    statusIdx: index('phase_account_status_idx').on(table.status),
  };
});

export type PhaseAccountType = typeof PhaseAccount.$inferSelect;
export type NewPhaseAccount = typeof PhaseAccount.$inferInsert;

export const AccountRelations = relations(Account, ({ one, many }) => ({
  User: one(User, {
    fields: [Account.userId],
    references: [User.id]
  }),
  DailyNote: many(DailyNote),
  LiveAccountTransaction: many(LiveAccountTransaction),
  Trade: many(Trade),
}));

export const LiveAccountTransactionRelations = relations(LiveAccountTransaction, ({ one, many }) => ({
  Account: one(Account, {
    fields: [LiveAccountTransaction.accountId],
    references: [Account.id]
  }),
  User: one(User, {
    fields: [LiveAccountTransaction.userId],
    references: [User.id]
  }),
}));

export const MasterAccountRelations = relations(MasterAccount, ({ one, many }) => ({
  User: one(User, {
    fields: [MasterAccount.userId],
    references: [User.id]
  }),
  Payout: many(Payout),
  PhaseAccount: many(PhaseAccount),
}));

export const PayoutRelations = relations(Payout, ({ one, many }) => ({
  MasterAccount: one(MasterAccount, {
    fields: [Payout.masterAccountId],
    references: [MasterAccount.id]
  }),
  PhaseAccount: one(PhaseAccount, {
    fields: [Payout.phaseAccountId],
    references: [PhaseAccount.id]
  }),
}));

export const PhaseAccountRelations = relations(PhaseAccount, ({ one, many }) => ({
  BreachRecord: many(BreachRecord),
  DailyAnchor: many(DailyAnchor),
  Payout: many(Payout),
  MasterAccount: one(MasterAccount, {
    fields: [PhaseAccount.masterAccountId],
    references: [MasterAccount.id]
  }),
  Trade: many(Trade),
}));
