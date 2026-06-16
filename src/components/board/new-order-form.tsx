"use client";

import { useState } from "react";
import { Button, Field, Confirm, inputClass } from "@/components/ui";
import type { NewOrderRow } from "@/server/actions/orders";

interface Row {
  key: string; customer: string; id_scalev: string;
  tag: "order" | "repeat"; need_fitter: boolean;
  wa_number: string; fitting_date: string; fitting_time: string;
}
const blank = (): Row => ({
  key: Math.random().toString(36).slice(2), customer: "", id_scalev: "",
  tag: "order", need_fitter: false,
  wa_number: "", fitting_date: "", fitting_time: "",
});

export function NewOrderForm({ onCancel, onSubmit }: {
  onCancel: () => void;
  onSubmit: (rows: NewOrderRow[]) => void;
}) {
  const [rows, setRows] = useState<Row[]>([blank()]);
  const [confirm, setConfirm] = useState(false);

  const upd = (i: number, patch: Partial<Row>) =>
    setRows((R) => R.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  function rowError(r: Row): string | null {
    if (!r.customer.trim()) return "Nama customer wajib";
    if (!r.id_scalev.trim()) return "ID Scalev wajib";
    const needF = r.tag === "order" || (r.tag === "repeat" && r.need_fitter);
    if (needF && !r.fitting_date) return "Tanggal fitting wajib";
    if (needF && !r.fitting_time) return "Jam fitting wajib";
    return null;
  }
  const ids = rows.map((r) => r.id_scalev.trim());
  const dup = ids.find((v, i) => v && ids.indexOf(v) !== i);
  const valid = rows.every((r) => !rowError(r)) && !dup;

  function submit() {
    onSubmit(rows.map((r) => {
      const needF = r.tag === "order" || (r.tag === "repeat" && r.need_fitter);
      return {
        customer: r.customer.trim(), id_scalev: r.id_scalev.trim(), tag: r.tag,
        need_fitter: r.need_fitter,
        wa_number: r.wa_number.trim() || undefined,
        fitting_date: needF ? r.fitting_date : undefined,
        fitting_time: needF ? r.fitting_time : undefined,
        fitting_duration_minutes: 60,
      };
    }));
  }

  return (
    <div>
      <button onClick={onCancel} className="text-gray-500 text-sm mb-2.5">← Kanban</button>
      <h1 className="font-serif text-2xl m-0 mb-4 font-medium">Input Order</h1>

      <div className="flex flex-col gap-3">
        {rows.map((r, i) => {
          const needF = r.tag === "order" || (r.tag === "repeat" && r.need_fitter);
          const err = rowError(r);
          return (
            <div key={r.key} className="bg-creamcard border border-line rounded-2xl p-4">
              <div className="flex justify-between mb-2.5">
                <span className="text-xs text-gray-500 font-semibold">Order #{i + 1}</span>
                {rows.length > 1 ? (
                  <button onClick={() => setRows((R) => R.filter((_, x) => x !== i))}
                    className="bg-danger text-white rounded-lg px-3 py-1.5 text-xs font-bold">Hapus baris</button>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="Nama customer">
                  <input className={inputClass} value={r.customer}
                    onChange={(e) => upd(i, { customer: e.target.value })} placeholder="cth. Bpk. Ahmad" />
                </Field>
                <Field label="ID Scalev (unik)">
                  <input className={inputClass} value={r.id_scalev}
                    onChange={(e) => upd(i, { id_scalev: e.target.value })} placeholder="cth. 1289371298" />
                </Field>
                <Field label="Tag order">
                  <select className={inputClass} value={r.tag}
                    onChange={(e) => upd(i, { tag: e.target.value as Row["tag"], need_fitter: false })}>
                    <option value="order">Order</option>
                    <option value="repeat">Repeat Order</option>
                  </select>
                </Field>
                {r.tag === "repeat" ? (
                  <Field label="Perlu fitter ulang?">
                    <select className={inputClass} value={r.need_fitter ? "y" : "n"}
                      onChange={(e) => upd(i, { need_fitter: e.target.value === "y" })}>
                      <option value="n">Tidak — sales input model</option>
                      <option value="y">Ya — perlu fitter</option>
                    </select>
                  </Field>
                ) : null}
              </div>

              <Field label="Nomor WhatsApp customer (opsional)">
                <input className={inputClass} value={r.wa_number}
                  onChange={(e) => upd(i, { wa_number: e.target.value })} placeholder="cth. 0812xxxxxxx" />
              </Field>

              {needF ? (
                <>
                  <div className="grid grid-cols-2 gap-2.5">
                    <Field label="Tanggal fitting">
                      <input type="date" className={inputClass} value={r.fitting_date}
                        onChange={(e) => upd(i, { fitting_date: e.target.value })} />
                    </Field>
                    <Field label="Jam mulai fitting">
                      <input type="time" className={inputClass} value={r.fitting_time}
                        onChange={(e) => upd(i, { fitting_time: e.target.value })} />
                    </Field>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">Durasi fitting: 60 menit. Fitter dipilih oleh Kepala Fitter setelah order dikonfirmasi.</div>
                </>
              ) : null}
              {err ? <div className="text-danger text-xs mt-1.5">{err}</div> : null}
            </div>
          );
        })}
      </div>

      {dup ? <div className="text-danger text-xs mt-2.5">ID Scalev &quot;{dup}&quot; duplikat antar baris.</div> : null}

      <div className="flex gap-2.5 mt-3.5">
        <Button variant="ghost" onClick={() => setRows((R) => [...R, blank()])}>+ Tambah baris</Button>
        <Button onClick={() => valid && setConfirm(true)} disabled={!valid}>
          Simpan {rows.length > 1 ? `${rows.length} order` : "order"}
        </Button>
      </div>

      {confirm ? (
        <Confirm title="Apakah data order sudah benar?"
          message={`Akan menyimpan ${rows.length} order ke Draft Sales.`}
          cancelLabel="Kembali" confirmLabel="Ya, Simpan"
          onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); submit(); }} />
      ) : null}
    </div>
  );
}
