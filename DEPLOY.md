# PANDUAN DEPLOY PRODUCTION — ERP Sales & Fitter Tarda

Dokumen ini berisi langkah deploy ke Vercel + Supabase + Cloudflare R2 + Telegram.
Ikuti berurutan. Jangan lewati bagian migration & env.

---

## 0. RINGKAS: APAKAH SUDAH SIAP DEPLOY?

Kode sudah lolos `npm run build` (tanpa error). Yang perlu kamu lakukan sebelum
produksi benar-benar jalan:
1. Jalankan semua migration SQL di Supabase (lihat bagian 1).
2. Isi semua env di Vercel (bagian 2).
3. Sesuaikan setting Supabase Auth (bagian 3) & Realtime (bagian 4).
4. Pastikan R2 (bagian 5).
5. (Opsional tapi disarankan) upload logo asli — lihat bagian 7.
6. Push ke GitHub & deploy (bagian 6).

---

## 1. MIGRATION SQL (Supabase → SQL Editor)

Jalankan file di folder `supabase/migrations/` SECARA BERURUTAN, satu per satu:

1. `0001_init.sql`
2. `0002_rls.sql`
3. `0003_storage.sql`
4. `0004_color_manual.sql`
5. `0005_fitting_notifications.sql`
6. `0006a_roles_enum.sql`   ← JALANKAN SENDIRI DULU (commit), baru lanjut
7. `0006b_assign_measurements.sql`
8. `0007_measure_telegram_storage.sql`
9. `0008_fix_model_write_invoice_draft.sql`
10. `0009_order_people.sql`

Catatan penting:
- `0006a` HARUS dijalankan terpisah sebelum `0006b` (Postgres tidak izinkan pakai
  nilai enum baru di transaksi yang sama saat ditambahkan).
- Semua migration aman & idempoten — tidak menghapus data lama.
- Kalau project Supabase-mu sudah pernah menjalankan sebagian, jalankan saja yang
  belum. `if not exists` / `drop policy if exists` membuatnya aman diulang.

Jika ingin RESET data dummy sebelum produksi: jalankan `supabase/RESET_DUMMY_DATA.sql`
(manual, hati-hati — menghapus semua order & turunannya, menyisakan user & master).

---

## 2. ENV VARIABLE (Vercel → Project Settings → Environment Variables)

Isi SEMUA berikut (nilai dari masing-masing layanan). Yang diawali NEXT_PUBLIC_
boleh terekspos ke browser; sisanya server-only — JANGAN beri prefix NEXT_PUBLIC_.

Supabase:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY        (server-only)

App URL (WAJIB domain production, BUKAN localhost):
- NEXT_PUBLIC_APP_URL=https://<domain-vercel-kamu>.vercel.app

Telegram (server-only):
- TELEGRAM_BOT_TOKEN
- TELEGRAM_CHAT_ID

Cloudflare R2 (server-only):
- R2_ACCOUNT_ID
- R2_ACCESS_KEY_ID
- R2_SECRET_ACCESS_KEY
- R2_BUCKET_NAME
- R2_PUBLIC_BASE_URL               (Public Development URL r2.dev, atau custom domain)
- R2_ENDPOINT                       (opsional; default dihitung dari R2_ACCOUNT_ID)

Set untuk environment "Production" (dan "Preview" bila perlu testing).
Setelah mengubah env, lakukan Redeploy agar terbaca.

---

## 3. SUPABASE AUTH

- Authentication → Providers → Email: MATIKAN "Confirm email".
  (User memakai email internal `username@tarda.local` yang tidak menerima email
  konfirmasi; kalau menyala, login akan gagal.)
