import { redirect } from "next/navigation";
import { getSessionProfile } from "@/server/auth";
import { Navbar } from "@/components/ui/navbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getSessionProfile();
  if (!me) redirect("/login");

  return (
    <div className="h-screen flex flex-col bg-cream text-navy overflow-hidden">
      <div className="shrink-0">
        <Navbar userId={me.id} name={me.name} role={me.role} />
      </div>
      {/* area konten mengisi sisa tinggi; tiap halaman atur scroll/padding sendiri */}
      <main className="flex-1 min-h-0 flex flex-col">{children}</main>
    </div>
  );
}
