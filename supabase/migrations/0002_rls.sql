-- =====================================================================
-- 0002_rls.sql — Row Level Security + helper + RPC
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper: role & kepemilikan (SECURITY DEFINER agar tidak rekursif ke RLS)
-- ---------------------------------------------------------------------
create or replace function auth_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'super_admin' from profiles where id = auth.uid()), false);
$$;

create or replace function is_assigned_fitter(o_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from order_fitters
    where order_id = o_id and fitter_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------
-- Aktifkan RLS
-- ---------------------------------------------------------------------
alter table profiles            enable row level security;
alter table master_options      enable row level security;
alter table orders              enable row level security;
alter table order_fitters       enable row level security;
alter table order_model_details enable row level security;
alter table invoices            enable row level security;
alter table invoice_revisions   enable row level security;
alter table catalog_files       enable row level security;
alter table activity_logs       enable row level security;

-- ---------------------------------------------------------------------
-- profiles
-- semua user terautentikasi boleh baca daftar profil (untuk nama sales/fitter);
-- hanya owner yang boleh menulis.
-- ---------------------------------------------------------------------
drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles
  for select to authenticated using (true);

drop policy if exists profiles_write_owner on profiles;
create policy profiles_write_owner on profiles
  for all to authenticated using (is_admin()) with check (is_admin());

-- user boleh update baris dirinya (mis. nama) — opsional, owner tetap bisa semua
drop policy if exists profiles_self_update on profiles;
create policy profiles_self_update on profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------
-- master_options : semua authenticated baca; hanya owner tulis
-- ---------------------------------------------------------------------
drop policy if exists master_read on master_options;
create policy master_read on master_options
  for select to authenticated using (true);

drop policy if exists master_write_owner on master_options;
create policy master_write_owner on master_options
  for all to authenticated using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------
-- orders
--   owner  : semua
--   sales  : hanya order miliknya (sales_id = uid)
--   fitter : hanya order yang di-assign ke dirinya
-- ---------------------------------------------------------------------
drop policy if exists orders_select on orders;
create policy orders_select on orders
  for select to authenticated using (
    is_admin()
    or sales_id = auth.uid()
    or is_assigned_fitter(id)
  );

-- sales boleh insert order baru sebagai dirinya; owner boleh insert apa saja
drop policy if exists orders_insert on orders;
create policy orders_insert on orders
  for insert to authenticated with check (
    is_admin() or (auth_role() = 'sales' and sales_id = auth.uid())
  );

-- update:
--   owner  : semua
--   sales  : order miliknya
--   fitter : order yang di-assign (mis. saat input model mengubah status)
drop policy if exists orders_update on orders;
create policy orders_update on orders
  for update to authenticated using (
    is_admin() or sales_id = auth.uid() or is_assigned_fitter(id)
  ) with check (
    is_admin() or sales_id = auth.uid() or is_assigned_fitter(id)
  );

-- tidak ada policy DELETE → hard delete diblokir untuk semua (soft delete via status)

-- ---------------------------------------------------------------------
-- order_fitters
-- ---------------------------------------------------------------------
drop policy if exists of_select on order_fitters;
create policy of_select on order_fitters
  for select to authenticated using (
    is_admin()
    or fitter_id = auth.uid()
    or exists (select 1 from orders o where o.id = order_id and o.sales_id = auth.uid())
  );

drop policy if exists of_write on order_fitters;
create policy of_write on order_fitters
  for all to authenticated using (
    is_admin() or exists (select 1 from orders o where o.id = order_id and o.sales_id = auth.uid())
  ) with check (
    is_admin() or exists (select 1 from orders o where o.id = order_id and o.sales_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- order_model_details
--   baca   : siapa pun yang boleh baca order induk
--   tulis  : owner; sales pemilik (saat sales_model_input); fitter assigned (saat fitter_work)
-- ---------------------------------------------------------------------
drop policy if exists model_select on order_model_details;
create policy model_select on order_model_details
  for select to authenticated using (
    exists (select 1 from orders o where o.id = order_id and (
      is_admin() or o.sales_id = auth.uid() or is_assigned_fitter(o.id)
    ))
  );

drop policy if exists model_write on order_model_details;
create policy model_write on order_model_details
  for all to authenticated using (
    exists (select 1 from orders o where o.id = order_id and (
      is_admin()
      or (o.sales_id = auth.uid() and o.status = 'sales_model_input')
      or (is_assigned_fitter(o.id) and o.status = 'fitter_work')
    ))
  ) with check (
    exists (select 1 from orders o where o.id = order_id and (
      is_admin()
      or (o.sales_id = auth.uid() and o.status in ('sales_model_input','invoice_draft'))
      or (is_assigned_fitter(o.id) and o.status = 'fitter_work')
    ))
  );

-- ---------------------------------------------------------------------
-- invoices
--   baca/tulis: owner; sales pemilik order; fitter assigned boleh BACA
-- ---------------------------------------------------------------------
drop policy if exists inv_select on invoices;
create policy inv_select on invoices
  for select to authenticated using (
    exists (select 1 from orders o where o.id = order_id and (
      is_admin() or o.sales_id = auth.uid() or is_assigned_fitter(o.id)
    ))
  );

drop policy if exists inv_write on invoices;
create policy inv_write on invoices
  for all to authenticated using (
    exists (select 1 from orders o where o.id = order_id and (is_admin() or o.sales_id = auth.uid()))
  ) with check (
    exists (select 1 from orders o where o.id = order_id and (is_admin() or o.sales_id = auth.uid()))
  );

-- ---------------------------------------------------------------------
-- invoice_revisions : owner & sales pemilik
-- ---------------------------------------------------------------------
drop policy if exists rev_all on invoice_revisions;
create policy rev_all on invoice_revisions
  for all to authenticated using (
    exists (
      select 1 from invoices i join orders o on o.id = i.order_id
      where i.id = invoice_id and (is_admin() or o.sales_id = auth.uid())
    )
  ) with check (
    exists (
      select 1 from invoices i join orders o on o.id = i.order_id
      where i.id = invoice_id and (is_admin() or o.sales_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------
-- catalog_files : authenticated baca; owner tulis
-- ---------------------------------------------------------------------
drop policy if exists cat_read on catalog_files;
create policy cat_read on catalog_files
  for select to authenticated using (true);

drop policy if exists cat_write_owner on catalog_files;
create policy cat_write_owner on catalog_files
  for all to authenticated using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------
-- activity_logs : owner baca semua; user baca log miliknya. insert by authenticated.
-- ---------------------------------------------------------------------
drop policy if exists logs_select on activity_logs;
create policy logs_select on activity_logs
  for select to authenticated using (is_admin() or actor_id = auth.uid());

drop policy if exists logs_insert on activity_logs;
create policy logs_insert on activity_logs
  for insert to authenticated with check (actor_id = auth.uid());

-- ---------------------------------------------------------------------
-- RPC: nomor invoice berikutnya (atomik per tahun)
-- ---------------------------------------------------------------------
create or replace function next_invoice_number(p_year int)
returns text language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into invoice_counters(year, last) values (p_year, 1)
    on conflict (year) do update set last = invoice_counters.last + 1
    returning last into n;
  return 'INV-TRD-' || p_year::text || '-' || lpad(n::text, 4, '0');
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: invoice publik via slug (tanpa login)
-- SECURITY DEFINER → bypass RLS, hanya mengembalikan data invoice yang aman.
-- ---------------------------------------------------------------------
create or replace function public_invoice(p_slug text)
returns json language plpgsql security definer set search_path = public as $$
declare result json;
begin
  select json_build_object(
    'number', i.number_active,
    'created_at', i.created_at,
    'total', i.total,
    'customer', o.customer,
    'id_scalev', o.id_scalev,
    'sales_name', p.name,
    'packages', coalesce((
      select json_agg(json_build_object(
        'name', concat_ws(' - ', m.cutting, m.fabric, m.color),
        'price', m.price
      ) order by m.created_at)
      from order_model_details m where m.order_id = o.id
    ), '[]'::json)
  ) into result
  from invoices i
  join orders o on o.id = i.order_id
  left join profiles p on p.id = o.sales_id
  where i.slug = p_slug;

  return result;  -- null jika slug tidak ada
end;
$$;

-- izinkan anon & authenticated memanggil RPC publik
grant execute on function public_invoice(text) to anon, authenticated;
grant execute on function next_invoice_number(int) to authenticated;
