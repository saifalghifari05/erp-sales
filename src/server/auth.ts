import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/** Mengembalikan profil user yang sedang login, atau null. */
export async function getSessionProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, name, role, active")
    .eq("id", user.id)
    .single();
  return (data as Profile) ?? null;
}
