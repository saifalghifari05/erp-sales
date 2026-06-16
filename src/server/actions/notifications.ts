"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/server/auth";

/** Tandai semua notifikasi personal milik user sebagai sudah dibaca. */
export async function markAllRead() {
  const supabase = createClient();
  const me = await getSessionProfile();
  if (!me) return { error: "Tidak diizinkan." };
  await supabase.from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("recipient_user_id", me.id)
    .eq("is_read", false);
  return { ok: true };
}
