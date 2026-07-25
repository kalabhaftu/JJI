-- Supabase Storage hardening policy for JJI.
--
-- This first-pass policy matches the current application path conventions:
--   trade-images/<folder>/<auth-user-id>/<optional-trade-id>/<file>
--   feedback-attachments/<auth-user-id>/<submission-id>/<file>
--   weekly-calendars/<auth-user-id>/<week-start>/<file>
--
-- IMPORTANT:
-- trade-images may still need to remain public while legacy rows store public
-- URLs. Do not mark that bucket private until trade image reads migrate to stored
-- object references and owner-checked signed URLs. New write paths are still
-- owner-prefixed so bucket privacy can be tightened later without changing path
-- shape.
--
-- feedback-attachments should be private. The app uploads feedback attachments
-- server-side and stores storage:// object references for new submissions.

alter table storage.objects enable row level security;

insert into storage.buckets (id, name, public)
values
  ('trade-images', 'trade-images', true),
  ('feedback-attachments', 'feedback-attachments', false),
  ('weekly-calendars', 'weekly-calendars', true)
on conflict (id) do update
set public = excluded.public;

-- Remove every legacy policy currently present in production. PostgreSQL
-- combines permissive policies with OR, so leaving one would bypass the
-- hardened owner-prefix checks below.
drop policy if exists "Allow authenticated uploads" on storage.objects;
drop policy if exists "Allow authenticated uploads to trade-images" on storage.objects;
drop policy if exists "Allow user deletes" on storage.objects;
drop policy if exists "Allow user updates" on storage.objects;
drop policy if exists "Allow users to delete their files" on storage.objects;
drop policy if exists "Allow users to update their files" on storage.objects;
drop policy if exists "feedback_attachments_insert" on storage.objects;

-- Authenticated users may read trade images under either their auth uid prefix
-- or the existing folder/internal-user-id convention. Existing public URLs remain
-- available while the bucket is public.
drop policy if exists "Users can read own trade images" on storage.objects;
create policy "Users can read own trade images"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'trade-images'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or (storage.foldername(name))[2] = auth.uid()::text
  )
);

-- Users may upload trade images only under an owner prefix. Service-role uploads
-- bypass RLS for server-side import/cleanup flows.
drop policy if exists "Users can upload own trade images" on storage.objects;
create policy "Users can upload own trade images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'trade-images'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or (storage.foldername(name))[2] = auth.uid()::text
  )
);

drop policy if exists "Users can update own trade images" on storage.objects;
create policy "Users can update own trade images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'trade-images'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or (storage.foldername(name))[2] = auth.uid()::text
  )
)
with check (
  bucket_id = 'trade-images'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or (storage.foldername(name))[2] = auth.uid()::text
  )
);

drop policy if exists "Users can delete own trade images" on storage.objects;
create policy "Users can delete own trade images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'trade-images'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or (storage.foldername(name))[2] = auth.uid()::text
  )
);

-- Feedback attachments are private by bucket setting. Authenticated users may
-- access only files under their own prefix; support/admin service-role clients
-- bypass RLS for review and cleanup.
drop policy if exists "Users can read own feedback attachments" on storage.objects;
create policy "Users can read own feedback attachments"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'feedback-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can upload own feedback attachments" on storage.objects;
create policy "Users can upload own feedback attachments"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'feedback-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update own feedback attachments" on storage.objects;
create policy "Users can update own feedback attachments"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'feedback-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'feedback-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete own feedback attachments" on storage.objects;
create policy "Users can delete own feedback attachments"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'feedback-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Weekly review rows currently store public calendar image URLs. Browser writes
-- are limited to an authenticated user's own prefix until those legacy URLs can
-- be migrated to private object references.
drop policy if exists "Users can read own weekly calendars" on storage.objects;
create policy "Users can read own weekly calendars"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'weekly-calendars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can upload own weekly calendars" on storage.objects;
create policy "Users can upload own weekly calendars"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'weekly-calendars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update own weekly calendars" on storage.objects;
create policy "Users can update own weekly calendars"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'weekly-calendars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'weekly-calendars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete own weekly calendars" on storage.objects;
create policy "Users can delete own weekly calendars"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'weekly-calendars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Verification queries to run after applying:
-- select id, public from storage.buckets where id in ('trade-images', 'feedback-attachments', 'weekly-calendars');
-- select policyname, cmd, roles from pg_policies where schemaname = 'storage' and tablename = 'objects' order by policyname;
