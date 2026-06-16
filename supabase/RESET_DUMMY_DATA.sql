-- =====================================================================
-- RESET DATA DUMMY — ERP Tarda
-- Jalankan MANUAL di Supabase SQL Editor saat ingin mulai dari bersih
-- (misalnya sebelum produksi). BUKAN bagian dari migration.
--
-- PENTING:
-- - Ini menghapus SEMUA order beserta turunannya (pemakai, ukuran, model,
--   foto-metadata, invoice, log, notifikasi).
-- - User (profiles/auth) dan Master Data TIDAK dihapus.
-- - File foto fisik di R2/Supabase Storage TIDAK ikut terhapus oleh skrip ini
--   (hapus manual di dashboard R2/Storage bila perlu benar-benar bersih).
-- - Tidak bisa di-undo. Pastikan memang ingin mereset.
-- =====================================================================

begin;

-- urutan aman (anak dulu walau ada cascade, biar eksplisit)
delete from customer_measurement_photos;
delete from customer_measurements;
delete from order_model_details;
delete from order_people;
delete from order_fitters;
delete from invoice_revisions;
delete from invoices;
delete from notifications;
delete from activity_logs;
delete from orders;

-- reset penomoran invoice agar mulai dari 0001 lagi
delete from invoice_counters;

commit;

-- =====================================================================
-- OPSIONAL: kalau mau SEKALIAN hapus user (selain Super Admin) & master data,
-- hapus tanda komentar di bawah. Hati-hati.
-- =====================================================================
-- delete from profiles where role <> 'super_admin';
-- delete from master_options;
