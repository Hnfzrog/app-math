import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Penyalinan soal antar ujian dijalankan di server karena kunci jawaban (soal_ujian_kunci)
// hanya bisa dibaca guru pemilik ujian asal. Lewat server, soal hasil kopian tetap membawa
// kuncinya sehingga auto-nilai pilihan ganda tetap berfungsi.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { target_ujian_id, soal_ids } = await req.json() as { target_ujian_id: string; soal_ids: string[] };

    if (!target_ujian_id || !Array.isArray(soal_ids) || soal_ids.length === 0) {
      return NextResponse.json({ error: 'Pilih minimal satu soal untuk diambil.' }, { status: 400 });
    }

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      return NextResponse.json({ error: 'Sesi tidak valid. Silakan login ulang.' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Sesi tidak valid. Silakan login ulang.' }, { status: 401 });
    }

    // Pemanggil harus guru pengampu kelas ujian tujuan (atau admin).
    const { data: target } = await supabaseAdmin
      .from('ujian')
      .select('id, kelas_id')
      .eq('id', target_ujian_id)
      .single();

    if (!target) {
      return NextResponse.json({ error: 'Ujian tujuan tidak ditemukan.' }, { status: 404 });
    }

    const { data: profil } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = profil?.role === 'admin';
    if (!isAdmin) {
      const { data: guruKelas } = await supabaseAdmin
        .from('guru_kelas')
        .select('kelas_id')
        .eq('guru_id', user.id)
        .eq('kelas_id', target.kelas_id)
        .limit(1);

      if (!guruKelas || guruKelas.length === 0) {
        return NextResponse.json({ error: 'Anda tidak mengampu kelas ujian ini.' }, { status: 403 });
      }
    }

    const { data: sumber, error: sumberError } = await supabaseAdmin
      .from('soal_ujian')
      .select('id, pertanyaan, tipe, opsi, multi_jawaban, butuh_foto_jawaban, lampiran_url')
      .in('id', soal_ids);

    if (sumberError) {
      return NextResponse.json({ error: sumberError.message }, { status: 500 });
    }
    if (!sumber || sumber.length === 0) {
      return NextResponse.json({ error: 'Soal sumber tidak ditemukan.' }, { status: 404 });
    }

    const { data: kunciSumber } = await supabaseAdmin
      .from('soal_ujian_kunci')
      .select('soal_id, kunci_jawaban, pembahasan')
      .in('soal_id', sumber.map((s: any) => s.id));

    const kunciMap = new Map((kunciSumber || []).map((k: any) => [k.soal_id, k]));

    // Snapshot: baris baru, bukan referensi. Guru pengimpor bebas mengedit hasilnya.
    let jumlah = 0;
    for (const s of sumber) {
      const { data: baru, error: insertError } = await supabaseAdmin
        .from('soal_ujian')
        .insert({
          ujian_id: target_ujian_id,
          pertanyaan: s.pertanyaan,
          tipe: s.tipe,
          opsi: s.opsi,
          multi_jawaban: s.multi_jawaban,
          butuh_foto_jawaban: s.butuh_foto_jawaban,
          lampiran_url: s.lampiran_url,
        })
        .select('id')
        .single();

      if (insertError || !baru) {
        return NextResponse.json(
          { error: insertError?.message || 'Gagal menyalin soal.' },
          { status: 500 }
        );
      }

      const kunci = kunciMap.get(s.id);
      if (kunci) {
        const { error: kunciError } = await supabaseAdmin
          .from('soal_ujian_kunci')
          .insert({
            soal_id: baru.id,
            kunci_jawaban: kunci.kunci_jawaban,
            pembahasan: kunci.pembahasan,
          });

        if (kunciError) {
          return NextResponse.json({ error: kunciError.message }, { status: 500 });
        }
      }

      jumlah++;
    }

    return NextResponse.json({ success: true, jumlah });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Server error' }, { status: 500 });
  }
}
