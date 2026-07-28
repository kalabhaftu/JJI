-- Storage is still public during the legacy-object migration. Access policies
-- now resolve the canonical internal user ID; the auth-ID branch is temporary
-- for existing objects and is removed after object-reference migration.

drop policy if exists "Users can read own trade images" on storage.objects;
create policy "Users can read own trade images"
on storage.objects for select to authenticated
using (
  bucket_id = 'trade-images'
  and (
    (storage.foldername(name))[1] in ((select private.current_internal_user_id()), (select auth.uid())::text)
    or (storage.foldername(name))[2] in ((select private.current_internal_user_id()), (select auth.uid())::text)
  )
);

drop policy if exists "Users can upload own trade images" on storage.objects;
create policy "Users can upload own trade images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'trade-images'
  and (
    (storage.foldername(name))[1] in ((select private.current_internal_user_id()), (select auth.uid())::text)
    or (storage.foldername(name))[2] in ((select private.current_internal_user_id()), (select auth.uid())::text)
  )
);

drop policy if exists "Users can update own trade images" on storage.objects;
create policy "Users can update own trade images"
on storage.objects for update to authenticated
using (
  bucket_id = 'trade-images'
  and (
    (storage.foldername(name))[1] in ((select private.current_internal_user_id()), (select auth.uid())::text)
    or (storage.foldername(name))[2] in ((select private.current_internal_user_id()), (select auth.uid())::text)
  )
)
with check (
  bucket_id = 'trade-images'
  and (
    (storage.foldername(name))[1] in ((select private.current_internal_user_id()), (select auth.uid())::text)
    or (storage.foldername(name))[2] in ((select private.current_internal_user_id()), (select auth.uid())::text)
  )
);

drop policy if exists "Users can delete own trade images" on storage.objects;
create policy "Users can delete own trade images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'trade-images'
  and (
    (storage.foldername(name))[1] in ((select private.current_internal_user_id()), (select auth.uid())::text)
    or (storage.foldername(name))[2] in ((select private.current_internal_user_id()), (select auth.uid())::text)
  )
);

drop policy if exists "Users can read own feedback attachments" on storage.objects;
create policy "Users can read own feedback attachments"
on storage.objects for select to authenticated
using (
  bucket_id = 'feedback-attachments'
  and (storage.foldername(name))[1] in ((select private.current_internal_user_id()), (select auth.uid())::text)
);

drop policy if exists "Users can upload own feedback attachments" on storage.objects;
create policy "Users can upload own feedback attachments"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'feedback-attachments'
  and (storage.foldername(name))[1] in ((select private.current_internal_user_id()), (select auth.uid())::text)
);

drop policy if exists "Users can update own feedback attachments" on storage.objects;
create policy "Users can update own feedback attachments"
on storage.objects for update to authenticated
using (
  bucket_id = 'feedback-attachments'
  and (storage.foldername(name))[1] in ((select private.current_internal_user_id()), (select auth.uid())::text)
)
with check (
  bucket_id = 'feedback-attachments'
  and (storage.foldername(name))[1] in ((select private.current_internal_user_id()), (select auth.uid())::text)
);

drop policy if exists "Users can delete own feedback attachments" on storage.objects;
create policy "Users can delete own feedback attachments"
on storage.objects for delete to authenticated
using (
  bucket_id = 'feedback-attachments'
  and (storage.foldername(name))[1] in ((select private.current_internal_user_id()), (select auth.uid())::text)
);

drop policy if exists "Users can read own weekly calendars" on storage.objects;
create policy "Users can read own weekly calendars"
on storage.objects for select to authenticated
using (
  bucket_id = 'weekly-calendars'
  and (storage.foldername(name))[1] in ((select private.current_internal_user_id()), (select auth.uid())::text)
);

drop policy if exists "Users can upload own weekly calendars" on storage.objects;
create policy "Users can upload own weekly calendars"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'weekly-calendars'
  and (storage.foldername(name))[1] in ((select private.current_internal_user_id()), (select auth.uid())::text)
);

drop policy if exists "Users can update own weekly calendars" on storage.objects;
create policy "Users can update own weekly calendars"
on storage.objects for update to authenticated
using (
  bucket_id = 'weekly-calendars'
  and (storage.foldername(name))[1] in ((select private.current_internal_user_id()), (select auth.uid())::text)
)
with check (
  bucket_id = 'weekly-calendars'
  and (storage.foldername(name))[1] in ((select private.current_internal_user_id()), (select auth.uid())::text)
);

drop policy if exists "Users can delete own weekly calendars" on storage.objects;
create policy "Users can delete own weekly calendars"
on storage.objects for delete to authenticated
using (
  bucket_id = 'weekly-calendars'
  and (storage.foldername(name))[1] in ((select private.current_internal_user_id()), (select auth.uid())::text)
);
