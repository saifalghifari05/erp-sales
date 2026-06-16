"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { OrderPerson } from "@/lib/types";
import { MEASUREMENT_FIELDS } from "@/lib/types";
import { Button, inputClass, Confirm, Toast } from "@/components/ui";
import { addPerson, deletePerson, savePersonMeasurement, savePersonModel, type PersonModelInput } from "@/server/actions/people";
import { uploadCustomerPhoto, deletePhoto } from "@/server/actions/model";

interface PersonData {
  person: OrderPerson;
  measurement: Record<string, unknown> | null;
  model: Record<string, unknown> | null;
  photos: { id: string; public_url: string | null }[];
}

const MODEL_FIELDS: { key: keyof PersonModelInput; label: string; cat?: string; manual?: boolean }[] = [
  { key: "cutting", label: "Cutting", cat: "cutting" },
  { key: "fabric", label: "Jenis Kain", cat: "fabric" },
  { key: "color", label: "Warna Kain", manual: true },
  { key: "collar", label: "Collar", cat: "collar" },
  { key: "bottom_placket", label: "Bottom of Placket", cat: "bottom_placket" },
  { key: "front_placket", label: "Front Placket", cat: "front_placket" },
  { key: "pocket", label: "Pocket", cat: "pocket" },
  { key: "sleeve_cuff", label: "Sleeve", cat: "sleeve_cuff" },
  { key: "accessories", label: "Accessories", cat: "accessories" },
  { key: "add_on", label: "Add On", cat: "add_on" },
  { key: "cufflink", label: "Cufflink", cat: "cufflink" },
];

// Registry flusher: tiap PersonCard mendaftarkan fungsi simpan-semua,
// dipanggil parent sebelum "Selesai Fitting" agar tak ada isian yang belum tersimpan.
const flushers = new Map<string, () => Promise<boolean>>();
function registerFlush(id: string, fn: () => Promise<boolean>) { flushers.set(id, fn); }
function unregisterFlush(id: string) { flushers.delete(id); }
async function flushAll(): Promise<boolean> {
  let ok = true;
  for (const fn of flushers.values()) { ok = (await fn()) && ok; }
  return ok;
}

async function compressImage(file: File) {
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl;
  });
  const maxSide = 1280;
  let { width, height } = img;
  if (width > height && width > maxSide) { height = Math.round(height * maxSide / width); width = maxSide; }
  else if (height > maxSide) { width = Math.round(width * maxSide / height); height = maxSide; }
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
  let mime = "image/webp"; let out = canvas.toDataURL(mime, 0.7);
  if (!out.startsWith("data:image/webp")) { mime = "image/jpeg"; out = canvas.toDataURL(mime, 0.7); }
  const base64 = out.split(",")[1];
  const name = file.name.replace(/\.[^.]+$/, "") + (mime === "image/webp" ? ".webp" : ".jpg");
  return { base64, mime, name, size: Math.round((base64.length * 3) / 4) };
}

