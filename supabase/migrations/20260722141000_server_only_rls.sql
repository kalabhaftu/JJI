-- Server-only database contract. Application reads/writes use the trusted
-- server connection; browser roles receive no direct table access. Rehearse
-- this migration against a staging clone and run the API test matrix first.
DO $$
DECLARE
  table_name text;
  protected_tables text[] := ARRAY[
    'AIChat', 'AIChatMessage', 'AIChatUsageLog', 'AISavedInsight', 'Account',
    'ActivityLog', 'AdminAISetting', 'AdminDashboardPreset', 'AdminFeatureFlag',
    'AdminSharingPolicy', 'AdminWidgetSetting', 'AuditLog', 'BacktestTrade',
    'BreachRecord', 'DailyAnchor', 'DailyNote', 'DashboardTemplate',
    'DonationAddress', 'Feedback', 'FeedbackReply', 'FreeAccessInvite',
    'ImportJob', 'JournalTemplate', 'LiveAccountTransaction', 'MasterAccount',
    'Notification', 'PaymentRecord', 'Payout', 'PhaseAccount', 'PromoCode',
    'PromoRedemption', 'SharedReport', 'SiteUiSettings', 'Subscription',
    'Synchronization', 'Trade', 'TradeExecution', 'TradeTag', 'TradingModel',
    'User', 'UserGeoLog', 'UserGoal', 'UserSettings', 'WeeklyAIReview',
    'WeeklyReview'
  ];
BEGIN
  FOREACH table_name IN ARRAY protected_tables LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', table_name);
    END IF;
  END LOOP;
END $$;
-- Realtime subscriptions need SELECT privileges. These policies expose only
-- rows owned by the signed-in user; browser writes remain revoked and every
-- non-Realtime table remains server-only.
GRANT SELECT ON TABLE
  public."Trade",
  public."Account",
  public."MasterAccount",
  public."PhaseAccount",
  public."Payout",
  public."DailyNote",
  public."Notification"
TO authenticated;
DROP POLICY IF EXISTS "realtime_select_own_trades" ON public."Trade";
CREATE POLICY "realtime_select_own_trades" ON public."Trade"
  FOR SELECT TO authenticated
  USING ("userId" = auth.uid()::text);
DROP POLICY IF EXISTS "realtime_select_own_accounts" ON public."Account";
CREATE POLICY "realtime_select_own_accounts" ON public."Account"
  FOR SELECT TO authenticated
  USING ("userId" = auth.uid()::text);
DROP POLICY IF EXISTS "realtime_select_own_master_accounts" ON public."MasterAccount";
CREATE POLICY "realtime_select_own_master_accounts" ON public."MasterAccount"
  FOR SELECT TO authenticated
  USING ("userId" = auth.uid()::text);
DROP POLICY IF EXISTS "realtime_select_own_daily_notes" ON public."DailyNote";
CREATE POLICY "realtime_select_own_daily_notes" ON public."DailyNote"
  FOR SELECT TO authenticated
  USING ("userId" = auth.uid()::text);
DROP POLICY IF EXISTS "realtime_select_own_notifications" ON public."Notification";
CREATE POLICY "realtime_select_own_notifications" ON public."Notification"
  FOR SELECT TO authenticated
  USING ("userId" = auth.uid()::text);
DROP POLICY IF EXISTS "realtime_select_own_phase_accounts" ON public."PhaseAccount";
CREATE POLICY "realtime_select_own_phase_accounts" ON public."PhaseAccount"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public."MasterAccount" AS owner
      WHERE owner."id" = "PhaseAccount"."masterAccountId"
        AND owner."userId" = auth.uid()::text
    )
  );
DROP POLICY IF EXISTS "realtime_select_own_payouts" ON public."Payout";
CREATE POLICY "realtime_select_own_payouts" ON public."Payout"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public."MasterAccount" AS owner
      WHERE owner."id" = "Payout"."masterAccountId"
        AND owner."userId" = auth.uid()::text
    )
  );
