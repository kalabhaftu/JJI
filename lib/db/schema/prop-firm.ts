import { relations } from 'drizzle-orm';
import { pgTable, uuid, text, integer, boolean, timestamp, jsonb, doublePrecision, json, uniqueIndex } from 'drizzle-orm/pg-core';
import { BreachTypeEnum } from './enums';
import { Account, LiveAccountTransaction, MasterAccount, Payout, PhaseAccount } from './accounts';

export const BreachRecord = pgTable('BreachRecord', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  phaseAccountId: text('phaseAccountId').notNull(),
  breachType: BreachTypeEnum('breachType').notNull(),
  breachAmount: doublePrecision('breachAmount').notNull(),
  breachTime: timestamp('breachTime', { withTimezone: true, mode: 'date' }).defaultNow(),
  currentEquity: doublePrecision('currentEquity').notNull(),
  accountSize: doublePrecision('accountSize').notNull(),
  dailyStartBalance: doublePrecision('dailyStartBalance'),
  highWaterMark: doublePrecision('highWaterMark'),
  tradeId: text('tradeId'),
  notes: text('notes'),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull().$onUpdateFn(() => new Date()),
});

export type BreachRecordType = typeof BreachRecord.$inferSelect;
export type NewBreachRecord = typeof BreachRecord.$inferInsert;

export const DailyAnchor = pgTable('DailyAnchor', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  phaseAccountId: text('phaseAccountId').notNull(),
  date: timestamp('date', { withTimezone: true, mode: 'date' }).notNull(),
  anchorEquity: doublePrecision('anchorEquity').notNull(),
  computedAt: timestamp('computedAt', { withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => [
  uniqueIndex('DailyAnchor_phaseAccountId_date_key').on(table.phaseAccountId, table.date),
]);

export type DailyAnchorType = typeof DailyAnchor.$inferSelect;
export type NewDailyAnchor = typeof DailyAnchor.$inferInsert;

export const BreachRecordRelations = relations(BreachRecord, ({ one, many }) => ({
  PhaseAccount: one(PhaseAccount, {
    fields: [BreachRecord.phaseAccountId],
    references: [PhaseAccount.id]
  }),
}));

export const DailyAnchorRelations = relations(DailyAnchor, ({ one, many }) => ({
  PhaseAccount: one(PhaseAccount, {
    fields: [DailyAnchor.phaseAccountId],
    references: [PhaseAccount.id]
  }),
}));
