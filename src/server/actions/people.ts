"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/server/auth";
import { revalidatePath } from "next/cache";

export async function addPerson(orderId: string, wearerName: string) {
  const supabase = createClient();
  const me = await getSessionProfile();
  if (!me) return { error: "Tidak diizinkan." };
  if (!wearerName.trim()) return { error: "Nama pemakai wajib diisi." };

  const { count } = await supabase.from("order_people")
    .select("id", { count: "exact", head: true }).eq("order_id", orderId);

  const { data, error } = await supabase.from("order_people").insert({
    order_id: orderId, wearer_name: wearerName.trim(), sort_order: count ?? 0,
    created_by: me.id, updated_by: me.id,
  }).select("id, order_id, wearer_name, sort_order").single();
  if (error) return { error: error.message };
  revalidatePath(`/order/${orderId}`);
  return { ok: true, person: data };
}

export async function renamePerson(orderId: string, personId: string, wearerName: string) {
  const supabase = createClient();
  const me = await getSessionProfile();
  if (!me) return { error: "Tidak diizinkan." };
  if (!wearerName.trim()) return { error: "Nama pemakai wajib diisi." };
  const { error } = await supabase.from("order_people")
    .update({ wearer_name: wearerName.trim(), updated_by: me.id }).eq("id", personId);
  if (error) return { error: error.message };
  revalidatePath(`/order/${orderId}`);
  return { ok: true };
}

export async function deletePerson(orderId: string, personId: string) {
  const supabase = createClient();
  const me = await getSessionProfile();
  if (!me) return { error: "Tidak diizinkan." };
  // hapus foto fisik dulu
  const { data: photos } = await supabase.from("customer_measurement_photos")
    .select("storage_provider, storage_path").eq("person_id", personId);
  if (photos && photos.length) {
    try {
      const { deletePhotoFile } = await import("@/lib/storage");
      for (const p of photos) await deletePhotoFile(p.storage_provider ?? "supabase", p.storage_path);
    } catch { /* abaikan */ }
  }
  // cascade akan menghapus measurement/model/photo via FK on delete cascade
  const { error } = await supabase.from("order_people").delete().eq("id", personId);
  if (error) return { error: error.message };
  revalidatePath(`/order/${orderId}`);
  return { ok: true };
}

export async function savePersonMeasurement(
  orderId: string, personId: string,
  values: Record<string, number | null>, watchNote: boolean, ankleNote: boolean
) {
  const supabase = createClient();
  const me = await getSessionProfile();
  if (!me) return { error: "Tidak diizinkan." };

  const { data: existing } = await supabase.from("customer_measurements")
    .select("id").eq("person_id", personId).maybeSingle();

  const row = {
    ...values, order_id: orderId, person_id: personId, fitter_id: me.id,
    has_watch_note: watchNote, has_ankle_note: ankleNote, updated_by: me.id,
  };
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

export interface PersonModelInput {
  cutting: string; fabric: string; color: string;
  collar: string; bottom_placket: string; front_placket: string;
  pocket: string; sleeve_cuff: string;
  accessories: string; add_on: string; cufflink: string; note: string;
}

export async function savePersonModel(
  orderId: string, personId: string, wearerName: string, pkg: PersonModelInput
) {
  const supabase = createClient();
  const me = await getSessionProfile();
  if (!me) return { error: "Tidak diizinkan." };

  const row = {
    order_id: orderId, person_id: personId, wearer_name: wearerName,
    cutting: pkg.cutting || null, fabric: pkg.fabric || null, color: pkg.color || null,
    collar: pkg.collar || null, bottom_placket: pkg.bottom_placket || null,
    front_placket: pkg.front_placket || null, pocket: pkg.pocket || null,
    sleeve_cuff: pkg.sleeve_cuff || null, accessories: pkg.accessories || null,
    add_on: pkg.add_on || null, cufflink: pkg.cufflink || null, note: pkg.note || null,
    input_by: me.id, input_role: me.role,
  };

  const { data: existing } = await supabase.from("order_model_details")
    .select("id").eq("person_id", personId).maybeSingle();
  if (existing) {
    const { error } = await supabase.from("order_model_details").update(row).eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("order_model_details").insert(row);
    if (error) return { error: error.message };
  }
  revalidatePath(`/order/${orderId}`);
  return { ok: true };
}
