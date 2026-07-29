alter table "AuditLog"
  add column if not exists "request_id" text,
  add column if not exists "entity_type" text,
  add column if not exists "source" text;

alter table "AuditLog"
  alter column "user_id" drop not null;

alter table "AuditLog"
  drop constraint if exists "AuditLog_user_id_User_id_fk";

alter table "AuditLog"
  add constraint "AuditLog_user_id_User_id_fk"
  foreign key ("user_id") references "User" ("id")
  on delete set null;

create index if not exists "AuditLog_request_id_idx"
  on "AuditLog" ("request_id")
  where "request_id" is not null;

alter table "ActivityLog"
  add column if not exists "requestId" text;

create index if not exists "ActivityLog_requestId_idx"
  on "ActivityLog" ("requestId")
  where "requestId" is not null;
