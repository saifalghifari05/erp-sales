"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/server/auth";
import { revalidatePath } from "next/cache";
import { rupiah } from "@/lib/format";

export async function setPackagePrice(orderId: string, packageId: string, price: number) {
  const supabase = createClient();
  const me = await getSessionProfile();
  if (!me || (me.role !== "sales" && me.role !== "super_admin")) return { error: "Tidak diizinkan." };
  const { data, error } = await supabase.from("order_model_details")
    .update({ price: Math.max(0, Math.floor(price)) }).eq("id", packageId).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "Harga tidak tersimpan (akses ditolak). Jalankan migration 0008." };
  }
  revalidatePath(`/invoice/${orderId}`);
  return { ok: true };
}

export async function createInvoice(orderId: string, priceMap?: Record<string, number>) {
  const supabase = createClient();
  const me = await getSessionProfile();
  if (!me || (me.role !== "sales" && me.role !== "super_admin")) return { error: "Tidak diizinkan." };

  const { data: pkgs } = await supabase.from("order_model_details")
    .select("id, cutting, fabric, color, price").eq("order_id", orderId);
  if (!pkgs || pkgs.length === 0) return { error: "Belum ada paket." };

  // Jika client mengirim priceMap, persist dulu agar tidak ada race timing.
  if (priceMap) {
    for (const p of pkgs) {
      const v = Math.max(0, Math.floor(priceMap[p.id] ?? p.price ?? 0));
      if (v !== p.price) {
        const { data: updated, error: upErr } = await supabase.from("order_model_details")
          .update({ price: v }).eq("id", p.id).select("id");
        if (upErr) return { error: "Gagal menyimpan harga: " + upErr.message };
        // RLS bisa memblokir tanpa error (0 baris). Pastikan benar-benar tersimpan.
        if (!updated || updated.length === 0) {
          return { error: "Harga tidak tersimpan (akses ditolak). Jalankan migration 0008 lalu coba lagi." };
        }
      }
      p.price = v;
    }
  }

  // Validasi: sebut nama paket yang belum punya harga.
  const empty = pkgs.find((p) => !p.price || p.price <= 0);
  if (empty) {
    const name = [empty.cutting, empty.fabric, empty.color].filter(Boolean).join(" - ") || "tanpa nama";
    return { error: `Harga paket ${name} belum diisi.` };
  }

  const total = pkgs.reduce((s, p) => s + (p.price || 0), 0);

  const { data: o } = await supabase.from("orders")
    .select("id, id_scalev").eq("id", orderId).single();

  const year = new Date().getFullYear();
  const { data: number, error: numErr } = await supabase.rpc("next_invoice_number", { p_year: year });
  if (numErr) return { error: numErr.message };

  const slug = crypto.randomUUID().replace(/-/g, "");

  const { error } = await supabase.from("invoices").insert({
    order_id: orderId, number, number_active: number, slug, total,
  });
  if (error) return { error: error.message };

  await supabase.from("activity_logs").insert({
    actor_id: me.id, actor_name: me.name, actor_role: me.role, order_id: orderId,
    action: "create_invoice",
    text: `${me.name} membuat invoice ${number} untuk order ${o?.id_scalev}.`,
  });
  revalidatePath(`/invoice/${orderId}`); revalidatePath("/board");
  return { ok: true };
}

export async function sendWhatsApp(orderId: string, waNumber: string) {
  const supabase = createClient();
  const me = await getSessionProfile();
  if (!me) return { error: "Tidak diizinkan." };

  const { data: inv } = await supabase.from("invoices")
    .select("id, number_active").eq("order_id", orderId).single();
  const { data: o } = await supabase.from("orders")
    .select("id, id_scalev").eq("id", orderId).single();

  await supabase.from("orders").update({ wa_number: waNumber, status: "invoice_sent" }).eq("id", orderId);
  await supabase.from("invoices").update({
    sent: true, sent_to: waNumber, sent_by: me.id, sent_at: new Date().toISOString(),
  }).eq("order_id", orderId);

  await supabase.from("activity_logs").insert({
    actor_id: me.id, actor_name: me.name, actor_role: me.role, order_id: orderId,
    action: "send_wa",
    text: `${me.name} mengirim invoice ${inv?.number_active} ke WhatsApp ${waNumber} untuk order ${o?.id_scalev}.`,
  });
  revalidatePath(`/invoice/${orderId}`); revalidatePath("/board");
  return { ok: true };
}

export async function reviseInvoice(orderId: string, newTotal: number, reason: string) {
  const supabase = createClient();
  const me = await getSessionProfile();
  if (!me || (me.role !== "sales" && me.role !== "super_admin")) return { error: "Tidak diizinkan." };
  if (!reason.trim()) return { error: "Alasan revisi wajib diisi." };

  const { data: inv } = await supabase.from("invoices")
    .select("id, number, total").eq("order_id", orderId).single();
  if (!inv) return { error: "Invoice tidak ditemukan." };

  const { count } = await supabase.from("invoice_revisions")
    .select("id", { count: "exact", head: true }).eq("invoice_id", inv.id);
  const rev = (count || 0) + 1;

  await supabase.from("invoice_revisions").insert({
    invoice_id: inv.id, rev, old_total: inv.total, new_total: Math.floor(newTotal),
    reason: reason.trim(), revised_by: me.id,
  });
  await supabase.from("invoices").update({
    total: Math.floor(newTotal), number_active: `${inv.number}-R${rev}`,
  }).eq("id", inv.id);

  const { data: o } = await supabase.from("orders").select("id_scalev").eq("id", orderId).single();
  await supabase.from("activity_logs").insert({
    actor_id: me.id, actor_name: me.name, actor_role: me.role, order_id: orderId,
    action: "revise_invoice",
    text: `${me.name} merevisi invoice ${inv.number}-R${rev} order ${o?.id_scalev} menjadi ${rupiah(newTotal)} — alasan: ${reason.trim()}.`,
  });
  revalidatePath(`/invoice/${orderId}`);
  return { ok: true };
}

