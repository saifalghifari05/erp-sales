-- =====================================================================
-- 0005_fitting_notifications.sql
-- Jadwal fitting (kolom di orders) + tabel notifications + RLS + realtime.
-- Jalankan SETELAH 0001–0004 di Supabase SQL Editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Kolom jadwal fitting pada orders
-- ---------------------------------------------------------------------
alter table orders add column if not exists fitting_start_at        timestamptz;
alter table orders add column if not exists fitting_end_at          timestamptz;
alter table orders add column if not exists fitting_duration_minutes integer not null default 60;
alter table orders add column if not exists fitting_started_at      timestamptz;
alter table orders add column if not exists fitting_started_by      uuid references profiles(id);
alter table orders add column if not exists fitting_override_reason text;
alter table orders add column if not exists fitting_override_by     uuid references profiles(id);
alter table orders add column if not exists fitting_override_at     timestamptz;

create index if not exists idx_orders_fitting_start on orders(fitting_start_at);

-- ---------------------------------------------------------------------
-- notifications
-- recipient_user_id : notifikasi personal (sales pemilik order)
-- recipient_role    : notifikasi role-based (mis. semua 'fitter')
-- ---------------------------------------------------------------------
create table if not exists notifications (
  id                uuid primary key default gen_random_uuid(),
  recipient_user_id uuid references profiles(id) on delete cascade,
  recipient_role    user_role,
  type              text not null default 'fitting_schedule',
  title             text not null,
  message           text not null,
  order_id          uuid references orders(id) on delete set null,
  is_read           boolean not null default false,
  read_at           timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists idx_notif_user on notifications(recipient_user_id, is_read);
create index if not exists idx_notif_role on notifications(recipient_role, is_read);
create index if not exists idx_notif_created on notifications(created_at desc);

alter table notifications enable row level security;

-- Baca:
--   super_admin : semua
--   personal    : recipient_user_id = uid
--   role-based  : recipient_role = role user saat ini (mis. fitter melihat notif role 'fitter')
drop policy if exists notif_select on notifications;
create policy notif_select on notifications
  for select to authenticated using (
    is_admin()
    or recipient_user_id = auth.uid()
    or (recipient_role is not null and recipient_role = auth_role())
  );

-- Update (tandai sudah dibaca):
--   user boleh menandai notif personal miliknya; admin boleh semua.
--   Notif role-based dibaca bersama → hanya admin yang boleh meng-update flag-nya
--   (agar tidak saling menimpa is_read antar fitter).
drop policy if exists notif_update on notifications;
create policy notif_update on notifications
  for update to authenticated using (
    is_admin() or recipient_user_id = auth.uid()
  ) with check (
    is_admin() or recipient_user_id = auth.uid()
  );

-- Insert: dibuat dari server action (authenticated). Batasi ke admin/sales/fitter.
drop policy if exists notif_insert on notifications;
create policy notif_insert on notifications
  for insert to authenticated with check (true);

-- ---------------------------------------------------------------------
-- Realtime: tambahkan tabel ke publication supabase_realtime
-- ---------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table notifications;
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Perbarui RPC public_invoice: sertakan detail model lengkap per paket
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
        'price', m.price,
        'cutting', m.cutting, 'fabric', m.fabric, 'color', m.color,
        'collar', m.collar, 'bottom_placket', m.bottom_placket, 'front_placket', m.front_placket,
        'pocket', m.pocket, 'sleeve_cuff', m.sleeve_cuff, 'accessories', m.accessories,
        'add_on', m.add_on, 'cufflink', m.cufflink, 'note', m.note
      ) order by m.created_at)
      from order_model_details m where m.order_id = o.id
    ), '[]'::json)
  ) into result
  from invoices i
  join orders o on o.id = i.order_id
  left join profiles p on p.id = o.sales_id
  where i.slug = p_slug;

  return result;
end;
$$;

grant execute on function public_invoice(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- RPC daftar jadwal fitting sesuai role (tanpa membuka detail order):
--   super_admin : semua, lengkap (customer, id_scalev, sales)
--   sales       : hanya order miliknya
--   fitter      : semua jadwal, minimal (fitter + waktu), tanpa customer
-- ---------------------------------------------------------------------
create or replace function fitting_schedules()
returns json language plpgsql security definer set search_path = public as $$
declare r user_role; uid uuid; result json;
begin
  uid := auth.uid();
  select role into r from profiles where id = uid;

  if r = 'super_admin' then
    select coalesce(json_agg(row), '[]'::json) into result from (
      select o.id_scalev, o.customer, o.fitting_start_at, o.fitting_end_at,
             sp.name as sales_name,
             coalesce(string_agg(fp.name, ', '), '') as fitters
      from orders o
      left join profiles sp on sp.id = o.sales_id
      left join order_fitters ofs on ofs.order_id = o.id
      left join profiles fp on fp.id = ofs.fitter_id
      where o.fitting_start_at is not null and o.status not in ('cancelled','done')
      group by o.id, sp.name
      order by o.fitting_start_at
    ) row;
  elsif r = 'sales' then
    select coalesce(json_agg(row), '[]'::json) into result from (
      select o.fitting_start_at, o.fitting_end_at,
             coalesce(string_agg(fp.name, ', '), '') as fitters
      from orders o
      left join order_fitters ofs on ofs.order_id = o.id
      left join profiles fp on fp.id = ofs.fitter_id
      where o.sales_id = uid and o.fitting_start_at is not null and o.status not in ('cancelled','done')
      group by o.id
      order by o.fitting_start_at
    ) row;
  elsif r = 'fitter' then
    -- semua jadwal, minimal: per fitter + waktu, tanpa customer/sales
    select coalesce(json_agg(row), '[]'::json) into result from (
      select fp.name as fitter_name, o.fitting_start_at, o.fitting_end_at
      from orders o
      join order_fitters ofs on ofs.order_id = o.id
      join profiles fp on fp.id = ofs.fitter_id
      where o.fitting_start_at is not null and o.status not in ('cancelled','done')
      order by o.fitting_start_at
    ) row;
  else
    result := '[]'::json;
  end if;

  return result;
end;
$$;

grant execute on function fitting_schedules() to authenticated;
