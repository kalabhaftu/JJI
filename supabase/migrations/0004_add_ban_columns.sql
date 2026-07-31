ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isBanned" boolean DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bannedAt" timestamp with time zone;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bannedUntil" timestamp with time zone;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "banReason" text;
