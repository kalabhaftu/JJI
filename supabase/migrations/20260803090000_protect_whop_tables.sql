-- Protect the Whop tables added after the server-only RLS migration.
-- Mirrors the server-only contract: browser roles have no direct access.
DO $$
DECLARE
  table_name text;
  protected_tables text[] := ARRAY['WhopMembership', 'WhopWebhookEvent'];
BEGIN
  FOREACH table_name IN ARRAY protected_tables LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', table_name);
    END IF;
  END LOOP;
END $$;