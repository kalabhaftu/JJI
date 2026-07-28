-- Audit -> deterministic repair -> enforce.
-- This migration intentionally aborts when a relationship cannot be inferred.
-- Review the reported rows, repair them explicitly, then rerun the migration.
DO $$
DECLARE
  orphan_count bigint;
  relation text;
  child_table text;
  child_column text;
  parent_table text;
  parent_column text;
BEGIN
  -- These two ownership repairs are deterministic because the child belongs to
  -- the same parent record it already references.
  UPDATE public."TradeExecution" execution
  SET "userId" = trade."userId"
  FROM public."Trade" trade
  WHERE execution."tradeId" = trade."id"
    AND execution."userId" <> trade."userId";

  UPDATE public."LiveAccountTransaction" transaction_row
  SET "userId" = account."userId"
  FROM public."Account" account
  WHERE transaction_row."accountId" = account."id"
    AND transaction_row."userId" <> account."userId";

  UPDATE public."Payout" payout
  SET "masterAccountId" = phase."masterAccountId"
  FROM public."PhaseAccount" phase
  WHERE payout."phaseAccountId" = phase."id"
    AND payout."masterAccountId" <> phase."masterAccountId";

  -- Breach rows were historically written by both import-time and historical
  -- evaluators. Keep one deterministic canonical row per phase/type: prefer a
  -- nonzero, complete measurement, then the earliest breach event. This is
  -- safe for the audited duplicates because they represent the same breach;
  -- ambiguous groups must be repaired before this migration is run.
  WITH ranked_breaches AS (
    SELECT "id",
      row_number() OVER (
        PARTITION BY "phaseAccountId", "breachType"
        ORDER BY
          CASE WHEN "breachAmount" <> 0 THEN 1 ELSE 0 END DESC,
          CASE WHEN "currentEquity" <> 0 THEN 1 ELSE 0 END DESC,
          CASE WHEN "dailyStartBalance" IS NOT NULL THEN 1 ELSE 0 END DESC,
          CASE WHEN "highWaterMark" IS NOT NULL THEN 1 ELSE 0 END DESC,
          "breachTime" ASC NULLS LAST,
          "id"
      ) AS duplicate_rank
    FROM public."BreachRecord"
  )
  DELETE FROM public."BreachRecord" breach
  USING ranked_breaches ranked
  WHERE breach."id" = ranked."id"
    AND ranked.duplicate_rank > 1;

  SELECT count(*) INTO orphan_count
  FROM public."Trade" child
  LEFT JOIN public."User" parent ON parent."id" = child."userId"
  WHERE parent."id" IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Trade.userId has % orphan rows; repair before enforcing constraints', orphan_count;
  END IF;

  SELECT count(*) INTO orphan_count
  FROM public."TradeExecution" child
  LEFT JOIN public."Trade" parent ON parent."id" = child."tradeId"
  WHERE parent."id" IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'TradeExecution.tradeId has % orphan rows; repair before enforcing constraints', orphan_count;
  END IF;

  SELECT count(*) INTO orphan_count
  FROM public."TradeExecution" child
  LEFT JOIN public."User" parent ON parent."id" = child."userId"
  WHERE parent."id" IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'TradeExecution.userId has % orphan rows; repair before enforcing constraints', orphan_count;
  END IF;

  SELECT count(*) INTO orphan_count
  FROM public."Account" child
  LEFT JOIN public."User" parent ON parent."id" = child."userId"
  WHERE parent."id" IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Account.userId has % orphan rows; repair before enforcing constraints', orphan_count;
  END IF;

  SELECT count(*) INTO orphan_count
  FROM public."LiveAccountTransaction" child
  LEFT JOIN public."Account" parent ON parent."id" = child."accountId"
  WHERE parent."id" IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'LiveAccountTransaction.accountId has % orphan rows; repair before enforcing constraints', orphan_count;
  END IF;

  SELECT count(*) INTO orphan_count
  FROM public."LiveAccountTransaction" child
  LEFT JOIN public."User" parent ON parent."id" = child."userId"
  WHERE parent."id" IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'LiveAccountTransaction.userId has % orphan rows; repair before enforcing constraints', orphan_count;
  END IF;

  SELECT count(*) INTO orphan_count
  FROM public."MasterAccount" child
  LEFT JOIN public."User" parent ON parent."id" = child."userId"
  WHERE parent."id" IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'MasterAccount.userId has % orphan rows; repair before enforcing constraints', orphan_count;
  END IF;

  SELECT count(*) INTO orphan_count
  FROM public."PhaseAccount" child
  LEFT JOIN public."MasterAccount" parent ON parent."id" = child."masterAccountId"
  WHERE parent."id" IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'PhaseAccount.masterAccountId has % orphan rows; repair before enforcing constraints', orphan_count;
  END IF;

  SELECT count(*) INTO orphan_count
  FROM public."Payout" child
  LEFT JOIN public."MasterAccount" parent ON parent."id" = child."masterAccountId"
  WHERE parent."id" IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Payout.masterAccountId has % orphan rows; repair before enforcing constraints', orphan_count;
  END IF;

  SELECT count(*) INTO orphan_count
  FROM public."Payout" child
  LEFT JOIN public."PhaseAccount" parent ON parent."id" = child."phaseAccountId"
  WHERE parent."id" IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Payout.phaseAccountId has % orphan rows; repair before enforcing constraints', orphan_count;
  END IF;

  SELECT count(*) INTO orphan_count
  FROM public."BreachRecord" child
  LEFT JOIN public."PhaseAccount" parent ON parent."id" = child."phaseAccountId"
  WHERE parent."id" IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'BreachRecord.phaseAccountId has % orphan rows; repair before enforcing constraints', orphan_count;
  END IF;

  SELECT count(*) INTO orphan_count
  FROM public."DailyAnchor" child
  LEFT JOIN public."PhaseAccount" parent ON parent."id" = child."phaseAccountId"
  WHERE parent."id" IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'DailyAnchor.phaseAccountId has % orphan rows; repair before enforcing constraints', orphan_count;
  END IF;

  SELECT count(*) INTO orphan_count
  FROM public."Trade" child
  LEFT JOIN public."Account" parent ON parent."id" = child."accountId"
  WHERE child."accountId" IS NOT NULL AND parent."id" IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Trade.accountId has % orphan rows; repair before enforcing constraints', orphan_count;
  END IF;

  SELECT count(*) INTO orphan_count
  FROM public."Trade" child
  LEFT JOIN public."PhaseAccount" parent ON parent."id" = child."phaseAccountId"
  WHERE child."phaseAccountId" IS NOT NULL AND parent."id" IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Trade.phaseAccountId has % orphan rows; repair before enforcing constraints', orphan_count;
  END IF;

  -- Audit every relationship that this migration enforces. Nullable foreign
  -- keys are ignored when null; non-null columns still fail at constraint time.
  FOREACH relation IN ARRAY ARRAY[
    'UserSettings|userId|User|id',
    'ImportJob|userId|User|id',
    'Notification|userId|User|id',
    'SharedReport|userId|User|id',
    'Subscription|userId|User|id',
    'Synchronization|userId|User|id',
    'Account|userId|User|id',
    'LiveAccountTransaction|accountId|Account|id',
    'LiveAccountTransaction|userId|User|id',
    'MasterAccount|userId|User|id',
    'PhaseAccount|masterAccountId|MasterAccount|id',
    'Payout|masterAccountId|MasterAccount|id',
    'Payout|phaseAccountId|PhaseAccount|id',
    'BreachRecord|phaseAccountId|PhaseAccount|id',
    'DailyAnchor|phaseAccountId|PhaseAccount|id',
    'Trade|userId|User|id',
    'Trade|accountId|Account|id',
    'Trade|phaseAccountId|PhaseAccount|id',
    'Trade|modelId|TradingModel|id',
    'TradeExecution|tradeId|Trade|id',
    'TradeExecution|userId|User|id',
    'TradeTag|userId|User|id',
    'BacktestTrade|userId|User|id',
    'DailyNote|userId|User|id',
    'DailyNote|accountId|Account|id',
    'JournalTemplate|userId|User|id',
    'WeeklyReview|userId|User|id',
    'TradingModel|userId|User|id',
    'ActivityLog|userId|User|id',
    'UserGoal|userId|User|id',
    'DashboardTemplate|userId|User|id',
    'WeeklyAIReview|userId|User|id',
    'AIChat|userId|User|id',
    'AIChatMessage|chatId|AIChat|id',
    'AISavedInsight|userId|User|id',
    'AIChatUsageLog|userId|User|id',
    'PaymentRecord|userId|User|id',
    'PaymentRecord|subscriptionId|Subscription|id',
    'PromoRedemption|userId|User|id',
    'Feedback|userId|User|id',
    'FeedbackReply|feedbackId|Feedback|id',
    'UserGeoLog|userId|User|id'
  ] LOOP
    child_table := split_part(relation, '|', 1);
    child_column := split_part(relation, '|', 2);
    parent_table := split_part(relation, '|', 3);
    parent_column := split_part(relation, '|', 4);

    EXECUTE format(
      'SELECT count(*) FROM public.%I child LEFT JOIN public.%I parent ON parent.%I = child.%I WHERE child.%I IS NOT NULL AND parent.%I IS NULL',
      child_table, parent_table, parent_column, child_column, child_column, parent_column
    ) INTO orphan_count;

    IF orphan_count > 0 THEN
      RAISE EXCEPTION '% has % orphan rows; repair before enforcing constraints', relation, orphan_count;
    END IF;
  END LOOP;

  SELECT count(*) INTO orphan_count
  FROM public."Trade" child
  LEFT JOIN public."TradingModel" parent ON parent."id" = child."modelId"
  WHERE child."modelId" IS NOT NULL AND parent."id" IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Trade.modelId has % orphan rows; repair before enforcing constraints', orphan_count;
  END IF;

  SELECT count(*) INTO orphan_count
  FROM public."Trade" child
  LEFT JOIN public."User" parent ON parent."id" = child."userId"
  WHERE parent."id" IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Trade.userId has % orphan rows; repair before enforcing constraints', orphan_count;
  END IF;

  SELECT count(*) INTO orphan_count
  FROM public."BreachRecord"
  GROUP BY "phaseAccountId", "breachType"
  HAVING count(*) > 1;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'BreachRecord has duplicate phase/type groups; resolve duplicates before enforcing idempotency';
  END IF;

  SELECT count(*) INTO orphan_count
  FROM public."Trade"
  WHERE "tradeIdentityKey" IS NOT NULL
  GROUP BY "userId", "tradeIdentityKey"
  HAVING count(*) > 1;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Trade has duplicate user/identity groups; resolve duplicates before enforcing idempotency';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "BreachRecord_phaseAccountId_breachType_key"
  ON public."BreachRecord" ("phaseAccountId", "breachType");

