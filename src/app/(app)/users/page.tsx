import { createClient } from "@/lib/supabase/server";
import { PageScroll } from "@/components/ui/page-scroll";
import { getSessionProfile } from "@/server/auth";
import { redirect } from "next/navigation";
import { UserManager } from "@/components/board/user-manager";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await getSessionProfile();
  if (!me || me.role !== "super_admin") redirect("/board");

  const supabase = createClient();
  const { data: profiles } = await supabase
    .from("profiles").select("id, username, name, role, active").order("role");

  return (
    <PageScroll wide>
      <UserManager users={(profiles as Profile[]) ?? []} />
    </PageScroll>
  );
}
