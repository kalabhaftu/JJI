import { relations } from 'drizzle-orm';
import { pgTable, uuid, text, integer, boolean, timestamp, jsonb, doublePrecision, json, customType, index } from 'drizzle-orm/pg-core';
import { UserRoleEnum, ImportJobStatusEnum, NotificationTypeEnum, NotificationPriorityEnum, FeedbackCategoryEnum, FeedbackStatusEnum, SubscriptionStatusEnum } from './enums';
import { Account, LiveAccountTransaction, MasterAccount, Payout, PhaseAccount } from './accounts';
import { BacktestTrade } from './backtest';
import { DailyNote, JournalTemplate, WeeklyReview } from './journal';
import { DashboardTemplate, AdminWidgetSetting, AdminDashboardPreset } from './dashboard';
import { Trade, TradeExecution, TradeTag } from './trades';
import { TradingModel, ActivityLog, UserGoal } from './playbook';
import { WeeklyAIReview, AIChat, AISavedInsight, AIChatMessage, AdminAISetting, AIChatUsageLog } from './ai';
import { FeedbackReply, DonationAddress, SiteUiSettings, PaymentRecord, PromoCode, PromoRedemption, FreeAccessInvite } from './misc';

export const AdminFeatureFlag = pgTable('AdminFeatureFlag', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  key: text('key').notNull().unique(),
  label: text('label').notNull(),
  description: text('description'),
  enabled: boolean('enabled').default(false),
  internalOnly: boolean('internalOnly').default(false),
  roleGate: text('roleGate'),
  cohort: text('cohort'),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull().$onUpdateFn(() => new Date()),
});

export type AdminFeatureFlagType = typeof AdminFeatureFlag.$inferSelect;
export type NewAdminFeatureFlag = typeof AdminFeatureFlag.$inferInsert;

export const AdminSharingPolicy = pgTable('AdminSharingPolicy', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  key: text('key').unique().default('default'),
  publicSharingEnabled: boolean('publicSharingEnabled').default(true),
  defaultExpirationDays: integer('defaultExpirationDays'),
  requireExpiration: boolean('requireExpiration').default(false),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull().$onUpdateFn(() => new Date()),
});

export type AdminSharingPolicyType = typeof AdminSharingPolicy.$inferSelect;
export type NewAdminSharingPolicy = typeof AdminSharingPolicy.$inferInsert;

export const User = pgTable('User', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  auth_user_id: text('auth_user_id').notNull().unique(),
  isFirstConnection: boolean('isFirstConnection').default(true),
  firstName: text('firstName'),
  lastName: text('lastName'),
  role: UserRoleEnum('role').default('user'),
  onboardingStatus: jsonb('onboarding_status'),
  etpToken: text('etpToken'),
  thorToken: text('thorToken'),
  fcmToken: text('fcmToken'),
});

export type UserType = typeof User.$inferSelect;
export type NewUser = typeof User.$inferInsert;

export const UserSettings = pgTable('UserSettings', {
  userId: text('userId').primaryKey(),
  timezone: text('timezone').default('America/New_York'),
  theme: text('theme').default('system'),
  accountFilterSettings: text('accountFilterSettings'),
  aiSettings: jsonb('aiSettings'),
  backtestInputMode: text('backtestInputMode').default('manual'),
  breakEvenThreshold: doublePrecision('breakEvenThreshold').default(10),
  pnlDisplayMode: text('pnlDisplayMode').default('net'),
  accentPack: text('accentPack').default('classic'),
  widgetStyle: text('widgetStyle').default('default'),
  chartStyle: text('chartStyle').default('smooth'),
  autoAdjustAccountDate: boolean('autoAdjustAccountDate').default(false),
  webhookToken: text('webhookToken').unique(),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull().$onUpdateFn(() => new Date()),
});

export type UserSettingsType = typeof UserSettings.$inferSelect;
export type NewUserSettings = typeof UserSettings.$inferInsert;

