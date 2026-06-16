-- =====================================================================
-- 0006b_assign_measurements.sql
-- Jalankan SETELAH 0006a (role enum sudah ter-commit).
-- =====================================================================

-- ---------------------------------------------------------------------
-- orders: konfirmasi sales + status assignment fitter
-- ---------------------------------------------------------------------
alter table orders add column if not exists sales_confirmed_at   timestamptz;
alter table orders add column if not exists sales_confirmed_by   uuid references profiles(id);
alter table orders add column if not exists fitter_assignment_status text not null default 'pending_sales_confirmation';
alter table orders add column if not exists assigned_by_head_fitter uuid references profiles(id);
alter table orders add column if not exists assigned_at          timestamptz;

-- fitter_assignment_status: pending_sales_confirmation | ready_to_assign | assigned
create index if not exists idx_orders_assign_status on orders(fitter_assignment_status);

-- ---------------------------------------------------------------------
-- order_fitters: metadata assignment
-- ---------------------------------------------------------------------
alter table order_fitters add column if not exists assigned_by     uuid references profiles(id);
alter table order_fitters add column if not exists assigned_at     timestamptz default now();
alter table order_fitters add column if not exists is_primary      boolean not null default false;
alter table order_fitters add column if not exists assignment_note text;

-- ---------------------------------------------------------------------
-- customer_measurements (1 baris per order)
-- ---------------------------------------------------------------------
create table if not exists customer_measurements (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete cascade unique,
  fitter_id     uuid references profiles(id),
  height                          numeric,
  weight                          numeric,
  neck_circumference              numeric,
  shoulder                        numeric,
  sleeve_length                   numeric,
  sleeve_opening_circumference    numeric,
  elbow                           numeric,
  upper_arm                       numeric,
  armpit                          numeric,
  chest_circumference             numeric,
  waist_circumference             numeric,
  hip_circumference               numeric,
  gamis_length                    numeric,
  bottom_width                    numeric,
  created_by    uuid references profiles(id),
  updated_by    uuid references profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_meas_order on customer_measurements(order_id);

drop trigger if exists trg_meas_touch on customer_measurements;
create trigger trg_meas_touch before update on customer_measurements
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------
-- customer_measurement_photos (maks 5 per order, dibatasi di app)
-- ---------------------------------------------------------------------
create table if not exists customer_measurement_photos (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references orders(id) on delete cascade,
  measurement_id uuid references customer_measurements(id) on delete cascade,
  storage_path   text not null,
  public_url     text,
  uploaded_by    uuid references profiles(id),
  created_at     timestamptz not null default now()
);
create index if not exists idx_photo_order on customer_measurement_photos(order_id);

-- ---------------------------------------------------------------------
-- Helper RLS untuk role baru
-- ---------------------------------------------------------------------
create or replace function is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'manager' from profiles where id = auth.uid()), false);
$$;

create or replace function is_head_fitter() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'head_fitter' from profiles where id = auth.uid()), false);
$$;

-- Boleh "melihat" (read-only luas): admin atau manager
create or replace function can_view_all() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('super_admin','manager') from profiles where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------
-- Perbarui RLS orders: manager read semua; head_fitter read order
-- yang sudah dikonfirmasi sales (untuk assign) + yang sudah ia assign.
-- ---------------------------------------------------------------------
drop policy if exists orders_select on orders;
create policy orders_select on orders
  for select to authenticated using (
    is_admin()
    or is_manager()
    or sales_id = auth.uid()
    or is_assigned_fitter(id)
    or (is_head_fitter() and (sales_confirmed_at is not null or fitter_assignment_status in ('ready_to_assign','assigned')))
  );

-- update: admin; sales pemilik (sebelum confirmed); fitter assigned; head_fitter (assign)
drop policy if exists orders_update on orders;
create policy orders_update on orders
  for update to authenticated using (
    is_admin() or sales_id = auth.uid() or is_assigned_fitter(id) or is_head_fitter()
  ) with check (
    is_admin() or sales_id = auth.uid() or is_assigned_fitter(id) or is_head_fitter()
  );

