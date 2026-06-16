"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COLS_FULL, COLS_FITTER, COLS_HEAD_FITTER, STATUS, type OrderStatus } from "@/lib/constants";
import type { Order, Profile } from "@/lib/types";
import { Toast } from "@/components/ui";
import { PageScroll } from "@/components/ui/page-scroll";
import { NewOrderForm } from "@/components/board/new-order-form";
import { createOrders, type NewOrderRow } from "@/server/actions/orders";

export function Kanban({ me, orders }: {
  me: Profile; orders: Order[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState("");
  const cols: OrderStatus[] =
    me.role === "fitter" ? COLS_FITTER :
    me.role === "head_fitter" ? COLS_HEAD_FITTER : COLS_FULL;
  const canCreate = me.role === "sales" || me.role === "super_admin";

  function openOrder(o: Order) {
    if (o.status === "draft_sales") router.push(`/order/${o.id}?mode=draft`);
    else if (o.status === "invoice_draft" || o.status === "invoice_sent" || o.status === "done")
      router.push(`/invoice/${o.id}`);
    else router.push(`/order/${o.id}`);
  }

  async function handleCreate(rows: NewOrderRow[]) {
    const res = await createOrders(rows);
    if (res?.error) { setToast(res.error); return; }
    setShowForm(false);
    setToast(`${rows.length} order dibuat`);
    router.refresh();
  }

  if (showForm) {
    return (
      <PageScroll wide>
        <NewOrderForm onCancel={() => setShowForm(false)} onSubmit={handleCreate} />
      </PageScroll>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col px-4 lg:px-6 pt-4">
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden pb-4 kanban-scroll">
        <div className="flex gap-5 min-w-max h-full items-stretch">
          {cols.map((c) => {
            const items = orders.filter((o) => o.status === c);
            const isDraft = c === "draft_sales";
            return (
              <div key={c}
                className="w-[340px] shrink-0 h-full bg-[#F1EADA] border border-line rounded-2xl p-4 flex flex-col min-h-0">
                <div className="shrink-0 flex items-center gap-2.5 mb-4 pb-3 border-b border-line">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS[c].col }} />
                  <span className="text-[14.5px] font-bold flex-1">{STATUS[c].label}</span>
                  <span className="text-[12.5px] text-gray-500 bg-white rounded-full px-2.5 py-0.5 font-bold">{items.length}</span>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pr-0.5">
                  {items.map((o) => {
                    const fitterNames = (o.order_fitters ?? [])
                      .map((f) => f.profiles?.name).filter(Boolean).join(", ");
                    const pkg = o.model_count?.[0]?.count ?? 0;
                    return (
                      <button key={o.id} onClick={() => openOrder(o)}
                        className="kard relative text-left bg-white border border-line rounded-2xl p-4 cursor-pointer text-navy">
                        {o.status === "draft_sales" && o.sales_confirmed_at ? (
                          <span title="Sudah dikonfirmasi Sales"
                            className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-[#3F7A4F] text-white flex items-center justify-center text-[11px] font-bold">✓</span>
                        ) : null}
                        <div className="flex justify-between gap-2 items-center pr-6">
                          <span className="font-bold text-sm">{o.id_scalev}</span>
                          <span className="text-[10.5px] px-2.5 py-0.5 rounded-full font-bold"
                            style={{ background: o.tag === "repeat" ? "#F0E6D2" : "#E3ECF2" }}>
                            {o.tag === "repeat" ? "Repeat" : "Order"}
                          </span>
                        </div>
                        <div className="text-base my-1.5 font-semibold">{o.customer}</div>
                        {o.status === "fitter_work" && o.fitting_started_at ? (
                          <div className="inline-block text-[10.5px] font-bold bg-[#2F6F8F] text-white px-2 py-0.5 rounded-full mb-1">Fitting Berlangsung</div>
                        ) : null}
                        <div className="text-xs text-gray-500">Sales: {o.sales?.name}</div>
                        {fitterNames ? <div className="text-xs text-gray-500 mt-0.5">Fitter: {fitterNames}</div> : null}
                        {pkg > 0 ? <div className="text-xs text-gold mt-2 font-semibold">{pkg} paket</div> : null}
                      </button>
                    );
                  })}
                  {items.length === 0 ? (
                    <div className="text-[12.5px] text-gray-500 py-[18px] px-2.5 text-center border border-dashed border-line rounded-xl bg-white/50">
                      Belum ada order
                    </div>
                  ) : null}
                </div>

                {isDraft && canCreate ? (
                  <button onClick={() => setShowForm(true)}
                    className="add-order shrink-0 mt-3.5 w-full py-3 rounded-xl border border-dashed border-navy bg-white text-navy font-bold text-sm cursor-pointer">
                    + Order
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {toast ? <Toast message={toast} onDone={() => setToast("")} /> : null}
    </div>
  );
}
