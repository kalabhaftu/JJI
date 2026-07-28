-- Canonical application ownership uses public."User".id. Supabase Auth owns
-- auth.uid(), so browser-facing policies resolve the internal row through a
-- private, authenticated-only helper rather than making the server-only User
-- table directly readable.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.current_internal_user_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.id
  FROM public."User" AS u
  WHERE (SELECT auth.uid()) IS NOT NULL
    AND u."auth_user_id" = (SELECT auth.uid())::text
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION private.current_internal_user_id() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION private.current_internal_user_id() TO authenticated;

DROP POLICY IF EXISTS "realtime_select_own_trades" ON public."Trade";
CREATE POLICY "realtime_select_own_trades" ON public."Trade"
  FOR SELECT TO authenticated
  USING ("userId" = (SELECT private.current_internal_user_id()));

DROP POLICY IF EXISTS "realtime_select_own_accounts" ON public."Account";
CREATE POLICY "realtime_select_own_accounts" ON public."Account"
  FOR SELECT TO authenticated
  USING ("userId" = (SELECT private.current_internal_user_id()));

DROP POLICY IF EXISTS "realtime_select_own_master_accounts" ON public."MasterAccount";
CREATE POLICY "realtime_select_own_master_accounts" ON public."MasterAccount"
  FOR SELECT TO authenticated
  USING ("userId" = (SELECT private.current_internal_user_id()));

DROP POLICY IF EXISTS "realtime_select_own_daily_notes" ON public."DailyNote";
CREATE POLICY "realtime_select_own_daily_notes" ON public."DailyNote"
  FOR SELECT TO authenticated
  USING ("userId" = (SELECT private.current_internal_user_id()));

DROP POLICY IF EXISTS "realtime_select_own_notifications" ON public."Notification";
CREATE POLICY "realtime_select_own_notifications" ON public."Notification"
  FOR SELECT TO authenticated
  USING ("userId" = (SELECT private.current_internal_user_id()));

DROP POLICY IF EXISTS "realtime_select_own_phase_accounts" ON public."PhaseAccount";
CREATE POLICY "realtime_select_own_phase_accounts" ON public."PhaseAccount"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public."MasterAccount" AS owner
      WHERE owner."id" = "PhaseAccount"."masterAccountId"
        AND owner."userId" = (SELECT private.current_internal_user_id())
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
        AND owner."userId" = (SELECT private.current_internal_user_id())
    )
  );
