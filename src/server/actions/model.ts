"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/server/auth";
import { revalidatePath } from "next/cache";
import { MEASUREMENT_FIELDS } from "@/lib/types";

export interface PackageInput {
  id?: string;
  cutting: string; fabric: string; color: string;
  collar: string; bottom_placket: string; front_placket: string;
  pocket: string; sleeve_cuff: string;
  accessories: string; add_on: string; cufflink: string;
  note: string;
}

export async function startFitting(orderId: string) {
  const supabase = createClient();
  const me = await getSessionProfile();
  if (!me) return { error: "Tidak diizinkan." };

  const { data: o } = await supabase.from("orders")
    .select("id, id_scalev, customer, status, fitting_started_at").eq("id", orderId).single();
  if (!o) return { error: "Order tidak ditemukan." };
  if (o.status !== "fitter_work") return { error: "Order tidak di tahap Pekerjaan Fitter." };

  const { error } = await supabase.from("orders").update({
    fitting_started_at: new Date().toISOString(),
    fitting_started_by: me.id,
  }).eq("id", orderId);
  if (error) return { error: error.message };

  await supabase.from("activity_logs").insert({
    actor_id: me.id, actor_name: me.name, actor_role: me.role, order_id: orderId,
    action: "start_fitting",
    text: `${me.name} memulai fitting untuk order ${o.id_scalev}.`,
  });
  revalidatePath(`/order/${orderId}`); revalidatePath("/board");
  return { ok: true };
}

/** Simpan/replace ukuran badan customer (1 baris per order). */
export async function saveMeasurement(orderId: string, values: Record<string, number | null>) {
  const supabase = createClient();
  const me = await getSessionProfile();
  if (!me) return { error: "Tidak diizinkan." };

  const { data: existing } = await supabase.from("customer_measurements")
    .select("id").eq("order_id", orderId).maybeSingle();

  const row = { ...values, order_id: orderId, fitter_id: me.id, updated_by: me.id };
  if (existing) {
    const { error } = await supabase.from("customer_measurements").update(row).eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("customer_measurements").insert({ ...row, created_by: me.id });
    if (error) return { error: error.message };
  }
  revalidatePath(`/order/${orderId}`);
  return { ok: true };
}

export async function uploadCustomerPhoto(
  orderId: string,
  payload: { personId: string; fileName: string; mimeType: string; base64: string; fileSize: number }
) {
  const supabase = createClient();
  const me = await getSessionProfile();
  if (!me) return { error: "Tidak diizinkan." };

  const { count } = await supabase.from("customer_measurement_photos")
    .select("id", { count: "exact", head: true }).eq("person_id", payload.personId);
  if ((count ?? 0) >= 5) return { error: "Maksimal 5 foto per pemakai." };

  let up;
  try {
    const { uploadPhoto } = await import("@/lib/storage");
    up = await uploadPhoto(orderId, payload.fileName, payload.mimeType, payload.base64);
  } catch (e) {
    const raw = e instanceof Error ? e.message : "gagal upload";
    console.error("[uploadCustomerPhoto gagal]", raw); // detail lengkap ke server log
    // ringkas jadi pesan manusiawi untuk notifikasi & UI
    let title = "Gagal upload foto order.";
    let detail = "";
    if (/SignatureDoesNotMatch/i.test(raw)) {
      title = "Gagal upload foto. Konfigurasi R2 tidak cocok.";
      detail = "Periksa Access Key, Secret Key, Account ID, Endpoint, dan Bucket.";
    } else if (/NoSuchBucket|bucket/i.test(raw)) {
      title = "Gagal upload foto. Bucket R2 tidak ditemukan.";
      detail = "Periksa nama R2_BUCKET_NAME.";
    } else if (/InvalidAccessKeyId|AccessDenied|403/i.test(raw)) {
      title = "Gagal upload foto. Akses R2 ditolak.";
      detail = "Periksa Access Key & Secret Key R2.";
    } else {
      title = "Gagal upload foto order.";
      detail = "Periksa konfigurasi Cloudflare R2.";
    }
    await supabase.from("notifications").insert({
      recipient_role: "super_admin", type: "photo_upload_failed",
      title, message: detail, order_id: orderId,
    });
    return { error: `${title}${detail ? " " + detail : ""}` };
  }

  const { data: meas } = await supabase.from("customer_measurements").select("id").eq("person_id", payload.personId).maybeSingle();

  const { data: row, error } = await supabase.from("customer_measurement_photos").insert({
    order_id: orderId,
    person_id: payload.personId,
    measurement_id: meas?.id ?? null,
    storage_provider: up.provider,
    storage_path: up.storage_path,
    public_url: up.public_url,
    file_name: payload.fileName,
    mime_type: payload.mimeType,
    file_size: payload.fileSize,
    uploaded_by: me.id,
  }).select("id, order_id, person_id, storage_path, public_url, created_at").single();
  if (error) return { error: error.message };

  revalidatePath(`/order/${orderId}`);
  return { ok: true, photo: row };
}

