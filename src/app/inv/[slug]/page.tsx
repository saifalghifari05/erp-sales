import { createClient } from "@/lib/supabase/server";
import { rupiah } from "@/lib/format";
import { PublicInvoicePackages } from "@/components/invoice/public-invoice-packages";
import { Logo } from "@/components/ui/logo";

export const dynamic = "force-dynamic";

interface Pkg {
  name: string; price: number;
  cutting: string | null; fabric: string | null; color: string | null;
  collar: string | null; bottom_placket: string | null; front_placket: string | null;
  pocket: string | null; sleeve_cuff: string | null; accessories: string | null;
  add_on: string | null; cufflink: string | null; note: string | null;
}
interface PublicInvoice {
  number: string; created_at: string; total: number;
  customer: string; id_scalev: string; sales_name: string;
  packages: Pkg[];
}

export default async function PublicInvoicePage({ params }: { params: { slug: string } }) {
  const supabase = createClient();
  const { data } = await supabase.rpc("public_invoice", { p_slug: params.slug });
  const inv = data as PublicInvoice | null;

  if (!inv) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-5">
        <div className="text-center text-gray-500">
          <div className="font-serif text-2xl text-navy mb-2">Invoice tidak ditemukan</div>
          <div className="text-sm">Link mungkin salah atau sudah tidak berlaku.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream py-10 px-5">
      <div className="bg-white border border-line rounded-2xl p-6 max-w-[640px] mx-auto">
        <div className="flex justify-between items-start border-b-2 border-navy pb-4 mb-4">
          <div className="flex gap-3 items-center">
            <Logo size={48} withWordmark={false} dark />
            <div><div className="font-serif text-xl text-navy">Tarda Tailor</div><div className="text-[11px] text-gray-500 tracking-wider">Custom Luxury Thobe</div></div>
          </div>
          <div className="text-right">
            <div className="text-lg font-extrabold text-navy">INVOICE</div>
            <div className="text-sm text-gold font-bold">{inv.number}</div>
            <div className="text-[11px] text-gray-500">{new Date(inv.created_at).toLocaleDateString("id-ID")}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5 mb-4 text-sm text-navy">
          <div><span className="text-gray-500">Customer</span><div className="font-semibold">{inv.customer}</div></div>
          <div><span className="text-gray-500">ID Scalev</span><div className="font-semibold">{inv.id_scalev}</div></div>
          <div><span className="text-gray-500">Sales</span><div className="font-semibold">{inv.sales_name}</div></div>
        </div>

        <div className="text-xs text-gray-500 mb-2 font-semibold">Detail paket (klik untuk lihat detail)</div>
        <PublicInvoicePackages packages={inv.packages} />

        <div className="flex justify-between items-center border-t-2 border-navy mt-4 pt-3">
          <span className="font-extrabold text-navy">Total</span>
          <span className="font-extrabold text-lg text-navy">{rupiah(inv.total)}</span>
        </div>
      </div>
    </div>
  );
}
