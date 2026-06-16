"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionProfile } from "@/server/auth";
import { revalidatePath } from "next/cache";

export interface CatalogFile {
  id: string; name: string; storage_path: string; active: boolean; created_at: string;
}

/** Upload PDF katalog (Super Admin). base64 tanpa prefix data URL. */
export async function uploadCatalog(name: string, base64: string) {
  const me = await getSessionProfile();
  if (!me || me.role !== "super_admin") return { error: "Hanya Super Admin." };
  if (!name.trim()) return { error: "Nama katalog wajib diisi." };

  const admin = createAdminClient();
  const buffer = Buffer.from(base64, "base64");
  const path = `${crypto.randomUUID()}.pdf`;
  const { error: upErr } = await admin.storage.from("catalog").upload(path, buffer, {
    contentType: "application/pdf", upsert: false,
  });
  if (upErr) return { error: "Gagal upload katalog: " + upErr.message };

  const supabase = createClient();
  const { error } = await supabase.from("catalog_files")
    .insert({ name: name.trim(), storage_path: path, uploaded_by: me.id, active: true });
  if (error) return { error: error.message };

  revalidatePath("/master");
  return { ok: true };
}

export async function toggleCatalog(id: string, active: boolean) {
  const me = await getSessionProfile();
  if (!me || me.role !== "super_admin") return { error: "Hanya Super Admin." };
  const supabase = createClient();
  const { error } = await supabase.from("catalog_files").update({ active }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/master");
  return { ok: true };
}

export async function deleteCatalog(id: string, storagePath: string) {
  const me = await getSessionProfile();
  if (!me || me.role !== "super_admin") return { error: "Hanya Super Admin." };
  const admin = createAdminClient();
  await admin.storage.from("catalog").remove([storagePath]);
  const supabase = createClient();
  const { error } = await supabase.from("catalog_files").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/master");
  return { ok: true };
}

/** Signed URL (1 jam) untuk membuka PDF katalog. */
export async function getCatalogUrl(storagePath: string) {
  const me = await getSessionProfile();
  if (!me) return { error: "Tidak diizinkan." };
  const supabase = createClient();
  const { data, error } = await supabase.storage.from("catalog").createSignedUrl(storagePath, 3600);
  if (error || !data) return { error: error?.message ?? "Gagal membuat tautan." };
  return { ok: true, url: data.signedUrl };
}
