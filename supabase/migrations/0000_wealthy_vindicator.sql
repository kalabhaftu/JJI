CREATE TYPE "public"."BacktestDirection" AS ENUM('BUY', 'SELL');
--> statement-breakpoint
CREATE TYPE "public"."BacktestModel" AS ENUM('ICT_2022', 'MSNR', 'TTFM', 'PRICE_ACTION', 'SUPPLY_DEMAND', 'SMART_MONEY', 'CUSTOM');
--> statement-breakpoint
CREATE TYPE "public"."BacktestOutcome" AS ENUM('WIN', 'LOSS', 'BREAKEVEN');
--> statement-breakpoint
CREATE TYPE "public"."BacktestSession" AS ENUM('ASIAN', 'LONDON', 'NEW_YORK');
--> statement-breakpoint
CREATE TYPE "public"."BreachType" AS ENUM('daily_drawdown', 'max_drawdown');
--> statement-breakpoint
CREATE TYPE "public"."DrawdownType" AS ENUM('static', 'trailing');
--> statement-breakpoint
CREATE TYPE "public"."ErrorLevel" AS ENUM('WARNING', 'ERROR', 'CRITICAL');
--> statement-breakpoint
CREATE TYPE "public"."ErrorSource" AS ENUM('CLIENT', 'SERVER', 'API');
--> statement-breakpoint
CREATE TYPE "public"."FeedbackCategory" AS ENUM('BUG_REPORT', 'FEATURE_REQUEST', 'GENERAL', 'OTHER');
--> statement-breakpoint
CREATE TYPE "public"."FeedbackStatus" AS ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
--> statement-breakpoint
CREATE TYPE "public"."FreeAccessType" AS ENUM('lifetime', 'until_date', 'one_time_signup');
--> statement-breakpoint
CREATE TYPE "public"."ImportJobStatus" AS ENUM('queued', 'processing', 'completed', 'failed', 'cancelled');
--> statement-breakpoint
CREATE TYPE "public"."JournalEmotion" AS ENUM('confident', 'anxious', 'focused', 'energetic', 'calm', 'frustrated', 'optimistic', 'pessimistic', 'disciplined', 'impulsive', 'happy', 'sad', 'neutral', 'tired', 'excited', 'stressed', 'relaxed');
--> statement-breakpoint
CREATE TYPE "public"."MarketBias" AS ENUM('BULLISH', 'BEARISH', 'UNDECIDED');
--> statement-breakpoint
CREATE TYPE "public"."MasterAccountStatus" AS ENUM('active', 'funded', 'failed');
--> statement-breakpoint
CREATE TYPE "public"."NotificationPriority" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
--> statement-breakpoint
CREATE TYPE "public"."NotificationType" AS ENUM('FUNDED_PENDING_APPROVAL', 'FUNDED_APPROVED', 'FUNDED_DECLINED', 'PHASE_TRANSITION_PENDING', 'PAYOUT_APPROVED', 'PAYOUT_REJECTED', 'SYSTEM', 'RISK_ALERT', 'IMPORT_STATUS', 'WEEKLY_PERFORMANCE', 'STRATEGY_DEVIATION', 'SYSTEM_ANNOUNCEMENT', 'TRADE_STATUS', 'RISK_DAILY_LOSS_80', 'RISK_DAILY_LOSS_95', 'RISK_MAX_DRAWDOWN_80', 'RISK_MAX_DRAWDOWN_95', 'IMPORT_PROCESSING', 'IMPORT_COMPLETE', 'STRATEGY_SESSION_VIOLATION', 'FEEDBACK_REPLY', 'PAYMENT_DUE_SOON', 'PAYMENT_DUE_TODAY', 'PAYMENT_OVERDUE', 'SUBSCRIPTION_EXPIRED', 'PAYMENT_RECEIVED', 'PAYMENT_FAILED', 'ACCESS_RESTORED', 'ADMIN_FREE_ACCESS_GRANTED', 'ADMIN_FREE_ACCESS_REVOKED');
--> statement-breakpoint
CREATE TYPE "public"."PaymentStatus" AS ENUM('pending', 'waiting', 'confirming', 'confirmed', 'sending', 'finished', 'partially_paid', 'failed', 'refunded', 'expired');
--> statement-breakpoint
CREATE TYPE "public"."PayoutStatus" AS ENUM('pending', 'approved', 'paid', 'rejected');
--> statement-breakpoint
CREATE TYPE "public"."PhaseAccountStatus" AS ENUM('active', 'passed', 'failed', 'archived', 'pending', 'pending_approval');
--> statement-breakpoint
CREATE TYPE "public"."PromoApplicability" AS ENUM('signup_only', 'renewal_only', 'any');
--> statement-breakpoint
CREATE TYPE "public"."PromoType" AS ENUM('percentage_discount', 'fixed_discount', 'free_months', 'lifetime_free');
--> statement-breakpoint
CREATE TYPE "public"."SubscriptionStatus" AS ENUM('active', 'past_due', 'unpaid', 'expired', 'cancelled', 'free_access', 'invited_free', 'promo_active');
--> statement-breakpoint
CREATE TYPE "public"."TradeExecutionKind" AS ENUM('ENTRY', 'EXIT');
--> statement-breakpoint
CREATE TYPE "public"."TradeOutcome" AS ENUM('GOOD_WIN', 'BAD_WIN', 'GOOD_BE', 'BAD_BE', 'BREAKEVEN', 'GOOD_LOSS', 'BAD_LOSS');
--> statement-breakpoint
CREATE TYPE "public"."TransactionType" AS ENUM('DEPOSIT', 'WITHDRAWAL');
--> statement-breakpoint
CREATE TYPE "public"."UserRole" AS ENUM('user', 'admin');
--> statement-breakpoint
CREATE TYPE "public"."WeeklyExpectation" AS ENUM('BULLISH_EXPANSION', 'BEARISH_EXPANSION', 'CONSOLIDATION');
--> statement-breakpoint
CREATE TABLE "Account" (
	"id" text PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"name" text,
	"broker" text,
	"startingBalance" double precision DEFAULT 0,
	"userId" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone NOT NULL,
	"isArchived" boolean DEFAULT false,
	"isConfigured" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "LiveAccountTransaction" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"userId" text NOT NULL,
	"type" "TransactionType" NOT NULL,
	"amount" double precision NOT NULL,
	"description" text,
	"createdAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "MasterAccount" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"accountName" text NOT NULL,
	"propFirmName" text NOT NULL,
	"accountSize" double precision NOT NULL,
	"evaluationType" text NOT NULL,
	"currentPhase" integer NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone DEFAULT now(),
	"status" "MasterAccountStatus" DEFAULT 'active',
	"isArchived" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "Payout" (
	"id" text PRIMARY KEY NOT NULL,
	"masterAccountId" text NOT NULL,
	"phaseAccountId" text NOT NULL,
	"amount" double precision NOT NULL,
	"status" "PayoutStatus" DEFAULT 'pending',
	"requestDate" timestamp with time zone DEFAULT now(),
	"approvedDate" timestamp with time zone,
	"paidDate" timestamp with time zone,
	"rejectedDate" timestamp with time zone,
	"notes" text,
	"rejectionReason" text,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "PhaseAccount" (
	"id" text PRIMARY KEY NOT NULL,
	"masterAccountId" text NOT NULL,
	"phaseNumber" integer NOT NULL,
	"phaseId" text,
	"accountSize" double precision,
	"status" "PhaseAccountStatus" DEFAULT 'active',
	"profitTargetPercent" double precision NOT NULL,
	"dailyDrawdownPercent" double precision NOT NULL,
	"maxDrawdownPercent" double precision NOT NULL,
	"maxDrawdownType" "DrawdownType" DEFAULT 'static',
	"minTradingDays" integer DEFAULT 0,
	"timeLimitDays" integer,
	"consistencyRulePercent" double precision DEFAULT 0,
	"profitSplitPercent" double precision,
	"payoutCycleDays" integer,
	"minProfitForPayout" double precision,
	"startDate" timestamp with time zone DEFAULT now(),
	"endDate" timestamp with time zone,
	"updatedAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "BacktestTrade" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"pair" text NOT NULL,
	"direction" "BacktestDirection" NOT NULL,
	"outcome" "BacktestOutcome" NOT NULL,
	"session" "BacktestSession" NOT NULL,
	"model" "BacktestModel" NOT NULL,
	"customModel" text,
	"riskRewardRatio" double precision NOT NULL,
	"entryPrice" double precision NOT NULL,
	"stopLoss" double precision NOT NULL,
	"takeProfit" double precision NOT NULL,
	"exitPrice" double precision NOT NULL,
	"pnl" double precision NOT NULL,
	"imageOne" text,
	"imageTwo" text,
	"imageThree" text,
	"imageFour" text,
	"imageFive" text,
	"imageSix" text,
	"cardPreviewImage" text,
	"notes" text,
	"tags" text[] NOT NULL,
	"dateExecuted" timestamp with time zone NOT NULL,
	"backtestDate" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone NOT NULL,
	"riskPoints" double precision DEFAULT 0,
	"rewardPoints" double precision DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "BreachRecord" (
	"id" text PRIMARY KEY NOT NULL,
	"phaseAccountId" text NOT NULL,
	"breachType" "BreachType" NOT NULL,
	"breachAmount" double precision NOT NULL,
	"breachTime" timestamp with time zone DEFAULT now(),
	"currentEquity" double precision NOT NULL,
	"accountSize" double precision NOT NULL,
	"dailyStartBalance" double precision,
	"highWaterMark" double precision,
	"tradeId" text,
	"notes" text,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "DailyAnchor" (
	"id" text PRIMARY KEY NOT NULL,
	"phaseAccountId" text NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"anchorEquity" double precision NOT NULL,
	"computedAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "DailyNote" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"note" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone NOT NULL,
	"accountId" text,
	"emotion" "JournalEmotion"
);
--> statement-breakpoint
CREATE TABLE "JournalTemplate" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"content" jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "WeeklyReview" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"startDate" timestamp with time zone NOT NULL,
	"endDate" timestamp with time zone NOT NULL,
	"calendarImage" text,
	"expectation" "WeeklyExpectation",
	"actualOutcome" "WeeklyExpectation",
	"isCorrect" boolean,
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "AdminDashboardPreset" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"segment" text DEFAULT 'all',
	"description" text,
	"layout" jsonb DEFAULT '[]',
	"active" boolean DEFAULT true,
	"recommended" boolean DEFAULT false,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone NOT NULL,
	CONSTRAINT "AdminDashboardPreset_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "AdminWidgetSetting" (
	"id" text PRIMARY KEY NOT NULL,
	"widgetType" text NOT NULL,
	"label" text,
	"description" text,
	"visible" boolean DEFAULT true,
	"recommended" boolean DEFAULT false,
	"deprecated" boolean DEFAULT false,
	"status" text DEFAULT 'stable',
	"premiumOnly" boolean DEFAULT false,
	"roleGate" text,
	"metadata" jsonb,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone NOT NULL,
	CONSTRAINT "AdminWidgetSetting_widgetType_unique" UNIQUE("widgetType")
);
--> statement-breakpoint
CREATE TABLE "DashboardTemplate" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"isDefault" boolean DEFAULT false,
	"isActive" boolean DEFAULT false,
	"layout" jsonb DEFAULT '[]',
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "AdminFeatureFlag" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"enabled" boolean DEFAULT false,
	"internalOnly" boolean DEFAULT false,
	"roleGate" text,
	"cohort" text,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone NOT NULL,
	CONSTRAINT "AdminFeatureFlag_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "AdminSharingPolicy" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text DEFAULT 'default',
	"publicSharingEnabled" boolean DEFAULT true,
	"defaultExpirationDays" integer,
	"requireExpiration" boolean DEFAULT false,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone NOT NULL,
	CONSTRAINT "AdminSharingPolicy_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "Feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text,
	"name" text,
	"email" text,
	"category" "FeedbackCategory" NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"attachments" jsonb,
	"status" "FeedbackStatus" DEFAULT 'OPEN',
	"ipAddress" text,
	"userAgent" text,
	"country" text,
	"city" text,
	"region" text,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ImportJob" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"status" "ImportJobStatus" DEFAULT 'queued',
	"stage" text DEFAULT 'queued',
	"progress" integer DEFAULT 0,
	"totalItems" integer DEFAULT 0,
	"processedItems" integer DEFAULT 0,
	"importedCount" integer DEFAULT 0,
	"skippedCount" integer DEFAULT 0,
	"fileName" text NOT NULL,
	"fileSize" integer NOT NULL,
	"fileData" "bytea" NOT NULL,
	"state" jsonb,
	"error" text,
	"cancelRequested" boolean DEFAULT false,
	"startedAt" timestamp with time zone,
	"completedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Notification" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"type" "NotificationType" NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"data" jsonb,
	"isRead" boolean DEFAULT false,
	"actionRequired" boolean DEFAULT false,
	"invalidationKey" text,
	"priority" "NotificationPriority" DEFAULT 'MEDIUM',
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "SharedReport" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"slug" text NOT NULL,
	"title" text DEFAULT 'Trading Report',
	"dateFrom" text,
	"dateTo" text,
	"accountId" text,
	"snapshot" jsonb NOT NULL,
	"isPublic" boolean DEFAULT true,
	"viewCount" integer DEFAULT 0,
	"expiresAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone NOT NULL,
	CONSTRAINT "SharedReport_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "Subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"status" "SubscriptionStatus" DEFAULT 'unpaid',
	"planId" text DEFAULT 'pro',
	"currentPeriodStart" timestamp with time zone,
	"currentPeriodEnd" timestamp with time zone,
	"nextPaymentDue" timestamp with time zone,
	"cancelledAt" timestamp with time zone,
	"promoCodeId" text,
	"freeAccessId" text,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone NOT NULL,
	CONSTRAINT "Subscription_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "Synchronization" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"service" text NOT NULL,
	"accountId" text NOT NULL,
	"lastSyncedAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone NOT NULL,
	"token" text,
	"tokenExpiresAt" timestamp with time zone,
	"dailySyncTime" timestamp with time zone,
	"includedFeeTypes" jsonb
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"auth_user_id" text NOT NULL,
	"isFirstConnection" boolean DEFAULT true,
	"firstName" text,
	"lastName" text,
	"role" "UserRole" DEFAULT 'user',
	"onboarding_status" jsonb,
	"etpToken" text,
	"thorToken" text,
	"fcmToken" text,
	CONSTRAINT "User_email_unique" UNIQUE("email"),
	CONSTRAINT "User_auth_user_id_unique" UNIQUE("auth_user_id")
);
--> statement-breakpoint
CREATE TABLE "UserGeoLog" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"country" text,
	"countryCode" text,
	"city" text,
	"region" text,
	"latitude" double precision,
	"longitude" double precision,
	"ipAddress" text,
	"createdAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "UserSettings" (
	"userId" text,
	"timezone" text DEFAULT 'America/New_York',
	"theme" text DEFAULT 'system',
	"accountFilterSettings" text,
	"aiSettings" jsonb,
	"backtestInputMode" text DEFAULT 'manual',
	"breakEvenThreshold" double precision DEFAULT 10,
	"pnlDisplayMode" text DEFAULT 'net',
	"accentPack" text DEFAULT 'classic',
	"widgetStyle" text DEFAULT 'default',
	"chartStyle" text DEFAULT 'smooth',
	"autoAdjustAccountDate" boolean DEFAULT false,
	"webhookToken" text,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone NOT NULL,
	CONSTRAINT "UserSettings_webhookToken_unique" UNIQUE("webhookToken")
);
--> statement-breakpoint
CREATE TABLE "Trade" (
	"id" text PRIMARY KEY NOT NULL,
	"accountNumber" text NOT NULL,
	"quantity" double precision DEFAULT 0,
	"entryId" text,
	"closeId" text,
	"tradeIdentityKey" text,
	"instrument" text NOT NULL,
	"entryPrice" text NOT NULL,
	"closePrice" text NOT NULL,
	"entryDate" text NOT NULL,
	"closeDate" text NOT NULL,
	"entryPriceValue" double precision,
	"closePriceValue" double precision,
	"pnl" double precision NOT NULL,
	"timeInPosition" double precision DEFAULT 0,
	"userId" text NOT NULL,
	"side" text,
	"commission" double precision DEFAULT 0,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone DEFAULT now(),
	"comment" text,
	"groupId" text,
	"cardPreviewImage" text,
	"cardPreviewTransform" jsonb,
	"imageOne" text,
	"imageTwo" text,
	"imageThree" text,
	"imageFour" text,
	"imageFive" text,
	"imageSix" text,
	"accountId" text,
	"phaseAccountId" text,
	"symbol" text,
	"entryTime" timestamp with time zone,
	"exitTime" timestamp with time zone,
	"closeReason" text,
	"stopLoss" text,
	"stopLossValue" double precision,
	"takeProfit" text,
	"takeProfitValue" double precision,
	"tags" text[] NOT NULL,
	"marketBias" "MarketBias",
	"modelId" text,
	"selectedRules" jsonb,
	"outcome" "TradeOutcome",
	"ruleBroken" boolean DEFAULT false,
	"newsDay" boolean DEFAULT false,
	"selectedNews" text,
	"newsTraded" boolean DEFAULT false,
	"biasTimeframe" text,
	"narrativeTimeframe" text,
	"entryTimeframe" text,
	"structureTimeframe" text,
	"orderType" text,
	"chartLinks" text,
	"chartLinksList" text[] DEFAULT '{}',
	"plannedEntry" text,
	"plannedStopLoss" text,
	"plannedTakeProfit" text,
	"plannedSize" double precision,
	"planNotes" text,
	"mae" double precision,
	"mfe" double precision,
	"setup" text
);
--> statement-breakpoint
CREATE TABLE "TradeExecution" (
	"id" text PRIMARY KEY NOT NULL,
	"tradeId" text NOT NULL,
	"userId" text NOT NULL,
	"kind" "TradeExecutionKind" NOT NULL,
	"quantity" double precision DEFAULT 0,
	"price" double precision,
	"executedAt" timestamp with time zone,
	"pnl" double precision DEFAULT 0,
	"commission" double precision DEFAULT 0,
	"brokerExecutionId" text,
	"legacySourceTradeId" text,
	"closeReason" text,
	"rawSymbol" text,
	"metadata" jsonb,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "TradeTag" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#3b82f6',
	"userId" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ActivityLog" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entityId" text,
	"metadata" jsonb,
	"ipAddress" text,
	"createdAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "TradingModel" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"rules" jsonb DEFAULT '[]',
	"setups" jsonb DEFAULT '[]',
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "UserGoal" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"metric" text NOT NULL,
	"targetValue" double precision NOT NULL,
	"currentValue" double precision DEFAULT 0,
	"period" text NOT NULL,
	"startDate" timestamp with time zone NOT NULL,
	"endDate" timestamp with time zone,
	"isCompleted" boolean DEFAULT false,
	"completedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "AIChatMessage" (
	"id" text PRIMARY KEY NOT NULL,
	"chatId" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "AIChatUsageLog" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"chatId" text,
	"promptTokens" integer DEFAULT 0,
	"completionTokens" integer DEFAULT 0,
	"totalTokens" integer DEFAULT 0,
	"estimatedCost" double precision DEFAULT 0,
	"responseTimeMs" integer DEFAULT 0,
	"createdAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "AdminAISetting" (
	"id" text PRIMARY KEY DEFAULT 'global' NOT NULL,
	"enabled" boolean DEFAULT true,
	"demoModeEnabled" boolean DEFAULT true,
	"freePlanAccess" boolean DEFAULT false,
	"paidPlanAccess" boolean DEFAULT true,
	"adminAccess" boolean DEFAULT true,
	"maxContextSize" integer DEFAULT 32768,
	"maxMessagesPerDay" integer DEFAULT 50,
	"maxTokensPerResponse" integer DEFAULT 2048,
	"conversationRetentionDays" integer DEFAULT 30,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "DonationAddress" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"network" text NOT NULL,
	"address" text NOT NULL,
	"isActive" boolean DEFAULT true,
	"sortOrder" integer DEFAULT 0,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ErrorLog" (
	"id" text PRIMARY KEY NOT NULL,
	"source" "ErrorSource" NOT NULL,
	"level" "ErrorLevel" DEFAULT 'ERROR',
	"message" text NOT NULL,
	"stack" text,
	"url" text,
	"userId" text,
	"metadata" jsonb,
	"ipAddress" text,
	"createdAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "FeedbackReply" (
	"id" text PRIMARY KEY NOT NULL,
	"feedbackId" text NOT NULL,
	"message" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "FreeAccessInvite" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"type" "FreeAccessType" NOT NULL,
	"expiresAt" timestamp with time zone,
	"note" text,
	"grantedBy" text,
	"grantedAt" timestamp with time zone DEFAULT now(),
	"revokedAt" timestamp with time zone,
	"isActive" boolean DEFAULT true,
	"registeredAt" timestamp with time zone,
	"registeredUserId" text,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone NOT NULL,
	CONSTRAINT "FreeAccessInvite_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "PaymentRecord" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"subscriptionId" text NOT NULL,
	"planId" text DEFAULT 'pro',
	"amountUsd" double precision NOT NULL,
	"provider" text DEFAULT 'nowpayments',
	"providerPaymentId" text,
	"providerInvoiceId" text,
	"providerStatus" text,
	"payCurrency" text,
	"payAmount" double precision,
	"paymentUrl" text,
	"invoiceUrl" text,
	"subscriptionPeriodStart" timestamp with time zone,
	"subscriptionPeriodEnd" timestamp with time zone,
	"dueDate" timestamp with time zone,
	"paidAt" timestamp with time zone,
	"expiredAt" timestamp with time zone,
	"rawProviderPayload" jsonb,
	"promoCodeId" text,
	"discountAmount" double precision DEFAULT 0,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone NOT NULL,
	CONSTRAINT "PaymentRecord_providerPaymentId_unique" UNIQUE("providerPaymentId"),
	CONSTRAINT "PaymentRecord_providerInvoiceId_unique" UNIQUE("providerInvoiceId")
);
--> statement-breakpoint
CREATE TABLE "PromoCode" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"type" "PromoType" NOT NULL,
	"applicability" "PromoApplicability" DEFAULT 'signup_only',
	"value" double precision NOT NULL,
	"maxUses" integer,
	"usesCount" integer DEFAULT 0,
	"validFrom" timestamp with time zone DEFAULT now(),
	"validUntil" timestamp with time zone,
	"isActive" boolean DEFAULT true,
	"appliesToPlan" text DEFAULT 'pro',
	"createdBy" text,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone NOT NULL,
	CONSTRAINT "PromoCode_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "PromoRedemption" (
	"id" text PRIMARY KEY NOT NULL,
	"promoCodeId" text NOT NULL,
	"userId" text NOT NULL,
	"redeemedAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "SiteUiSettings" (
	"id" text PRIMARY KEY NOT NULL,
	"showDonateButton" boolean DEFAULT true,
	"showFeedbackButton" boolean DEFAULT true,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "AIChat" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"title" text DEFAULT 'New Conversation',
	"isPinned" boolean DEFAULT false,
	"isArchived" boolean DEFAULT false,
	"isDeleted" boolean DEFAULT false,
	"accounts" text[] NOT NULL,
	"dateRange" text NOT NULL,
	"customFrom" timestamp with time zone,
	"customTo" timestamp with time zone,
	"dataSources" text[] NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "AISavedInsight" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"category" text DEFAULT 'insight',
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "WeeklyAIReview" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"weekStart" timestamp with time zone NOT NULL,
	"weekEnd" timestamp with time zone NOT NULL,
	"summary" text NOT NULL,
	"highlights" jsonb DEFAULT '[]',
	"lowlights" jsonb DEFAULT '[]',
	"stats" jsonb DEFAULT '{}',
	"grade" text DEFAULT '',
	"focusNextWeek" text,
	"createdAt" timestamp with time zone DEFAULT now()
);
