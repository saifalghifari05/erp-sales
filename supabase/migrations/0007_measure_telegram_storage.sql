-- =====================================================================
-- 0007_measure_telegram_storage.sql
-- - Field ukuran baru (hand_circumference, arm_circumference)
-- - Kolom guard laporan Telegram di orders
-- - Kolom metadata storage external di customer_measurement_photos
-- Jalankan SETELAH 0001–0006b. Aman & idempoten. Tidak drop column.
-- =====================================================================

-- ---- Ukuran badan: tambah field baru (lama 'bottom_width' dibiarkan, tidak dipakai UI) ----
alter table customer_measurements add column if not exists hand_circumference numeric;
alter table customer_measurements add column if not exists arm_circumference  numeric;

-- ---- Guard laporan Telegram (1x kirim) ----
alter table orders add column if not exists telegram_report_sent_at  timestamptz;
alter table orders add column if not exists telegram_report_sent_by  uuid references profiles(id);
alter table orders add column if not exists telegram_report_status   text;  -- 'sent' | 'failed' | null

-- ---- Metadata storage external pada foto customer ----
alter table customer_measurement_photos add column if not exists storage_provider text default 'r2';
alter table customer_measurement_photos add column if not exists file_name text;
alter table customer_measurement_photos add column if not exists mime_type text;
alter table customer_measurement_photos add column if not exists file_size bigint;
alter table customer_measurement_photos add column if not exists measurement_id uuid references customer_measurements(id) on delete set null;

-- ---------------------------------------------------------------------
-- Notifikasi: Super Admin TIDAK lagi menerima semua notifikasi.
-- Hanya notif personal miliknya atau role-based 'super_admin'.
-- (Activity log tetap mencatat semua proses; ini hanya soal notifikasi.)
-- ---------------------------------------------------------------------
drop policy if exists notif_select on notifications;
create policy notif_select on notifications
  for select to authenticated using (
    recipient_user_id = auth.uid()
    or (recipient_role is not null and recipient_role = auth_role())
  );
