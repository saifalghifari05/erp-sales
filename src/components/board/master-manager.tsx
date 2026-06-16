"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MASTER_KEYS } from "@/lib/constants";
import { Button, inputClass, Toast, Confirm } from "@/components/ui";
import {
  addMasterOption, renameMasterOption, toggleMasterOption, deleteMasterOption,
} from "@/server/actions/master";
import { uploadCatalog, toggleCatalog, deleteCatalog, getCatalogUrl, type CatalogFile } from "@/server/actions/catalog";

type Opt = { id: string; category: string; label: string; active: boolean };
type FilterMode = "active" | "inactive" | "all";

const TABS = [...MASTER_KEYS, { key: "__catalog", label: "Katalog PDF" }];

export function MasterManager({ options, catalogs }: { options: Opt[]; catalogs: CatalogFile[] }) {
  const router = useRouter();
  const [toast, setToast] = useState("");
  const [active, setActive] = useState(MASTER_KEYS[0].key);
  const [filter, setFilter] = useState<FilterMode>("active");
  const [newLabel, setNewLabel] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [delOpt, setDelOpt] = useState<Opt | null>(null);
  const flash = (m: string) => setToast(m);

  const current = MASTER_KEYS.find((k) => k.key === active);
  const items = options
    .filter((o) => o.category === active)
    .filter((o) => (filter === "all" ? true : filter === "active" ? o.active : !o.active));

  async function add() {
    if (!newLabel.trim()) return;
    const r = await addMasterOption(active, newLabel);
    if (r?.error) flash(r.error);
    else { setNewLabel(""); router.refresh(); }
  }
  async function saveRename() {
    if (!editId) return;
    const r = await renameMasterOption(editId, editLabel);
    if (r?.error) flash(r.error);
    else { setEditId(null); setEditLabel(""); router.refresh(); }
  }
  async function confirmDelete() {
    if (!delOpt) return;
    const r = await deleteMasterOption(delOpt.id);
    setDelOpt(null);
    if (r?.error) { flash(r.error); return; }
    flash(r.archived ? "Data sudah pernah dipakai, jadi dipindahkan ke Nonaktif." : "Data berhasil dihapus.");
    router.refresh();
  }

  return (
    <div className="w-full max-w-[1600px]">
      <h1 className="font-serif text-2xl m-0 font-medium">Master Data</h1>
      <div className="text-sm text-gray-500 mt-1 mb-5">Pilih kategori di kiri, kelola opsinya di kanan.</div>

      <div className="flex gap-6 flex-col lg:flex-row">
        {/* Sidebar kategori */}
        <div className="lg:w-[240px] shrink-0">
          <div className="flex lg:flex-col gap-1.5 flex-wrap">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => { setActive(t.key); setEditId(null); }}
                className={`text-left text-sm font-semibold px-3.5 py-2.5 rounded-xl border transition ${
                  active === t.key ? "bg-navy text-cream border-navy" : "bg-creamcard text-navy border-line hover:border-navy"
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Panel kanan */}
        <div className="flex-1 min-w-0">
          {active === "__catalog" ? (
            <CatalogManager catalogs={catalogs} flash={flash} />
          ) : (
            <div className="bg-creamcard border border-line rounded-2xl p-5">
              <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
                <div className="font-bold">{current?.label}</div>
                <div className="flex gap-1 text-xs">
                  {(["active", "inactive", "all"] as FilterMode[]).map((f) => (
                    <button key={f} onClick={() => setFilter(f)}
                      className={`px-3 py-1.5 rounded-lg font-semibold border ${
                        filter === f ? "bg-navy text-cream border-navy" : "bg-white text-navy border-line"
                      }`}>
                      {f === "active" ? "Aktif" : f === "inactive" ? "Nonaktif" : "Semua"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tambah */}
              <div className="flex gap-2 mb-4">
                <input className={inputClass} value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") add(); }}
                  placeholder={`Tambah opsi ${current?.label.toLowerCase()}`} />
                <Button onClick={add}>Tambah</Button>
              </div>

              {/* List */}
              <div className="flex flex-col divide-y divide-line">
                {items.length === 0 ? (
                  <div className="text-sm text-gray-400 py-6 text-center">Tidak ada data pada filter ini.</div>
                ) : null}
                {items.map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-3 py-2.5">
                    {editId === o.id ? (
                      <input className={inputClass} value={editLabel} autoFocus
                        onChange={(e) => setEditLabel(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveRename(); }} />
                    ) : (
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-sm ${o.active ? "" : "text-gray-400 line-through"}`}>{o.label}</span>
                        {!o.active ? <span className="text-[10px] text-gray-400 border border-line rounded px-1.5 py-0.5">nonaktif</span> : null}
                      </div>
                    )}
                    <div className="flex gap-1.5 shrink-0">
                      {editId === o.id ? (
                        <>
                          <button onClick={saveRename} className="text-xs bg-navy text-cream rounded-md px-2.5 py-1 font-semibold">Simpan</button>
                          <button onClick={() => setEditId(null)} className="text-xs border border-line bg-white rounded-md px-2.5 py-1 font-semibold">Batal</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setEditId(o.id); setEditLabel(o.label); }}
                            className="text-xs border border-line bg-white rounded-md px-2.5 py-1 font-semibold">Edit</button>
                          <button onClick={async () => { const r = await toggleMasterOption(o.id, !o.active); if (r?.error) flash(r.error); else router.refresh(); }}
                            className="text-xs border border-line bg-white rounded-md px-2.5 py-1 font-semibold">
                            {o.active ? "Nonaktif" : "Aktifkan"}
                          </button>
                          <button onClick={() => setDelOpt(o)}
                            className="text-xs bg-danger text-white rounded-md px-2.5 py-1 font-bold">Hapus</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {delOpt ? (
        <Confirm title="Hapus opsi ini?"
          message={`"${delOpt.label}" akan dihapus. Jika sudah pernah dipakai di order, otomatis dipindahkan ke Nonaktif agar data lama aman.`}
          cancelLabel="Batal" confirmLabel="Ya, Hapus" danger
          onCancel={() => setDelOpt(null)} onConfirm={confirmDelete} />
      ) : null}

      {toast ? <Toast message={toast} onDone={() => setToast("")} /> : null}
    </div>
  );
}

