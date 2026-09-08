import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Pakai service_role key — hanya aman di server-side
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { nama, email, password, role, nisn } = await request.json();

    if (!nama || !email || !password || !role) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    // 1. Buat user di auth.users — ini yang memenuhi FK constraint
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // langsung confirmed, tidak perlu verifikasi email
      user_metadata: { nama, role },
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const userId = authData.user.id;

    // 2. Update public.users dengan data tambahan
    // (biasanya sudah dibuat otomatis oleh trigger, tapi kita upsert untuk pastikan)
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .upsert({
        id: userId,
        nama,
        email,
        role,
        nisn: role === 'siswa' ? nisn : null,
      });

    if (profileError) {
      // Rollback: hapus auth user kalau insert profile gagal
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    return NextResponse.json({ id: userId }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 500 });
  }
}
