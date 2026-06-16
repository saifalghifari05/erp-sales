"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Order, Profile, OrderPerson } from "@/lib/types";
import { fmtFittingRange } from "@/lib/format";
import { Button, Confirm, Toast, Modal, Field, inputClass } from "@/components/ui";
import { PersonFittingManager } from "@/components/order/person-fitting-manager";
import { confirmOrder, assignFitters, cancelDraft } from "@/server/actions/orders";
import { finishModel, startFitting } from "@/server/actions/model";

interface PersonData {
  person: OrderPerson;
  measurement: Record<string, unknown> | null;
  model: Record<string, unknown> | null;
  photos: { id: string; public_url: string | null }[];
}

export function OrderDetail({ me, order, master, fitters, peopleData, catalogs }: {
  me: Profile; order: Order; master: Record<string, string[]>;
  fitters: { id: string; name: string }[];
  peopleData: PersonData[];
  catalogs: { id: string; name: string; storage_path: string }[];
}) {
  const router = useRouter();
  const [toast, setToast] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmSales, setConfirmSales] = useState(false);
  const [assignSel, setAssignSel] = useState<string[]>([]);
  const [overrideReason, setOverrideReason] = useState("");
  const [showOverride, setShowOverride] = useState(false);
  const [fittingStarted, setFittingStarted] = useState<boolean>(!!order.fitting_started_at);

  const back = () => router.push("/board");
  const flash = (m: string) => setToast(m);
  const isAdmin = me.role === "super_admin";
  const isHeadFitter = me.role === "head_fitter";
  const fitterNames = (order.order_fitters ?? []).map((f) => f.profiles?.name).filter(Boolean).join(", ");

  function Row({ k, v }: { k: string; v: string }) {
    return <div className="flex justify-between py-2 border-b border-line text-sm"><span className="text-gray-500">{k}</span><span className="font-semibold">{v}</span></div>;
  }

  // ============ DRAFT SALES ============
  if (order.status === "draft_sales") {
    const confirmed = !!order.sales_confirmed_at;
    const toFitter = order.next_stage === "fitter_work";
    const canSalesConfirm = (me.role === "sales" && order.sales_id === me.id) || isAdmin;
    const canAssign = (isHeadFitter || isAdmin) && confirmed && toFitter;

    return (
      <div>
        <button onClick={back} className="text-gray-500 text-sm mb-2.5">← Kanban</button>
        <h1 className="font-serif text-2xl m-0 font-medium">{order.customer}</h1>
        <div className="text-sm text-gray-500 mt-1 mb-4">{order.id_scalev} · {order.tag === "repeat" ? "Repeat Order" : "Order"} · Draft Sales{confirmed ? " · sudah dikonfirmasi" : ""}</div>

        <div className="bg-creamcard border border-line rounded-2xl p-4">
          <Row k="Customer" v={order.customer} />
          <Row k="ID Scalev" v={order.id_scalev} />
          <Row k="Tag" v={order.tag === "repeat" ? "Repeat Order" : "Order"} />
          {order.tag === "repeat" ? <Row k="Perlu fitter ulang" v={order.need_fitter ? "Ya" : "Tidak"} /> : null}
          {order.wa_number ? <Row k="WhatsApp" v={order.wa_number} /> : null}
          {order.fitting_start_at ? <Row k="Jadwal fitting" v={fmtFittingRange(order.fitting_start_at, order.fitting_end_at)} /> : null}
          {fitterNames ? <Row k="Fitter ter-assign" v={fitterNames} /> : null}
        </div>

        {canSalesConfirm && !confirmed ? (
          <div className="mt-4 flex justify-between gap-2.5 flex-wrap">
            <Button variant="danger" onClick={() => setConfirmCancel(true)}>Batalkan Draft</Button>
            <Button onClick={() => setConfirmSales(true)}>Konfirmasi Order</Button>
          </div>
        ) : null}
        {confirmed && !canAssign ? (
          <div className="mt-3.5 text-sm text-gray-500">{toFitter ? "Menunggu Kepala Fitter memilih fitter." : "Menunggu input model sales."}</div>
        ) : null}

        {canAssign ? (
          <div className="mt-5 bg-creamcard border border-line rounded-2xl p-4">
            <div className="font-bold text-sm mb-2">Pilih fitter untuk order ini</div>
            <div className="flex gap-2 flex-wrap mb-3">
              {fitters.map((f) => {
                const on = assignSel.includes(f.id);
                return (
                  <button key={f.id} onClick={() => setAssignSel((s) => on ? s.filter((x) => x !== f.id) : [...s, f.id])}
                    className="px-3 py-1.5 rounded-full text-sm font-semibold border"
                    style={{ background: on ? "#0B1F3A" : "#fff", color: on ? "#F7F3EA" : "#0B1F3A", borderColor: on ? "#0B1F3A" : "#E3DCCB" }}>
                    {f.name}
                  </button>
                );
              })}
            </div>
            <Button disabled={assignSel.length === 0} onClick={async () => {
              const r = await assignFitters(order.id, assignSel);
              if (r?.conflict) { setShowOverride(true); flash(r.conflict); return; }
              if (r?.error) { flash(r.error); return; }
              router.push("/board"); router.refresh();
            }}>Assign &amp; Kirim ke Fitter</Button>
            {showOverride && isAdmin ? (
              <div className="mt-3">
                <Field label="Alasan override bentrok (Super Admin)">
                  <input className={inputClass} value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="cth. kebutuhan khusus" />
                </Field>
                <Button className="mt-2" disabled={!overrideReason.trim()} onClick={async () => {
                  const r = await assignFitters(order.id, assignSel, overrideReason.trim());
                  if (r?.error) { flash(r.error); return; }
                  router.push("/board"); router.refresh();
                }}>Override &amp; Assign</Button>
              </div>
            ) : null}
          </div>
        ) : null}
        {isHeadFitter && !confirmed ? <div className="mt-4 text-sm text-gray-500">Order belum dikonfirmasi Sales.</div> : null}

        {confirmSales ? (
          <Confirm title="Konfirmasi Order"
            message="Pastikan data order sudah benar. Setelah dikonfirmasi, order akan menunggu assign fitter dari Kepala Fitter."
            cancelLabel="Kembali" confirmLabel="Ya, Konfirmasi"
            onCancel={() => setConfirmSales(false)}
            onConfirm={async () => { setConfirmSales(false); const r = await confirmOrder(order.id); if (r?.error) flash(r.error); else { router.push("/board"); router.refresh(); } }} />
        ) : null}
        {confirmCancel ? (
          <Confirm title="Yakin ingin membatalkan draft ini?" message="Draft akan dipindahkan ke status Cancelled. Data tetap tersimpan."
            cancelLabel="Batal" confirmLabel="Ya, Batalkan Draft" danger
            onCancel={() => setConfirmCancel(false)}
            onConfirm={async () => { setConfirmCancel(false); const r = await cancelDraft(order.id); if (r?.error) flash(r.error); else { router.push("/board"); router.refresh(); } }} />
        ) : null}
        {toast ? <Toast message={toast} onDone={() => setToast("")} /> : null}
      </div>
    );
  }

  // ============ FITTER FLOW ============
  const isFitterFlow = order.status === "fitter_work" && (me.role === "fitter" || isAdmin);
  const canEditPeople = isFitterFlow; // edit hanya saat fitter_work

  // GATE Mulai Fitting
  if (isFitterFlow && !fittingStarted) {
    return (
      <div>
        <button onClick={back} className="text-gray-500 text-sm mb-2.5">← Kanban</button>
        <h1 className="font-serif text-2xl m-0 font-medium">{order.customer}</h1>
        <div className="text-sm text-gray-500 mt-1 mb-4">{order.id_scalev} · Pekerjaan Fitter</div>
        <div className="bg-creamcard border border-line rounded-2xl p-5 max-w-[520px]">
          <Row k="ID Scalev" v={order.id_scalev} />
          <Row k="Customer" v={order.customer} />
          {order.fitting_start_at ? <Row k="Jadwal fitting" v={fmtFittingRange(order.fitting_start_at, order.fitting_end_at)} /> : null}
          <div className="mt-5">
            <Button className="w-full" onClick={async () => {
              const r = await startFitting(order.id);
              if (r?.error) { flash(r.error); return; }
              setFittingStarted(true); router.refresh();
            }}>Mulai Fitting</Button>
          </div>
        </div>
        {toast ? <Toast message={toast} onDone={() => setToast("")} /> : null}
      </div>
    );
  }

  // Daftar pemakai/paket (fitter sudah mulai, atau view utk admin/lainnya)
  const showBadge = order.status === "fitter_work" && fittingStarted;
  return (
    <div>
      <button onClick={back} className="text-gray-500 text-sm mb-2.5">← Kanban</button>
      <h1 className="font-serif text-2xl m-0 font-medium flex items-center gap-2">
        {order.customer}
        {showBadge ? <span className="text-[11px] font-bold bg-[#2F6F8F] text-white px-2 py-0.5 rounded-full">Fitting Berlangsung</span> : null}
      </h1>
      <div className="text-sm text-gray-500 mt-1 mb-4">{order.id_scalev} · {order.tag === "repeat" ? "Repeat Order" : "Order"} · Sales {order.sales?.name}</div>

      <PersonFittingManager
        orderId={order.id}
        people={peopleData}
        master={master}
        catalogs={catalogs}
        canEdit={canEditPeople}
        onFinish={async () => {
          const r = await finishModel(order.id);
          if (r?.error) flash(r.error); else { router.push("/board"); router.refresh(); }
        }}
      />
      {toast ? <Toast message={toast} onDone={() => setToast("")} /> : null}
    </div>
  );
}