function CatalogManager({ catalogs, flash }: { catalogs: CatalogFile[]; flash: (m: string) => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState<CatalogFile | null>(null);

  async function handleFile(file: File | null) {
    if (!file) return;
    if (file.type !== "application/pdf") { flash("File harus PDF."); return; }
    if (!name.trim()) { flash("Isi nama katalog dulu."); return; }
    setBusy(true);
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res((r.result as string).split(",")[1]);
        r.onerror = rej; r.readAsDataURL(file);
      });
      const r = await uploadCatalog(name.trim(), base64);
      if (r?.error) flash(r.error); else { setName(""); flash("Katalog terupload"); router.refresh(); }
    } catch { flash("Gagal memproses file."); }
    setBusy(false);
  }

  async function open(path: string) {
    const r = await getCatalogUrl(path);
    if (r?.error || !r?.url) { flash(r?.error ?? "Gagal membuka."); return; }
    window.open(r.url, "_blank");
  }

  return (
    <div className="bg-creamcard border border-line rounded-2xl p-5">
      <div className="font-bold mb-3">Katalog PDF</div>
      <div className="flex gap-2 items-end flex-wrap mb-4">
        <div className="flex-1 min-w-[200px]">
          <div className="text-xs text-gray-500 font-semibold mb-1">Nama katalog</div>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="cth. Katalog Collar 2026" />
        </div>
        <label className="px-3.5 py-2 rounded-[10px] bg-navy text-cream text-sm font-semibold cursor-pointer">
          {busy ? "Mengupload…" : "Upload PDF"}
          <input type="file" accept="application/pdf" hidden disabled={busy} onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
        </label>
      </div>

      {catalogs.length === 0 ? (
        <div className="py-6 text-center text-gray-500 text-sm border border-dashed border-line rounded-xl">Belum ada katalog.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {catalogs.map((c) => (
            <div key={c.id} className="flex justify-between items-center gap-2.5 border border-line rounded-xl px-3.5 py-2.5 bg-white flex-wrap">
              <div className="text-sm font-semibold">{c.name} {c.active ? "" : <span className="text-gray-400 font-normal">(nonaktif)</span>}</div>
              <div className="flex gap-1.5">
                <button onClick={() => open(c.storage_path)} className="text-xs border border-line bg-white rounded-md px-2.5 py-1 font-semibold">Lihat</button>
                <button onClick={async () => { const r = await toggleCatalog(c.id, !c.active); if (r?.error) flash(r.error); else router.refresh(); }}
                  className="text-xs border border-line bg-white rounded-md px-2.5 py-1 font-semibold">{c.active ? "Nonaktifkan" : "Aktifkan"}</button>
                <button onClick={() => setDel(c)} className="text-xs border border-line bg-white rounded-md px-2.5 py-1 font-semibold text-danger">Hapus</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="text-[11px] text-gray-400 mt-3">Katalog aktif bisa dilihat fitter saat input model. Katalog tidak tampil di invoice publik.</div>

      {del ? (
        <Confirm title={`Hapus katalog "${del.name}"?`} message="File PDF akan dihapus permanen." cancelLabel="Batal" confirmLabel="Ya, Hapus" danger
          onCancel={() => setDel(null)}
          onConfirm={async () => { const r = await deleteCatalog(del.id, del.storage_path); setDel(null); if (r?.error) flash(r.error); else router.refresh(); }} />
      ) : null}
    </div>
  );
}
