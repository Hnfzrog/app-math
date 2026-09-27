import { NextResponse } from 'next/server';
import { getFromStorage } from '@/lib/storage';

// Proxy baca file dari Supabase Storage (cadangan bila bucket privat).
// Untuk bucket publik, tampil langsung via getPublicUrl.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  if (!key) {
    return NextResponse.json({ error: 'Key tidak ditemukan' }, { status: 400 });
  }

  try {
    const { body, contentType } = await getFromStorage(key);
    return new NextResponse(new Uint8Array(body), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600'
      }
    });
  } catch (err: any) {
    console.error('Get file error:', err);
    return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 404 });
  }
}