-- order_fitters: head_fitter & admin boleh menulis (assign); manager read; fitter read miliknya
drop policy if exists of_select on order_fitters;
create policy of_select on order_fitters
  for select to authenticated using (
    is_admin() or is_manager()
    or fitter_id = auth.uid()
    or is_head_fitter()
    or exists (select 1 from orders o where o.id = order_id and o.sales_id = auth.uid())
  );

drop policy if exists of_write on order_fitters;
create policy of_write on order_fitters
  for all to authenticated using (
    is_admin() or is_head_fitter()
  ) with check (
    is_admin() or is_head_fitter()
  );

-- model details: tambahkan manager (read) ke kebijakan select
drop policy if exists model_select on order_model_details;
create policy model_select on order_model_details
  for select to authenticated using (
    is_admin() or is_manager()
    or exists (select 1 from orders o where o.id = order_id and (
      o.sales_id = auth.uid() or is_assigned_fitter(o.id) or is_head_fitter()
    ))
  );

-- ---------------------------------------------------------------------
-- RLS measurements & photos
-- read: admin/manager; sales pemilik; fitter assigned; head_fitter
-- write: fitter assigned (saat fitter_work) atau admin
-- ---------------------------------------------------------------------
alter table customer_measurements enable row level security;
alter table customer_measurement_photos enable row level security;

drop policy if exists meas_select on customer_measurements;
create policy meas_select on customer_measurements
  for select to authenticated using (
    is_admin() or is_manager()
    or exists (select 1 from orders o where o.id = order_id and (
      o.sales_id = auth.uid() or is_assigned_fitter(o.id) or is_head_fitter()
    ))
  );

drop policy if exists meas_write on customer_measurements;
create policy meas_write on customer_measurements
  for all to authenticated using (
    is_admin() or exists (select 1 from orders o where o.id = order_id and is_assigned_fitter(o.id) and o.status = 'fitter_work')
  ) with check (
    is_admin() or exists (select 1 from orders o where o.id = order_id and is_assigned_fitter(o.id) and o.status = 'fitter_work')
  );

drop policy if exists photo_select on customer_measurement_photos;
create policy photo_select on customer_measurement_photos
  for select to authenticated using (
    is_admin() or is_manager()
    or exists (select 1 from orders o where o.id = order_id and (
      o.sales_id = auth.uid() or is_assigned_fitter(o.id) or is_head_fitter()
    ))
  );

drop policy if exists photo_write on customer_measurement_photos;
create policy photo_write on customer_measurement_photos
  for all to authenticated using (
    is_admin() or exists (select 1 from orders o where o.id = order_id and is_assigned_fitter(o.id) and o.status = 'fitter_work')
  ) with check (
    is_admin() or exists (select 1 from orders o where o.id = order_id and is_assigned_fitter(o.id) and o.status = 'fitter_work')
  );

-- ---------------------------------------------------------------------
-- master_options, profiles, invoices, dst: izinkan manager READ.
-- ---------------------------------------------------------------------
drop policy if exists inv_select on invoices;
create policy inv_select on invoices
  for select to authenticated using (
    is_admin() or is_manager()
    or exists (select 1 from orders o where o.id = order_id and (
      o.sales_id = auth.uid() or is_assigned_fitter(o.id)
    ))
  );

drop policy if exists logs_select on activity_logs;
create policy logs_select on activity_logs
  for select to authenticated using (is_admin() or is_manager() or actor_id = auth.uid());

-- ---------------------------------------------------------------------
-- Storage bucket foto customer (privat)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('customer-photos', 'customer-photos', false)
on conflict (id) do nothing;

drop policy if exists cust_photo_read on storage.objects;
create policy cust_photo_read on storage.objects
  for select to authenticated using (bucket_id = 'customer-photos');

drop policy if exists cust_photo_write on storage.objects;
create policy cust_photo_write on storage.objects
  for insert to authenticated with check (bucket_id = 'customer-photos');

drop policy if exists cust_photo_delete on storage.objects;
create policy cust_photo_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'customer-photos' and (is_admin() or owner = auth.uid())
  );
