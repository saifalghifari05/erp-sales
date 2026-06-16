-- =====================================================================
-- seed.sql — Master data dummy + panduan menautkan user auth ke profiles
-- Jalankan SETELAH 0001–0003.
-- =====================================================================

-- ---- Master data dummy (idempoten: hapus dulu kategori yang sama) ----
delete from master_options where category in (
  'cutting','fabric','collar','bottom_placket','front_placket',
  'pocket','sleeve_cuff','accessories','add_on','cufflink'
);

insert into master_options (category, label, sort_order) values
  ('cutting','Qatary',1),('cutting','Saudi',2),('cutting','Dubai',3),
  ('fabric','Twill',1),('fabric','Toyobo',2),('fabric','Woolpeach',3),
  ('collar','Collar A',1),('collar','Collar B',2),
  ('bottom_placket','Bottom Placket A',1),('bottom_placket','Bottom Placket B',2),
  ('front_placket','Front Placket A',1),('front_placket','Front Placket B',2),
  ('pocket','Pocket A',1),('pocket','Pocket B',2),
  ('sleeve_cuff','Sleeve With Cuff A',1),('sleeve_cuff','Sleeve Without Cuff A',2),
  ('accessories','Pin A',1),('accessories','Button A',2),
  ('add_on','Add On A',1),
  ('cufflink','Cufflink A',1);

-- ---------------------------------------------------------------------
-- MENAUTKAN USER AUTH → PROFILES
-- ---------------------------------------------------------------------
-- profiles.id WAJIB sama dengan auth.users.id. Langkah:
-- 1) Authentication → Users → Add user (email + password) untuk tiap akun.
-- 2) Salin UUID tiap user, lalu jalankan insert berikut (ganti <uuid>).
--
-- insert into profiles (id, username, name, role) values
--   ('<uuid-alghi>',  'alghi',  'Alghi',  'super_admin'),
--   ('<uuid-ican>',   'ican',   'Ican',   'sales'),
--   ('<uuid-faqih>',  'faqih',  'Faqih',  'sales'),
--   ('<uuid-syamil>', 'syamil', 'Syamil', 'fitter'),
--   ('<uuid-ical>',   'ical',   'Ical',   'fitter'),
--   ('<uuid-rizky>',  'rizky',  'Rizky',  'fitter'),
--   ('<uuid-nisa>',   'nisa',   'Nisa',   'fitter');
--
-- Alternatif otomatis (email pola <username>@tarda.local → username = bagian sebelum @):
-- insert into profiles (id, username, name, role)
-- select u.id,
--   split_part(u.email,'@',1),
--   initcap(split_part(u.email,'@',1)),
--   case split_part(u.email,'@',1)
--     when 'alghi' then 'super_admin'::user_role
--     when 'ican' then 'sales'::user_role
--     when 'faqih' then 'sales'::user_role
--     else 'fitter'::user_role
--   end
-- from auth.users u
-- where u.email like '%@tarda.local'
-- on conflict (id) do nothing;
