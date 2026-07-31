import { relations } from 'drizzle-orm';
import { pgTable, uuid, text, integer, boolean, timestamp, jsonb, doublePrecision, json, index } from 'drizzle-orm/pg-core';
import { PromoTypeEnum, PromoApplicabilityEnum, FreeAccessTypeEnum } from './enums';
import { AdminFeatureFlag, AdminSharingPolicy, User, UserSettings, ImportJob, Notification, Feedback, UserGeoLog, SharedReport, Subscription, Synchronization } from './users';


export const FeedbackReply = pgTable('FeedbackReply', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  feedbackId: text('feedbackId').notNull().references(() => Feedback.id, { onDelete: 'cascade' }),
  message: text('message').notNull(),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow(),
});

export type FeedbackReplyType = typeof FeedbackReply.$inferSelect;
export type NewFeedbackReply = typeof FeedbackReply.$inferInsert;

export const DonationAddress = pgTable('DonationAddress', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  token: text('token').notNull(),
  network: text('network').notNull(),
  address: text('address').notNull(),
  isActive: boolean('isActive').default(true),
  sortOrder: integer('sortOrder').default(0),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull().$onUpdateFn(() => new Date()),
});

export type DonationAddressType = typeof DonationAddress.$inferSelect;
export type NewDonationAddress = typeof DonationAddress.$inferInsert;

export const SiteUiSettings = pgTable('SiteUiSettings', {
  id: text('id').primaryKey(),
  showDonateButton: boolean('showDonateButton').default(true),
  showFeedbackButton: boolean('showFeedbackButton').default(true),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull().$onUpdateFn(() => new Date()),
});

export type SiteUiSettingsType = typeof SiteUiSettings.$inferSelect;
export type NewSiteUiSettings = typeof SiteUiSettings.$inferInsert;

export const PaymentRecord = pgTable('PaymentRecord', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('userId').notNull().references(() => User.id, { onDelete: 'cascade' }),
  subscriptionId: text('subscriptionId').notNull().references(() => Subscription.id, { onDelete: 'cascade' }),
  planId: text('planId').default('pro'),
  amountUsd: doublePrecision('amountUsd').notNull(),
  provider: text('provider').default('nowpayments'),
  providerPaymentId: text('providerPaymentId').unique(),
  providerInvoiceId: text('providerInvoiceId').unique(),
  providerStatus: text('providerStatus'),
  payCurrency: text('payCurrency'),
  payAmount: doublePrecision('payAmount'),
  paymentUrl: text('paymentUrl'),
  invoiceUrl: text('invoiceUrl'),
  subscriptionPeriodStart: timestamp('subscriptionPeriodStart', { withTimezone: true, mode: 'date' }),
  subscriptionPeriodEnd: timestamp('subscriptionPeriodEnd', { withTimezone: true, mode: 'date' }),
  dueDate: timestamp('dueDate', { withTimezone: true, mode: 'date' }),
  paidAt: timestamp('paidAt', { withTimezone: true, mode: 'date' }),
  expiredAt: timestamp('expiredAt', { withTimezone: true, mode: 'date' }),
  rawProviderPayload: jsonb('rawProviderPayload'),
  promoCodeId: text('promoCodeId'),
  discountAmount: doublePrecision('discountAmount').default(0),
  // --- Whop-specific fields ---
  /** Whop membership ID (mem_xxx). Unique — one row per Whop membership. */
  whopMembershipId: text('whopMembershipId').unique(),
  /** Whop user ID attached to this membership. */
  whopUserId: text('whopUserId'),
  /** Whop plan ID this membership was purchased under. */
  whopPlanId: text('whopPlanId'),
  /** Whop product ID. */
  whopProductId: text('whopProductId'),
  /** 'sandbox' | 'production' — records which environment originated the event. */
  whopEnvironment: text('whopEnvironment'),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull().$onUpdateFn(() => new Date()),
}, (table) => [
  index('PaymentRecord_promoCodeId_idx').on(table.promoCodeId),
  index('PaymentRecord_whopMembershipId_idx').on(table.whopMembershipId),
]);

/**
 * WhopWebhookEvent — idempotency log for Whop webhook deliveries.
 *
 * Before processing any Whop event we attempt to INSERT a row here.
 * The UNIQUE constraint on `eventId` causes a conflict on duplicate delivery,
 * which we catch and treat as a no-op. This guarantees exactly-once processing
 * even when Whop re-delivers an event on retry.
 */
