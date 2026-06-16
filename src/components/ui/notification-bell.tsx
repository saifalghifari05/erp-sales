"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { markAllRead } from "@/server/actions/notifications";
import type { Notification, Role } from "@/lib/types";

export function NotificationBell({ userId, role }: { userId: string; role: Role }) {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);

  // muat awal + subscribe realtime
  useEffect(() => {
    const supabase = createClient();

    async function load() {
      // RLS membatasi: personal (user) + role-based (role user). Ambil terbaru.
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      setItems((data as Notification[]) ?? []);
    }
    load();

    const channel = supabase
      .channel("notif")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const n = payload.new as Notification;
          // relevan jika: personal utk user, ATAU role-based utk role user.
          // super_admin TIDAK lagi menangkap semua — hanya notif role 'super_admin' / personal.
          const relevan =
            n.recipient_user_id === userId ||
            (n.recipient_role != null && n.recipient_role === role);
          if (relevan) setItems((prev) => [n, ...prev].slice(0, 50));
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, role]);

  // tutup saat klik di luar
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // unread: personal pakai is_read DB; role-based pakai "seen" lokal sesi.
  const unread = items.filter((n) => {
    if (n.recipient_user_id) return !n.is_read;
    return !seen.has(n.id);
  }).length;

  async function openPanel() {
    setOpen((v) => !v);
    if (!open) {
      // tandai terbaca: personal via server, role-based via lokal
      setSeen((s) => { const ns = new Set(s); items.forEach((n) => ns.add(n.id)); return ns; });
      setItems((prev) => prev.map((n) => (n.recipient_user_id ? { ...n, is_read: true } : n)));
      await markAllRead();
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button onClick={openPanel} className="relative w-9 h-9 rounded-lg border border-gold/60 flex items-center justify-center text-cream hover:bg-white/10">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 ? (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-[320px] max-h-[420px] overflow-y-auto bg-cream text-navy rounded-2xl shadow-2xl border border-line z-50">
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">Belum ada notifikasi.</div>
          ) : (
            <div className="flex flex-col py-1">
              {items.map((n) => (
                <div key={n.id} className="px-4 py-3 border-b border-line/60 last:border-0">
                  <div className="text-sm font-semibold">{n.title}</div>
                  <div className="text-[12px] text-gray-600 mt-0.5">{n.message}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
