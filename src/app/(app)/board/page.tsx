import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/server/auth";
import { redirect } from "next/navigation";
import { Kanban } from "@/components/board/kanban";
import type { Order } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const me = await getSessionProfile();
  if (!me) redirect("/login");
  const supabase = createClient();

  // RLS otomatis membatasi baris yang kembali sesuai role.
  // Cancelled tidak ditampilkan di kanban (ada halaman tersendiri).
  const { data: orders } = await supabase
    .from("orders")
    .select(`
      id, id_scalev, customer, tag, need_fitter, status, next_stage, prev_status,
      sales_id, wa_number, created_at,
      fitting_start_at, fitting_end_at, fitting_duration_minutes, fitting_started_at, fitting_started_by,
      sales_confirmed_at, sales_confirmed_by, fitter_assignment_status, assigned_by_head_fitter, assigned_at,
      sales:profiles!orders_sales_id_fkey ( name ),
      order_fitters ( fitter_id, profiles:profiles!order_fitters_fitter_id_fkey ( name ) ),
      model_count:order_model_details ( count )
    `)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });

  return (
    <Kanban
      me={me}
      orders={(orders as unknown as Order[]) ?? []}
    />
  );
}
