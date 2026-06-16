-- =====================================================================
-- 0008_fix_model_write_invoice_draft.sql
-- Fix: harga paket tersimpan 0 padahal total benar.
-- Sebabnya policy USING model_write hanya mengizinkan sales menulis saat
-- status 'sales_model_input', padahal input harga terjadi di 'invoice_draft'.
-- Akibatnya UPDATE price oleh sales di invoice_draft match 0 baris (diam-diam
-- gagal), price tetap 0, sementara total invoice tetap terhitung.
-- Jalankan SETELAH migration sebelumnya.
-- =====================================================================

drop policy if exists model_write on order_model_details;
create policy model_write on order_model_details
  for all to authenticated using (
    exists (select 1 from orders o where o.id = order_id and (
      is_admin()
      or (o.sales_id = auth.uid() and o.status in ('sales_model_input','invoice_draft'))
      or (is_assigned_fitter(o.id) and o.status = 'fitter_work')
    ))
  ) with check (
    exists (select 1 from orders o where o.id = order_id and (
      is_admin()
      or (o.sales_id = auth.uid() and o.status in ('sales_model_input','invoice_draft'))
      or (is_assigned_fitter(o.id) and o.status = 'fitter_work')
    ))
  );
