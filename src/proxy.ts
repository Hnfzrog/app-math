import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

// Rute terproteksi + role yang diizinkan (admin boleh masuk semua area).
const RULES: { prefix: string; allow: string[] }[] = [
  { prefix: '/admin', allow: ['admin'] },
  { prefix: '/guru', allow: ['guru', 'admin'] },
  { prefix: '/siswa', allow: ['siswa', 'admin'] },
];

const HOME_BY_ROLE: Record<string, string> = {
  admin: '/admin/dashboard',
  guru: '/guru/dashboard',
  siswa: '/siswa/dashboard',
};

// Prefetch dari <Link> tidak boleh memicu pengalihan yang tidak disengaja.
function isPrefetchRequest(req: NextRequest): boolean {
  return (
    req.headers.get('next-router-prefetch') === '1' ||
    req.headers.get('x-middleware-prefetch') === '1' ||
    req.headers.get('purpose') === 'prefetch'
  );
}

export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  const rule = RULES.find((r) => pathname.startsWith(r.prefix));
  // Rute di luar area terproteksi: lewat saja.
  if (!rule) return NextResponse.next();

  const { supabase, getResponse } = createSupabaseServerClient(req);

  // Optimistic check: baca sesi dari COOKIE (getSession), TANPA refresh jaringan.
  // Sebelumnya getUser() memaksa refresh token pada SETIAP navigasi; digabung dengan
  // refresh oleh klien browser → token yang sama dipakai dua kali → Supabase
  // "reuse detection" me-revoke sesi (penyebab logout mendadak). getSession() tidak
  // menyentuh jaringan sehingga tidak memicu refresh/race.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  // Tanpa sesi → satu-satunya alasan mengalihkan ke /login.
  if (!user) {
    if (isPrefetchRequest(req)) return getResponse();
    console.warn(`[auth] redirect /login — ${pathname} (tanpa sesi)`);
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Sesi ada tapi role tidak berhak → kembalikan ke dashboard miliknya (bukan /login,
  // agar pengguna tidak dipaksa login ulang padahal sesinya masih aktif).
  const role = (user.app_metadata?.role as string) || (user.user_metadata?.role as string) || '';
  if (role && !rule.allow.includes(role)) {
    if (isPrefetchRequest(req)) return getResponse();
    const home = HOME_BY_ROLE[role] || '/login';
    console.warn(`[auth] redirect ${home} — ${pathname} (role=${role} tidak berhak)`);
    return NextResponse.redirect(new URL(home, req.url));
  }

  return getResponse();
}

export const config = {
  matcher: ['/admin/:path*', '/guru/:path*', '/siswa/:path*'],
};
