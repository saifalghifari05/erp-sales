import { createClient } from "@/lib/supabase/server";
import { PageScroll } from "@/components/ui/page-scroll";
import { getSessionProfile } from "@/server/auth";
import { redirect } from "next/navigation";
import { MasterManager } from "@/components/board/master-manager";

export const dynamic = "force-dynamic";

export default async function MasterPage() {
  const me = await getSessionProfile();
  if (!me || me.role !== "super_admin") redirect("/board");
  const supabase = createClient();

  const { data: options } = await supabase
    .from("master_options").select("id, category, label, active").order("sort_order");

  const { data: catalogs } = await supabase
    .from("catalog_files").select("id, name, storage_path, active, created_at").order("created_at", { ascending: false });

  return (
    <PageScroll wide>
      <MasterManager
        options={(options as { id: string; category: string; label: string; active: boolean }[]) ?? []}
        catalogs={(catalogs as { id: string; name: string; storage_path: string; active: boolean; created_at: string }[]) ?? []}
      />
    </PageScroll>
  );
}