export const WhopWebhookEvent = pgTable('WhopWebhookEvent', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  /** Unique Whop event ID from the webhook payload. */
  eventId: text('eventId').notNull().unique(),
  /** e.g. 'membership.activated', 'payment.succeeded' */
  eventType: text('eventType').notNull(),
  /** The Whop membership ID referenced by this event, if applicable. */
  membershipId: text('membershipId'),
  /** Processing outcome: 'processed' | 'skipped' | 'error' */
  processingResult: text('processingResult').notNull(),
  /** Optional error message if processingResult is 'error'. */
  errorMessage: text('errorMessage'),
  /** Raw JSON payload (for debugging). Truncated to 64 KB. */
  rawPayload: jsonb('rawPayload'),
  processedAt: timestamp('processedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => [
  index('WhopWebhookEvent_eventType_idx').on(table.eventType),
  index('WhopWebhookEvent_membershipId_idx').on(table.membershipId),
]);

export type PaymentRecordType = typeof PaymentRecord.$inferSelect;
export type NewPaymentRecord = typeof PaymentRecord.$inferInsert;

export type WhopWebhookEventType = typeof WhopWebhookEvent.$inferSelect;
export type NewWhopWebhookEvent = typeof WhopWebhookEvent.$inferInsert;

export const PromoCode = pgTable('PromoCode', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  code: text('code').notNull().unique(),
  type: PromoTypeEnum('type').notNull(),
  applicability: PromoApplicabilityEnum('applicability').default('signup_only'),
  value: doublePrecision('value').notNull(),
  maxUses: integer('maxUses'),
  usesCount: integer('usesCount').default(0),
  validFrom: timestamp('validFrom', { withTimezone: true, mode: 'date' }).defaultNow(),
  validUntil: timestamp('validUntil', { withTimezone: true, mode: 'date' }),
  isActive: boolean('isActive').default(true),
  appliesToPlan: text('appliesToPlan').default('pro'),
  createdBy: text('createdBy'),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull().$onUpdateFn(() => new Date()),
});

export type PromoCodeType = typeof PromoCode.$inferSelect;
export type NewPromoCode = typeof PromoCode.$inferInsert;

export const PromoRedemption = pgTable('PromoRedemption', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  promoCodeId: text('promoCodeId').notNull(),
  userId: text('userId').notNull().references(() => User.id, { onDelete: 'cascade' }),
  redeemedAt: timestamp('redeemedAt', { withTimezone: true, mode: 'date' }).defaultNow(),
});

export type PromoRedemptionType = typeof PromoRedemption.$inferSelect;
export type NewPromoRedemption = typeof PromoRedemption.$inferInsert;

export const FreeAccessInvite = pgTable('FreeAccessInvite', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  type: FreeAccessTypeEnum('type').notNull(),
  expiresAt: timestamp('expiresAt', { withTimezone: true, mode: 'date' }),
  note: text('note'),
  grantedBy: text('grantedBy'),
  grantedAt: timestamp('grantedAt', { withTimezone: true, mode: 'date' }).defaultNow(),
  revokedAt: timestamp('revokedAt', { withTimezone: true, mode: 'date' }),
  isActive: boolean('isActive').default(true),
  registeredAt: timestamp('registeredAt', { withTimezone: true, mode: 'date' }),
  registeredUserId: text('registeredUserId'),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull().$onUpdateFn(() => new Date()),
});

export type FreeAccessInviteType = typeof FreeAccessInvite.$inferSelect;
export type NewFreeAccessInvite = typeof FreeAccessInvite.$inferInsert;

export const FeedbackReplyRelations = relations(FeedbackReply, ({ one, many }) => ({
  Feedback: one(Feedback, {
    fields: [FeedbackReply.feedbackId],
    references: [Feedback.id]
  }),
}));

export const PaymentRecordRelations = relations(PaymentRecord, ({ one, many }) => ({
  Subscription: one(Subscription, {
    fields: [PaymentRecord.subscriptionId],
    references: [Subscription.id]
  }),
  PromoCode: one(PromoCode, {
    fields: [PaymentRecord.promoCodeId],
    references: [PromoCode.id]
  }),
}));

export const PromoCodeRelations = relations(PromoCode, ({ one, many }) => ({
  Subscription: many(Subscription),
  PaymentRecord: many(PaymentRecord),
  PromoRedemption: many(PromoRedemption),
}));

export const PromoRedemptionRelations = relations(PromoRedemption, ({ one, many }) => ({
  PromoCode: one(PromoCode, {
    fields: [PromoRedemption.promoCodeId],
    references: [PromoCode.id]
  }),
}));

export const FreeAccessInviteRelations = relations(FreeAccessInvite, ({ one, many }) => ({
  Subscription: many(Subscription),
}));
