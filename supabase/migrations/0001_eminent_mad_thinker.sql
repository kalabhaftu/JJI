CREATE TYPE "public"."backtest_direction" AS ENUM('BUY', 'SELL');
--> statement-breakpoint
CREATE TYPE "public"."backtest_model" AS ENUM('ICT_2022', 'MSNR', 'TTFM', 'PRICE_ACTION', 'SUPPLY_DEMAND', 'SMART_MONEY', 'CUSTOM');
--> statement-breakpoint
CREATE TYPE "public"."backtest_outcome" AS ENUM('WIN', 'LOSS', 'BREAKEVEN');
--> statement-breakpoint
CREATE TYPE "public"."backtest_session" AS ENUM('ASIAN', 'LONDON', 'NEW_YORK');
--> statement-breakpoint
CREATE TYPE "public"."breach_type" AS ENUM('daily_drawdown', 'max_drawdown');
--> statement-breakpoint
CREATE TYPE "public"."drawdown_type" AS ENUM('static', 'trailing');
--> statement-breakpoint
CREATE TYPE "public"."error_level" AS ENUM('WARNING', 'ERROR', 'CRITICAL');
--> statement-breakpoint
CREATE TYPE "public"."error_source" AS ENUM('CLIENT', 'SERVER', 'API');
--> statement-breakpoint
CREATE TYPE "public"."feedback_category" AS ENUM('BUG_REPORT', 'FEATURE_REQUEST', 'GENERAL', 'OTHER');
--> statement-breakpoint
CREATE TYPE "public"."feedback_status" AS ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
--> statement-breakpoint
CREATE TYPE "public"."free_access_type" AS ENUM('lifetime', 'until_date', 'one_time_signup');
--> statement-breakpoint
CREATE TYPE "public"."import_job_status" AS ENUM('queued', 'processing', 'completed', 'failed', 'cancelled');
--> statement-breakpoint
CREATE TYPE "public"."journal_emotion" AS ENUM('confident', 'anxious', 'focused', 'energetic', 'calm', 'frustrated', 'optimistic', 'pessimistic', 'disciplined', 'impulsive', 'happy', 'sad', 'neutral', 'tired', 'excited', 'stressed', 'relaxed');
--> statement-breakpoint
CREATE TYPE "public"."market_bias" AS ENUM('BULLISH', 'BEARISH', 'UNDECIDED');
--> statement-breakpoint
CREATE TYPE "public"."master_account_status" AS ENUM('active', 'funded', 'failed');
--> statement-breakpoint
CREATE TYPE "public"."notification_priority" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('FUNDED_PENDING_APPROVAL', 'FUNDED_APPROVED', 'FUNDED_DECLINED', 'PHASE_TRANSITION_PENDING', 'PAYOUT_APPROVED', 'PAYOUT_REJECTED', 'SYSTEM', 'RISK_ALERT', 'RISK_BREACH', 'IMPORT_STATUS', 'WEEKLY_PERFORMANCE', 'STRATEGY_DEVIATION', 'SYSTEM_ANNOUNCEMENT', 'TRADE_STATUS', 'RISK_DAILY_LOSS_80', 'RISK_DAILY_LOSS_95', 'RISK_MAX_DRAWDOWN_80', 'RISK_MAX_DRAWDOWN_95', 'IMPORT_PROCESSING', 'IMPORT_COMPLETE', 'STRATEGY_SESSION_VIOLATION', 'FEEDBACK_REPLY', 'PAYMENT_DUE_SOON', 'PAYMENT_DUE_TODAY', 'PAYMENT_OVERDUE', 'SUBSCRIPTION_EXPIRED', 'PAYMENT_RECEIVED', 'PAYMENT_FAILED', 'ACCESS_RESTORED', 'ADMIN_FREE_ACCESS_GRANTED', 'ADMIN_FREE_ACCESS_REVOKED');
--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'waiting', 'confirming', 'confirmed', 'sending', 'finished', 'partially_paid', 'failed', 'refunded', 'expired');
--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('pending', 'approved', 'paid', 'rejected');
--> statement-breakpoint
CREATE TYPE "public"."phase_account_status" AS ENUM('active', 'passed', 'failed', 'archived', 'pending', 'pending_approval');
--> statement-breakpoint
CREATE TYPE "public"."promo_applicability" AS ENUM('signup_only', 'renewal_only', 'any');
--> statement-breakpoint
CREATE TYPE "public"."promo_type" AS ENUM('percentage_discount', 'fixed_discount', 'free_months', 'lifetime_free');
--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'past_due', 'unpaid', 'expired', 'cancelled', 'free_access', 'invited_free', 'promo_active');
--> statement-breakpoint
CREATE TYPE "public"."trade_execution_kind" AS ENUM('ENTRY', 'EXIT');
--> statement-breakpoint
CREATE TYPE "public"."trade_outcome" AS ENUM('GOOD_WIN', 'BAD_WIN', 'GOOD_BE', 'BAD_BE', 'BREAKEVEN', 'GOOD_LOSS', 'BAD_LOSS');
--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('DEPOSIT', 'WITHDRAWAL');
--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');
--> statement-breakpoint
CREATE TYPE "public"."weekly_expectation" AS ENUM('BULLISH_EXPANSION', 'BEARISH_EXPANSION', 'CONSOLIDATION');
--> statement-breakpoint
ALTER TABLE "Account" ALTER COLUMN "updatedAt" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "LiveAccountTransaction" ALTER COLUMN "type" SET DATA TYPE "public"."transaction_type" USING "type"::text::"public"."transaction_type";
--> statement-breakpoint
ALTER TABLE "MasterAccount" ALTER COLUMN "status" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "MasterAccount" ALTER COLUMN "status" SET DATA TYPE "public"."master_account_status" USING "status"::text::"public"."master_account_status";
--> statement-breakpoint
ALTER TABLE "MasterAccount" ALTER COLUMN "status" SET DEFAULT 'active';
--> statement-breakpoint
ALTER TABLE "Payout" ALTER COLUMN "status" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "Payout" ALTER COLUMN "status" SET DATA TYPE "public"."payout_status" USING "status"::text::"public"."payout_status";
--> statement-breakpoint
ALTER TABLE "Payout" ALTER COLUMN "status" SET DEFAULT 'pending';
--> statement-breakpoint
ALTER TABLE "Payout" ALTER COLUMN "updatedAt" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "PhaseAccount" ALTER COLUMN "status" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "PhaseAccount" ALTER COLUMN "status" SET DATA TYPE "public"."phase_account_status" USING "status"::text::"public"."phase_account_status";
--> statement-breakpoint
ALTER TABLE "PhaseAccount" ALTER COLUMN "status" SET DEFAULT 'active';
--> statement-breakpoint
ALTER TABLE "PhaseAccount" ALTER COLUMN "maxDrawdownType" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "PhaseAccount" ALTER COLUMN "maxDrawdownType" SET DATA TYPE "public"."drawdown_type" USING "maxDrawdownType"::text::"public"."drawdown_type";
--> statement-breakpoint
ALTER TABLE "PhaseAccount" ALTER COLUMN "maxDrawdownType" SET DEFAULT 'static';
--> statement-breakpoint
ALTER TABLE "BacktestTrade" ALTER COLUMN "direction" SET DATA TYPE "public"."backtest_direction" USING "direction"::text::"public"."backtest_direction";
--> statement-breakpoint
ALTER TABLE "BacktestTrade" ALTER COLUMN "outcome" SET DATA TYPE "public"."backtest_outcome" USING "outcome"::text::"public"."backtest_outcome";
--> statement-breakpoint
ALTER TABLE "BacktestTrade" ALTER COLUMN "session" SET DATA TYPE "public"."backtest_session" USING "session"::text::"public"."backtest_session";
--> statement-breakpoint
ALTER TABLE "BacktestTrade" ALTER COLUMN "model" SET DATA TYPE "public"."backtest_model" USING "model"::text::"public"."backtest_model";
--> statement-breakpoint
ALTER TABLE "BacktestTrade" ALTER COLUMN "updatedAt" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "BreachRecord" ALTER COLUMN "breachType" SET DATA TYPE "public"."breach_type" USING "breachType"::text::"public"."breach_type";
--> statement-breakpoint
ALTER TABLE "BreachRecord" ALTER COLUMN "updatedAt" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "DailyNote" ALTER COLUMN "updatedAt" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "DailyNote" ALTER COLUMN "emotion" SET DATA TYPE "public"."journal_emotion" USING "emotion"::text::"public"."journal_emotion";
--> statement-breakpoint
ALTER TABLE "JournalTemplate" ALTER COLUMN "updatedAt" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "WeeklyReview" ALTER COLUMN "expectation" SET DATA TYPE "public"."weekly_expectation" USING "expectation"::text::"public"."weekly_expectation";
--> statement-breakpoint
ALTER TABLE "WeeklyReview" ALTER COLUMN "actualOutcome" SET DATA TYPE "public"."weekly_expectation" USING "actualOutcome"::text::"public"."weekly_expectation";
--> statement-breakpoint
ALTER TABLE "WeeklyReview" ALTER COLUMN "updatedAt" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "AdminDashboardPreset" ALTER COLUMN "updatedAt" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "AdminWidgetSetting" ALTER COLUMN "updatedAt" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "DashboardTemplate" ALTER COLUMN "updatedAt" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "AdminFeatureFlag" ALTER COLUMN "updatedAt" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "AdminSharingPolicy" ALTER COLUMN "updatedAt" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "Feedback" ALTER COLUMN "category" SET DATA TYPE "public"."feedback_category" USING "category"::text::"public"."feedback_category";
--> statement-breakpoint
ALTER TABLE "Feedback" ALTER COLUMN "status" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "Feedback" ALTER COLUMN "status" SET DATA TYPE "public"."feedback_status" USING "status"::text::"public"."feedback_status";
--> statement-breakpoint
ALTER TABLE "Feedback" ALTER COLUMN "status" SET DEFAULT 'OPEN';
--> statement-breakpoint
ALTER TABLE "Feedback" ALTER COLUMN "updatedAt" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "ImportJob" ALTER COLUMN "status" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "ImportJob" ALTER COLUMN "status" SET DATA TYPE "public"."import_job_status" USING "status"::text::"public"."import_job_status";
--> statement-breakpoint
ALTER TABLE "ImportJob" ALTER COLUMN "status" SET DEFAULT 'queued';
--> statement-breakpoint
ALTER TABLE "ImportJob" ALTER COLUMN "updatedAt" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "Notification" ALTER COLUMN "type" SET DATA TYPE "public"."notification_type" USING "type"::text::"public"."notification_type";
--> statement-breakpoint
ALTER TABLE "Notification" ALTER COLUMN "priority" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "Notification" ALTER COLUMN "priority" SET DATA TYPE "public"."notification_priority" USING "priority"::text::"public"."notification_priority";
--> statement-breakpoint
ALTER TABLE "Notification" ALTER COLUMN "priority" SET DEFAULT 'MEDIUM';
--> statement-breakpoint
ALTER TABLE "Notification" ALTER COLUMN "updatedAt" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "SharedReport" ALTER COLUMN "updatedAt" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "Subscription" ALTER COLUMN "status" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "Subscription" ALTER COLUMN "status" SET DATA TYPE "public"."subscription_status" USING "status"::text::"public"."subscription_status";
--> statement-breakpoint
ALTER TABLE "Subscription" ALTER COLUMN "status" SET DEFAULT 'unpaid';
--> statement-breakpoint
ALTER TABLE "Subscription" ALTER COLUMN "updatedAt" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "Synchronization" ALTER COLUMN "updatedAt" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "User" ALTER COLUMN "role" SET DATA TYPE "public"."user_role" USING "role"::text::"public"."user_role";
--> statement-breakpoint
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'user';
--> statement-breakpoint
ALTER TABLE "UserSettings" ADD PRIMARY KEY ("userId");
--> statement-breakpoint
ALTER TABLE "UserSettings" ALTER COLUMN "userId" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "UserSettings" ALTER COLUMN "updatedAt" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "Trade" ALTER COLUMN "marketBias" SET DATA TYPE "public"."market_bias" USING "marketBias"::text::"public"."market_bias";
--> statement-breakpoint
ALTER TABLE "Trade" ALTER COLUMN "outcome" SET DATA TYPE "public"."trade_outcome" USING "outcome"::text::"public"."trade_outcome";
--> statement-breakpoint
ALTER TABLE "TradeExecution" ALTER COLUMN "kind" SET DATA TYPE "public"."trade_execution_kind" USING "kind"::text::"public"."trade_execution_kind";
--> statement-breakpoint
ALTER TABLE "TradeExecution" ALTER COLUMN "updatedAt" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "TradeTag" ALTER COLUMN "updatedAt" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "TradingModel" ALTER COLUMN "updatedAt" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "UserGoal" ALTER COLUMN "updatedAt" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "AdminAISetting" ALTER COLUMN "updatedAt" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "DonationAddress" ALTER COLUMN "updatedAt" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "ErrorLog" ALTER COLUMN "source" SET DATA TYPE "public"."error_source" USING "source"::text::"public"."error_source";
--> statement-breakpoint
ALTER TABLE "ErrorLog" ALTER COLUMN "level" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "ErrorLog" ALTER COLUMN "level" SET DATA TYPE "public"."error_level" USING "level"::text::"public"."error_level";
--> statement-breakpoint
ALTER TABLE "ErrorLog" ALTER COLUMN "level" SET DEFAULT 'ERROR';
--> statement-breakpoint
ALTER TABLE "FreeAccessInvite" ALTER COLUMN "type" SET DATA TYPE "public"."free_access_type" USING "type"::text::"public"."free_access_type";
--> statement-breakpoint
ALTER TABLE "FreeAccessInvite" ALTER COLUMN "updatedAt" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "PaymentRecord" ALTER COLUMN "updatedAt" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "PromoCode" ALTER COLUMN "type" SET DATA TYPE "public"."promo_type" USING "type"::text::"public"."promo_type";
--> statement-breakpoint
ALTER TABLE "PromoCode" ALTER COLUMN "applicability" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "PromoCode" ALTER COLUMN "applicability" SET DATA TYPE "public"."promo_applicability" USING "applicability"::text::"public"."promo_applicability";
--> statement-breakpoint
ALTER TABLE "PromoCode" ALTER COLUMN "applicability" SET DEFAULT 'signup_only';
--> statement-breakpoint
ALTER TABLE "PromoCode" ALTER COLUMN "updatedAt" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "SiteUiSettings" ALTER COLUMN "updatedAt" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "AIChat" ALTER COLUMN "updatedAt" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "AISavedInsight" ALTER COLUMN "updatedAt" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "Feedback" ADD COLUMN "ip_address" text;
--> statement-breakpoint
ALTER TABLE "Feedback" ADD COLUMN "user_agent" text;
--> statement-breakpoint
ALTER TABLE "WeeklyAIReview" ADD COLUMN "focus_next_week" text;
--> statement-breakpoint
CREATE INDEX "phase_account_master_account_id_idx" ON "PhaseAccount" USING btree ("masterAccountId");
--> statement-breakpoint
CREATE INDEX "phase_account_status_idx" ON "PhaseAccount" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "trade_user_id_idx" ON "Trade" USING btree ("userId");
--> statement-breakpoint
CREATE INDEX "trade_account_id_idx" ON "Trade" USING btree ("accountId");
--> statement-breakpoint
CREATE INDEX "trade_entry_date_idx" ON "Trade" USING btree ("entryDate");
--> statement-breakpoint
CREATE INDEX "trade_outcome_idx" ON "Trade" USING btree ("outcome");
--> statement-breakpoint
CREATE INDEX "trade_execution_trade_id_idx" ON "TradeExecution" USING btree ("tradeId");
--> statement-breakpoint
ALTER TABLE "Feedback" DROP COLUMN "ipAddress";
--> statement-breakpoint
ALTER TABLE "Feedback" DROP COLUMN "userAgent";
--> statement-breakpoint
ALTER TABLE "WeeklyAIReview" DROP COLUMN "focusNextWeek";
--> statement-breakpoint
DROP TYPE "public"."BacktestDirection";
--> statement-breakpoint
DROP TYPE "public"."BacktestModel";
--> statement-breakpoint
DROP TYPE "public"."BacktestOutcome";
--> statement-breakpoint
DROP TYPE "public"."BacktestSession";
--> statement-breakpoint
DROP TYPE "public"."BreachType";
--> statement-breakpoint
DROP TYPE "public"."DrawdownType";
--> statement-breakpoint
DROP TYPE "public"."ErrorLevel";
--> statement-breakpoint
DROP TYPE "public"."ErrorSource";
--> statement-breakpoint
DROP TYPE "public"."FeedbackCategory";
--> statement-breakpoint
DROP TYPE "public"."FeedbackStatus";
--> statement-breakpoint
DROP TYPE "public"."FreeAccessType";
--> statement-breakpoint
DROP TYPE "public"."ImportJobStatus";
--> statement-breakpoint
DROP TYPE "public"."JournalEmotion";
--> statement-breakpoint
DROP TYPE "public"."MarketBias";
--> statement-breakpoint
DROP TYPE "public"."MasterAccountStatus";
--> statement-breakpoint
DROP TYPE "public"."NotificationPriority";
--> statement-breakpoint
DROP TYPE "public"."NotificationType";
--> statement-breakpoint
DROP TYPE "public"."PaymentStatus";
--> statement-breakpoint
DROP TYPE "public"."PayoutStatus";
--> statement-breakpoint
DROP TYPE "public"."PhaseAccountStatus";
--> statement-breakpoint
DROP TYPE "public"."PromoApplicability";
--> statement-breakpoint
DROP TYPE "public"."PromoType";
--> statement-breakpoint
DROP TYPE "public"."SubscriptionStatus";
--> statement-breakpoint
DROP TYPE "public"."TradeExecutionKind";
--> statement-breakpoint
DROP TYPE "public"."TradeOutcome";
--> statement-breakpoint
DROP TYPE "public"."TransactionType";
--> statement-breakpoint
DROP TYPE "public"."UserRole";
--> statement-breakpoint
DROP TYPE "public"."WeeklyExpectation";
