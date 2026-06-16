import "server-only";
import { createClient } from "@/lib/supabase/server";
import { MEASUREMENT_FIELDS } from "@/lib/types";

type SB = ReturnType<typeof createClient>;

// ukuran yang WAJIB / opsional diberi keterangan
const NOTE_LABEL: Record<string, string> = {
  chest_circumference: "lingkar dada",
  waist_circumference: "lingkar pinggang",
  hip_circumference: "lingkar pinggul",
};

/**
 * Laporan order selesai ke Telegram, RAPI PER PEMAKAI.
 * Ukuran: angka saja, dipisah baris baru (bukan "/").
 * Keterangan hanya untuk: lingkar dada, pinggang, pinggul; jam tangan & mata kaki jika dicentang.
 */
export async function sendOrderReport(supabase: SB, orderId: string): Promise<{ ok?: true; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { error: "Telegram belum dikonfigurasi." };

  const { data: o } = await supabase.from("orders").select("id_scalev, customer").eq("id", orderId).single();

  // fitter ter-assign
  const { data: ofs } = await supabase.from("order_fitters")
    .select(`profiles:profiles!order_fitters_fitter_id_fkey ( name )`).eq("order_id", orderId);
  const fitterName = (ofs ?? []).map((f) => (f as { profiles?: { name?: string } }).profiles?.name).filter(Boolean).join(", ") || "-";

  // pemakai + relasi
  const { data: people } = await supabase.from("order_people")
    .select("id, wearer_name, sort_order").eq("order_id", orderId).order("sort_order");
  const { data: meas } = await supabase.from("customer_measurements").select("*").eq("order_id", orderId);
  const { data: models } = await supabase.from("order_model_details").select("*").eq("order_id", orderId);
  const { data: photos } = await supabase.from("customer_measurement_photos")
    .select("person_id, public_url").eq("order_id", orderId);

  const measByPerson = new Map((meas ?? []).map((m) => [m.person_id, m]));
  const modelByPerson = new Map((models ?? []).map((m) => [m.person_id, m]));

  function personBlock(personId: string, name: string): string {
    const m = measByPerson.get(personId) as Record<string, unknown> | undefined;
    const md = modelByPerson.get(personId) as Record<string, unknown> | undefined;

    // tinggi + berat di atas
    const tinggi = m?.height ?? "-";
    const berat = m?.weight ?? "-";

    // nama model (cutting - fabric - color)
    const modelName = md ? [md.cutting, md.fabric, md.color].filter(Boolean).join(" ") : "";

    // baris model bullet (collar, placket, pocket, sleeve, accessories, add on, cufflink, catatan)
    const modelBullets = md ? [
      md.collar, md.bottom_placket, md.front_placket, md.pocket, md.sleeve_cuff,
      md.accessories, md.add_on, md.cufflink,
    ].filter(Boolean).map((x) => `* ${x}`).join("\n") : "";
    const catatan = md?.note ? `* ${md.note}` : "";

    // ukuran setelah model: dari neck_circumference dst (height & weight sudah di atas)
    const sizeKeys = MEASUREMENT_FIELDS.filter((f) => f.key !== "height" && f.key !== "weight");
    const sizeLines = sizeKeys.map((f) => {
      const v = m?.[f.key];
      let line = v == null || v === "" ? "-" : String(v);
      // keterangan
      if (f.key === "arm_circumference" && m?.has_watch_note) line += " jm tangan";
      else if (f.key === "gamis_length" && m?.has_ankle_note) line += " mata kaki";
      else if (NOTE_LABEL[f.key] && !(v == null || v === "")) line += " " + NOTE_LABEL[f.key];
      return line;
    }).join("\n");

    const parts = [
      name,
      String(tinggi),
      String(berat),
      "",
      modelName,
      "",
      [modelBullets, catatan].filter(Boolean).join("\n"),
      "",
      sizeLines,
    ];
    return parts.join("\n");
  }

  const blocks = (people ?? []).map((p) => "━━━━━━━━━━━━━━\n" + personBlock(p.id, p.wearer_name)).join("\n\n");

  const text =
    `📌 LAPORAN ORDER SELESAI\n\n` +
    `ID Scalev: ${o?.id_scalev ?? "-"}\n` +
    `Customer: ${o?.customer ?? "-"}\n` +
    `Fitter: ${fitterName}\n\n` +
    blocks;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { error: `Telegram menolak (${res.status}): ${t.slice(0, 120)}` };
    }

    // kirim foto per pemakai (album + teks nama). kumpulkan kegagalan.
    const failed = await sendPhotosPerPerson(token, chatId, people ?? [], photos ?? []);
    if (failed.length) {
      // catat ke Super Admin (tidak menggagalkan laporan teks yang sudah terkirim)
      await supabase.from("notifications").insert({
        recipient_role: "super_admin", type: "telegram_photo_failed",
        title: "Foto Telegram gagal",
        message: `Foto pemakai ${failed.join(", ")} gagal terkirim ke Telegram (order ${o?.id_scalev ?? "-"}). Bisa kirim ulang manual dari halaman invoice.`,
        order_id: orderId,
      });
    }
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "gagal kirim Telegram" };
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Kirim foto ke Telegram per pemakai: bubble teks nama dulu, lalu album.
 * Berurutan + jeda agar tidak kena rate-limit / pecah. Kembalikan daftar nama yang gagal.
 */
export async function sendPhotosPerPerson(
  token: string, chatId: string,
  people: { id: string; wearer_name: string }[],
  photos: { person_id: string | null; public_url: string | null }[],
): Promise<string[]> {
  const byPerson = new Map<string, string[]>();
  for (const ph of photos) {
    if (!ph.public_url || !ph.person_id) continue;
    const arr = byPerson.get(ph.person_id) ?? [];
    arr.push(ph.public_url);
    byPerson.set(ph.person_id, arr);
  }

  const failed: string[] = [];
  for (const p of people) {
    const urls = byPerson.get(p.id) ?? [];
    if (urls.length === 0) continue;

    let ok = false;
    if (urls.length === 1) {
      // foto tunggal: nama digabung jadi caption di bubble foto
      const r = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, photo: urls[0], caption: `📷 ${p.wearer_name}` }),
      }).catch(() => null);
      ok = !!r && r.ok;
    } else {
      // teks nama dulu sebagai penanda kelompok
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: `📷 Foto — ${p.wearer_name}` }),
      }).catch(() => null);
      await sleep(400);
      // album (maks 10 per group); pecah jika >10
      const chunks: string[][] = [];
      for (let i = 0; i < urls.length; i += 10) chunks.push(urls.slice(i, i + 10));
      ok = true;
      for (const ch of chunks) {
        const media = ch.map((u) => ({ type: "photo", media: u }));
        const r = await fetch(`https://api.telegram.org/bot${token}/sendMediaGroup`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, media }),
        }).catch(() => null);
        if (!r || !r.ok) ok = false;
        await sleep(600); // jeda antar album agar tidak kena rate-limit
      }
    }
    if (!ok) failed.push(p.wearer_name);
    await sleep(500); // jeda antar pemakai, jaga urutan
  }
  return failed;
}
