import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Klien Supabase server-side berbasis cookie untuk dipakai di proxy.
 *
 * Memakai satu sumber sesi (cookie Supabase `sb-*-auth-token`) sehingga status
 * login konsisten dengan klien browser — menggantikan cookie `user-role` manual
 * yang tidak tersinkron dan menjadi penyebab logout mendadak.
 *
 * `getResponse()` mengembalikan response yang harus di-return dari proxy agar
 * cookie hasil refresh sesi ikut terkirim ke browser.
 */
export function createSupabaseServerClient(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Tulis cookie ke request (agar terbaca handler berikutnya) dan ke
          // response (agar tersimpan di browser).
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  return { supabase, getResponse: () => response };
}
