-- Supersedes the historical 0001/0002 generated migrations. Those files
-- assumed an empty database and contained a UUID/text foreign-key mismatch.
-- This migration aligns the existing production schema without recreating
-- populated enum columns.
DO $$
DECLARE
  old_names text[] := ARRAY[
    'BacktestDirection', 'BacktestModel', 'BacktestOutcome', 'BacktestSession',
    'BreachType', 'DrawdownType', 'FeedbackCategory', 'FeedbackStatus',
    'FreeAccessType', 'ImportJobStatus', 'JournalEmotion', 'MarketBias',
    'MasterAccountStatus', 'NotificationPriority', 'NotificationType',
    'PaymentStatus', 'PayoutStatus', 'PhaseAccountStatus',
    'PromoApplicability', 'PromoType', 'SubscriptionStatus',
    'TradeExecutionKind', 'TradeOutcome', 'TransactionType', 'UserRole',
    'WeeklyExpectation'
  ];
  new_names text[] := ARRAY[
    'backtest_direction', 'backtest_model', 'backtest_outcome', 'backtest_session',
    'breach_type', 'drawdown_type', 'feedback_category', 'feedback_status',
    'free_access_type', 'import_job_status', 'journal_emotion', 'market_bias',
    'master_account_status', 'notification_priority', 'notification_type',
    'payment_status', 'payout_status', 'phase_account_status',
    'promo_applicability', 'promo_type', 'subscription_status',
    'trade_execution_kind', 'trade_outcome', 'transaction_type', 'user_role',
    'weekly_expectation'
  ];
  position integer;
BEGIN
  FOR position IN 1..array_length(old_names, 1) LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_type
      WHERE typnamespace = 'public'::regnamespace
        AND typname = old_names[position]
    ) AND NOT EXISTS (
      SELECT 1
      FROM pg_type
      WHERE typnamespace = 'public'::regnamespace
        AND typname = new_names[position]
    ) THEN
      EXECUTE format(
        'ALTER TYPE public.%I RENAME TO %I',
        old_names[position],
        new_names[position]
      );
    END IF;
  END LOOP;
END
$$;
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'RISK_BREACH';
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Feedback' AND column_name = 'ipAddress'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Feedback' AND column_name = 'ip_address'
  ) THEN
    ALTER TABLE public."Feedback" RENAME COLUMN "ipAddress" TO ip_address;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Feedback' AND column_name = 'userAgent'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Feedback' AND column_name = 'user_agent'
  ) THEN
    ALTER TABLE public."Feedback" RENAME COLUMN "userAgent" TO user_agent;
  END IF;
END
$$;
CREATE TABLE IF NOT EXISTS public."AuditLog" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  action text NOT NULL,
  entity_id text NOT NULL,
  before_data jsonb,
  after_data jsonb,
  ip_address text,
  created_at timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "AuditLog_user_id_idx"
  ON public."AuditLog" (user_id);
CREATE INDEX IF NOT EXISTS "AuditLog_entity_id_idx"
  ON public."AuditLog" (entity_id);
CREATE INDEX IF NOT EXISTS "AuditLog_created_at_idx"
  ON public."AuditLog" (created_at DESC);
ALTER TABLE public."AuditLog" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."AuditLog" FROM anon, authenticated;
