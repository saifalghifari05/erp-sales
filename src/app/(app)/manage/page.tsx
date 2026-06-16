import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/server/auth";
import { redirect } from "next/navigation";
import { ManageList } from "@/components/board/manage-list";
import type { Order } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ManagePage() {
  const me = await getSessionProfile();
  if (!me || me.role !== "super_admin") redirect("/board");
  const supabase = createClient();

  const { data: orders } = await supabase
    .from("orders")
    .select(`id, id_scalev, customer, status, created_at,
             sales:profiles!orders_sales_id_fkey ( name ),
             order_fitters ( fitter_id, profiles:profiles!order_fitters_fitter_id_fkey ( name ) )`)
    .order("created_at", { ascending: false });

  return <ManageList orders={(orders as unknown as Order[]) ?? []} />;
}
