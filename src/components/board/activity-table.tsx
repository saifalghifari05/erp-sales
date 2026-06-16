"use client";

import { useMemo, useState } from "react";
import { fmtTime } from "@/lib/format";

interface Row {
  id: string; actor_name: string | null; actor_role: string | null;
  action: string; text: string; created_at: string; id_scalev?: string | null;
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin", manager: "Manager", sales: "Sales",
  head_fitter: "Kepala Fitter", fitter: "Fitter",
};

export function ActivityTable({ rows }: { rows: Row[] }) {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [action, setAction] = useState("");
  const [date, setDate] = useState("");

  const actions = useMemo(() => Array.from(new Set(rows.map((r) => r.action))).sort(), [rows]);

  const filtered = rows.filter((r) => {
    if (q && !(`${r.text} ${r.id_scalev ?? ""}`.toLowerCase().includes(q.toLowerCase()))) return false;
    if (role && r.actor_role !== role) return false;
    if (action && r.action !== action) return false;
    if (date && !r.created_at.startsWith(date)) return false;
    return true;
  });

  return (
    <div className="flex-1 min-h-0 flex flex-col px-6 lg:px-10 pt-4">
      <div className="shrink-0 grid gap-2 mb-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}>
        <input className="px-3 py-2 border border-line rounded-lg text-sm bg-white" placeholder="Cari aktivitas / ID Scalev"
          value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="px-3 py-2 border border-line rounded-lg text-sm bg-white" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">Semua role</option>
          {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="px-3 py-2 border border-line rounded-lg text-sm bg-white" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">Semua aksi</option>
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <input type="date" className="px-3 py-2 border border-line rounded-lg text-sm bg-white" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div className="flex-1 min-h-0 overflow-auto border border-line rounded-2xl bg-creamcard">
        <table className="w-full text-sm border-collapse min-w-[640px]">
          <thead className="sticky top-0 bg-[#EFE8D8] z-10">
            <tr className="text-left text-gray-600">
              <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Waktu</th>
              <th className="px-4 py-2.5 font-semibold">User</th>
              <th className="px-4 py-2.5 font-semibold">Role</th>
              <th className="px-4 py-2.5 font-semibold">Aktivitas</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="px-4 py-2.5 text-[11px] text-gray-500 whitespace-nowrap align-top">{fmtTime(r.created_at)}</td>
                <td className="px-4 py-2.5 align-top whitespace-nowrap">{r.actor_name ?? "—"}</td>
                <td className="px-4 py-2.5 align-top whitespace-nowrap text-gray-500">{ROLE_LABEL[r.actor_role ?? ""] ?? r.actor_role}</td>
                <td className="px-4 py-2.5 align-top">{r.text}</td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Tidak ada aktivitas.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