- Authentication → URL Configuration:
  - Site URL: isi domain production (https://<domain>.vercel.app)
  - Redirect URLs: tambahkan domain production.
- Membuat user (sampai fitur "tambah user dari aplikasi" dibuat):
  1. Authentication → Users → Add user → email `username@tarda.local` + password.
  2. SQL Editor → insert ke profiles dengan id = UUID user tadi, role yang benar:
     super_admin | manager | sales | head_fitter | fitter
     (ingat: "Kepala Fitter" = role `head_fitter`; "Manager" = `manager`.)

---

## 4. SUPABASE REALTIME

- Tabel `notifications` sudah ditambahkan ke publication realtime sejak migration
  0005. Pastikan Realtime aktif untuk tabel ini:
  Database → Replication / Realtime → pastikan `notifications` ter-include.
- Tidak ada tabel lain yang butuh realtime.

---

## 5. CLOUDFLARE R2 (storage foto customer)

- Buat bucket (mis. `tarda-customer-photos`).
- Buat R2 API Token (Access Key ID + Secret) dengan izin Object Read & Write
  untuk bucket itu. Isikan ke env R2_ACCESS_KEY_ID & R2_SECRET_ACCESS_KEY.
- R2_ACCOUNT_ID = Account ID (terlihat di endpoint S3 API bucket).
- Aktifkan akses publik foto:
  - Untuk produksi DISARANKAN custom domain (R2 → bucket → Settings → Custom Domains).
    Isikan domainnya ke R2_PUBLIC_BASE_URL (mis. https://foto.domainmu.com).
  - Alternatif cepat: Public Development URL (r2.dev). Catatan: r2.dev rate-limited
    & kadang sertifikat SSL-nya lambat valid di browser. Untuk produksi, custom domain
    lebih stabil.
- Jika env R2 tidak lengkap, aplikasi otomatis fallback ke Supabase Storage
  (bucket `customer-photos`). Foto tetap tersimpan, tapi pertimbangkan kuota free tier.

---

## 6. DEPLOY KE VERCEL

1. Push project ke GitHub:
   - `git init` (jika belum), `git add .`, `git commit -m "ERP Tarda"`,
     buat repo di GitHub, `git remote add origin ...`, `git push -u origin main`.
   - Pastikan `.env.local` TIDAK ikut ter-push (sudah di .gitignore).
2. Di Vercel: New Project → Import repo GitHub-nya.
3. Framework: Next.js (terdeteksi otomatis). Build command & output default.
4. Tambahkan semua Environment Variables (bagian 2) SEBELUM deploy pertama.
5. Deploy. Setelah dapat domain, set `NEXT_PUBLIC_APP_URL` ke domain itu, lalu Redeploy.
6. Update Supabase Auth Site URL / Redirect URL ke domain production (bagian 3).

---

## 7. LOGO

- Saat ini memakai komponen `<Logo />` yang mencari file `/public/logo-tarda.png`.
- Jika file belum ada, otomatis tampil monogram "T" (TIDAK rusak/blank).
- Untuk memasang logo asli: taruh file di `public/logo-tarda.png` (PNG transparan,
  rasio ~1:1, min 128x128). Tidak perlu ubah kode. Lihat `public/README-LOGO.txt`.
- Logo dipakai di: login, header/navbar, invoice internal, public invoice.

---

## 8. KATALOG

- Super Admin: menu Master Data → tab "Katalog PDF" → upload PDF + beri nama.
- Katalog aktif otomatis muncul untuk Fitter di halaman input model
  (tombol "📖 nama katalog", dibuka via signed URL).
- Katalog disimpan di Supabase Storage bucket `catalog` (privat, dibuka via signed URL).
- Katalog TIDAK tampil di invoice publik.

---

## 9. CHECKLIST TESTING PRODUCTION

Login: super_admin, manager, sales, head_fitter, fitter — semua bisa masuk.
Sales: input order tanpa pilih fitter → konfirmasi → card centang hijau → hanya lihat order sendiri.
Kepala Fitter: lihat draft confirmed → tak bisa assign sebelum confirmed → assign → masuk Pekerjaan Fitter.
Fitter: terima job → Mulai Fitting → badge muncul → tambah >1 pemakai → ukuran+model+foto per pemakai (auto-save) → Selesai (ditolak bila ada yang belum lengkap).
Invoice: draft per pemakai → harga per paket → public invoice via slug (tanpa ukuran/foto) → status done hanya Copy Link + Cetak PDF.
Telegram: TIDAK terkirim saat fitter selesai; terkirim saat Sales Tandai Selesai; per pemakai, ukuran per baris, foto album + nama; tidak dobel.
UI: tanpa judul "Kanban Board", header 2 layer, menu bar beda warna, kanban full width, panel notifikasi tanpa judul, error R2 rapi.

---

## 10. CATATAN JUJUR (hal yang TIDAK bisa dipastikan dari sisi kode)

- Koneksi nyata R2/Telegram/Supabase hanya terverifikasi saat runtime dengan kredensial
  asli. Build hanya memverifikasi kompilasi.
- Preview foto R2 di browser bisa terkendala sertifikat r2.dev (lihat bagian 5);
  fungsi (simpan + kirim Telegram) tetap jalan. Custom domain menyelesaikan ini.
- Fitur "tambah user dari aplikasi" BELUM ada — user dibuat manual (bagian 3).
- Urutan laporan Telegram bisa selang-seling bila banyak order ditandai-selesai
  nyaris bersamaan (belum ada serialisasi antar-request).
