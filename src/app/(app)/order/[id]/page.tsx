import { createClient } from "@/lib/supabase/server";
import { PageScroll } from "@/components/ui/page-scroll";
import { getSessionProfile } from "@/server/auth";
import { redirect } from "next/navigation";
import { OrderDetail } from "@/components/order/order-detail";
import type { Order } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: { id: string } }) {
  const me = await getSessionProfile();
  if (!me) redirect("/login");
  const supabase = createClient();

  const { data: order } = await supabase
    .from("orders")
    .select(`
      id, id_scalev, customer, tag, need_fitter, status, next_stage, sales_id, wa_number, created_at,
      fitting_start_at, fitting_end_at, fitting_duration_minutes, fitting_started_at, fitting_started_by,
      sales_confirmed_at, sales_confirmed_by, fitter_assignment_status, assigned_by_head_fitter, assigned_at,
      sales:profiles!orders_sales_id_fkey ( name ),
      order_fitters ( fitter_id, profiles:profiles!order_fitters_fitter_id_fkey ( name ) )
    `)
    .eq("id", params.id)
    .single();

  if (!order) redirect("/board");

  const { data: master } = await supabase
    .from("master_options").select("category, label").eq("active", true).order("sort_order");
  const masterMap: Record<string, string[]> = {};
  (master ?? []).forEach((m) => { (masterMap[m.category] ??= []).push(m.label); });

  const { data: fitters } = await supabase
    .from("profiles").select("id, name").eq("role", "fitter").eq("active", true).order("name");

  // pemakai + relasi
  const { data: people } = await supabase
    .from("order_people").select("id, order_id, wearer_name, sort_order").eq("order_id", params.id).order("sort_order");
  const { data: meas } = await supabase.from("customer_measurements").select("*").eq("order_id", params.id);
  const { data: models } = await supabase
    .from("order_model_details").select("*").eq("order_id", params.id);
  const { data: photos } = await supabase
    .from("customer_measurement_photos").select("id, person_id, public_url").eq("order_id", params.id);

  const { data: catalogs } = await supabase
    .from("catalog_files").select("id, name, storage_path").eq("active", true).order("created_at", { ascending: false });

  const peopleData = (people ?? []).map((p) => ({
    person: p,
    measurement: (meas ?? []).find((m) => m.person_id === p.id) ?? null,
    model: (models ?? []).find((m) => m.person_id === p.id) ?? null,
    photos: (photos ?? []).filter((ph) => ph.person_id === p.id).map((ph) => ({ id: ph.id, public_url: ph.public_url })),
  }));

  return (
    <PageScroll wide>
      <OrderDetail
        me={me}
        order={order as unknown as Order}
        master={masterMap}
        fitters={(fitters as { id: string; name: string }[]) ?? []}
        peopleData={peopleData}
        catalogs={(catalogs as { id: string; name: string; storage_path: string }[]) ?? []}
      />
    </PageScroll>
  );
}
