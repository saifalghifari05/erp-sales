"use client";

import { useState } from "react";
import { Logo } from "@/components/ui/logo";
import { useRouter } from "next/navigation";
import type { Order, ModelPackage, Invoice, Profile } from "@/lib/types";
import { rupiah, digits, fmtTime, pktName, parseRupiahInput, formatRupiahInput } from "@/lib/format";
import { Button, Field, Modal, Confirm, inputClass, Toast } from "@/components/ui";
import {
  setPackagePrice, createInvoice, sendWhatsApp, reviseInvoice, markDone, resendPhotos,
} from "@/server/actions/invoice";

export function InvoiceView({ me, order, packages, invoice, siteUrl }: {
  me: Profile; order: Order; packages: ModelPackage[]; invoice: Invoice | null; siteUrl: string;
}) {
  const router = useRouter();
  const [toast, setToast] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [waModal, setWaModal] = useState(false);
  const [waNum, setWaNum] = useState(order.wa_number ?? "");
  const [revModal, setRevModal] = useState(false);
  const [reason, setReason] = useState("");
  const [newTotal, setNewTotal] = useState("");
  const [resendConfirm, setResendConfirm] = useState(false);
  const [resending, setResending] = useState(false);
  const [marking, setMarking] = useState(false);

  // harga per paket dikelola di state lokal (integer), diinisialisasi dari DB.
  const [prices, setPrices] = useState<Record<string, number>>(
    () => Object.fromEntries(packages.map((p) => [p.id, Number(p.price) || 0]))
  );

  const canPrice = me.role === "sales" || me.role === "super_admin";
  const total = packages.reduce((s, p) => s + (prices[p.id] || 0), 0);
  const allPriced = packages.length > 0 && packages.every((p) => (prices[p.id] || 0) > 0);
  const flash = (m: string) => setToast(m);
  const back = () => router.push("/board");

  async function onPriceChange(packageId: string, raw: string) {
    const val = parseRupiahInput(raw);
    setPrices((s) => ({ ...s, [packageId]: val }));   // update langsung → total & tombol reaktif
    await setPackagePrice(order.id, packageId, val);  // persist integer ke DB (tanpa refresh)
  }

  // =================== INVOICE DRAFT (verifikasi + harga) ===================
  if (order.status === "invoice_draft" && !invoice) {
    return (
      <div className="w-full max-w-[1600px]">
        <button onClick={back} className="text-gray-500 text-sm mb-2.5">← Kanban</button>
        <h1 className="font-serif text-2xl m-0 font-medium">Invoice Draft</h1>
        <div className="text-sm text-gray-500 mt-1 mb-4">
          {order.customer} · {order.id_scalev} · {canPrice ? "cek model, input harga, buat invoice" : "lihat progres"}
        </div>

        <div className="flex flex-col gap-2.5">
          {packages.map((p) => {
            const isOpen = open === p.id;
            return (
              <div key={p.id} className="bg-creamcard border border-line rounded-2xl overflow-hidden">
                <button onClick={() => setOpen(isOpen ? null : p.id)}
                  className="w-full text-left bg-transparent px-4 py-3.5 flex justify-between items-center">
                  <div>
                    <div className="font-bold">{pktName(p)}</div>
                    <div className="text-xs text-gray-500">oleh {p.input_profile?.name} ({p.input_role}) · {fmtTime(p.created_at)}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold" style={{ color: (prices[p.id] || 0) > 0 ? "#0B1F3A" : "#6B7280" }}>
                      {(prices[p.id] || 0) > 0 ? rupiah(prices[p.id]) : "belum ada harga"}
                    </span>
                    <span className="text-gray-500">{isOpen ? "▲" : "▼"}</span>
                  </div>
                </button>
                {isOpen ? (
                  <div className="px-4 pb-4 border-t border-line">
                    <div className="grid gap-2 my-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))" }}>
                      {([["Cutting", p.cutting], ["Jenis kain", p.fabric], ["Warna", p.color], ["Collar", p.collar],
                        ["Bottom Placket", p.bottom_placket], ["Front Placket", p.front_placket], ["Pocket", p.pocket],
                        ["Sleeve", p.sleeve_cuff], ["Accessories", p.accessories], ["Add On", p.add_on], ["Cufflink", p.cufflink]] as [string, string | null][])
                        .map(([k, val]) => (
                          <div key={k}>
                            <div className="text-[10px] text-gray-500 uppercase">{k}</div>
                            <div className="text-sm">{val || "—"}</div>
                          </div>
                        ))}
                    </div>
                    {p.note ? <div className="text-sm text-gray-500 mb-2.5">Catatan: {p.note}</div> : null}
                    {canPrice ? (
                      <Field label="Harga paket (Rp)">
                        <input className={inputClass} inputMode="numeric"
                          value={formatRupiahInput(prices[p.id] || 0)}
                          onChange={(e) => onPriceChange(p.id, e.target.value)}
                          placeholder="0" />
                        {(prices[p.id] || 0) > 0 ? <div className="text-xs text-gold mt-1">{rupiah(prices[p.id])}</div> : null}
                      </Field>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="bg-creamcard border border-line rounded-2xl mt-3.5 p-4 flex justify-between items-center">
          <span className="font-semibold">Total</span>
          <span className="font-extrabold text-lg">{rupiah(total)}</span>
        </div>

        {canPrice ? (
          <div className="flex justify-end mt-3">
            <Button disabled={!allPriced}
              onClick={async () => { const r = await createInvoice(order.id, prices); if (r?.error) flash(r.error); else router.refresh(); }}>
              Buat Invoice
            </Button>
          </div>
        ) : <div className="mt-3 text-sm text-gray-500">Mode lihat — menunggu sales membuat invoice.</div>}
        {!allPriced && canPrice ? <div className="text-danger text-xs mt-2">Semua paket harus punya harga sebelum invoice dibuat.</div> : null}
        {toast ? <Toast message={toast} onDone={() => setToast("")} /> : null}
      </div>
    );
  }

  // =================== INVOICE (sudah dibuat) ===================
  if (!invoice) {
    return <div><button onClick={back} className="text-gray-500 text-sm">← Kanban</button>
      <div className="mt-3 text-gray-500 text-sm">Invoice belum dibuat.</div></div>;
  }

  const number = invoice.number_active || invoice.number;
  const link = `${siteUrl}/inv/${invoice.slug}`;

  async function sendNow(num: string) {
    setWaModal(false);
    const r = await sendWhatsApp(order.id, num);
    if (r?.error) { flash(r.error); return; }
    const msg = encodeURIComponent(
      `Assalamualaikum Bapak/Ibu, berikut invoice pesanan Tarda dengan ID Scalev ${order.id_scalev}.\n\n` +
      `Total invoice: ${rupiah(invoice!.total)}\nLink invoice: ${link}\n\nTerima kasih.`
    );
    window.open(`https://wa.me/${num.replace(/\D/g, "")}?text=${msg}`, "_blank");
    router.refresh();
  }

  function copyLink() {
    try {
      navigator.clipboard?.writeText(link);
    } catch { /* sandbox */ }
    flash("Link invoice berhasil disalin");
  }

  return (
    <div>
      <button onClick={back} className="text-gray-500 text-sm mb-2.5 no-print">← Kanban</button>

      <div className="bg-white border border-line rounded-2xl p-6 max-w-[640px]">
        <div className="flex justify-between items-start border-b-2 border-navy pb-4 mb-4">
          <div className="flex gap-3 items-center">
            <Logo size={48} withWordmark={false} dark />
            <div><div className="font-serif text-xl">Tarda Tailor</div><div className="text-[11px] text-gray-500 tracking-wider">Custom Luxury Thobe</div></div>
          </div>
          <div className="text-right">
            <div className="text-lg font-extrabold">INVOICE</div>
            <div className="text-sm text-gold font-bold">{number}</div>
            <div className="text-[11px] text-gray-500">{new Date(invoice.created_at).toLocaleDateString("id-ID")}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5 mb-4 text-sm">
          <div><span className="text-gray-500">Customer</span><div className="font-semibold">{order.customer}</div></div>
          <div><span className="text-gray-500">ID Scalev</span><div className="font-semibold">{order.id_scalev}</div></div>
          <div><span className="text-gray-500">Sales</span><div className="font-semibold">{order.sales?.name}</div></div>
        </div>
        <table className="w-full border-collapse text-sm">
          <thead><tr className="border-b border-line text-left text-gray-500">
            <th className="py-1.5 font-semibold">Paket</th><th className="text-right font-semibold">Harga</th></tr></thead>
          <tbody>{packages.map((p) => (
            <tr key={p.id} className="border-b border-line">
              <td className="py-2">{pktName(p)}</td><td className="text-right">{rupiah(p.price)}</td>
            </tr>
          ))}</tbody>
          <tfoot><tr><td className="py-3 font-extrabold">Total</td>
            <td className="text-right font-extrabold text-base">{rupiah(invoice.total)}</td></tr></tfoot>
        </table>
        {invoice.invoice_revisions && invoice.invoice_revisions.length > 0 ? (
          <div className="mt-3.5 border-t border-line pt-2.5">
            <div className="text-xs font-bold mb-1.5">Riwayat revisi</div>
            {invoice.invoice_revisions.map((r) => (
              <div key={r.id} className="text-[11px] text-gray-500">R{r.rev}: {rupiah(r.old_total)} → {rupiah(r.new_total)} · {r.reason}</div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex gap-2.5 flex-wrap mt-4 no-print">
        <Button variant="ghost" onClick={copyLink}>Copy Link Invoice</Button>
        <Button variant="ghost" onClick={() => window.print()}>Cetak / PDF</Button>
        {me.role === "super_admin" ? (
          <Button variant="ghost" onClick={() => setResendConfirm(true)} disabled={resending}>
            {resending ? "Mengirim foto…" : "Kirim ulang foto"}
          </Button>
        ) : null}

        {/* Aksi aktif HANYA jika order belum selesai (done = arsip final) */}
        {order.status !== "done" ? (
          <>
            {(me.role === "sales" || me.role === "super_admin") && !invoice.sent ? (
              <Button onClick={() => (order.wa_number ? sendNow(order.wa_number) : setWaModal(true))}>Kirim WhatsApp</Button>
            ) : null}
            {invoice.sent ? (
              <span className="bg-[#E3F0E7] text-[#2E6B43] px-3.5 py-2 rounded-[10px] text-xs font-semibold self-center">
                Terkirim ke {invoice.sent_to}
              </span>
            ) : null}
            {invoice.sent && (me.role === "sales" || me.role === "super_admin") ? (
              <Button variant="ghost" onClick={() => { setNewTotal(String(invoice.total)); setRevModal(true); }}>Revisi Harga</Button>
            ) : null}
            {invoice.sent && (me.role === "sales" || me.role === "super_admin") ? (
              <Button disabled={marking} onClick={async () => {
                if (marking) return;
                setMarking(true);
                const r = await markDone(order.id);
                if (r?.error) { setMarking(false); flash(r.error); }
                else { router.push("/board"); router.refresh(); }
              }}>
                {marking ? "Memproses…" : "Tandai Selesai"}
              </Button>
            ) : null}
          </>
        ) : (
          <span className="bg-[#E8E4D8] text-gray-600 px-3.5 py-2 rounded-[10px] text-xs font-semibold self-center">
            Order selesai (arsip)
          </span>
        )}
      </div>

      {waModal ? (
        <Modal title="Nomor WhatsApp customer" onClose={() => setWaModal(false)}>
          <Field label="Nomor (cth. 0812xxxx)">
            <input className={inputClass} value={waNum} onChange={(e) => setWaNum(e.target.value)} autoFocus />
          </Field>
          <Button className="w-full mt-3" disabled={!waNum.trim()} onClick={() => sendNow(waNum)}>Buka WhatsApp</Button>
        </Modal>
      ) : null}

      {revModal ? (
        <Modal title="Revisi invoice" onClose={() => setRevModal(false)}>
          <div className="mb-[18px]">
            <Field label="Total baru (Rp)">
              <input className={inputClass} inputMode="numeric"
                value={newTotal ? Number(newTotal).toLocaleString("id-ID") : ""}
                onChange={(e) => setNewTotal(digits(e.target.value))} placeholder="0" />
              {Number(newTotal) > 0 ? <div className="text-xs text-gold mt-1.5">{rupiah(newTotal)}</div> : null}
            </Field>
          </div>
          <div className="mb-[22px]">
            <Field label="Alasan revisi (wajib)">
              <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="cth. tambah 1 paket" />
              {!reason.trim() ? <div className="text-danger text-xs mt-1.5">Alasan revisi wajib diisi.</div> : null}
            </Field>
          </div>
          <Button className="w-full" disabled={!reason.trim()}
            onClick={async () => {
              if (!reason.trim()) return;
              const r = await reviseInvoice(order.id, Number(newTotal), reason.trim());
              if (r?.error) flash(r.error); else { setRevModal(false); setReason(""); router.refresh(); }
            }}>
            Simpan revisi
          </Button>
        </Modal>
      ) : null}

      {resendConfirm ? (
        <Confirm title="Kirim ulang foto ke Telegram?"
          message="Ini akan mengirim ulang SEMUA foto pemakai pada order ini (dengan nama pemakai, sebagai album). Foto yang sudah pernah masuk bisa terkirim dua kali. Lanjutkan?"
          cancelLabel="Batal" confirmLabel="Ya, Kirim Ulang"
          onCancel={() => setResendConfirm(false)}
          onConfirm={async () => {
            setResendConfirm(false); setResending(true);
            const r = await resendPhotos(order.id);
            setResending(false);
            flash(r?.error ? r.error : "Foto dikirim ke Telegram.");
          }} />
      ) : null}

      {toast ? <Toast message={toast} onDone={() => setToast("")} /> : null}
    </div>
  );
}
