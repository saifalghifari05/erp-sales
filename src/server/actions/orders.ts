"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/server/auth";
import { revalidatePath } from "next/cache";
import { STATUS, type OrderStatus } from "@/lib/constants";

type SB = ReturnType<typeof createClient>;

/** Tulis activity log dengan kalimat siap-tampil. */
async function logActivity(
  supabase: SB,
  actor: { id: string; name: string; role: string },
  action: string,
  text: string,
  orderId: string | null
) {
  await supabase.from("activity_logs").insert({
    actor_id: actor.id, actor_name: actor.name, actor_role: actor.role,
    order_id: orderId, action, text,
  });
}

export interface NewOrderRow {
  customer: string;
  id_scalev: string;
  tag: "order" | "repeat";
  need_fitter: boolean;
  wa_number?: string;
  fitting_date?: string;   // "YYYY-MM-DD"
  fitting_time?: string;   // "HH:MM"
  fitting_duration_minutes?: number;
}

function buildFittingRange(date?: string, time?: string, durationMin = 60) {
  if (!date || !time) return { start: null as string | null, end: null as string | null };
  const start = new Date(`${date}T${time}:00`);
  const end = new Date(start.getTime() + durationMin * 60000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function createOrders(rows: NewOrderRow[]) {
  const supabase = createClient();
  const me = await getSessionProfile();
  if (!me || (me.role !== "sales" && me.role !== "super_admin")) {
    return { error: "Tidak diizinkan." };
  }

  for (const r of rows) {
    const needF = r.tag === "order" || (r.tag === "repeat" && r.need_fitter);
    const nextStage: OrderStatus = needF ? "fitter_work" : "sales_model_input";
    const dur = r.fitting_duration_minutes ?? 60;
    const { start, end } = buildFittingRange(r.fitting_date, r.fitting_time, dur);

    if (needF && (!start || !end)) {
      return { error: `Order ${r.id_scalev}: tanggal & jam fitting wajib diisi untuk order yang butuh fitter.` };
    }

    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        id_scalev: r.id_scalev.trim(),
        customer: r.customer.trim(),
        tag: r.tag,
        need_fitter: r.need_fitter,
        status: "draft_sales",
        next_stage: nextStage,
        sales_id: me.id,
        wa_number: r.wa_number?.trim() || null,
        fitting_start_at: start,
        fitting_end_at: end,
        fitting_duration_minutes: dur,
        fitter_assignment_status: "pending_sales_confirmation",
      })
      .select("id")
      .single();

    if (error) return { error: "Gagal menyimpan order (ID Scalev mungkin duplikat): " + error.message };

    await logActivity(supabase, me, "create_order",
      `${me.name} membuat draft order ${r.id_scalev} untuk customer ${r.customer}.`, order!.id);
  }

  revalidatePath("/board");
  return { ok: true };
}

/** Sales mengonfirmasi order siap dilanjutkan. */
export async function confirmOrder(orderId: string) {
  const supabase = createClient();
  const me = await getSessionProfile();
  if (!me) return { error: "Tidak diizinkan." };

  const { data: o } = await supabase.from("orders")
    .select("id, id_scalev, customer, status, sales_id, next_stage").eq("id", orderId).single();
  if (!o) return { error: "Order tidak ditemukan." };
  if (me.role !== "super_admin" && o.sales_id !== me.id) return { error: "Hanya sales pemilik." };
  if (o.status !== "draft_sales") return { error: "Order tidak di Draft Sales." };

  // butuh fitter? → menunggu assign Kepala Fitter. tanpa fitter → langsung siap input model sales.
  const needFitter = o.next_stage === "fitter_work";
  await supabase.from("orders").update({
    sales_confirmed_at: new Date().toISOString(),
    sales_confirmed_by: me.id,
    fitter_assignment_status: needFitter ? "ready_to_assign" : "assigned",
  }).eq("id", orderId);

  await logActivity(supabase, me, "confirm_order",
    `${me.name} mengonfirmasi order ${o.id_scalev} customer ${o.customer}.`, orderId);

  if (needFitter) {
    // notif ke Kepala Fitter
    await supabase.from("notifications").insert({
      recipient_role: "head_fitter", type: "order_confirmed",
      title: "Order siap assign", message: `Order ${o.id_scalev} sudah dikonfirmasi Sales dan siap dipilihkan fitter.`,
      order_id: orderId,
    });
  } else {
    // repeat tanpa fitter → langsung pindah ke input model sales
    await supabase.from("orders").update({ status: "sales_model_input" }).eq("id", orderId);
  }

  revalidatePath("/board");
  return { ok: true };
}

