-- =====================================================================
-- 0003_storage.sql — Storage bucket katalog PDF
-- =====================================================================

-- Bucket privat untuk PDF katalog (akses via signed URL dari app)
insert into storage.buckets (id, name, public)
values ('catalog', 'catalog', false)
on conflict (id) do nothing;

-- Baca: semua user terautentikasi boleh membaca file katalog
drop policy if exists catalog_read on storage.objects;
create policy catalog_read on storage.objects
  for select to authenticated
  using (bucket_id = 'catalog');

-- Tulis/hapus: hanya owner
drop policy if exists catalog_write_owner on storage.objects;
create policy catalog_write_owner on storage.objects
  for insert to authenticated
  with check (bucket_id = 'catalog' and is_admin());

drop policy if exists catalog_update_owner on storage.objects;
create policy catalog_update_owner on storage.objects
  for update to authenticated
  using (bucket_id = 'catalog' and is_admin());

drop policy if exists catalog_delete_owner on storage.objects;
create policy catalog_delete_owner on storage.objects
  for delete to authenticated
  using (bucket_id = 'catalog' and is_admin());
