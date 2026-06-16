import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/server/auth";
import { redirect } from "next/navigation";
import { STATUS } from "@/lib/constants";
import { PageScroll } from "@/components/ui/page-scroll";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const me = await getSessionProfile();
  if (!me || (me.role !== "super_admin" && me.role !== "manager")) redirect("/board");
  const supabase = createClient();

  const { data: orders } = await supabase.from("orders").select("status, created_at");
  const list = orders ?? [];
  const today = new Date().toDateString();
  const month = new Date().getMonth();
  const c = (f: (o: { status: string; created_at: string }) => boolean) => list.filter(f).length;

  const headline = [
    ["Order hari ini", c((o) => new Date(o.created_at).toDateString() === today), false],
    ["Order bulan ini", c((o) => new Date(o.created_at).getMonth() === month), false],
    ["Order aktif berjalan", c((o) => o.status !== "cancelled" && o.status !== "done"), true],
  ] as const;

  const pipeline = [
    ["Draft Sales", c((o) => o.status === "draft_sales"), STATUS.draft_sales.col],
    ["Pekerjaan Fitter", c((o) => o.status === "fitter_work"), STATUS.fitter_work.col],
    ["Input Model Sales", c((o) => o.status === "sales_model_input"), STATUS.sales_model_input.col],
  ] as const;

  const invoice = [
    ["Invoice Draft", c((o) => o.status === "invoice_draft"), STATUS.invoice_draft.col],
    ["Invoice Terkirim", c((o) => o.status === "invoice_sent"), STATUS.invoice_sent.col],
    ["Selesai", c((o) => o.status === "done"), STATUS.done.col],
    ["Cancelled", c((o) => o.status === "cancelled"), STATUS.cancelled.col],
  ] as const;

  return (
    <PageScroll wide>
      <h1 className="font-serif text-2xl m-0 font-medium sr-only">Dashboard</h1>

      <div className="grid gap-3.5 mb-7" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))" }}>
        {headline.map(([label, value, gold]) => (
          <div key={label} className="bg-navy text-cream rounded-2xl px-5 py-5">
            <div className="font-serif font-extrabold leading-none text-[40px]" style={{ color: gold ? "#B08642" : "#F7F3EA" }}>{value}</div>
            <div className="text-[12.5px] mt-2 opacity-85">{label}</div>
          </div>
        ))}
      </div>

      <Group title="Ringkasan Order" items={pipeline as unknown as [string, number, string][]} />
      <div className="h-6" />
      <Group title="Ringkasan Invoice & Penyelesaian" items={invoice as unknown as [string, number, string][]} />
    </PageScroll>
  );
}

function Group({ title, items }: { title: string; items: [string, number, string][] }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-gold font-bold mb-3">{title}</div>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))" }}>
        {items.map(([label, value, col]) => (
          <div key={label} className="bg-creamcard border border-line rounded-2xl p-[18px] flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: col }} />
              <span className="text-[12.5px] text-gray-500 font-semibold">{label}</span>
            </div>
            <div className="text-[32px] font-extrabold font-serif">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
