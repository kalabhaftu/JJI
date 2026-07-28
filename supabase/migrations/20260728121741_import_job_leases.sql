insert into storage.buckets (id, name, public)
values ('import-archives', 'import-archives', false)
on conflict (id) do update set public = false;

ALTER TABLE public."ImportJob"
  ADD COLUMN IF NOT EXISTS "fileObjectPath" text,
  ADD COLUMN IF NOT EXISTS "workerToken" text,
  ADD COLUMN IF NOT EXISTS "leaseExpiresAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "attempt" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "eventId" text;

ALTER TABLE public."ImportJob" ALTER COLUMN "fileData" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "ImportJob_userId_status_idx"
  ON public."ImportJob" ("userId", "status");

CREATE INDEX IF NOT EXISTS "import_job_user_created_at_idx"
  ON public."ImportJob" ("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "ImportJob_leaseExpiresAt_idx"
  ON public."ImportJob" ("status", "leaseExpiresAt");
