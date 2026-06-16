"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/server/auth";
import { revalidatePath } from "next/cache";

// kategori master → kolom di order_model_details untuk cek pemakaian
const CATEGORY_COLUMN: Record<string, string> = {
  cutting: "cutting",
  fabric: "fabric",
  collar: "collar",
  bottom_placket: "bottom_placket",
  front_placket: "front_placket",
  pocket: "pocket",
  sleeve_cuff: "sleeve_cuff",
  accessories: "accessories",
  add_on: "add_on",
  cufflink: "cufflink",
};

export async function addMasterOption(category: string, label: string) {
  const supabase = createClient();
  const me = await getSessionProfile();
  if (!me || me.role !== "super_admin") return { error: "Hanya Super Admin." };
  if (!label.trim()) return { error: "Label kosong." };
  const { error } = await supabase.from("master_options").insert({ category, label: label.trim() });
  if (error) return { error: error.message };
  revalidatePath("/master");
  return { ok: true };
}

export async function renameMasterOption(id: string, label: string) {
  const supabase = createClient();
  const me = await getSessionProfile();
  if (!me || me.role !== "super_admin") return { error: "Hanya Super Admin." };
  if (!label.trim()) return { error: "Label kosong." };
  const { error } = await supabase.from("master_options").update({ label: label.trim() }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/master");
  return { ok: true };
}

export async function toggleMasterOption(id: string, active: boolean) {
  const supabase = createClient();
  const me = await getSessionProfile();
  if (!me || me.role !== "super_admin") return { error: "Hanya Super Admin." };
  const { error } = await supabase.from("master_options").update({ active }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/master");
  return { ok: true };
}

/**
 * Hapus master option. Jika sudah dipakai di order_model_details, jangan hard delete
 * — ubah jadi nonaktif (archived). Mengembalikan { ok, archived } untuk pilih toast.
 */
export async function deleteMasterOption(id: string) {
  const supabase = createClient();
  const me = await getSessionProfile();
  if (!me || me.role !== "super_admin") return { error: "Hanya Super Admin." };

  const { data: opt } = await supabase
    .from("master_options").select("category, label").eq("id", id).single();
  if (!opt) return { error: "Opsi tidak ditemukan." };

  const col = CATEGORY_COLUMN[opt.category];
  let used = false;
  if (col) {
    const { count } = await supabase
      .from("order_model_details")
      .select("id", { count: "exact", head: true })
      .eq(col, opt.label);
    used = (count ?? 0) > 0;
  }

  if (used) {
    const { error } = await supabase.from("master_options").update({ active: false }).eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/master");
    return { ok: true, archived: true };
  }

  const { error } = await supabase.from("master_options").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/master");
  return { ok: true, archived: false };
}
