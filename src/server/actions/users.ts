"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionProfile } from "@/server/auth";
import { revalidatePath } from "next/cache";

/**
 * Reset/ubah password user oleh Super Admin.
 * Memakai service role di server. Memvalidasi pemanggil = super_admin.
 */
export async function resetUserPassword(userId: string, newPassword: string) {
  const me = await getSessionProfile();
  if (!me || me.role !== "super_admin") return { error: "Hanya Super Admin." };
  if (!newPassword || newPassword.length < 8) {
    return { error: "Password minimal 8 karakter." };
  }

  // ambil nama target untuk activity log
  const supabase = createClient();
  const { data: target } = await supabase.from("profiles").select("name").eq("id", userId).single();

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) return { error: error.message };

  await supabase.from("activity_logs").insert({
    actor_id: me.id, actor_name: me.name, actor_role: me.role, order_id: null,
    action: "reset_password",
    text: `${me.name} mengubah password user ${target?.name ?? ""}.`,
  });

  return { ok: true };
}

/** Aktif/nonaktifkan user (tidak menghapus). */
export async function setUserActive(userId: string, active: boolean) {
  const me = await getSessionProfile();
  if (!me || me.role !== "super_admin") return { error: "Hanya Super Admin." };
  const supabase = createClient();
  const { error } = await supabase.from("profiles").update({ active }).eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/users");
  return { ok: true };
}

const USERNAME_RE = /^[a-z0-9._]+$/;

/**
 * Ubah username user oleh Super Admin.
 * username disimpan di profiles.username (unik) DAN disinkronkan ke email
 * internal auth (<username>@tarda.local) agar login tetap konsisten.
 */
export async function updateUsername(userId: string, rawUsername: string) {
  const me = await getSessionProfile();
  if (!me || me.role !== "super_admin") return { error: "Hanya Super Admin." };

  const username = rawUsername.trim().toLowerCase();
  if (!username) return { error: "Username wajib diisi." };
  if (!USERNAME_RE.test(username)) {
    return { error: "Username hanya boleh huruf kecil, angka, titik, atau underscore." };
  }

  const supabase = createClient();

  // cek bentrok username
  const { data: clash } = await supabase
    .from("profiles").select("id").eq("username", username).neq("id", userId).maybeSingle();
  if (clash) return { error: "Username sudah dipakai user lain." };

  const { data: before } = await supabase.from("profiles").select("name, username").eq("id", userId).single();

  // sinkronkan email internal di auth (server-only, service role)
  const admin = createAdminClient();
  const { error: authErr } = await admin.auth.admin.updateUserById(userId, {
    email: `${username}@tarda.local`,
  });
  if (authErr) return { error: authErr.message };

  const { error } = await supabase.from("profiles").update({ username }).eq("id", userId);
  if (error) return { error: error.message };

  await supabase.from("activity_logs").insert({
    actor_id: me.id, actor_name: me.name, actor_role: me.role, order_id: null,
    action: "update_username",
    text: `${me.name} mengubah username user ${before?.name ?? ""} menjadi ${username}.`,
  });

  revalidatePath("/users");
  return { ok: true };
}
