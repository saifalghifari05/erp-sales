"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Confirm } from "@/components/ui";
import { NotificationBell } from "@/components/ui/notification-bell";
import { Logo } from "@/components/ui/logo";
import type { Role } from "@/lib/types";

export function Navbar({ userId, name, role }: { userId: string; name: string; role: Role }) {
  const path = usePathname();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);

  const nav: [string, string][] =
    role === "super_admin"
      ? [["/dashboard", "Dashboard"], ["/board", "Kanban"], ["/jadwal", "Jadwal"], ["/activity", "Activity Log"], ["/manage", "Kelola Order"], ["/master", "Master Data"], ["/users", "User"], ["/cancelled", "Cancelled"]]
      : role === "manager"
      ? [["/dashboard", "Dashboard"], ["/board", "Kanban"], ["/jadwal", "Jadwal"], ["/activity", "Activity Log"], ["/cancelled", "Cancelled"]]
      : role === "sales"
      ? [["/board", "Kanban"], ["/jadwal", "Jadwal"], ["/cancelled", "Cancelled"]]
      : [["/board", "Kanban"], ["/jadwal", "Jadwal"]];   // head_fitter & fitter

  const roleLabel =
    role === "super_admin" ? "Super Admin" :
    role === "manager" ? "Manager" :
    role === "sales" ? "Sales" :
    role === "head_fitter" ? "Kepala Fitter" : "Fitter";

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 no-print shrink-0">
      {/* BARIS ATAS — navy */}
      <div className="bg-navy text-cream w-full px-6 lg:px-10 xl:px-14 py-3 flex items-center justify-between gap-3.5">
        <Logo size={30} withWordmark />
        <div className="flex items-center gap-2.5">
          <NotificationBell userId={userId} role={role} />
          <span className="text-sm opacity-85 hidden sm:inline">{name} · <span className="text-gold">{roleLabel}</span></span>
          <button onClick={() => setConfirm(true)}
            className="border border-gold text-cream px-3 py-1.5 rounded-lg text-sm font-semibold">Keluar</button>
        </div>
      </div>
      {/* BARIS BAWAH: menu — cream, lebih ramping, dengan garis pemisah atas & bawah */}
      <div className="w-full px-6 lg:px-10 xl:px-14 py-1.5 overflow-x-auto bg-cream border-b border-line">
        <nav className="flex gap-1 min-w-max">
          {nav.map(([href, label]) => {
            const active = path === href;
            return (
              <Link key={href} href={href}
                className={`px-3 py-1 rounded-lg text-[13px] font-semibold whitespace-nowrap transition-colors ${active ? "bg-navy text-cream" : "text-navy/70 hover:bg-navy/5"}`}>
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
      {confirm ? (
        <Confirm title="Keluar dari aplikasi?" message="Sesi kamu akan diakhiri."
          cancelLabel="Batal" confirmLabel="Keluar" danger
          onCancel={() => setConfirm(false)} onConfirm={logout} />
      ) : null}
    </header>
  );
}
