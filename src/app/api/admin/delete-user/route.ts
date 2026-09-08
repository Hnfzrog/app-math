import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Pakai service_role key — hanya aman di server-side
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID tidak valid' }, { status: 400 });
    }

    // 1. Delete dari public.users (menghapus profil & memicu ON DELETE CASCADE ke tabel-tabel berelasi seperti jawaban_siswa, nilai, kelas, dsb)
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId);

    if (profileError) {
      require('fs').writeFileSync('/Users/bsi-2-2200017/Documents/app-math/delete_error.log', JSON.stringify(profileError, null, 2));
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    require('fs').writeFileSync('/Users/bsi-2-2200017/Documents/app-math/delete_error.log', 'Delete public.users success');

    // 2. Delete dari auth.users (mencabut kredensial login)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 500 });
  }
}