export function PersonFittingManager({ orderId, people, master, catalogs, canEdit, onFinish }: {
  orderId: string;
  people: PersonData[];
  master: Record<string, string[]>;
  catalogs: { id: string; name: string; storage_path: string }[];
  canEdit: boolean;
  onFinish: () => void;
}) {
  const router = useRouter();
  const [toast, setToast] = useState("");
  const [newName, setNewName] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [delPerson, setDelPerson] = useState<OrderPerson | null>(null);
  const flash = (m: string) => setToast(m);

  async function openCatalog(path: string) {
    const { getCatalogUrl } = await import("@/server/actions/catalog");
    const r = await getCatalogUrl(path);
    if (r?.error || !r?.url) { flash(r?.error ?? "Gagal membuka katalog."); return; }
    window.open(r.url, "_blank");
  }

  async function add() {
    if (!newName.trim()) return;
    const r = await addPerson(orderId, newName);
    if (r?.error) { flash(r.error); return; }
    setNewName(""); router.refresh();
  }

  return (
    <div className="max-w-[1000px]">
      {catalogs.length > 0 ? (
        <div className="bg-creamcard border border-line rounded-2xl p-3 mb-4">
          <div className="text-[11px] uppercase tracking-wider text-gold font-bold mb-2">Katalog Referensi</div>
          <div className="flex gap-2 flex-wrap">
            {catalogs.map((c) => (
              <button key={c.id} onClick={() => openCatalog(c.storage_path)}
                className="text-xs border border-line bg-white rounded-lg px-3 py-1.5 font-semibold">📖 {c.name}</button>
            ))}
          </div>
        </div>
      ) : null}

      {canEdit ? (
        <div className="bg-creamcard border border-line rounded-2xl p-4 mb-4 flex gap-2 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="text-xs text-gray-500 font-semibold mb-1">Nama Pemakai</div>
            <input className={inputClass} value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder="cth. Firgha" />
          </div>
          <Button onClick={add}>+ Tambah Pemakai / Paket</Button>
        </div>
      ) : null}

      {people.length === 0 ? (
        <div className="py-6 text-center text-gray-500 text-sm border border-dashed border-line rounded-xl bg-creamcard">
          Belum ada pemakai. Tambahkan minimal satu.
        </div>
      ) : null}

      <div className="flex flex-col gap-2.5">
        {people.map((pd) => (
          <PersonCard key={pd.person.id} pd={pd} orderId={orderId} master={master} canEdit={canEdit}
            open={openId === pd.person.id} onToggle={() => setOpenId(openId === pd.person.id ? null : pd.person.id)}
            onDelete={() => setDelPerson(pd.person)} flash={flash} />
        ))}
      </div>

      {canEdit ? (
        <div className="mt-5 flex justify-end items-center gap-3">
          <span className="text-[11px] text-gray-400">Perubahan tersimpan otomatis</span>
          <Button disabled={people.length === 0} onClick={async () => {
            const ok = await flushAll();   // simpan semua isian yang belum tersimpan
            if (!ok) { flash("Sebagian data gagal tersimpan. Cek koneksi lalu coba lagi."); return; }
            onFinish();
          }}>Selesai Fitting → Invoice Draft</Button>
        </div>
      ) : null}

      {delPerson ? (
        <Confirm title={`Hapus pemakai "${delPerson.wearer_name}"?`}
          message="Ukuran, model, dan foto pemakai ini akan ikut terhapus."
          cancelLabel="Batal" confirmLabel="Ya, Hapus" danger
          onCancel={() => setDelPerson(null)}
          onConfirm={async () => {
            const r = await deletePerson(orderId, delPerson.id);
            setDelPerson(null);
            if (r?.error) flash(r.error); else router.refresh();
          }} />
      ) : null}

      {toast ? <Toast message={toast} onDone={() => setToast("")} /> : null}
    </div>
  );
}

