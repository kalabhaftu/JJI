create table if not exists "WhopMembership" (
  "id" text primary key,
  "userId" text not null references "User" ("id") on delete cascade,
  "subscriptionId" text not null references "Subscription" ("id") on delete cascade,
  "membershipId" text not null,
  "whopUserId" text,
  "planId" text not null,
  "productId" text,
  "environment" text not null,
  "status" text not null,
  "cancelAtPeriodEnd" boolean not null default false,
  "currentPeriodStart" timestamptz,
  "currentPeriodEnd" timestamptz,
  "manageUrl" text,
  "providerUpdatedAt" timestamptz,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create unique index if not exists "WhopMembership_membershipId_key"
  on "WhopMembership" ("membershipId");
create index if not exists "WhopMembership_userId_idx"
  on "WhopMembership" ("userId");
create index if not exists "WhopMembership_subscriptionId_idx"
  on "WhopMembership" ("subscriptionId");

create table if not exists "WhopWebhookEvent" (
  "id" text primary key,
  "eventId" text not null,
  "eventType" text not null,
  "resourceId" text,
  "status" text not null default 'received',
  "attemptCount" integer not null default 0,
  "requestId" text,
  "payloadHash" text not null,
  "reviewRequired" boolean not null default false,
  "lastErrorCode" text,
  "workerToken" text,
  "leaseExpiresAt" timestamptz,
  "occurredAt" timestamptz,
  "queuedAt" timestamptz,
  "processedAt" timestamptz,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

-- `main` briefly shipped a different table under the same name in migration
-- version 0004. Expand that shape in place when present; on a clean database
-- these statements are no-ops. Legacy columns remain nullable for one deploy so
-- the previous webhook handler can keep running while the new app is promoted.
alter table "WhopWebhookEvent" add column if not exists "resourceId" text;
alter table "WhopWebhookEvent" add column if not exists "status" text not null default 'received';
alter table "WhopWebhookEvent" add column if not exists "attemptCount" integer not null default 0;
alter table "WhopWebhookEvent" add column if not exists "requestId" text;
alter table "WhopWebhookEvent" add column if not exists "payloadHash" text;
alter table "WhopWebhookEvent" add column if not exists "reviewRequired" boolean not null default false;
alter table "WhopWebhookEvent" add column if not exists "lastErrorCode" text;
alter table "WhopWebhookEvent" add column if not exists "workerToken" text;
alter table "WhopWebhookEvent" add column if not exists "leaseExpiresAt" timestamptz;
alter table "WhopWebhookEvent" add column if not exists "occurredAt" timestamptz;
alter table "WhopWebhookEvent" add column if not exists "queuedAt" timestamptz;
alter table "WhopWebhookEvent" add column if not exists "processedAt" timestamptz;
alter table "WhopWebhookEvent" add column if not exists "createdAt" timestamptz not null default now();
alter table "WhopWebhookEvent" add column if not exists "updatedAt" timestamptz not null default now();
alter table "WhopWebhookEvent" alter column "processedAt" drop default;
alter table "WhopWebhookEvent" alter column "processedAt" drop not null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'WhopWebhookEvent'
      and column_name = 'membershipId'
  ) then
    execute 'update "WhopWebhookEvent" set "resourceId" = coalesce("resourceId", "membershipId")';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'WhopWebhookEvent'
      and column_name = 'processingResult'
  ) then
    execute $legacy$
      update "WhopWebhookEvent"
      set "status" = case "processingResult"
        when 'processed' then 'processed'
        when 'error' then 'failed'
        else 'received'
      end,
      "processedAt" = case when "processingResult" = 'processed' then "processedAt" else null end
    $legacy$;
    execute 'alter table "WhopWebhookEvent" alter column "processingResult" drop not null';
  end if;
end
$$;

update "WhopWebhookEvent"
set "payloadHash" = 'legacy:' || "eventId"
where "payloadHash" is null;

alter table "WhopWebhookEvent" alter column "payloadHash" set not null;

-- Prevent the previous application version from retaining private webhook
-- bodies between this migration and the application promotion.
create or replace function public.jji_redact_legacy_whop_payload()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new."rawPayload" := null;
  return new;
end;
$$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'WhopWebhookEvent'
      and column_name = 'rawPayload'
  ) then
    execute 'update "WhopWebhookEvent" set "rawPayload" = null where "rawPayload" is not null';
    execute 'drop trigger if exists "WhopWebhookEvent_redact_legacy_payload" on "WhopWebhookEvent"';
    execute 'create trigger "WhopWebhookEvent_redact_legacy_payload" before insert or update of "rawPayload" on "WhopWebhookEvent" for each row execute function public.jji_redact_legacy_whop_payload()';
  end if;
end
$$;

create unique index if not exists "WhopWebhookEvent_eventId_key"
  on "WhopWebhookEvent" ("eventId");
create index if not exists "WhopWebhookEvent_status_createdAt_idx"
  on "WhopWebhookEvent" ("status", "createdAt");
create index if not exists "WhopWebhookEvent_resourceId_idx"
  on "WhopWebhookEvent" ("resourceId");
create index if not exists "WhopWebhookEvent_requestId_idx"
  on "WhopWebhookEvent" ("requestId");

alter table "WhopMembership" enable row level security;
alter table "WhopWebhookEvent" enable row level security;

revoke all on table "WhopMembership" from anon, authenticated;
revoke all on table "WhopWebhookEvent" from anon, authenticated;
