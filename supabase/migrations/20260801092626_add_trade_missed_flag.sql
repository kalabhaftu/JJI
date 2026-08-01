-- Drizzle has selected this field since missed-trade support landed. Keep the
-- migration idempotent because older environments may have received it through
-- a direct schema sync before Supabase migrations became authoritative.
alter table public."Trade"
  add column if not exists "isMissedTrade" boolean not null default false;
