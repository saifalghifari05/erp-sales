import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/server/auth";
import { redirect } from "next/navigation";
import { PageScroll } from "@/components/ui/page-scroll";
import { STATUS } from "@/lib/constants";
import type { Order } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CancelledPage() {
  const me = await getSessionProfile();
  if (!me) redirect("/login");
  // sales/manager/admin saja yang punya menu ini; head_fitter & fitter tidak.
  if (me.role === "fitter" || me.role === "head_fitter") redirect("/board");
  const supabase = createClient();

  const { data: orders } = await supabase
    .from("orders")
    .select(`id, id_scalev, customer, status, created_at, sales:profiles!orders_sales_id_fkey ( name )`)
    .eq("status", "cancelled")
    .order("created_at", { ascending: false });

  const list = (orders as unknown as Order[]) ?? [];

  return (
    <PageScroll wide>
      <h1 className="font-serif text-2xl m-0 font-medium sr-only">Cancelled Order</h1>

      {list.length === 0 ? (
        <div className="py-[22px] text-center text-gray-500 text-sm border border-dashed border-line rounded-xl bg-creamcard">Belum ada order dibatalkan.</div>
      ) : null}

      <div className="flex flex-col gap-2">
        {list.map((o) => (
          <div key={o.id} className="bg-creamcard border border-line rounded-2xl px-4 py-3 flex justify-between items-center gap-2.5 flex-wrap">
            <div>
              <div className="text-sm font-bold">{o.id_scalev} · {o.customer}</div>
              <div className="text-[11px] text-gray-500">Sales {o.sales?.name}</div>
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: "#F3D9D6", color: STATUS.cancelled.col }}>
              Cancelled
            </span>
          </div>
        ))}
      </div>
      {me.role === "super_admin" ? (
        <div className="text-[11px] text-gray-400 mt-4">Untuk restore atau ubah tahap, gunakan menu Kelola Order.</div>
      ) : null}
    </PageScroll>
  );
}
