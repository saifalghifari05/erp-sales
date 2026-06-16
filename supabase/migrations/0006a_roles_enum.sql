-- =====================================================================
-- 0006a_roles_enum.sql — Tambah role manager & head_fitter
-- JALANKAN FILE INI SENDIRI DULU (commit), baru jalankan 0006b.
-- =====================================================================
alter type user_role add value if not exists 'manager';
alter type user_role add value if not exists 'head_fitter';
