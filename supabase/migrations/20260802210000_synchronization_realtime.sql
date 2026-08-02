-- Enable realtime delivery for Synchronization rows to their owner.
GRANT SELECT ON TABLE public."Synchronization" TO authenticated;

CREATE POLICY "realtime_select_own_synchronizations" ON public."Synchronization"
  FOR SELECT TO authenticated
  USING ("userId" = (SELECT private.current_internal_user_id()));

ALTER PUBLICATION supabase_realtime ADD TABLE public."Synchronization";
