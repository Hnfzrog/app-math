import { NextResponse } from 'next/server';
import { uploadToStorage, MAX_FILE_SIZE } from '@/lib/storage';

// Upload file ke Supabase Storage (bucket publik). Mengembalikan key object.
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) || 'umum';

    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File melebihi 2MB. Gunakan link Google Drive untuk file besar/video.' }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '') || 'umum';
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
    const key = `${safeFolder}/${crypto.randomUUID()}.${ext}`;

    await uploadToStorage(key, bytes, file.type || 'application/octet-stream');
    return NextResponse.json({ key });
  } catch (err: any) {
    console.error('Upload error:', err);
    return NextResponse.json({ error: err?.message || 'Upload gagal' }, { status: 500 });
  }
}
