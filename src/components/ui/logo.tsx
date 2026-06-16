"use client";

import { useState } from "react";

/**
 * Logo Tarda. Menampilkan IKON Tarda (foto 2) di dalam plat navy membulat,
 * agar tampil baik di latar navy (header/login) maupun terang (invoice).
 * File ikon: /public/logo-tarda.png  (background ikon boleh navy — menyatu dgn plat).
 * Jika file tidak ada, fallback monogram "T".
 *
 * Props:
 *  - size        : ukuran plat (px). default 36
 *  - withWordmark: tampilkan tulisan "Tarda ERP" / "Tarda Tailor"
 *  - wordmark    : teks wordmark ("erp" | "tailor" | "none"). default "erp"
 *  - dark        : true bila teks wordmark harus gelap (di atas latar terang spt invoice)
 */
export function Logo({ size = 36, withWordmark = true, wordmark = "erp", dark = false }: {
  size?: number; withWordmark?: boolean; wordmark?: "erp" | "tailor" | "none"; dark?: boolean;
}) {
  const [imgOk, setImgOk] = useState(true);
  const textColor = dark ? "#0B1F3A" : "#F7F3EA";
  const plate = Math.round(size);
  const inner = Math.round(size * 0.74);

  return (
    <div className="flex items-center gap-2.5">
      <div className="rounded-[10px] flex items-center justify-center shrink-0"
        style={{ width: plate, height: plate, background: "#0B1F3A" }}>
        {imgOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/logo-tarda.png" alt="Tarda" width={inner} height={inner}
            style={{ width: inner, height: inner, objectFit: "contain" }}
            onError={() => setImgOk(false)} />
        ) : (
          <span className="font-serif" style={{ color: "#F7F3EA", fontSize: inner * 0.6 }}>T</span>
        )}
      </div>
      {withWordmark && wordmark !== "none" ? (
        wordmark === "tailor" ? (
          <div>
            <div className="font-serif text-xl" style={{ color: textColor }}>Tarda Tailor</div>
            <div className="text-[11px] tracking-wider" style={{ color: "#9a9488" }}>Custom Luxury Thobe</div>
          </div>
        ) : (
          <div className="font-serif text-base" style={{ color: textColor }}>
            Tarda <span style={{ color: "#B08642" }}>ERP</span>
          </div>
        )
      ) : null}
    </div>
  );
}
