-- =====================================================================
-- 0009_order_people.sql
-- 1 order = banyak pemakai (order_people). Tiap pemakai punya:
--   ukuran (customer_measurements), model (order_model_details), foto, harga.
-- Jalankan SETELAH migration sebelumnya. Aman & idempoten. Tidak drop column data.
-- =====================================================================

-- ---------------------------------------------------------------------
-- order_people (pemakai/paket dalam satu order)
-- ---------------------------------------------------------------------
create table if not exists order_people (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id) on delete cascade,
  wearer_name text not null,
  sort_order  int not null default 0,
  created_by  uuid references profiles(id),
  updated_by  uuid references profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_people_order on order_people(order_id);

drop trigger if exists trg_people_touch on order_people;
create trigger trg_people_touch before update on order_people
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------
-- Relasi person ke measurement / model / photo / harga
-- ---------------------------------------------------------------------
alter table customer_measurements add column if not exists person_id uuid references order_people(id) on delete cascade;
alter table customer_measurements add column if not exists has_watch_note boolean not null default false;
alter table customer_measurements add column if not exists has_ankle_note boolean not null default false;
alter table customer_measurements add column if not exists sleeve_opening_circumference numeric;

-- buang constraint unique(order_id) lama: sekarang 1 ukuran per pemakai, bukan per order
alter table customer_measurements drop constraint if exists customer_measurements_order_id_key;
create index if not exists idx_meas_person on customer_measurements(person_id);

alter table order_model_details add column if not exists person_id uuid references order_people(id) on delete cascade;
alter table order_model_details add column if not exists wearer_name text;
create index if not exists idx_model_person on order_model_details(person_id);

alter table customer_measurement_photos add column if not exists person_id uuid references order_people(id) on delete cascade;
create index if not exists idx_photo_person on customer_measurement_photos(person_id);

-- ---------------------------------------------------------------------
-- RLS order_people: ikut aturan order induk
-- ---------------------------------------------------------------------
alter table order_people enable row level security;

drop policy if exists people_select on order_people;
create policy people_select on order_people
  for select to authenticated using (
    is_admin() or is_manager()
    or exists (select 1 from orders o where o.id = order_id and (
      o.sales_id = auth.uid() or is_assigned_fitter(o.id) or is_head_fitter()
    ))
  );

drop policy if exists people_write on order_people;
create policy people_write on order_people
  for all to authenticated using (
    is_admin()
    or exists (select 1 from orders o where o.id = order_id and is_assigned_fitter(o.id) and o.status = 'fitter_work')
  ) with check (
    is_admin()
    or exists (select 1 from orders o where o.id = order_id and is_assigned_fitter(o.id) and o.status = 'fitter_work')
  );

-- ---------------------------------------------------------------------
-- public_invoice: nama paket sertakan nama pemakai
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
        'name', case when m.wearer_name is not null and m.wearer_name <> ''
                     then m.wearer_name || ' — ' || concat_ws(' ', m.cutting, m.fabric, m.color)
                     else concat_ws(' - ', m.cutting, m.fabric, m.color) end,
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
