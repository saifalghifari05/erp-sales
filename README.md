# ERP Sales & Fitter Tarda

Aplikasi internal Tarda Tailor untuk mengelola alur order custom gamis dari input sales sampai invoice terkirim. Dibangun dengan Next.js (App Router) + TypeScript + Tailwind + Supabase (Auth, Database, Storage, RLS), siap di-deploy ke Vercel.

---

## 1. Arsitektur

```
Browser (Next.js App Router, RSC + Client Components)
        │
        ├── Supabase Auth (email/password, session via cookie)
        │
        ├── Supabase Postgres (RLS enforced di level database)
        │       profiles, orders, order_fitters, master_options,
        │       order_model_details, invoices, invoice_revisions,
        │       catalog_files, activity_logs
        │
        └── Supabase Storage (bucket: catalog → PDF katalog)

Public Invoice Page (/inv/[slug]) → akses tanpa login via RPC SECURITY DEFINER
```

Prinsip:

- **RLS sungguhan.** Visibilitas data ditegakkan di database, bukan hanya di frontend. Sales hanya melihat order miliknya, fitter hanya order yang di-assign, owner melihat semua. Frontend hanya menampilkan apa yang dikembalikan database.
- **ID bisnis = ID Scalev.** Tabel tetap memakai UUID internal untuk relasi, tapi yang tampil ke user adalah `id_scalev` (unik).
- **Tidak ada hard delete.** Pembatalan = status `cancelled` (soft delete). Data tetap tersimpan dan bisa di-restore owner.
- **Invoice publik** dibuka lewat slug acak via fungsi `SECURITY DEFINER` yang hanya mengembalikan data invoice (tanpa membuka akses tabel ke anon).
- **Server Actions** dipakai untuk mutasi (buat order, proses, input model, invoice, dll) agar logika status & activity log konsisten di server.

### Status order (final)

`draft_sales → fitter_work | sales_model_input → invoice_draft → invoice_sent → done`
plus `cancelled` (soft delete). Tidak ada `sales_verification` (digabung ke `invoice_draft`).

### Alur

| Tag | Alur |
|---|---|
| Order | Draft Sales → Pekerjaan Fitter → Invoice Draft → Invoice Terkirim → Selesai |
| Repeat Order (tanpa fitter ulang) | Draft Sales → Input Model Sales → Invoice Draft → Invoice Terkirim → Selesai |
| Repeat Order (dengan fitter ulang) | Draft Sales → Pekerjaan Fitter → Invoice Draft → Invoice Terkirim → Selesai |

Semua order baru **wajib** mendarat di `draft_sales` dulu, lalu di-"Proses" manual oleh sales.

---

## 2. Struktur folder

```
erp-tarda/
├── README.md
├── package.json
├── next.config.mjs
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── .env.example
├── .gitignore
├── middleware.ts                      # refresh session + guard rute
├── supabase/
│   ├── migrations/
│   │   ├── 0001_init.sql               # tabel, enum, index, constraint
│   │   ├── 0002_rls.sql                # semua RLS policy + helper + RPC publik
│   │   └── 0003_storage.sql            # bucket katalog + policy storage
│   └── seed.sql                        # master data dummy + catatan seed user
├── src/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── page.tsx                    # redirect ke /login atau /board
│   │   ├── login/page.tsx
│   │   ├── (app)/
│   │   │   ├── layout.tsx              # shell: navbar + guard role
│   │   │   ├── board/page.tsx          # kanban
│   │   │   ├── order/[id]/page.tsx     # detail order / input model
│   │   │   ├── invoice/[id]/page.tsx   # invoice draft + invoice terkirim
│   │   │   ├── dashboard/page.tsx      # owner
│   │   │   ├── activity/page.tsx       # owner
│   │   │   ├── manage/page.tsx         # owner: cancel/restore/ubah tahap
│   │   │   └── master/page.tsx         # owner: master data + user mgmt
│   │   └── inv/[slug]/page.tsx         # invoice publik tanpa login
│   ├── components/
│   │   ├── ui/                         # Button, Modal, Confirm, Field, Toast, dll
│   │   ├── board/                      # Kanban, Column, OrderCard, NewOrderForm
│   │   ├── order/                      # ModelPanel, PackageCard, DraftActions
│   │   └── invoice/                    # InvoicePaper, InvoiceActions, ReviseModal
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts               # browser client
│   │   │   ├── server.ts               # server client (RSC/Action)
│   │   │   └── middleware.ts           # helper refresh session
│   │   ├── constants.ts                # warna, status, master keys
│   │   ├── format.ts                   # rupiah, tanggal, nama paket
│   │   └── types.ts                    # tipe domain
│   └── server/
│       ├── auth.ts                     # getSessionProfile()
│       └── actions/                    # Server Actions per domain
│           ├── orders.ts
│           ├── model.ts
│           ├── invoice.ts
│           └── master.ts
```

---

## 3. Setup Supabase

