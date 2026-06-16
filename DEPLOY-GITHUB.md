# DEPLOY VIA GITHUB + VERCEL — ERP Tarda

Alurnya sama seperti waktu kamu deploy Alter Tracker. Ringkasnya:
push kode ke GitHub → Vercel baca repo → isi env → deploy. Update berikutnya
cukup `git push`, Vercel auto-deploy.

================================================================
LANGKAH 0 — PASTIKAN DULU (sebelum push)
================================================================
- npm run build di lokal harus sukses (sudah terverifikasi).
- File .env.local JANGAN ikut (sudah otomatis di-ignore oleh .gitignore). Aman.
- Migration di Supabase production sudah lengkap 0001–0009 (cek enum role = 5).

================================================================
LANGKAH 1 — PUSH KE GITHUB
================================================================
Buka terminal di folder project (erp-tarda), lalu:

  git init
  git add .
  git commit -m "ERP Sales & Fitter Tarda - siap deploy"

Buat repo baru di github.com (kosong, tanpa README). Lalu hubungkan & push:

  git remote add origin https://github.com/<username-kamu>/erp-tarda.git
  git branch -M main
  git push -u origin main

Catatan: kalau diminta login, pakai akun GitHub-mu. Kalau folder ini PERNAH
di-git init sebelumnya dan error "remote already exists", jalankan:
  git remote set-url origin https://github.com/<username-kamu>/erp-tarda.git

================================================================
LANGKAH 2 — IMPORT DI VERCEL
================================================================
1. Buka vercel.com → New Project → Import Git Repository.
2. Pilih repo erp-tarda yang barusan kamu push.
3. Framework Preset: Next.js (terdeteksi otomatis). Biarkan Build & Output default.
4. JANGAN klik Deploy dulu — buka dulu bagian "Environment Variables" (langkah 3).

================================================================
LANGKAH 3 — ISI ENVIRONMENT VARIABLES DI VERCEL
================================================================
Tambahkan SEMUA ini (Settings → Environment Variables, target: Production).
Salin nilainya dari .env.local lokalmu.

  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  NEXT_PUBLIC_APP_URL          <- ISI SETELAH dapat domain Vercel (lihat langkah 5)
  TELEGRAM_BOT_TOKEN
  TELEGRAM_CHAT_ID
  R2_ACCOUNT_ID
  R2_ACCESS_KEY_ID
  R2_SECRET_ACCESS_KEY
  R2_BUCKET_NAME
  R2_PUBLIC_BASE_URL
  R2_ENDPOINT

Untuk deploy pertama, NEXT_PUBLIC_APP_URL boleh diisi sementara (mis. https://erp-tarda.vercel.app);
nanti dibetulkan setelah tahu domain final.

================================================================
LANGKAH 4 — DEPLOY
================================================================
Klik Deploy. Tunggu build selesai (~1–3 menit). Kalau sukses, dapat domain
seperti https://erp-tarda-xxxx.vercel.app.

Kalau build GAGAL: baca log error di Vercel. Penyebab tersering = ada env yang
belum diisi, atau typo nama env. Perbaiki di Settings → Environment Variables → Redeploy.

================================================================
LANGKAH 5 — SETELAH DAPAT DOMAIN
================================================================
1. Set NEXT_PUBLIC_APP_URL ke domain final (Settings → Env → edit) → Redeploy.
   (Ini penting agar link invoice publik memakai domain production, bukan localhost.)
2. Supabase → Authentication → URL Configuration:
   - Site URL: https://<domain-vercel-kamu>
   - Redirect URLs: tambahkan domain itu.
3. (Opsional) R2: kalau preview foto bermasalah karena r2.dev, pasang custom domain.

================================================================
UPDATE BERIKUTNYA (tiap ada revisi)
================================================================
Cukup di terminal:
  git add .
  git commit -m "deskripsi perubahan"
  git push

Vercel otomatis build & deploy versi baru. Tidak perlu setting ulang.

================================================================
CATATAN
================================================================
- Logo: pastikan public/logo-tarda.png (ikon) sudah ada sebelum push.
  favicon.ico + icon.png + apple-icon.png di src/app/.
- Migration & env adalah hal di LUAR kode — Vercel tidak mengurusnya.
  Database tetap di Supabase, foto di R2, sesuai env yang kamu isi.
