export function rupiah(n: number | string): string {
  const v = Number(n) || 0;
  return "Rp" + v.toLocaleString("id-ID");
}

export function digits(s: string): string {
  return (s || "").replace(/\D/g, "");
}

/** Ambil angka integer mentah dari input (buang non-digit). */
export function parseRupiahInput(value: string): number {
  return Number(digits(value)) || 0;
}

/** Format angka untuk ditampilkan di input (titik ribuan, tanpa prefix Rp). "" jika 0. */
export function formatRupiahInput(n: number): string {
  if (!n || n <= 0) return "";
  return n.toLocaleString("id-ID");
}

/** Format total dengan prefix Rp. */
export const formatRupiah = rupiah;

export function fmtTime(d: string | Date): string {
  return new Date(d).toLocaleString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function pktName(m: { wearer_name?: string | null; cutting?: string | null; fabric?: string | null; color?: string | null }): string {
  const model = [m.cutting, m.fabric, m.color].filter(Boolean).join(" - ");
  if (m.wearer_name) return model ? `${m.wearer_name} — ${model}` : m.wearer_name;
  return model || "Paket baru";
}

/** "11 Juni 2026, 10.00–11.00" dari start & end ISO. */
export function fmtFittingRange(startISO: string | null, endISO: string | null): string {
  if (!startISO) return "-";
  const s = new Date(startISO);
  const tgl = s.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  const jam = (d: Date) => d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(":", ".");
  const start = jam(s);
  const end = endISO ? jam(new Date(endISO)) : "";
  return `${tgl}, ${start}${end ? "–" + end : ""}`;
}
