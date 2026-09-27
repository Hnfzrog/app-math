import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { uploadToStorage, MAX_FILE_SIZE } from '@/lib/storage';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Satu endpoint: upload foto (jika ada) + update profil user dalam satu request.
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const token = (formData.get('token') as string) || '';

    // Verifikasi user dari token (mencegah id dipalsukan)
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Sesi tidak valid. Silakan login ulang.' }, { status: 401 });
    }

    // 1. Upload foto (jika ada)
    const file = formData.get('file') as File | null;
    let fotoUrl: string | null = null;
    if (file && file.size > 0) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'File melebihi 2MB. Gunakan link Google Drive.' }, { status: 400 });
      }
      const bytes = Buffer.from(await file.arrayBuffer());
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const key = `profil/${crypto.randomUUID()}.${ext}`;
      await uploadToStorage(key, bytes, file.type || 'image/jpeg');
      fotoUrl = key;
    }

    // 2. Susun payload update dari field yang dikirim
    const update: Record<string, any> = {};
    const fieldNames = ['nama', 'nomor_hp', 'nama_wali', 'alamat', 'tanggal_lahir', 'jenis_kelamin'];
    for (const f of fieldNames) {
      const v = formData.get(f);
      if (v !== null) update[f] = (v as string) || null;
    }
    if (fotoUrl !== null) update.foto_profil_url = fotoUrl;

    // 3. Update users
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update(update)
      .eq('id', user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, foto_profil_url: fotoUrl });
  } catch (err: any) {
    console.error('Update profile error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
