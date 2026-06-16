"use client";

import { useState } from "react";
import { rupiah } from "@/lib/format";

interface Pkg {
  name: string; price: number;
  cutting: string | null; fabric: string | null; color: string | null;
  collar: string | null; bottom_placket: string | null; front_placket: string | null;
  pocket: string | null; sleeve_cuff: string | null; accessories: string | null;
  add_on: string | null; cufflink: string | null; note: string | null;
}

export function PublicInvoicePackages({ packages }: { packages: Pkg[] }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-2">
      {packages.map((p, i) => {
        const isOpen = open === i;
        const rows: [string, string | null][] = [
          ["Cutting", p.cutting], ["Jenis kain", p.fabric], ["Warna kain", p.color],
          ["Collar", p.collar], ["Bottom Placket", p.bottom_placket], ["Front Placket", p.front_placket],
          ["Pocket", p.pocket], ["Sleeve", p.sleeve_cuff], ["Accessories", p.accessories],
          ["Add On", p.add_on], ["Cufflink", p.cufflink],
        ];
        return (
          <div key={i} className="border border-line rounded-xl overflow-hidden">
            <button onClick={() => setOpen(isOpen ? null : i)}
              className="w-full text-left bg-creamcard px-4 py-3 flex justify-between items-center">
              <span className="font-semibold text-navy">{p.name}</span>
              <span className="flex items-center gap-3">
                <span className="font-bold text-navy">{rupiah(p.price)}</span>
                <span className="text-gray-400">{isOpen ? "▲" : "▼"}</span>
              </span>
            </button>
            {isOpen ? (
              <div className="px-4 py-3 bg-white">
                <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))" }}>
                  {rows.map(([k, v]) => (
                    <div key={k}>
                      <div className="text-[10px] text-gray-500 uppercase">{k}</div>
                      <div className="text-sm text-navy">{v || "—"}</div>
                    </div>
                  ))}
                </div>
                {p.note ? <div className="text-sm text-gray-600 mt-2.5">Catatan: {p.note}</div> : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
