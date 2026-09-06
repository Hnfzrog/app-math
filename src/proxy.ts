import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function proxy(req: NextRequest) {
  const res = NextResponse.next()
  
  // Create a supabase client from edge environment variables
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Get session from cookies if using SSR auth (supabase-js normally doesn't handle cookies in middleware natively without @supabase/ssr package)
  // For this MVP, we are protecting routes simply by checking for a generic cookie or leaving it to client-side for simplicity if we don't have @supabase/ssr installed.
  // Actually, to do proper route protection with Supabase in Next.js App Router we should use @supabase/ssr.
  // We'll put a placeholder here that allows all for now, until we set up `@supabase/ssr`.
  
  const pathname = req.nextUrl.pathname
  
  // Basic route restriction logic based on a cookie 'user-role' for MVP purposes
  const roleCookie = req.cookies.get('user-role')?.value

  // Protect admin routes
  if (pathname.startsWith('/admin') && roleCookie !== 'admin') {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  
  // Protect guru routes
  if (pathname.startsWith('/guru') && roleCookie !== 'guru' && roleCookie !== 'admin') {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  
  // Protect siswa routes
  if (pathname.startsWith('/siswa') && roleCookie !== 'siswa' && roleCookie !== 'admin') {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return res
}

export const config = {
  matcher: ['/admin/:path*', '/guru/:path*', '/siswa/:path*'],
}
