-- =====================================================================
-- 0001_init.sql — Schema ERP Sales & Fitter Tarda
-- Jalankan di Supabase SQL Editor (urutan: 0001, 0002, 0003, lalu seed.sql)
-- =====================================================================

-- Extensions
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('super_admin', 'sales', 'fitter');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum (
    'draft_sales', 'fitter_work', 'sales_model_input',
    'invoice_draft', 'invoice_sent', 'done', 'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_tag as enum ('order', 'repeat');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- profiles  (1:1 dengan auth.users)
-- ---------------------------------------------------------------------
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique,
  name        text not null,
  role        user_role not null default 'sales',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- master_options  (master data dinamis: cutting, fabric, color, collar, dst)
-- category = kunci kategori (lihat lib/constants.ts MASTER_KEYS)
-- ---------------------------------------------------------------------
create table if not exists master_options (
  id          uuid primary key default gen_random_uuid(),
  category    text not null,
  label       text not null,
  active      boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists idx_master_category on master_options(category) where active;

-- ---------------------------------------------------------------------
-- orders
-- id_scalev = ID bisnis unik yang tampil ke user
-- next_stage = tahap tujuan saat "Proses" dari draft (fitter_work | sales_model_input)
-- ---------------------------------------------------------------------
create table if not exists orders (
  id              uuid primary key default gen_random_uuid(),
  id_scalev       text not null unique,
  customer        text not null,
  tag             order_tag not null default 'order',
  need_fitter     boolean not null default false,
  status          order_status not null default 'draft_sales',
  next_stage      order_status not null default 'fitter_work',
  prev_status     order_status,                       -- untuk restore
  sales_id        uuid not null references profiles(id),
  wa_number       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_orders_sales  on orders(sales_id);
create index if not exists idx_orders_status on orders(status);

-- ---------------------------------------------------------------------
-- order_fitters  (assignment many-to-many order <-> fitter)
-- ---------------------------------------------------------------------
create table if not exists order_fitters (
  order_id   uuid not null references orders(id) on delete cascade,
  fitter_id  uuid not null references profiles(id) on delete cascade,
  primary key (order_id, fitter_id)
);
create index if not exists idx_order_fitters_fitter on order_fitters(fitter_id);

-- ---------------------------------------------------------------------
-- order_model_details  (paket model; harga per paket disimpan di sini)
-- ---------------------------------------------------------------------
create table if not exists order_model_details (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete cascade,
  cutting         text,
  fabric          text,
  color           text,
  collar          text,
  bottom_placket  text,
  front_placket   text,
  pocket          text,
  sleeve_cuff     text,
  accessories     text,
  add_on          text,
  cufflink        text,
  note            text,
  price           bigint not null default 0,
  input_by        uuid references profiles(id),
  input_role      user_role,
  created_at      timestamptz not null default now()
);
create index if not exists idx_model_order on order_model_details(order_id);

-- ---------------------------------------------------------------------
-- invoices  (1:1 dengan order; total = jumlah harga paket saat dibuat)
-- slug = token publik acak
-- ---------------------------------------------------------------------
create table if not exists invoices (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete cascade unique,
  number          text not null,                 -- INV-TRD-2026-0001
  number_active   text not null,                 -- number atau number-R{n}
  slug            text not null unique,
  total           bigint not null default 0,
  sent            boolean not null default false,
  sent_to         text,
  sent_by         uuid references profiles(id),
  sent_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists idx_invoice_order on invoices(order_id);

-- sequence nomor invoice per tahun (dipakai RPC next_invoice_number)
create table if not exists invoice_counters (
  year  int primary key,
  last  int not null default 0
);

-- ---------------------------------------------------------------------
-- invoice_revisions
-- ---------------------------------------------------------------------
create table if not exists invoice_revisions (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid not null references invoices(id) on delete cascade,
  rev          int not null,
  old_total    bigint not null,
  new_total    bigint not null,
  reason       text not null,
  revised_by   uuid references profiles(id),
  created_at   timestamptz not null default now()
);
create index if not exists idx_rev_invoice on invoice_revisions(invoice_id);

-- ---------------------------------------------------------------------
-- catalog_files  (metadata PDF katalog; file fisik di Storage bucket 'catalog')
-- ---------------------------------------------------------------------
create table if not exists catalog_files (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  storage_path text not null,
  active       boolean not null default true,
  uploaded_by  uuid references profiles(id),
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- activity_logs
-- action = key teknis; text = kalimat siap tampil ke user
-- ---------------------------------------------------------------------
create table if not exists activity_logs (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references profiles(id),
  actor_name   text,
  actor_role   user_role,
  order_id     uuid references orders(id) on delete set null,
  action       text not null,
  text         text not null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_logs_created on activity_logs(created_at desc);

-- ---------------------------------------------------------------------
-- trigger updated_at pada orders
-- ---------------------------------------------------------------------
create or replace function touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_orders_touch on orders;
create trigger trg_orders_touch before update on orders
  for each row execute function touch_updated_at();
