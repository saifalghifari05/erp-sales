import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/server/auth";
import { redirect } from "next/navigation";
import { PageScroll } from "@/components/ui/page-scroll";
import { fmtFittingRange } from "@/lib/format";

export const dynamic = "force-dynamic";

interface Sched {
  fitter_name?: string;
  fitters?: string;
  customer?: string;
  id_scalev?: string;
  sales_name?: string;
  fitting_start_at: string;
  fitting_end_at: string;
}

export default async function JadwalPage() {
  const me = await getSessionProfile();
  if (!me) redirect("/login");
  const supabase = createClient();
  const { data } = await supabase.rpc("fitting_schedules");
  const list = (data as Sched[]) ?? [];

  return (
    <PageScroll wide>
      <h1 className="font-serif text-2xl m-0 font-medium">Jadwal Fitting</h1>
      <div className="text-sm text-gray-500 mt-1 mb-4">
        {me.role === "sales" ? "Jadwal dari order milikmu." :
         me.role === "fitter" ? "Seluruh jadwal fitting semua fitter." : "Semua jadwal fitting."}
      </div>

      {list.length === 0 ? (
        <div className="py-[22px] text-center text-gray-500 text-sm border border-dashed border-line rounded-xl bg-creamcard">Belum ada jadwal.</div>
      ) : null}

      <div className="flex flex-col gap-2">
        {list.map((s, i) => (
          <div key={i} className="bg-creamcard border border-line rounded-2xl px-4 py-3 flex justify-between items-center gap-3 flex-wrap">
            <div>
              {me.role === "fitter" ? (
                <div className="text-sm font-bold">{s.fitter_name}</div>
              ) : (
                <div className="text-sm font-bold">
                  {s.fitters || "-"}
                  {me.role === "super_admin" && s.customer ? <span className="text-gray-400 font-normal"> · {s.customer} ({s.id_scalev})</span> : null}
                </div>
              )}
              {me.role === "super_admin" && s.sales_name ? <div className="text-[11px] text-gray-500">Sales: {s.sales_name}</div> : null}
            </div>
            <div className="text-sm text-navy font-semibold">{fmtFittingRange(s.fitting_start_at, s.fitting_end_at)}</div>
          </div>
        ))}
      </div>
    </PageScroll>
  );
}
