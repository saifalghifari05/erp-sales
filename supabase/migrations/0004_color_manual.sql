-- =====================================================================
-- 0004_color_manual.sql — Warna Kain jadi input manual (bukan master)
-- Jalankan SETELAH 0001–0003 (dan kapan saja setelah seed).
--
-- Catatan: kolom order_model_details.color SUDAH bertipe text dan menyimpan
-- label warna apa adanya, jadi tidak ada perubahan tipe kolom yang diperlukan.
-- Data paket lama tetap aman — nilai color yang sudah tersimpan tidak berubah.
-- Migration ini hanya membersihkan opsi master kategori 'color' agar tidak
-- muncul lagi di UI Master Data.
-- =====================================================================

delete from master_options where category = 'color';