export async function deletePhoto(orderId: string, photoId: string) {
  const supabase = createClient();
  const me = await getSessionProfile();
  if (!me) return { error: "Tidak diizinkan." };
  const { data: p } = await supabase.from("customer_measurement_photos")
    .select("storage_provider, storage_path").eq("id", photoId).single();
  if (p) {
    try {
      const { deletePhotoFile } = await import("@/lib/storage");
      await deletePhotoFile(p.storage_provider ?? "supabase", p.storage_path);
    } catch { /* abaikan kegagalan hapus file fisik */ }
  }
  const { error } = await supabase.from("customer_measurement_photos").delete().eq("id", photoId);
  if (error) return { error: error.message };
  revalidatePath(`/order/${orderId}`);
  return { ok: true };
}

export async function savePackage(orderId: string, pkg: PackageInput) {
  const supabase = createClient();
  const me = await getSessionProfile();
  if (!me) return { error: "Tidak diizinkan." };

  const row = {
    order_id: orderId,
    cutting: pkg.cutting || null, fabric: pkg.fabric || null, color: pkg.color || null,
    collar: pkg.collar || null, bottom_placket: pkg.bottom_placket || null,
    front_placket: pkg.front_placket || null, pocket: pkg.pocket || null,
    sleeve_cuff: pkg.sleeve_cuff || null, accessories: pkg.accessories || null,
    add_on: pkg.add_on || null, cufflink: pkg.cufflink || null, note: pkg.note || null,
    input_by: me.id, input_role: me.role,
  };

  if (pkg.id) {
    const { error } = await supabase.from("order_model_details").update(row).eq("id", pkg.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("order_model_details").insert(row);
    if (error) return { error: error.message };
  }
  revalidatePath(`/order/${orderId}`);
  return { ok: true };
}

export async function deletePackage(orderId: string, packageId: string) {
  const supabase = createClient();
  const me = await getSessionProfile();
  if (!me) return { error: "Tidak diizinkan." };
  const { error } = await supabase.from("order_model_details").delete().eq("id", packageId);
  if (error) return { error: error.message };
  revalidatePath(`/order/${orderId}`);
  return { ok: true };
}

export async function finishModel(orderId: string) {
  const supabase = createClient();
  const me = await getSessionProfile();
  if (!me) return { error: "Tidak diizinkan." };

  const { data: o } = await supabase.from("orders")
    .select("id, id_scalev, customer, sales_id, sales:profiles!orders_sales_id_fkey ( name )")
    .eq("id", orderId).single();

  const { data: people } = await supabase.from("order_people").select("id, wearer_name").eq("order_id", orderId);
  if (!people || people.length === 0) return { error: "Belum ada pemakai/paket." };

  // validasi model per pemakai
  const { data: models } = await supabase.from("order_model_details").select("person_id").eq("order_id", orderId);
  const modeledPersons = new Set((models ?? []).map((m) => m.person_id));
  const missingModel = people.find((p) => !modeledPersons.has(p.id));
  if (missingModel) return { error: `Pemakai ${missingModel.wearer_name} belum punya detail model.` };

  // validasi ukuran lengkap (15 field) per pemakai
  const { data: meas } = await supabase.from("customer_measurements").select("*").eq("order_id", orderId);
  const measByPerson = new Map((meas ?? []).map((m) => [m.person_id, m]));
  for (const p of people) {
    const m = measByPerson.get(p.id) as Record<string, unknown> | undefined;
    if (!m) return { error: `Ukuran badan ${p.wearer_name} belum diisi.` };
    const kosong = MEASUREMENT_FIELDS.find((f) => m[f.key] == null || m[f.key] === "");
    if (kosong) return { error: `Ukuran "${kosong.label}" untuk ${p.wearer_name} belum diisi.` };
  }

  const { error } = await supabase.from("orders").update({ status: "invoice_draft" }).eq("id", orderId);
  if (error) return { error: error.message };

  await supabase.from("activity_logs").insert({
    actor_id: me.id, actor_name: me.name, actor_role: me.role, order_id: orderId,
    action: "model_done",
    text: `${me.name} menyelesaikan input ukuran dan model untuk order ${o?.id_scalev} customer ${o?.customer}.`,
  });

  // notif ke sales pemilik order
  if (o?.sales_id) {
    await supabase.from("notifications").insert({
      recipient_user_id: o.sales_id, type: "model_done",
      title: "Ukuran & model selesai",
      message: `Fitter sudah menyelesaikan input ukuran dan model untuk Order ${o.id_scalev}.`,
      order_id: orderId,
    });
  }

  revalidatePath("/board");
  return { ok: true };
}