/** Kepala Fitter assign fitter ke order yang sudah dikonfirmasi sales. */
export async function assignFitters(orderId: string, fitterIds: string[], overrideReason?: string) {
  const supabase = createClient();
  const me = await getSessionProfile();
  if (!me || (me.role !== "head_fitter" && me.role !== "super_admin")) return { error: "Hanya Kepala Fitter." };
  if (fitterIds.length === 0) return { error: "Pilih minimal 1 fitter." };

  const { data: o } = await supabase.from("orders")
    .select("id, id_scalev, customer, status, sales_confirmed_at, fitting_start_at, fitting_end_at").eq("id", orderId).single();
  if (!o) return { error: "Order tidak ditemukan." };
  if (!o.sales_confirmed_at) return { error: "Order belum dikonfirmasi Sales." };

  // cek bentrok
  if (o.fitting_start_at && o.fitting_end_at) {
    const conflict = await findConflict(supabase, orderId, fitterIds, o.fitting_start_at, o.fitting_end_at);
    if (conflict) {
      if (me.role !== "super_admin" && !(overrideReason && overrideReason.trim())) {
        return { conflict: `Jadwal ${conflict.name} bentrok pada ${conflict.range}. Pilih fitter atau jam lain.` };
      }
      if (overrideReason && overrideReason.trim()) {
        await supabase.from("orders").update({
          fitting_override_reason: overrideReason.trim(),
          fitting_override_by: me.id, fitting_override_at: new Date().toISOString(),
        }).eq("id", orderId);
        await logActivity(supabase, me, "override_conflict",
          `${me.name} override jadwal bentrok ${conflict.name} untuk order ${o.id_scalev}. Alasan: ${overrideReason.trim()}.`, orderId);
      }
    }
  }

  // reset assignment lama, set baru
  await supabase.from("order_fitters").delete().eq("order_id", orderId);
  await supabase.from("order_fitters").insert(
    fitterIds.map((fid, i) => ({
      order_id: orderId, fitter_id: fid, assigned_by: me.id,
      assigned_at: new Date().toISOString(), is_primary: i === 0,
    }))
  );

  await supabase.from("orders").update({
    status: "fitter_work",
    fitter_assignment_status: "assigned",
    assigned_by_head_fitter: me.id,
    assigned_at: new Date().toISOString(),
  }).eq("id", orderId);

  // notif ke tiap fitter
  const notifs = fitterIds.map((fid) => ({
    recipient_user_id: fid, type: "job_assigned",
    title: "Job fitting baru", message: `Kamu mendapat job fitting baru: Order ${o.id_scalev}.`,
    order_id: orderId,
  }));
  await supabase.from("notifications").insert(notifs);

  // nama fitter untuk log
  const { data: fps } = await supabase.from("profiles").select("name").in("id", fitterIds);
  const names = (fps ?? []).map((x) => x.name).join(", ");
  await logActivity(supabase, me, "assign_fitter",
    `${me.name} meng-assign ${names} ke order ${o.id_scalev} customer ${o.customer}.`, orderId);

  revalidatePath("/board");
  return { ok: true };
}

/** Cari bentrok jadwal fitter. Kembalikan {name, range} fitter pertama yang bentrok, atau null. */
async function findConflict(
  supabase: SB, orderId: string, fitterIds: string[], start: string, end: string
) {
  if (fitterIds.length === 0) return null;
  // ambil order lain yang punya fitter sama & jadwal overlap (status aktif)
  const { data: rows } = await supabase
    .from("order_fitters")
    .select(`fitter_id, profiles:profiles!order_fitters_fitter_id_fkey ( name ),
             orders:orders!order_fitters_order_id_fkey ( id, status, fitting_start_at, fitting_end_at )`)
    .in("fitter_id", fitterIds);

  for (const row of (rows ?? []) as unknown as {
    fitter_id: string; profiles?: { name: string } | null;
    orders?: { id: string; status: string; fitting_start_at: string | null; fitting_end_at: string | null } | null;
  }[]) {
    const o = row.orders;
    if (!o || o.id === orderId) continue;
    if (["cancelled", "done"].includes(o.status)) continue;
    if (!o.fitting_start_at || !o.fitting_end_at) continue;
    const oStart = new Date(o.fitting_start_at).getTime();
    const oEnd = new Date(o.fitting_end_at).getTime();
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (s < oEnd && e > oStart) {
      return { name: row.profiles?.name ?? "Fitter",
        range: fmtRangeId(o.fitting_start_at, o.fitting_end_at) };
    }
  }
  return null;
}

