import "server-only";
import { createClient as createAdminBase } from "@supabase/supabase-js";

/**
 * Admin client memakai SERVICE ROLE KEY — bypass RLS.
 * HANYA boleh dipanggil dari server (Server Action / Route Handler).
 * Jangan pernah impor dari komponen client.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY belum diset.");
  return createAdminBase(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
