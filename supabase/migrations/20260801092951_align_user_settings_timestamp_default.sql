-- User-data reset recreates settings with database defaults. Production kept
-- this column NOT NULL after an older migration removed its default, causing
-- otherwise valid resets to fail at commit time.
alter table public."UserSettings"
  alter column "updatedAt" set default now();