function fmtRangeId(startISO: string, endISO: string): string {
  const s = new Date(startISO);
  const tgl = s.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  const jam = (d: Date) => d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(":", ".");
  return `${tgl}, ${jam(s)}–${jam(new Date(endISO))}`;
}

export async function cancelDraft(orderId: string) {
  const supabase = createClient();
  const me = await getSessionProfile();
  if (!me) return { error: "Tidak diizinkan." };

  const { data: o } = await supabase.from("orders")
    .select("id, id_scalev, customer, status").eq("id", orderId).single();
  if (!o) return { error: "Order tidak ditemukan." };

  const { error } = await supabase.from("orders")
    .update({ status: "cancelled", prev_status: o.status }).eq("id", orderId);
  if (error) return { error: error.message };

  await logActivity(supabase, me, "cancel_draft",
    `${me.name} membatalkan draft order ${o.id_scalev} customer ${o.customer}.`, orderId);
  revalidatePath("/board");
  return { ok: true };
}

export async function cancelOrder(orderId: string) {
  const supabase = createClient();
  const me = await getSessionProfile();
  if (!me || me.role !== "super_admin") return { error: "Hanya Super Admin." };

  const { data: o } = await supabase.from("orders")
    .select("id, id_scalev, customer, status").eq("id", orderId).single();
  if (!o) return { error: "Order tidak ditemukan." };

  const { error } = await supabase.from("orders")
    .update({ status: "cancelled", prev_status: o.status }).eq("id", orderId);
  if (error) return { error: error.message };

  await logActivity(supabase, me, "cancel_order",
    `${me.name} membatalkan order ${o.id_scalev} customer ${o.customer}.`, orderId);
  revalidatePath("/manage"); revalidatePath("/board");
  return { ok: true };
}

export async function restoreOrder(orderId: string) {
  const supabase = createClient();
  const me = await getSessionProfile();
  if (!me || me.role !== "super_admin") return { error: "Hanya Super Admin." };

  const { data: o } = await supabase.from("orders")
    .select("id, id_scalev, customer, prev_status").eq("id", orderId).single();
  if (!o) return { error: "Order tidak ditemukan." };

  const target = (o.prev_status as OrderStatus) || "draft_sales";
  const { error } = await supabase.from("orders").update({ status: target }).eq("id", orderId);
  if (error) return { error: error.message };

  await logActivity(supabase, me, "restore_order",
    `${me.name} mengembalikan order ${o.id_scalev} customer ${o.customer}.`, orderId);
  revalidatePath("/manage"); revalidatePath("/board");
  return { ok: true };
}

export async function changeStage(orderId: string, target: OrderStatus, reason: string) {
  const supabase = createClient();
  const me = await getSessionProfile();
  if (!me || me.role !== "super_admin") return { error: "Hanya Super Admin." };
  if (!reason.trim()) return { error: "Alasan perubahan wajib diisi." };

  const { data: o } = await supabase.from("orders")
    .select("id, id_scalev, customer, status").eq("id", orderId).single();
  if (!o) return { error: "Order tidak ditemukan." };

  const fromLabel = STATUS[o.status as OrderStatus].label;
  const { error } = await supabase.from("orders")
    .update({ status: target, prev_status: o.status }).eq("id", orderId);
  if (error) return { error: error.message };

  await logActivity(supabase, me, "change_stage",
    `${me.name} mengubah tahap order ${o.id_scalev} dari ${fromLabel} ke ${STATUS[target].label} karena ${reason.trim()}.`,
    orderId);
  revalidatePath("/manage"); revalidatePath("/board");
  return { ok: true };
}