function PersonCard({ pd, orderId, master, canEdit, open, onToggle, onDelete, flash }: {
  pd: PersonData; orderId: string; master: Record<string, string[]>; canEdit: boolean;
  open: boolean; onToggle: () => void; onDelete: () => void; flash: (m: string) => void;
}) {
  const router = useRouter();
  const m = pd.measurement;
  const md = pd.model;
  const hasMeasure = !!m;
  const hasModel = !!md;

  // state ukuran
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    MEASUREMENT_FIELDS.forEach((f) => { const v = m?.[f.key]; o[f.key] = v == null ? "" : String(v); });
    return o;
  });
  const [watch, setWatch] = useState<boolean>(!!m?.has_watch_note);
  const [ankle, setAnkle] = useState<boolean>(!!m?.has_ankle_note);
  const setV = (k: string, v: string) => { measDirty.current = true; setMeasStatus(""); setVals((s) => ({ ...s, [k]: v.replace(/[^0-9.]/g, "") })); };

  // state model
  const [mv, setMv] = useState<PersonModelInput>(() => ({
    cutting: (md?.cutting as string) ?? "", fabric: (md?.fabric as string) ?? "", color: (md?.color as string) ?? "",
    collar: (md?.collar as string) ?? "", bottom_placket: (md?.bottom_placket as string) ?? "",
    front_placket: (md?.front_placket as string) ?? "", pocket: (md?.pocket as string) ?? "",
    sleeve_cuff: (md?.sleeve_cuff as string) ?? "", accessories: (md?.accessories as string) ?? "",
    add_on: (md?.add_on as string) ?? "", cufflink: (md?.cufflink as string) ?? "", note: (md?.note as string) ?? "",
  }));
  const setM = (k: keyof PersonModelInput, v: string) => { modelDirty.current = true; setModelStatus(""); setMv((s) => ({ ...s, [k]: v })); };

  const [photos, setPhotos] = useState(pd.photos);
  const [uploading, setUploading] = useState(false);

  // status auto-save per bagian: "" | "saving" | "saved" | "error"
  const [measStatus, setMeasStatus] = useState<"" | "saving" | "saved" | "error">("");
  const [modelStatus, setModelStatus] = useState<"" | "saving" | "saved" | "error">("");
  const measDirty = useRef(false);
  const modelDirty = useRef(false);

  const allMeasure = MEASUREMENT_FIELDS.every((f) => vals[f.key] !== "");
  const modelOk = mv.cutting && mv.fabric && mv.color;

  // simpan ukuran (silent; dipakai on-blur & saat Selesai). hanya menyimpan jika ada perubahan / belum tersimpan.
  async function saveMeasure(opts?: { silent?: boolean }) {
    setMeasStatus("saving");
    const payload: Record<string, number | null> = {};
    MEASUREMENT_FIELDS.forEach((f) => { payload[f.key] = vals[f.key] === "" ? null : Number(vals[f.key]); });
    const r = await savePersonMeasurement(orderId, pd.person.id, payload, watch, ankle);
    if (r?.error) { setMeasStatus("error"); if (!opts?.silent) flash(r.error); return false; }
    measDirty.current = false; setMeasStatus("saved");
    return true;
  }
  async function saveModel(opts?: { silent?: boolean }) {
    setModelStatus("saving");
    const r = await savePersonModel(orderId, pd.person.id, pd.person.wearer_name, mv);
    if (r?.error) { setModelStatus("error"); if (!opts?.silent) flash(r.error); return false; }
    modelDirty.current = false; setModelStatus("saved");
    return true;
  }

  // on-blur: hanya simpan jika ada perubahan sejak terakhir tersimpan
  const blurMeasure = () => { if (canEdit && measDirty.current) saveMeasure({ silent: true }); };
  const blurModel = () => { if (canEdit && modelDirty.current) saveModel({ silent: true }); };

  // daftarkan flusher agar parent bisa memaksa simpan semua sebelum Selesai
  useEffect(() => {
    registerFlush(pd.person.id, async () => {
      let ok = true;
      if (measDirty.current) ok = (await saveMeasure({ silent: true })) && ok;
      if (modelDirty.current) ok = (await saveModel({ silent: true })) && ok;
      return ok;
    });
    return () => unregisterFlush(pd.person.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (photos.length + files.length > 5) { flash("Maksimal 5 foto per pemakai."); return; }
    setUploading(true);
    for (const file of Array.from(files)) {
      try {
        const c = await compressImage(file);
        const r = await uploadCustomerPhoto(orderId, {
          personId: pd.person.id, fileName: c.name, mimeType: c.mime, base64: c.base64, fileSize: c.size,
        });
        if (r?.error) { flash(r.error); continue; }
        if (r?.photo) setPhotos((prev) => [...prev, { id: (r.photo as { id: string }).id, public_url: (r.photo as { public_url: string | null }).public_url }]);
      } catch { flash("Gagal memproses foto."); }
    }
    setUploading(false);
  }
  async function removePhoto(id: string) {
    const r = await deletePhoto(orderId, id);
    if (r?.error) { flash(r.error); return; }
    setPhotos((prev) => prev.filter((x) => x.id !== id));
  }

  return (
    <div className="bg-creamcard border border-line rounded-2xl overflow-hidden">
      <button onClick={onToggle} className="w-full text-left px-4 py-3 flex justify-between items-center">
        <div>
          <div className="font-bold">{pd.person.wearer_name}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">
            Ukuran: {hasMeasure ? "sudah diisi" : "belum diisi"} · Model: {hasModel ? "sudah diisi" : "belum diisi"} · Foto: {photos.length}
          </div>
        </div>
        <span className="text-gray-400">{open ? "▲" : "▼"}</span>
      </button>

      {open ? (
        <div className="px-4 pb-4 border-t border-line">
          {/* UKURAN */}
          <div className="text-[11px] uppercase tracking-wider text-gold font-bold mt-3 mb-2">Ukuran Badan</div>
          <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))" }}>
            {MEASUREMENT_FIELDS.map((f) => (
              <label key={f.key} className="block">
                <div className="text-xs text-gray-500 font-semibold mb-1">{f.label}</div>
                <input className={inputClass} inputMode="decimal" value={vals[f.key]} disabled={!canEdit}
                  onChange={(e) => setV(f.key, e.target.value)} onBlur={blurMeasure} placeholder="0" />
                {f.key === "arm_circumference" ? (
                  <label className="flex items-center gap-1.5 mt-1 text-[11px] text-gray-600">
                    <input type="checkbox" checked={watch} disabled={!canEdit}
                      onChange={(e) => { measDirty.current = true; setWatch(e.target.checked); }} onBlur={blurMeasure} /> Jam Tangan
                  </label>
                ) : null}
                {f.key === "gamis_length" ? (
                  <label className="flex items-center gap-1.5 mt-1 text-[11px] text-gray-600">
                    <input type="checkbox" checked={ankle} disabled={!canEdit}
                      onChange={(e) => { measDirty.current = true; setAnkle(e.target.checked); }} onBlur={blurMeasure} /> Mata Kaki
                  </label>
                ) : null}
              </label>
            ))}
          </div>
          {canEdit ? (
            <div className="mt-2.5 flex items-center gap-2 text-xs">
              <SaveStatus status={measStatus} />
              {!allMeasure ? <span className="text-gray-400">· semua ukuran wajib diisi sebelum Selesai</span> : null}
            </div>
          ) : null}

          {/* MODEL */}
          <div className="text-[11px] uppercase tracking-wider text-gold font-bold mt-4 mb-2">Detail Model</div>
          <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))" }}>
            {MODEL_FIELDS.map((f) => (
              <label key={f.key} className="block">
                <div className="text-xs text-gray-500 font-semibold mb-1">{f.label}</div>
                {f.manual ? (
                  <input className={inputClass} value={mv[f.key]} disabled={!canEdit}
                    onChange={(e) => setM(f.key, e.target.value)} onBlur={blurModel} placeholder="Masukkan warna kain" />
                ) : (
                  <select className={inputClass} value={mv[f.key]} disabled={!canEdit}
                    onChange={(e) => setM(f.key, e.target.value)} onBlur={blurModel}>
                    <option value="">— pilih —</option>
                    {(master[f.cat!] ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                )}
              </label>
            ))}
          </div>
          <label className="block mt-2.5">
            <div className="text-xs text-gray-500 font-semibold mb-1">Catatan</div>
            <textarea className={inputClass} rows={2} value={mv.note} disabled={!canEdit}
              onChange={(e) => setM("note", e.target.value)} onBlur={blurModel} />
          </label>
          {canEdit ? (
            <div className="mt-2.5 flex items-center gap-2 text-xs">
              <SaveStatus status={modelStatus} />
              {!modelOk ? <span className="text-gray-400">· cutting, jenis kain, warna wajib</span> : null}
            </div>
          ) : null}

          {/* FOTO */}
          <div className="text-[11px] uppercase tracking-wider text-gold font-bold mt-4 mb-2">Foto Pemakai (maks 5)</div>
          <div className="flex gap-3 flex-wrap">
            {photos.map((p) => (
              <div key={p.id} className="relative w-24 h-24 rounded-xl overflow-hidden border border-line">
                {p.public_url ? <img src={p.public_url} alt="foto" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-line flex items-center justify-center text-[10px] text-gray-500">foto</div>}
                {canEdit ? <button onClick={() => removePhoto(p.id)} className="absolute top-1 right-1 bg-danger text-white rounded-full w-5 h-5 text-xs leading-none">×</button> : null}
              </div>
            ))}
            {canEdit && photos.length < 5 ? (
              <label className="w-24 h-24 rounded-xl border border-dashed border-line flex items-center justify-center cursor-pointer text-gray-400 text-sm">
                {uploading ? "…" : "+ Foto"}
                <input type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => handleUpload(e.target.files)} />
              </label>
            ) : null}
          </div>

          {canEdit ? (
            <div className="mt-4 flex justify-end">
              <button onClick={onDelete} className="text-xs text-danger underline">Hapus pemakai ini</button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SaveStatus({ status }: { status: "" | "saving" | "saved" | "error" }) {
  if (status === "saving") return <span className="text-gray-500">Menyimpan…</span>;
  if (status === "saved") return <span className="text-[#3F7A4F] font-semibold">Tersimpan ✓</span>;
  if (status === "error") return <span className="text-danger font-semibold">Gagal menyimpan</span>;
  return <span className="text-gray-400">Belum disimpan</span>;
}
