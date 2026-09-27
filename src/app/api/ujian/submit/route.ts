import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AiScoreError, isPilihanGandaBenar, scoreEssayWithAi } from '@/lib/aiScore';

// Penilaian dijalankan di server agar kunci jawaban (soal_ujian_kunci) tidak pernah
// sampai ke browser siswa — policy baca soal_ujian sendiri terbuka untuk guru.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type JawabanMasuk = { soal_id: string; jawaban_teks?: string | string[] | null; foto_url?: string | null };

// Disimpan sebagai text: string apa adanya, array di-JSON-kan (pola sama dengan jawaban_siswa).
function serializeJawaban(nilai: JawabanMasuk['jawaban_teks']): string {
  if (nilai == null) return '';
  return typeof nilai === 'string' ? nilai : JSON.stringify(nilai);
}

export async function POST(req: Request) {
  try {
    const { ujian_id, jawaban } = await req.json() as { ujian_id: string; jawaban: JawabanMasuk[] };

    if (!ujian_id || !Array.isArray(jawaban) || jawaban.length === 0) {
      return NextResponse.json({ error: 'Data jawaban tidak lengkap.' }, { status: 400 });
    }

    // Verifikasi pemanggil dari token (mencegah siswa mengirim atas nama siswa lain).
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      return NextResponse.json({ error: 'Sesi tidak valid. Silakan login ulang.' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Sesi tidak valid. Silakan login ulang.' }, { status: 401 });
    }
    const siswaId = user.id;

    // Hanya ujian yang sudah diterbitkan yang boleh dikumpulkan.
    // Waktu tutup sengaja TIDAK dicek di sini: siswa yang sudah terlanjur mulai tetap
    // harus bisa mengumpulkan jawabannya walau jam tutup sudah lewat (gerbang masuk saja).
    const { data: ujian } = await supabaseAdmin
      .from('ujian')
      .select('id, is_terbit, jenis, bab_id')
      .eq('id', ujian_id)
      .single();

    if (!ujian) {
      return NextResponse.json({ error: 'Ujian tidak ditemukan.' }, { status: 404 });
    }
    if (!ujian.is_terbit) {
      return NextResponse.json({ error: 'Ujian ini belum diterbitkan.' }, { status: 403 });
    }

    // Soal + kunci diambil pakai service role.
    const { data: soalList, error: soalError } = await supabaseAdmin
      .from('soal_ujian')
      .select('id, tipe, pertanyaan')
      .eq('ujian_id', ujian_id);

    if (soalError) {
      return NextResponse.json({ error: soalError.message }, { status: 500 });
    }
    if (!soalList || soalList.length === 0) {
      return NextResponse.json({ error: 'Ujian ini belum memiliki soal.' }, { status: 400 });
    }

    const soalMap = new Map(soalList.map((s: any) => [s.id, s]));

    // Tolak soal yang bukan milik ujian ini (mencegah jawaban disuntik dari ujian lain).
    const soalIds = jawaban.map(j => j.soal_id);
    if (soalIds.some(id => !soalMap.has(id))) {
      return NextResponse.json({ error: 'Ada jawaban untuk soal yang bukan milik ujian ini.' }, { status: 400 });
    }

    // Satu kali percobaan: kalau sudah ada jawaban tersimpan, jangan timpa nilai yang mungkin sudah divalidasi.
    const { data: existing } = await supabaseAdmin
      .from('jawaban_ujian')
      .select('id')
      .eq('siswa_id', siswaId)
      .in('soal_id', soalIds)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'Anda sudah mengerjakan ujian ini.' }, { status: 409 });
    }

    const { data: kunciList } = await supabaseAdmin
      .from('soal_ujian_kunci')
      .select('soal_id, kunci_jawaban')
      .in('soal_id', soalIds);

    const kunciMap = new Map((kunciList || []).map((k: any) => [k.soal_id, k.kunci_jawaban]));

    const inserts: any[] = [];
    const hasil: any[] = [];

    for (const j of jawaban) {
      const soal: any = soalMap.get(j.soal_id);
      const kunci = kunciMap.get(j.soal_id);
      const nilaiSerialized = serializeJawaban(j.jawaban_teks);

      const row: any = {
        soal_id: j.soal_id,
        siswa_id: siswaId,
        jawaban_teks: nilaiSerialized,
        foto_url: j.foto_url || null,
        status: 'pending_verifikasi',
      };

      if (soal.tipe === 'pg') {
        if (!kunci) {
          // Kunci belum diatur guru — biar guru yang menilai manual.
          row.skor_ai = null;
          row.feedback_ai = 'Kunci jawaban belum diatur guru.';
          hasil.push({ soal_id: j.soal_id, tipe: 'pg', skor: null, feedback: row.feedback_ai });
        } else {
          const nilaiUntukDinilai = Array.isArray(j.jawaban_teks) ? j.jawaban_teks : j.jawaban_teks ?? '';
          const benar = isPilihanGandaBenar(nilaiUntukDinilai, kunci);
          row.skor_ai = benar ? 100 : 0;
          row.feedback_ai = benar ? 'Auto-Graded: Benar' : 'Auto-Graded: Salah';
          hasil.push({ soal_id: j.soal_id, tipe: 'pg', skor: row.skor_ai, feedback: row.feedback_ai });
        }
      } else {
        // Uraian: dibantu AI, guru tetap wajib validasi.
        try {
          const ai = await scoreEssayWithAi({
            pertanyaan: soal.pertanyaan,
            kunciJawaban: kunci || '',
            jawabanSiswa: nilaiSerialized,
          });
          row.skor_ai = ai.skor;
          row.feedback_ai = ai.feedback;
        } catch (err: any) {
          console.error('Gagal menilai uraian dengan AI:', err);
          row.skor_ai = null;
          row.feedback_ai = err instanceof AiScoreError ? err.message : 'Gagal menghubungi AI untuk koreksi.';
        }
        // Skor uraian tidak dibocorkan ke siswa — menunggu validasi guru.
        hasil.push({ soal_id: j.soal_id, tipe: 'uraian', skor: null, feedback: null });
      }

      inserts.push(row);
    }

    const { error: insertError } = await supabaseAdmin.from('jawaban_ujian').insert(inserts);
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // UH: tulis rata-rata skor ujian ke nilai per-bab (skor_benar) supaya hasil langsung
    // muncul di menu Penilaian guru & Nilai Saya siswa. Guru bisa menyesuaikan/validasi lagi.
    if (ujian?.bab_id && ujian.jenis === 'UH') {
      const skors = inserts
        .map(r => r.skor_ai)
        .filter(v => v != null)
        .map(Number);
      const rata = skors.length > 0
        ? skors.reduce((a, b) => a + b, 0) / skors.length
        : 0;

      const { error: nilaiError } = await supabaseAdmin
        .from('nilai')
        .upsert(
          { siswa_id: siswaId, bab_id: ujian.bab_id, skor_benar: Math.round(rata * 100) / 100 },
          { onConflict: 'siswa_id,bab_id' }
        );

      if (nilaiError) {
        console.error('Gagal menyimpan skor ke nilai:', nilaiError);
      }
    }

    return NextResponse.json({ success: true, hasil });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Server error' }, { status: 500 });
  }
}
