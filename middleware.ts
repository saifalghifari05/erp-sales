import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware ringan & Edge-safe: TIDAK memakai @supabase/ssr (yang menarik
 * modul Node seperti __dirname dan gagal di Edge Runtime). Di sini cukup
 * mengecek keberadaan cookie sesi Supabase sebagai "penjaga pintu" pertama.
 * Validasi sesi sebenarnya tetap dilakukan di server (getSessionProfile).
 */
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // rute publik (tidak perlu login)
  const isPublic =
    path.startsWith("/login") ||
    path.startsWith("/inv/") ||
    path === "/";

  if (isPublic) return NextResponse.next();

  // Supabase menyimpan token sesi di cookie berpola "sb-<ref>-auth-token".
  // Cek keberadaannya tanpa memanggil library apa pun.
  const hasSession = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));

  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
