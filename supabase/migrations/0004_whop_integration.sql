CREATE TABLE "WhopWebhookEvent" (
	"id" text PRIMARY KEY NOT NULL,
	"eventId" text NOT NULL,
	"eventType" text NOT NULL,
	"membershipId" text,
	"processingResult" text NOT NULL,
	"errorMessage" text,
	"rawPayload" jsonb,
	"processedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "WhopWebhookEvent_eventId_unique" UNIQUE("eventId")
);
--> statement-breakpoint
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_user_id_User_id_fk";
--> statement-breakpoint
ALTER TABLE "ImportJob" ALTER COLUMN "fileData" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "AuditLog" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ImportJob" ADD COLUMN "fileObjectPath" text;--> statement-breakpoint
ALTER TABLE "ImportJob" ADD COLUMN "workerToken" text;--> statement-breakpoint
ALTER TABLE "ImportJob" ADD COLUMN "leaseExpiresAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ImportJob" ADD COLUMN "attempt" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ImportJob" ADD COLUMN "eventId" text;--> statement-breakpoint
ALTER TABLE "Trade" ADD COLUMN "isMissedTrade" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "ActivityLog" ADD COLUMN "requestId" text;--> statement-breakpoint
ALTER TABLE "PaymentRecord" ADD COLUMN "whopMembershipId" text;--> statement-breakpoint
ALTER TABLE "PaymentRecord" ADD COLUMN "whopUserId" text;--> statement-breakpoint
ALTER TABLE "PaymentRecord" ADD COLUMN "whopPlanId" text;--> statement-breakpoint
ALTER TABLE "PaymentRecord" ADD COLUMN "whopProductId" text;--> statement-breakpoint
ALTER TABLE "PaymentRecord" ADD COLUMN "whopEnvironment" text;--> statement-breakpoint
ALTER TABLE "AuditLog" ADD COLUMN "entity_type" text;--> statement-breakpoint
ALTER TABLE "AuditLog" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "AuditLog" ADD COLUMN "request_id" text;--> statement-breakpoint
CREATE INDEX "WhopWebhookEvent_eventType_idx" ON "WhopWebhookEvent" USING btree ("eventType");--> statement-breakpoint
CREATE INDEX "WhopWebhookEvent_membershipId_idx" ON "WhopWebhookEvent" USING btree ("membershipId");--> statement-breakpoint
ALTER TABLE "AIChat" ADD CONSTRAINT "AIChat_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AIChatMessage" ADD CONSTRAINT "AIChatMessage_chatId_AIChat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."AIChat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AIChatUsageLog" ADD CONSTRAINT "AIChatUsageLog_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "LiveAccountTransaction" ADD CONSTRAINT "LiveAccountTransaction_accountId_Account_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "LiveAccountTransaction" ADD CONSTRAINT "LiveAccountTransaction_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "MasterAccount" ADD CONSTRAINT "MasterAccount_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_masterAccountId_MasterAccount_id_fk" FOREIGN KEY ("masterAccountId") REFERENCES "public"."MasterAccount"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_phaseAccountId_PhaseAccount_id_fk" FOREIGN KEY ("phaseAccountId") REFERENCES "public"."PhaseAccount"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "PhaseAccount" ADD CONSTRAINT "PhaseAccount_masterAccountId_MasterAccount_id_fk" FOREIGN KEY ("masterAccountId") REFERENCES "public"."MasterAccount"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "BacktestTrade" ADD CONSTRAINT "BacktestTrade_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "BreachRecord" ADD CONSTRAINT "BreachRecord_phaseAccountId_PhaseAccount_id_fk" FOREIGN KEY ("phaseAccountId") REFERENCES "public"."PhaseAccount"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DailyAnchor" ADD CONSTRAINT "DailyAnchor_phaseAccountId_PhaseAccount_id_fk" FOREIGN KEY ("phaseAccountId") REFERENCES "public"."PhaseAccount"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DailyNote" ADD CONSTRAINT "DailyNote_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "JournalTemplate" ADD CONSTRAINT "JournalTemplate_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "WeeklyReview" ADD CONSTRAINT "WeeklyReview_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DashboardTemplate" ADD CONSTRAINT "DashboardTemplate_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SharedReport" ADD CONSTRAINT "SharedReport_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Synchronization" ADD CONSTRAINT "Synchronization_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "UserGeoLog" ADD CONSTRAINT "UserGeoLog_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_accountId_Account_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_phaseAccountId_PhaseAccount_id_fk" FOREIGN KEY ("phaseAccountId") REFERENCES "public"."PhaseAccount"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_modelId_TradingModel_id_fk" FOREIGN KEY ("modelId") REFERENCES "public"."TradingModel"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "TradeExecution" ADD CONSTRAINT "TradeExecution_tradeId_Trade_id_fk" FOREIGN KEY ("tradeId") REFERENCES "public"."Trade"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "TradeExecution" ADD CONSTRAINT "TradeExecution_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "TradeTag" ADD CONSTRAINT "TradeTag_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "TradingModel" ADD CONSTRAINT "TradingModel_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "UserGoal" ADD CONSTRAINT "UserGoal_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "FeedbackReply" ADD CONSTRAINT "FeedbackReply_feedbackId_Feedback_id_fk" FOREIGN KEY ("feedbackId") REFERENCES "public"."Feedback"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_subscriptionId_Subscription_id_fk" FOREIGN KEY ("subscriptionId") REFERENCES "public"."Subscription"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "PromoRedemption" ADD CONSTRAINT "PromoRedemption_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AISavedInsight" ADD CONSTRAINT "AISavedInsight_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "WeeklyAIReview" ADD CONSTRAINT "WeeklyAIReview_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_number_idx" ON "Account" USING btree ("userId","number");--> statement-breakpoint
CREATE INDEX "master_account_user_status_idx" ON "MasterAccount" USING btree ("userId","status");--> statement-breakpoint
CREATE UNIQUE INDEX "BreachRecord_phaseAccountId_breachType_key" ON "BreachRecord" USING btree ("phaseAccountId","breachType");--> statement-breakpoint
CREATE INDEX "import_job_user_created_at_idx" ON "ImportJob" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "trade_user_entry_date_idx" ON "Trade" USING btree ("userId","entryDate");--> statement-breakpoint
CREATE INDEX "trade_user_account_entry_date_idx" ON "Trade" USING btree ("userId","accountId","entryDate");--> statement-breakpoint
CREATE INDEX "trade_user_phase_entry_date_idx" ON "Trade" USING btree ("userId","phaseAccountId","entryDate");--> statement-breakpoint
CREATE INDEX "ActivityLog_requestId_idx" ON "ActivityLog" USING btree ("requestId") WHERE "ActivityLog"."requestId" is not null;--> statement-breakpoint
CREATE INDEX "PaymentRecord_whopMembershipId_idx" ON "PaymentRecord" USING btree ("whopMembershipId");--> statement-breakpoint
CREATE INDEX "AuditLog_request_id_idx" ON "AuditLog" USING btree ("request_id") WHERE "AuditLog"."request_id" is not null;--> statement-breakpoint
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_whopMembershipId_unique" UNIQUE("whopMembershipId");