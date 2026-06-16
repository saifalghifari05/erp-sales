"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Profile } from "@/lib/types";
import { Button, Modal, Field, inputClass, Toast } from "@/components/ui";
import { resetUserPassword, setUserActive, updateUsername } from "@/server/actions/users";

export function UserManager({ users }: { users: Profile[] }) {
  const router = useRouter();
  const [toast, setToast] = useState("");
  const [resetFor, setResetFor] = useState<Profile | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [editFor, setEditFor] = useState<Profile | null>(null);
  const [uname, setUname] = useState("");
  const [unameBusy, setUnameBusy] = useState(false);
  const flash = (m: string) => setToast(m);

  const roleLabel = (r: string) => (r === "super_admin" ? "Super Admin" : r === "sales" ? "Sales" : "Fitter");

  const pwError =
    pw.length > 0 && pw.length < 8 ? "Password minimal 8 karakter." :
    pw2.length > 0 && pw !== pw2 ? "Konfirmasi password tidak sama." : "";
  const canSave = pw.length >= 8 && pw === pw2 && !busy;

  const unameError =
    uname.length > 0 && !/^[a-z0-9._]+$/.test(uname.trim().toLowerCase())
      ? "Hanya huruf kecil, angka, titik, underscore." : "";
  const canSaveUname = uname.trim().length > 0 && !unameError && !unameBusy;

  async function doReset() {
    if (!resetFor || !canSave) return;
    setBusy(true);
    const r = await resetUserPassword(resetFor.id, pw);
    setBusy(false);
    if (r?.error) { flash(r.error); return; }
    setResetFor(null); setPw(""); setPw2("");
    flash("Password user berhasil diperbarui.");
  }

  async function doUsername() {
    if (!editFor || !canSaveUname) return;
    setUnameBusy(true);
    const r = await updateUsername(editFor.id, uname);
    setUnameBusy(false);
    if (r?.error) { flash(r.error); return; }
    setEditFor(null); setUname("");
    flash("Username user berhasil diperbarui.");
    router.refresh();
  }

  return (
    <div>
      <h1 className="font-serif text-2xl m-0 font-medium">User Management</h1>
      <div className="text-sm text-gray-500 mt-1 mb-4">Kelola user, username, status, dan reset password. Password tidak pernah ditampilkan.</div>

      <div className="flex flex-col gap-2">
        {users.map((u) => (
          <div key={u.id} className="bg-creamcard border border-line rounded-2xl px-4 py-3 flex justify-between items-center gap-2.5 flex-wrap">
            <div>
              <div className="text-sm font-bold">{u.name} <span className="text-gray-400 font-normal">· {roleLabel(u.role)}</span></div>
              <div className="text-[11px] text-gray-500">@{u.username ?? "—"}{u.active ? "" : " · nonaktif"}</div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => { setEditFor(u); setUname(u.username ?? ""); }}
                className="text-xs border border-line bg-white rounded-md px-2.5 py-1 font-semibold">Ubah Username</button>
              <button onClick={() => { setResetFor(u); setPw(""); setPw2(""); }}
                className="text-xs border border-line bg-white rounded-md px-2.5 py-1 font-semibold">Reset Password</button>
              {u.role !== "super_admin" ? (
                <button onClick={async () => { const r = await setUserActive(u.id, !u.active); if (r?.error) flash(r.error); else router.refresh(); }}
                  className="text-xs border border-line bg-white rounded-md px-2.5 py-1 font-semibold">
                  {u.active ? "Nonaktifkan" : "Aktifkan"}
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="text-[11px] text-gray-500 mt-5">
        Tambah user baru lewat Supabase Authentication, lalu tautkan ke tabel profiles (lihat README). Setelah itu set username &amp; password di sini.
      </div>

      {resetFor ? (
        <Modal title="Ubah Password User" onClose={() => setResetFor(null)}>
          <div className="text-sm mb-3">User: <span className="font-bold">{resetFor.name}</span></div>
          <div className="mb-[14px]">
            <Field label="Password baru">
              <input className={inputClass} type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="min. 8 karakter" />
            </Field>
          </div>
          <div className="mb-[18px]">
            <Field label="Konfirmasi password">
              <input className={inputClass} type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </Field>
            {pwError ? <div className="text-danger text-xs mt-1.5">{pwError}</div> : null}
          </div>
          <Button className="w-full" disabled={!canSave} onClick={doReset}>
            {busy ? "Menyimpan…" : "Simpan"}
          </Button>
        </Modal>
      ) : null}

      {editFor ? (
        <Modal title="Ubah Username User" onClose={() => setEditFor(null)}>
          <div className="text-sm mb-3">User: <span className="font-bold">{editFor.name}</span></div>
          <div className="mb-[18px]">
            <Field label="Username">
              <input className={inputClass} value={uname} autoCapitalize="none"
                onChange={(e) => setUname(e.target.value)} placeholder="contoh: ican" />
              {unameError ? <div className="text-danger text-xs mt-1.5">{unameError}</div> : null}
              <div className="text-[11px] text-gray-400 mt-1.5">Login user menjadi: {(uname.trim().toLowerCase() || "username")}@tarda.local</div>
            </Field>
          </div>
          <Button className="w-full" disabled={!canSaveUname} onClick={doUsername}>
            {unameBusy ? "Menyimpan…" : "Simpan"}
          </Button>
        </Modal>
      ) : null}

      {toast ? <Toast message={toast} onDone={() => setToast("")} /> : null}
    </div>
  );
}