export const ImportJob = pgTable('ImportJob', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('userId').notNull(),
  status: ImportJobStatusEnum('status').default('queued'),
  stage: text('stage').default('queued'),
  progress: integer('progress').default(0),
  totalItems: integer('totalItems').default(0),
  processedItems: integer('processedItems').default(0),
  importedCount: integer('importedCount').default(0),
  skippedCount: integer('skippedCount').default(0),
  fileName: text('fileName').notNull(),
  fileSize: integer('fileSize').notNull(),
  fileData: customType<{ data: Buffer; driverData: Buffer }>({ dataType() { return 'bytea'; } })('fileData').notNull(),
  state: jsonb('state'),
  error: text('error'),
  cancelRequested: boolean('cancelRequested').default(false),
  startedAt: timestamp('startedAt', { withTimezone: true, mode: 'date' }),
  completedAt: timestamp('completedAt', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull().$onUpdateFn(() => new Date()),
});

export type ImportJobType = typeof ImportJob.$inferSelect;
export type NewImportJob = typeof ImportJob.$inferInsert;

export const Notification = pgTable('Notification', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('userId').notNull(),
  type: NotificationTypeEnum('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  data: jsonb('data'),
  isRead: boolean('isRead').default(false),
  actionRequired: boolean('actionRequired').default(false),
  invalidationKey: text('invalidationKey'),
  priority: NotificationPriorityEnum('priority').default('MEDIUM'),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull().$onUpdateFn(() => new Date()),
});

export type NotificationRow = typeof Notification.$inferSelect;
export type NotificationType = (typeof NotificationTypeEnum.enumValues)[number];
export type NotificationPriority = (typeof NotificationPriorityEnum.enumValues)[number];
export type NewNotification = typeof Notification.$inferInsert;

export const Feedback = pgTable('Feedback', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('userId'),
  name: text('name'),
  email: text('email'),
  category: FeedbackCategoryEnum('category').notNull(),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  attachments: jsonb('attachments'),
  status: FeedbackStatusEnum('status').default('OPEN'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  country: text('country'),
  city: text('city'),
  region: text('region'),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull().$onUpdateFn(() => new Date()),
});

export type FeedbackType = typeof Feedback.$inferSelect;
export type NewFeedback = typeof Feedback.$inferInsert;

export const UserGeoLog = pgTable('UserGeoLog', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('userId').notNull(),
  country: text('country'),
  countryCode: text('countryCode'),
  city: text('city'),
  region: text('region'),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  ipAddress: text('ipAddress'),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow(),
});

export type UserGeoLogType = typeof UserGeoLog.$inferSelect;
export type NewUserGeoLog = typeof UserGeoLog.$inferInsert;

export const SharedReport = pgTable('SharedReport', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('userId').notNull(),
  slug: text('slug').notNull().unique(),
  title: text('title').default('Trading Report'),
  dateFrom: text('dateFrom'),
  dateTo: text('dateTo'),
  accountId: text('accountId'),
  snapshot: jsonb('snapshot').notNull(),
  isPublic: boolean('isPublic').default(true),
  viewCount: integer('viewCount').default(0),
  expiresAt: timestamp('expiresAt', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull().$onUpdateFn(() => new Date()),
});

export type SharedReportType = typeof SharedReport.$inferSelect;
export type NewSharedReport = typeof SharedReport.$inferInsert;

export const Subscription = pgTable('Subscription', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('userId').notNull().unique(),
  status: SubscriptionStatusEnum('status').default('unpaid'),
  planId: text('planId').default('pro'),
  currentPeriodStart: timestamp('currentPeriodStart', { withTimezone: true, mode: 'date' }),
  currentPeriodEnd: timestamp('currentPeriodEnd', { withTimezone: true, mode: 'date' }),
  nextPaymentDue: timestamp('nextPaymentDue', { withTimezone: true, mode: 'date' }),
  cancelledAt: timestamp('cancelledAt', { withTimezone: true, mode: 'date' }),
  promoCodeId: text('promoCodeId'),
  freeAccessId: text('freeAccessId'),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull().$onUpdateFn(() => new Date()),
}, (table) => [
  index('Subscription_promoCodeId_idx').on(table.promoCodeId),
  index('Subscription_freeAccessId_idx').on(table.freeAccessId),
]);

