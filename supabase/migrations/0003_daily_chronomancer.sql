ALTER TABLE "ErrorLog" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "ErrorLog" CASCADE;--> statement-breakpoint
ALTER TABLE "AuditLog" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
CREATE UNIQUE INDEX "DailyAnchor_phaseAccountId_date_key" ON "DailyAnchor" USING btree ("phaseAccountId","date");--> statement-breakpoint
CREATE INDEX "Subscription_promoCodeId_idx" ON "Subscription" USING btree ("promoCodeId");--> statement-breakpoint
CREATE INDEX "Subscription_freeAccessId_idx" ON "Subscription" USING btree ("freeAccessId");--> statement-breakpoint
CREATE INDEX "PaymentRecord_promoCodeId_idx" ON "PaymentRecord" USING btree ("promoCodeId");--> statement-breakpoint
CREATE UNIQUE INDEX "WeeklyAIReview_userId_weekStart_key" ON "WeeklyAIReview" USING btree ("userId","weekStart");--> statement-breakpoint
DROP TYPE "public"."error_level";--> statement-breakpoint
DROP TYPE "public"."error_source";