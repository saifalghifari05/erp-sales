"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Field, inputClass } from "@/components/ui";
import { Logo } from "@/components/ui/logo";

const DOMAIN = "@tarda.local";

/** username -> email internal. Jika user mengetik email lengkap, pakai apa adanya. */
function toEmail(input: string): string {
  const v = input.trim().toLowerCase();
  if (v.includes("@")) return v;
  return v + DOMAIN;
}

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!username.trim() || !password) { setErr("Username dan password wajib diisi."); return; }
    setErr(""); setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: toEmail(username), password,
    });
    setLoading(false);
    if (error) { setErr("Username atau password salah."); return; }
    router.push("/board");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center p-5">
      <div className="w-full max-w-[360px]">
        <div className="text-center mb-7">
          <div className="mx-auto mb-4 w-fit"><Logo size={56} withWordmark={false} /></div>
          <div className="text-cream font-serif text-2xl">ERP Sales &amp; Fitter</div>
          <div className="text-gold tracking-[5px] text-[11px] mt-1.5 uppercase">Tarda Tailor</div>
        </div>
        <div className="bg-creamcard rounded-2xl p-6">
          <Field label="Username">
            <input className={inputClass} value={username} autoCapitalize="none" autoCorrect="off"
              onChange={(e) => setUsername(e.target.value)} placeholder="Masukkan username" />
          </Field>
          <Field label="Password">
            <input className={inputClass} type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="••••••" />
          </Field>
          {err ? <div className="text-danger text-xs mt-2">{err}</div> : null}
          <Button className="w-full mt-4" onClick={submit} disabled={loading || !username.trim() || !password}>
            {loading ? "Memproses…" : "Masuk"}
          </Button>
        </div>
      </div>
    </div>
  );
}
