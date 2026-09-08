import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Endpoint ini menggunakan SERVICE_ROLE key — hanya jalankan sekali untuk seeding
// Akses: GET /api/admin/seed

export async function GET() {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const results: any[] = [];

  const users = [
    { email: 'admin@gmail.com',  password: 'password123', role: 'admin', nama: 'Bapak Kepala Admin' },
    { email: 'guru@gmail.com',   password: 'password123', role: 'guru',  nama: 'Ibu Guru Matematika' },
    { email: 'siswa@gmail.com',  password: 'password123', role: 'siswa', nama: 'Andi Siswa Rajin' },
    { email: 'budi@gmail.com',   password: 'password123', role: 'siswa', nama: 'Budi Santoso' },
  ];

  for (const u of users) {
    // Buat user via Admin API (cara resmi — tidak perlu insert manual ke auth.users)
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
    });

    if (error) {
      results.push({ email: u.email, status: 'error', message: error.message });
      continue;
    }

    const newId = data.user.id;

    // Update profil di public.users yang dibuat oleh trigger handle_new_user
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .update({ role: u.role, nama: u.nama })
      .eq('id', newId);

    results.push({ 
      email: u.email, 
      status: profileError ? 'profile_error' : 'ok', 
      id: newId,
      message: profileError?.message 
    });
  }

  return NextResponse.json({ results });
}