CREATE UNIQUE INDEX IF NOT EXISTS "Trade_userId_tradeIdentityKey_key"
  ON public."Trade" ("userId", "tradeIdentityKey")
  WHERE "tradeIdentityKey" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "TradeExecution_userId_idx" ON public."TradeExecution" ("userId");
CREATE INDEX IF NOT EXISTS "Trade_userId_tradeIdentityKey_lookup_idx" ON public."Trade" ("userId", "tradeIdentityKey");
CREATE INDEX IF NOT EXISTS "Trade_user_entry_date_idx" ON public."Trade" ("userId", "entryDate");
CREATE INDEX IF NOT EXISTS "Trade_user_account_entry_date_idx" ON public."Trade" ("userId", "accountId", "entryDate");
CREATE INDEX IF NOT EXISTS "Trade_user_phase_entry_date_idx" ON public."Trade" ("userId", "phaseAccountId", "entryDate");
CREATE INDEX IF NOT EXISTS "Account_user_number_idx" ON public."Account" ("userId", "number");
CREATE INDEX IF NOT EXISTS "MasterAccount_user_status_idx" ON public."MasterAccount" ("userId", "status");
CREATE INDEX IF NOT EXISTS "BreachRecord_phaseAccountId_idx" ON public."BreachRecord" ("phaseAccountId");
CREATE INDEX IF NOT EXISTS "Payout_masterAccountId_idx" ON public."Payout" ("masterAccountId");
CREATE INDEX IF NOT EXISTS "Payout_phaseAccountId_idx" ON public."Payout" ("phaseAccountId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserSettings_userId_User_id_fk') THEN
    ALTER TABLE public."UserSettings" ADD CONSTRAINT "UserSettings_userId_User_id_fk"
      FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ImportJob_userId_User_id_fk') THEN
    ALTER TABLE public."ImportJob" ADD CONSTRAINT "ImportJob_userId_User_id_fk"
      FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Notification_userId_User_id_fk') THEN
    ALTER TABLE public."Notification" ADD CONSTRAINT "Notification_userId_User_id_fk"
      FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SharedReport_userId_User_id_fk') THEN
    ALTER TABLE public."SharedReport" ADD CONSTRAINT "SharedReport_userId_User_id_fk"
      FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Subscription_userId_User_id_fk') THEN
    ALTER TABLE public."Subscription" ADD CONSTRAINT "Subscription_userId_User_id_fk"
      FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Synchronization_userId_User_id_fk') THEN
    ALTER TABLE public."Synchronization" ADD CONSTRAINT "Synchronization_userId_User_id_fk"
      FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Account_userId_User_id_fk') THEN
    ALTER TABLE public."Account" ADD CONSTRAINT "Account_userId_User_id_fk"
      FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LiveAccountTransaction_accountId_Account_id_fk') THEN
    ALTER TABLE public."LiveAccountTransaction" ADD CONSTRAINT "LiveAccountTransaction_accountId_Account_id_fk"
      FOREIGN KEY ("accountId") REFERENCES public."Account"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LiveAccountTransaction_userId_User_id_fk') THEN
    ALTER TABLE public."LiveAccountTransaction" ADD CONSTRAINT "LiveAccountTransaction_userId_User_id_fk"
      FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MasterAccount_userId_User_id_fk') THEN
    ALTER TABLE public."MasterAccount" ADD CONSTRAINT "MasterAccount_userId_User_id_fk"
      FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PhaseAccount_masterAccountId_MasterAccount_id_fk') THEN
    ALTER TABLE public."PhaseAccount" ADD CONSTRAINT "PhaseAccount_masterAccountId_MasterAccount_id_fk"
      FOREIGN KEY ("masterAccountId") REFERENCES public."MasterAccount"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payout_masterAccountId_MasterAccount_id_fk') THEN
    ALTER TABLE public."Payout" ADD CONSTRAINT "Payout_masterAccountId_MasterAccount_id_fk"
      FOREIGN KEY ("masterAccountId") REFERENCES public."MasterAccount"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payout_phaseAccountId_PhaseAccount_id_fk') THEN
    ALTER TABLE public."Payout" ADD CONSTRAINT "Payout_phaseAccountId_PhaseAccount_id_fk"
      FOREIGN KEY ("phaseAccountId") REFERENCES public."PhaseAccount"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BreachRecord_phaseAccountId_PhaseAccount_id_fk') THEN
    ALTER TABLE public."BreachRecord" ADD CONSTRAINT "BreachRecord_phaseAccountId_PhaseAccount_id_fk"
      FOREIGN KEY ("phaseAccountId") REFERENCES public."PhaseAccount"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DailyAnchor_phaseAccountId_PhaseAccount_id_fk') THEN
    ALTER TABLE public."DailyAnchor" ADD CONSTRAINT "DailyAnchor_phaseAccountId_PhaseAccount_id_fk"
      FOREIGN KEY ("phaseAccountId") REFERENCES public."PhaseAccount"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Trade_userId_User_id_fk') THEN
    ALTER TABLE public."Trade" ADD CONSTRAINT "Trade_userId_User_id_fk"
      FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Trade_accountId_Account_id_fk') THEN
    ALTER TABLE public."Trade" ADD CONSTRAINT "Trade_accountId_Account_id_fk"
      FOREIGN KEY ("accountId") REFERENCES public."Account"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Trade_phaseAccountId_PhaseAccount_id_fk') THEN
    ALTER TABLE public."Trade" ADD CONSTRAINT "Trade_phaseAccountId_PhaseAccount_id_fk"
      FOREIGN KEY ("phaseAccountId") REFERENCES public."PhaseAccount"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Trade_modelId_TradingModel_id_fk') THEN
    ALTER TABLE public."Trade" ADD CONSTRAINT "Trade_modelId_TradingModel_id_fk"
      FOREIGN KEY ("modelId") REFERENCES public."TradingModel"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TradeExecution_tradeId_Trade_id_fk') THEN
    ALTER TABLE public."TradeExecution" ADD CONSTRAINT "TradeExecution_tradeId_Trade_id_fk"
      FOREIGN KEY ("tradeId") REFERENCES public."Trade"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TradeExecution_userId_User_id_fk') THEN
    ALTER TABLE public."TradeExecution" ADD CONSTRAINT "TradeExecution_userId_User_id_fk"
      FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TradeTag_userId_User_id_fk') THEN
    ALTER TABLE public."TradeTag" ADD CONSTRAINT "TradeTag_userId_User_id_fk"
      FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BacktestTrade_userId_User_id_fk') THEN
    ALTER TABLE public."BacktestTrade" ADD CONSTRAINT "BacktestTrade_userId_User_id_fk"
      FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DailyNote_userId_User_id_fk') THEN
    ALTER TABLE public."DailyNote" ADD CONSTRAINT "DailyNote_userId_User_id_fk"
      FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DailyNote_accountId_Account_id_fk') THEN
    ALTER TABLE public."DailyNote" ADD CONSTRAINT "DailyNote_accountId_Account_id_fk"
      FOREIGN KEY ("accountId") REFERENCES public."Account"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'JournalTemplate_userId_User_id_fk') THEN
    ALTER TABLE public."JournalTemplate" ADD CONSTRAINT "JournalTemplate_userId_User_id_fk"
      FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WeeklyReview_userId_User_id_fk') THEN
    ALTER TABLE public."WeeklyReview" ADD CONSTRAINT "WeeklyReview_userId_User_id_fk"
      FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TradingModel_userId_User_id_fk') THEN
    ALTER TABLE public."TradingModel" ADD CONSTRAINT "TradingModel_userId_User_id_fk"
      FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ActivityLog_userId_User_id_fk') THEN
    ALTER TABLE public."ActivityLog" ADD CONSTRAINT "ActivityLog_userId_User_id_fk"
      FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserGoal_userId_User_id_fk') THEN
    ALTER TABLE public."UserGoal" ADD CONSTRAINT "UserGoal_userId_User_id_fk"
      FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DashboardTemplate_userId_User_id_fk') THEN
    ALTER TABLE public."DashboardTemplate" ADD CONSTRAINT "DashboardTemplate_userId_User_id_fk"
      FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WeeklyAIReview_userId_User_id_fk') THEN
    ALTER TABLE public."WeeklyAIReview" ADD CONSTRAINT "WeeklyAIReview_userId_User_id_fk"
      FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AIChat_userId_User_id_fk') THEN
    ALTER TABLE public."AIChat" ADD CONSTRAINT "AIChat_userId_User_id_fk"
      FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AIChatMessage_chatId_AIChat_id_fk') THEN
    ALTER TABLE public."AIChatMessage" ADD CONSTRAINT "AIChatMessage_chatId_AIChat_id_fk"
      FOREIGN KEY ("chatId") REFERENCES public."AIChat"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AISavedInsight_userId_User_id_fk') THEN
    ALTER TABLE public."AISavedInsight" ADD CONSTRAINT "AISavedInsight_userId_User_id_fk"
      FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AIChatUsageLog_userId_User_id_fk') THEN
    ALTER TABLE public."AIChatUsageLog" ADD CONSTRAINT "AIChatUsageLog_userId_User_id_fk"
      FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentRecord_userId_User_id_fk') THEN
    ALTER TABLE public."PaymentRecord" ADD CONSTRAINT "PaymentRecord_userId_User_id_fk"
      FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentRecord_subscriptionId_Subscription_id_fk') THEN
    ALTER TABLE public."PaymentRecord" ADD CONSTRAINT "PaymentRecord_subscriptionId_Subscription_id_fk"
      FOREIGN KEY ("subscriptionId") REFERENCES public."Subscription"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromoRedemption_userId_User_id_fk') THEN
    ALTER TABLE public."PromoRedemption" ADD CONSTRAINT "PromoRedemption_userId_User_id_fk"
      FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname IN ('Feedback_userId_User_id_fk', 'Feedback_userId_fkey')) THEN
    ALTER TABLE public."Feedback" ADD CONSTRAINT "Feedback_userId_User_id_fk"
      FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname IN ('FeedbackReply_feedbackId_Feedback_id_fk', 'FeedbackReply_feedbackId_fkey')) THEN
    ALTER TABLE public."FeedbackReply" ADD CONSTRAINT "FeedbackReply_feedbackId_Feedback_id_fk"
      FOREIGN KEY ("feedbackId") REFERENCES public."Feedback"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname IN ('UserGeoLog_userId_User_id_fk', 'UserGeoLog_userId_fkey')) THEN
    ALTER TABLE public."UserGeoLog" ADD CONSTRAINT "UserGeoLog_userId_User_id_fk"
      FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE CASCADE;
  END IF;
END $$;
