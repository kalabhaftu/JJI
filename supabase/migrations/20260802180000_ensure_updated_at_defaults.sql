-- Ensures updatedAt columns carry a database default for inserts.
-- The Drizzle schema declares updatedAt as NOT NULL DEFAULT now(), but the
-- production database drifted (migration 0001 was edited after it had been
-- applied), causing inserts that omit updatedAt to violate the not-null
-- constraint. These statements are idempotent.
ALTER TABLE "Account" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "AdminAISetting" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "AdminDashboardPreset" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "AdminFeatureFlag" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "AdminSharingPolicy" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "AdminWidgetSetting" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "AIChat" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "AISavedInsight" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "BacktestTrade" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "BreachRecord" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "DailyNote" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "DashboardTemplate" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "DonationAddress" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "Feedback" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "FreeAccessInvite" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "ImportJob" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "JournalTemplate" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "Notification" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "Payout" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "PaymentRecord" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "PromoCode" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "SharedReport" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "SiteUiSettings" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "Subscription" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "Synchronization" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "TradeExecution" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "TradeTag" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "TradingModel" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "UserGoal" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "UserSettings" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "WeeklyReview" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "WhopMembership" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "WhopWebhookEvent" ALTER COLUMN "updatedAt" SET DEFAULT now();