export type SubscriptionType = typeof Subscription.$inferSelect;
export type NewSubscription = typeof Subscription.$inferInsert;

export const Synchronization = pgTable('Synchronization', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('userId').notNull(),
  service: text('service').notNull(),
  accountId: text('accountId').notNull(),
  lastSyncedAt: timestamp('lastSyncedAt', { withTimezone: true, mode: 'date' }).notNull(),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull().$onUpdateFn(() => new Date()),
  token: text('token'),
  tokenExpiresAt: timestamp('tokenExpiresAt', { withTimezone: true, mode: 'date' }),
  dailySyncTime: timestamp('dailySyncTime', { withTimezone: true, mode: 'date' }),
  includedFeeTypes: jsonb('includedFeeTypes'),
});

export type SynchronizationType = typeof Synchronization.$inferSelect;
export type NewSynchronization = typeof Synchronization.$inferInsert;

export const UserRelations = relations(User, ({ one, many }) => ({
  Account: many(Account),
  BacktestTrade: many(BacktestTrade),
  DailyNote: many(DailyNote),
  DashboardTemplate: many(DashboardTemplate),
  LiveAccountTransaction: many(LiveAccountTransaction),
  MasterAccount: many(MasterAccount),
  Notification: many(Notification),
  ImportJob: many(ImportJob),
  Feedback: many(Feedback),
  UserGeoLog: many(UserGeoLog),
  TradeTag: many(TradeTag),
  TradingModel: many(TradingModel),
  WeeklyReview: many(WeeklyReview),
  WeeklyAIReview: many(WeeklyAIReview),
  ActivityLog: many(ActivityLog),
  JournalTemplate: many(JournalTemplate),
  UserGoal: many(UserGoal),
  SharedReport: many(SharedReport),
  settings: one(UserSettings),
  Subscription: one(Subscription),
  AIChat: many(AIChat),
  AISavedInsight: many(AISavedInsight),
  synchronizations: many(Synchronization),
}));

export const UserSettingsRelations = relations(UserSettings, ({ one, many }) => ({
  User: one(User, {
    fields: [UserSettings.userId],
    references: [User.id]
  }),
}));

export const ImportJobRelations = relations(ImportJob, ({ one, many }) => ({
  User: one(User, {
    fields: [ImportJob.userId],
    references: [User.id]
  }),
}));

export const NotificationRelations = relations(Notification, ({ one, many }) => ({
  User: one(User, {
    fields: [Notification.userId],
    references: [User.id]
  }),
}));

export const FeedbackRelations = relations(Feedback, ({ one, many }) => ({
  User: one(User, {
    fields: [Feedback.userId],
    references: [User.id]
  }),
  Replies: many(FeedbackReply),
}));

export const UserGeoLogRelations = relations(UserGeoLog, ({ one, many }) => ({
  User: one(User, {
    fields: [UserGeoLog.userId],
    references: [User.id]
  }),
}));

export const SharedReportRelations = relations(SharedReport, ({ one, many }) => ({
  User: one(User, {
    fields: [SharedReport.userId],
    references: [User.id]
  }),
}));

export const SubscriptionRelations = relations(Subscription, ({ one, many }) => ({
  User: one(User, {
    fields: [Subscription.userId],
    references: [User.id]
  }),
  PromoCode: one(PromoCode, {
    fields: [Subscription.promoCodeId],
    references: [PromoCode.id]
  }),
  FreeAccess: one(FreeAccessInvite, {
    fields: [Subscription.freeAccessId],
    references: [FreeAccessInvite.id]
  }),
  PaymentRecord: many(PaymentRecord),
}));

export const SynchronizationRelations = relations(Synchronization, ({ one, many }) => ({
  user: one(User, {
    fields: [Synchronization.userId],
    references: [User.id]
  }),
}));
