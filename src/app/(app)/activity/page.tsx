import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/server/auth";
import { redirect } from "next/navigation";
import { ActivityTable } from "@/components/board/activity-table";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const me = await getSessionProfile();
  if (!me || (me.role !== "super_admin" && me.role !== "manager")) redirect("/board");
  const supabase = createClient();

  const { data: logs } = await supabase
    .from("activity_logs")
    .select("id, actor_name, actor_role, action, text, created_at, orders:order_id ( id_scalev )")
    .order("created_at", { ascending: false })
    .limit(500);

  const rows = (logs ?? []).map((l) => ({
    id: l.id, actor_name: l.actor_name, actor_role: l.actor_role,
    action: l.action, text: l.text, created_at: l.created_at,
    id_scalev: (l as { orders?: { id_scalev?: string } | null }).orders?.id_scalev ?? null,
  }));

  return <ActivityTable rows={rows} />;
}
