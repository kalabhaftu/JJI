import { relations } from 'drizzle-orm';
import { pgTable, uuid, text, integer, boolean, timestamp, jsonb, doublePrecision, json } from 'drizzle-orm/pg-core';
import { BacktestDirectionEnum, BacktestOutcomeEnum, BacktestSessionEnum, BacktestModelEnum } from './enums';
import { AdminFeatureFlag, AdminSharingPolicy, User, UserSettings, ImportJob, Notification, Feedback, UserGeoLog, SharedReport, Subscription, Synchronization } from './users';

export const BacktestTrade = pgTable('BacktestTrade', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('userId').notNull().references(() => User.id, { onDelete: 'cascade' }),
  pair: text('pair').notNull(),
  direction: BacktestDirectionEnum('direction').notNull(),
  outcome: BacktestOutcomeEnum('outcome').notNull(),
  session: BacktestSessionEnum('session').notNull(),
  model: BacktestModelEnum('model').notNull(),
  customModel: text('customModel'),
  riskRewardRatio: doublePrecision('riskRewardRatio').notNull(),
  entryPrice: doublePrecision('entryPrice').notNull(),
  stopLoss: doublePrecision('stopLoss').notNull(),
  takeProfit: doublePrecision('takeProfit').notNull(),
  exitPrice: doublePrecision('exitPrice').notNull(),
  pnl: doublePrecision('pnl').notNull(),
  imageOne: text('imageOne'),
  imageTwo: text('imageTwo'),
  imageThree: text('imageThree'),
  imageFour: text('imageFour'),
  imageFive: text('imageFive'),
  imageSix: text('imageSix'),
  cardPreviewImage: text('cardPreviewImage'),
  notes: text('notes'),
  tags: text('tags').array().notNull(),
  dateExecuted: timestamp('dateExecuted', { withTimezone: true, mode: 'date' }).notNull(),
  backtestDate: timestamp('backtestDate', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull().$onUpdateFn(() => new Date()),
  riskPoints: doublePrecision('riskPoints').default(0),
  rewardPoints: doublePrecision('rewardPoints').default(0),
});

export type BacktestTradeType = typeof BacktestTrade.$inferSelect;
export type NewBacktestTrade = typeof BacktestTrade.$inferInsert;

export const BacktestTradeRelations = relations(BacktestTrade, ({ one, many }) => ({
  User: one(User, {
    fields: [BacktestTrade.userId],
    references: [User.id]
  }),
}));
