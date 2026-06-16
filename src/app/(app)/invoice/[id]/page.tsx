import { createClient } from "@/lib/supabase/server";
import { PageScroll } from "@/components/ui/page-scroll";
import { getSessionProfile } from "@/server/auth";
import { redirect } from "next/navigation";
import { InvoiceView } from "@/components/invoice/invoice-view";
import type { Order, ModelPackage, Invoice } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function InvoicePage({ params }: { params: { id: string } }) {
  const me = await getSessionProfile();
  if (!me) redirect("/login");
  const supabase = createClient();

  const { data: order } = await supabase
    .from("orders")
    .select(`id, id_scalev, customer, status, sales_id, wa_number,
             sales:profiles!orders_sales_id_fkey ( name )`)
    .eq("id", params.id).single();
  if (!order) redirect("/board");

  const { data: packages } = await supabase
    .from("order_model_details")
    .select(`*, input_profile:profiles!order_model_details_input_by_fkey ( name )`)
    .eq("order_id", params.id).order("created_at");

  const { data: invoice } = await supabase
    .from("invoices")
    .select(`*, invoice_revisions ( id, rev, old_total, new_total, reason, created_at )`)
    .eq("order_id", params.id).maybeSingle();

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "";

  return (
    <PageScroll wide>
      <InvoiceView
        me={me}
        order={order as unknown as Order}
        packages={(packages as unknown as ModelPackage[]) ?? []}
        invoice={(invoice as unknown as Invoice) ?? null}
        siteUrl={siteUrl}
      />
    </PageScroll>
  );
}
