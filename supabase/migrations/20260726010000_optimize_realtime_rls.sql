DROP POLICY IF EXISTS "realtime_select_own_trades" ON public."Trade";
CREATE POLICY "realtime_select_own_trades" ON public."Trade"
  FOR SELECT TO authenticated
  USING ("userId" = (SELECT auth.uid())::text);
DROP POLICY IF EXISTS "realtime_select_own_accounts" ON public."Account";
CREATE POLICY "realtime_select_own_accounts" ON public."Account"
  FOR SELECT TO authenticated
  USING ("userId" = (SELECT auth.uid())::text);
DROP POLICY IF EXISTS "realtime_select_own_master_accounts" ON public."MasterAccount";
CREATE POLICY "realtime_select_own_master_accounts" ON public."MasterAccount"
  FOR SELECT TO authenticated
  USING ("userId" = (SELECT auth.uid())::text);
DROP POLICY IF EXISTS "realtime_select_own_daily_notes" ON public."DailyNote";
CREATE POLICY "realtime_select_own_daily_notes" ON public."DailyNote"
  FOR SELECT TO authenticated
  USING ("userId" = (SELECT auth.uid())::text);
DROP POLICY IF EXISTS "realtime_select_own_notifications" ON public."Notification";
CREATE POLICY "realtime_select_own_notifications" ON public."Notification"
  FOR SELECT TO authenticated
  USING ("userId" = (SELECT auth.uid())::text);
DROP POLICY IF EXISTS "realtime_select_own_phase_accounts" ON public."PhaseAccount";
CREATE POLICY "realtime_select_own_phase_accounts" ON public."PhaseAccount"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public."MasterAccount" AS owner
      WHERE owner."id" = "PhaseAccount"."masterAccountId"
        AND owner."userId" = (SELECT auth.uid())::text
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
        AND owner."userId" = (SELECT auth.uid())::text
    )
  );
