"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Order } from "@/lib/types";
import { STATUS, COLS_FULL, type OrderStatus } from "@/lib/constants";
import { fmtTime } from "@/lib/format";
import { Button, Confirm, Modal, Field, inputClass, Toast } from "@/components/ui";
import { cancelOrder, restoreOrder, changeStage } from "@/server/actions/orders";

export function ManageList({ orders }: { orders: Order[] }) {
  const router = useRouter();
  const [toast, setToast] = useState("");
  const [pending, setPending] = useState<{ order: Order; action: "cancel" | "restore" } | null>(null);
  const [stageFor, setStageFor] = useState<Order | null>(null);
  const [target, setTarget] = useState<OrderStatus>("draft_sales");
  const [reason, setReason] = useState("");
  const flash = (m: string) => setToast(m);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [date, setDate] = useState("");

  const fnames = (o: Order) => (o.order_fitters ?? []).map((f) => f.profiles?.name).filter(Boolean).join(", ");

  const filtered = useMemo(() => orders.filter((o) => {
    if (q && !(`${o.id_scalev} ${o.customer}`.toLowerCase().includes(q.toLowerCase()))) return false;
    if (status && o.status !== status) return false;
    if (date && !o.created_at.startsWith(date)) return false;
    return true;
  }), [orders, q, status, date]);

  return (
    <div className="flex-1 min-h-0 flex flex-col px-6 lg:px-10 pt-4">
      <div className="shrink-0 grid gap-2 mb-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}>
        <input className="px-3 py-2 border border-line rounded-lg text-sm bg-white" placeholder="Cari ID Scalev / customer"
          value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="px-3 py-2 border border-line rounded-lg text-sm bg-white" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Semua status</option>
          {[...COLS_FULL, "cancelled" as OrderStatus].map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
        </select>
        <input type="date" className="px-3 py-2 border border-line rounded-lg text-sm bg-white" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div className="flex-1 min-h-0 overflow-auto border border-line rounded-2xl bg-creamcard">
        <table className="w-full text-sm border-collapse min-w-[820px]">
          <thead className="sticky top-0 bg-[#EFE8D8] z-10">
            <tr className="text-left text-gray-600">
              <th className="px-4 py-2.5 font-semibold">ID Scalev</th>
              <th className="px-4 py-2.5 font-semibold">Customer</th>
              <th className="px-4 py-2.5 font-semibold">Sales</th>
              <th className="px-4 py-2.5 font-semibold">Fitter</th>
              <th className="px-4 py-2.5 font-semibold">Status</th>
              <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Tanggal</th>
              <th className="px-4 py-2.5 font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id} className="border-t border-line">
                <td className="px-4 py-2.5 font-semibold whitespace-nowrap">{o.id_scalev}</td>
                <td className="px-4 py-2.5">{o.customer}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">{o.sales?.name}</td>
                <td className="px-4 py-2.5 text-gray-500">{fnames(o) || "—"}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: STATUS[o.status].col }} />
                    {STATUS[o.status].label}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-[11px] text-gray-500 whitespace-nowrap">{fmtTime(o.created_at)}</td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-1.5">
                    <button onClick={() => { setStageFor(o); setTarget(o.status); setReason(""); }}
                      className="text-xs border border-line bg-white rounded-md px-2.5 py-1 font-semibold whitespace-nowrap">Ubah Tahap</button>
                    {o.status === "cancelled" ? (
                      <button onClick={() => setPending({ order: o, action: "restore" })}
                        className="text-xs border border-line bg-white rounded-md px-2.5 py-1 font-semibold">Restore</button>
                    ) : (
                      <button onClick={() => setPending({ order: o, action: "cancel" })}
                        className="text-xs bg-danger text-white rounded-md px-2.5 py-1 font-bold">Cancel</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Tidak ada order.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {pending ? (
        <Confirm
          title={pending.action === "cancel" ? "Yakin ingin membatalkan order ini?" : "Yakin ingin mengembalikan order ini?"}
          message={pending.action === "cancel"
            ? "Order ini akan dipindahkan ke status Cancelled. Data tetap tersimpan."
            : "Order ini akan dikembalikan ke proses aktif."}
          cancelLabel="Batal"
          confirmLabel={pending.action === "cancel" ? "Ya, Cancel Order" : "Ya, Restore Order"}
          danger={pending.action === "cancel"}
          onCancel={() => setPending(null)}
          onConfirm={async () => {
            const r = pending.action === "cancel" ? await cancelOrder(pending.order.id) : await restoreOrder(pending.order.id);
            setPending(null);
            if (r?.error) flash(r.error); else router.refresh();
          }} />
      ) : null}

      {stageFor ? (
        <Modal title={`Ubah Tahap — ${stageFor.id_scalev}`} onClose={() => setStageFor(null)}>
          <div className="mb-[18px]">
            <Field label="Status tujuan">
              <select className={inputClass} value={target} onChange={(e) => setTarget(e.target.value as OrderStatus)}>
                {[...COLS_FULL, "cancelled" as OrderStatus].map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
              </select>
            </Field>
          </div>
          <div className="mb-[22px]">
            <Field label="Alasan perubahan (wajib)">
              <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="cth. revisi data" />
              {!reason.trim() ? <div className="text-danger text-xs mt-1.5">Alasan perubahan wajib diisi.</div> : null}
            </Field>
          </div>
          <Button className="w-full" disabled={!reason.trim() || target === stageFor.status}
            onClick={async () => {
              const r = await changeStage(stageFor!.id, target, reason.trim());
              if (r?.error) flash(r.error); else { setStageFor(null); router.refresh(); }
            }}>
            Simpan perubahan tahap
          </Button>
          {target === stageFor.status ? <div className="text-xs text-gray-500 mt-2 text-center">Pilih status berbeda dari saat ini.</div> : null}
        </Modal>
      ) : null}

      {toast ? <Toast message={toast} onDone={() => setToast("")} /> : null}
    </div>
  );
}
