import { relations } from 'drizzle-orm';
import { pgTable, uuid, text, integer, boolean, timestamp, jsonb, doublePrecision, json } from 'drizzle-orm/pg-core';
import { JournalEmotionEnum, WeeklyExpectationEnum } from './enums';
import { Account, LiveAccountTransaction, MasterAccount, Payout, PhaseAccount } from './accounts';
import { AdminFeatureFlag, AdminSharingPolicy, User, UserSettings, ImportJob, Notification, Feedback, UserGeoLog, SharedReport, Subscription, Synchronization } from './users';

export const DailyNote = pgTable('DailyNote', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('userId').notNull().references(() => User.id, { onDelete: 'cascade' }),
  date: timestamp('date', { withTimezone: true, mode: 'date' }).notNull(),
  note: text('note').notNull(),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull().$onUpdateFn(() => new Date()),
  accountId: text('accountId'),
  emotion: JournalEmotionEnum('emotion'),
});

export type DailyNoteType = typeof DailyNote.$inferSelect;
export type NewDailyNote = typeof DailyNote.$inferInsert;

export const JournalTemplate = pgTable('JournalTemplate', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('userId').notNull().references(() => User.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  content: jsonb('content').notNull(),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull().$onUpdateFn(() => new Date()),
});

export type JournalTemplateType = typeof JournalTemplate.$inferSelect;
export type NewJournalTemplate = typeof JournalTemplate.$inferInsert;

export const WeeklyReview = pgTable('WeeklyReview', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('userId').notNull().references(() => User.id, { onDelete: 'cascade' }),
  startDate: timestamp('startDate', { withTimezone: true, mode: 'date' }).notNull(),
  endDate: timestamp('endDate', { withTimezone: true, mode: 'date' }).notNull(),
  calendarImage: text('calendarImage'),
  expectation: WeeklyExpectationEnum('expectation'),
  actualOutcome: WeeklyExpectationEnum('actualOutcome'),
  isCorrect: boolean('isCorrect'),
  notes: text('notes'),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull().$onUpdateFn(() => new Date()),
});

export type WeeklyReviewType = typeof WeeklyReview.$inferSelect;
export type NewWeeklyReview = typeof WeeklyReview.$inferInsert;

export const DailyNoteRelations = relations(DailyNote, ({ one, many }) => ({
  Account: one(Account, {
    fields: [DailyNote.accountId],
    references: [Account.id]
  }),
  User: one(User, {
    fields: [DailyNote.userId],
    references: [User.id]
  }),
}));

export const JournalTemplateRelations = relations(JournalTemplate, ({ one, many }) => ({
  User: one(User, {
    fields: [JournalTemplate.userId],
    references: [User.id]
  }),
}));

export const WeeklyReviewRelations = relations(WeeklyReview, ({ one, many }) => ({
  User: one(User, {
    fields: [WeeklyReview.userId],
    references: [User.id]
  }),
}));
