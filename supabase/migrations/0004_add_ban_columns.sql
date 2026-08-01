-- Historical production marker. These columns are retained for migration and
-- schema parity only; application billing and dispute handling do not use them.
alter table "User" add column if not exists "isBanned" boolean default false;
alter table "User" add column if not exists "bannedAt" timestamptz;
alter table "User" add column if not exists "bannedUntil" timestamptz;
alter table "User" add column if not exists "banReason" text;