1. Buat project di [supabase.com](https://supabase.com).
2. Di **SQL Editor**, jalankan berurutan:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_rls.sql`
   - `supabase/migrations/0003_storage.sql`
   - `supabase/seed.sql`
3. Buat user auth (Authentication → Users → Add user, atau lewat dashboard). Untuk tiap user, **catat UUID-nya**, lalu sambungkan ke tabel `profiles` (lihat `seed.sql` bagian bawah — ada query untuk menautkan email → profile + role). Karena `profiles.id` harus = `auth.users.id`, cara termudah:
   - Buat user di Authentication dengan email & password.
   - Salin UUID user.
   - Jalankan `insert into profiles (id, name, role) values ('<uuid>', 'Ican', 'sales');` dst.
4. Ambil dari **Project Settings → API**:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role key` → `SUPABASE_SERVICE_ROLE_KEY` (server-only)

User awal yang disarankan (atur password di dashboard):

Login UI memakai **username** (tanpa label email). Sistem memetakan `username` → `username@tarda.local` di belakang layar. Buat user auth dengan email pola tersebut.

| Username | Email internal | Role | Nama |
|---|---|---|---|
| alghi | alghi@tarda.local | super_admin | Alghi |
| ican@tarda.local | sales | Ican |
| faqih@tarda.local | sales | Faqih |
| syamil@tarda.local | fitter | Syamil |
| ical@tarda.local | fitter | Ical |
| rizky@tarda.local | fitter | Rizky |
| nisa@tarda.local | fitter | Nisa |

---

## 4. Environment variables

Salin `.env.example` ke `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
NEXT_PUBLIC_APP_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...    # SERVER-ONLY
```

`NEXT_PUBLIC_APP_URL` dipakai untuk membentuk link invoice publik (set ke domain Vercel di produksi).

`SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API → service_role) **hanya dipakai di server** untuk fitur reset password user oleh Super Admin. **Jangan** beri prefix `NEXT_PUBLIC_` dan jangan pernah diimpor dari komponen client. Di Vercel, tambahkan sebagai Environment Variable biasa (bukan public).

---

## 5. Jalankan lokal

```bash
npm install
npm run dev
```

Buka http://localhost:3000.

---

## 6. Deploy Vercel

1. Push repo ke GitHub.
2. Di Vercel: **New Project → Import** repo.
3. Framework otomatis terdeteksi Next.js.
4. Tambahkan environment variables (sama dengan `.env.local`, set `NEXT_PUBLIC_APP_URL` ke domain Vercel).
5. Deploy.
6. Di Supabase → Authentication → URL Configuration, tambahkan domain Vercel ke **Site URL** dan **Redirect URLs**.

---

## 7. Checklist testing role access

Login bergantian dan verifikasi:

**Sales (Ican)**
- [ ] Navbar hanya: Kanban + nama/role + Keluar (tidak ada "Input Order")
- [ ] Tombol "+ Order" muncul di dasar kolom Draft Sales
- [ ] Bisa buat order (single & bulk), semua masuk Draft Sales
- [ ] Hanya melihat order miliknya (cek: order Faqih tidak muncul) — diuji juga via query langsung untuk pastikan RLS, bukan filter UI
- [ ] Bisa Edit / Batalkan Draft / Proses di card Draft Sales
- [ ] Repeat tanpa fitter → tombol "Input Model"; lainnya → "Kirim ke Fitter"
- [ ] Bisa input harga, buat invoice, copy link, kirim WhatsApp, tandai selesai
- [ ] Tidak bisa ubah tahap / kelola master data

**Fitter (Syamil)**
- [ ] Kanban hanya 4 kolom: Pekerjaan Fitter, Invoice Draft, Invoice Terkirim, Selesai
- [ ] Tidak ada Draft Sales / Input Model Sales / Cancelled / tombol +Order
- [ ] Hanya melihat order yang di-assign ke dirinya
- [ ] Bisa input/edit model HANYA saat status Pekerjaan Fitter
- [ ] Di tahap lain hanya bisa lihat progress + Copy Link

**Owner**
- [ ] Navbar: Dashboard, Kanban, Activity, Kelola Order, Master Data
- [ ] Melihat semua order
- [ ] Bisa cancel/restore (dengan konfirmasi) & ubah tahap (alasan wajib)
- [ ] Bisa kelola master data & user
- [ ] Bisa revisi invoice

**Public invoice**
- [ ] `/inv/<slug>` terbuka tanpa login
- [ ] Tidak bisa mengakses halaman sistem lain tanpa login
- [ ] Slug acak tidak mudah ditebak

**RLS langsung (penting)**
- [ ] Sebagai Ican, query `select * from orders` via Supabase client hanya mengembalikan order Ican (bukan hanya tersembunyi di UI)
- [ ] Sebagai fitter, hanya order assigned yang kembali
- [ ] Anon tidak bisa `select` tabel orders/invoices secara langsung