export async function markDone(orderId: string) {
  const supabase = createClient();
  const me = await getSessionProfile();
  if (!me) return { error: "Tidak diizinkan." };

  const { data: o } = await supabase.from("orders")
    .select("id_scalev, customer, status, need_fitter, tag, telegram_report_sent_at").eq("id", orderId).single();
  if (!o) return { error: "Order tidak ditemukan." };
  if (o.status === "done") return { error: "Order sudah selesai." };

  // Validasi ukuran TIDAK lagi di sini — kelengkapan sudah dijamin saat fitter
  // klik "Selesai Fitting" (finishModel). Di titik ini sales tidak boleh dibuntukan.
  // Cek ringan: pastikan ada detail model (pengaman, normalnya selalu ada).
  const { count: pkgCount } = await supabase.from("order_model_details")
    .select("id", { count: "exact", head: true }).eq("order_id", orderId);
  if (!pkgCount || pkgCount === 0) return { error: "Detail model belum ada." };

  // ubah status → done
  const { error } = await supabase.from("orders").update({ status: "done" }).eq("id", orderId);
  if (error) return { error: error.message };
  await supabase.from("activity_logs").insert({
    actor_id: me.id, actor_name: me.name, actor_role: me.role, order_id: orderId,
    action: "done",
    text: `${me.name} menandai order ${o.id_scalev} customer ${o.customer} sebagai selesai.`,
  });

  // GUARD anti-dobel: hanya kirim jika belum pernah terkirim
  if (!o.telegram_report_sent_at) {
    // tandai dulu agar klik dobel/balapan tidak mengirim dua kali
    await supabase.from("orders").update({
      telegram_report_sent_at: new Date().toISOString(),
      telegram_report_sent_by: me.id,
      telegram_report_status: "pending",
    }).eq("id", orderId).is("telegram_report_sent_at", null);

    const { sendOrderReport } = await import("@/lib/telegram");
    const res = await sendOrderReport(supabase, orderId);
    if (res.ok) {
      await supabase.from("orders").update({ telegram_report_status: "sent" }).eq("id", orderId);
      await supabase.from("activity_logs").insert({
        actor_id: me.id, actor_name: me.name, actor_role: me.role, order_id: orderId,
        action: "telegram_sent", text: `Sistem mengirim laporan Telegram untuk order ${o.id_scalev}.`,
      });
    } else {
      await supabase.from("orders").update({ telegram_report_status: "failed" }).eq("id", orderId);
      await supabase.from("activity_logs").insert({
        actor_id: me.id, actor_name: me.name, actor_role: me.role, order_id: orderId,
        action: "telegram_failed", text: `Sistem gagal mengirim laporan Telegram untuk order ${o.id_scalev}.`,
      });
      // notif critical ke Super Admin
      await supabase.from("notifications").insert({
        recipient_role: "super_admin", type: "telegram_failed",
        title: "Laporan Telegram gagal", message: `Gagal kirim laporan Telegram untuk order ${o.id_scalev}. ${res.error ?? ""}`,
        order_id: orderId,
      });
    }
  }

  revalidatePath("/board");
  return { ok: true };
}

/** Kirim ulang foto customer ke Telegram (manual, Super Admin saja). */
export async function resendPhotos(orderId: string) {
  const supabase = createClient();
  const me = await getSessionProfile();
  if (!me || me.role !== "super_admin") return { error: "Hanya Super Admin." };

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { error: "Telegram belum dikonfigurasi." };

  const { data: o } = await supabase.from("orders").select("id_scalev").eq("id", orderId).single();
  const { data: people } = await supabase.from("order_people")
    .select("id, wearer_name, sort_order").eq("order_id", orderId).order("sort_order");
  const { data: photos } = await supabase.from("customer_measurement_photos")
    .select("person_id, public_url").eq("order_id", orderId);

  if (!photos || photos.length === 0) return { error: "Tidak ada foto untuk dikirim." };

  const { sendPhotosPerPerson } = await import("@/lib/telegram");
  const failed = await sendPhotosPerPerson(token, chatId, people ?? [], photos);

  await supabase.from("activity_logs").insert({
    actor_id: me.id, actor_name: me.name, actor_role: me.role, order_id: orderId,
    action: "resend_photos",
    text: failed.length
      ? `${me.name} kirim ulang foto Telegram order ${o?.id_scalev}; gagal: ${failed.join(", ")}.`
      : `${me.name} kirim ulang foto Telegram order ${o?.id_scalev} (berhasil).`,
  });

  if (failed.length) return { error: `Sebagian gagal: ${failed.join(", ")}. Coba lagi.` };
  return { ok: true };
}
