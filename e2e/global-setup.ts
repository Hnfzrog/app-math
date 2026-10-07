import './ws-polyfill';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import { loadEnv } from './env';
import {
  KELAS_UJI, KELAS_UJI_ANGKATAN, KELAS_UJI_SUB, BAB_UJI, KONTEN_UJI,
  SISWA_UJI_EMAIL, SISWA_UJI_PASSWORD, SISWA_UJI_NAMA, STATE_FILE,
} from './testdata';

/**
 * Seed data uji E2E: 1 kelas + 1 siswa uji + assign guru uji + 1 bab + 1 LKPD.
 * Idempotent (bersihkan sisa run sebelumnya dulu). Service key = bypass RLS.
 */
export default async function globalSetup() {
  loadEnv();
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Bersihkan sisa kelas uji dari run sebelumnya (hanya combo angkatan/sub_kelas uji).
  await admin.from('kelas').delete().eq('angkatan', KELAS_UJI_ANGKATAN).eq('sub_kelas', KELAS_UJI_SUB);

  const state: { kelasId?: string; siswaId?: string; guruId?: string; babId?: string; ujianUhId?: string; ujianUtsId?: string } = {};

  const { data: kelas, error: eKelas } = await admin
    .from('kelas')
    .insert({ nama: KELAS_UJI, angkatan: KELAS_UJI_ANGKATAN, sub_kelas: KELAS_UJI_SUB })
    .select().single();
  if (eKelas || !kelas) throw new Error('seed kelas gagal: ' + eKelas?.message);
  state.kelasId = kelas.id;

  // Siswa uji (auth + public.users)
  const { data: existing } = await admin.from('users').select('id').eq('email', SISWA_UJI_EMAIL).maybeSingle();
  let siswaId = existing?.id;
  if (!siswaId) {
    const { data: created, error: eUser } = await admin.auth.admin.createUser({
      email: SISWA_UJI_EMAIL, password: SISWA_UJI_PASSWORD, email_confirm: true,
      user_metadata: { nama: SISWA_UJI_NAMA, role: 'siswa' },
    });
    if (eUser || !created.user) throw new Error('seed siswa gagal: ' + eUser?.message);
    siswaId = created.user.id;
  }
  await admin.from('users').upsert({ id: siswaId, email: SISWA_UJI_EMAIL, nama: SISWA_UJI_NAMA, role: 'siswa' });
  state.siswaId = siswaId;

  await admin.from('siswa_kelas').upsert({ siswa_id: siswaId, kelas_id: state.kelasId });

  // Presensi uji (status 'masuk') → agar keaktifan otomatis = 100%.
  await admin.from('presensi').insert({
    siswa_id: siswaId, kelas_id: state.kelasId,
    tanggal: new Date().toISOString().slice(0, 10), status: 'masuk',
  });

  // Assign guru uji ke kelas uji
  const { data: guru } = await admin.from('users').select('id').eq('email', process.env.E2E_GURU_EMAIL!).maybeSingle();
  if (guru?.id) {
    state.guruId = guru.id;
    await admin.from('guru_kelas').upsert({ guru_id: guru.id, kelas_id: state.kelasId });
  }

  // Bab + LKPD (agar kolom penilaian LKPD muncul)
  const { data: bab } = await admin.from('bab').insert({ kelas_id: state.kelasId, nomor: 1, judul: BAB_UJI }).select().single();
  state.babId = bab?.id;
  if (state.babId) {
    await admin.from('konten').insert({ bab_id: state.babId, tipe: 'lkpd', judul: KONTEN_UJI });
  }

  // Ujian UH terbit + dalam jendela (untuk mode ujian D4 & pembahasan D3).
  const now = Date.now();
  const jadwal = {
    mulai_at: new Date(now - 3_600_000).toISOString(),
    selesai_at: new Date(now + 3_600_000).toISOString(),
    is_terbit: true,
  };
  if (state.guruId && state.babId) {
    const { data: uh } = await admin.from('ujian').insert({
      guru_id: state.guruId, kelas_id: state.kelasId, jenis: 'UH', deskripsi: 'UH E2E',
      durasi_menit: 30, bab_id: state.babId, ...jadwal,
    }).select().single();
    if (uh) {
      state.ujianUhId = uh.id;
      const { data: soalUh } = await admin.from('soal_ujian').insert({
        ujian_id: uh.id, pertanyaan: 'E2E: 1 + 1 = ?', tipe: 'pg', opsi: ['1', '2', '3'], multi_jawaban: false,
      }).select().single();
      if (soalUh) await admin.from('soal_ujian_kunci').insert({ soal_id: soalUh.id, kunci_jawaban: JSON.stringify(['2']) });
    }

    // Ujian UTS terbit + punya 1 jawaban siswa uji (untuk penilaian benar/salah E3).
    const { data: uts } = await admin.from('ujian').insert({
      guru_id: state.guruId, kelas_id: state.kelasId, jenis: 'UTS', deskripsi: 'UTS E2E',
      durasi_menit: 60, ...jadwal, bab_id: null,
    }).select().single();
    if (uts) {
      state.ujianUtsId = uts.id;
      const { data: soalUts } = await admin.from('soal_ujian').insert({
        ujian_id: uts.id, pertanyaan: 'E2E UTS: 2 + 2 = ?', tipe: 'pg', opsi: ['3', '4', '5'], multi_jawaban: false,
      }).select().single();
      if (soalUts && state.siswaId) {
        await admin.from('soal_ujian_kunci').insert({ soal_id: soalUts.id, kunci_jawaban: JSON.stringify(['4']) });
        await admin.from('jawaban_ujian').insert({
          soal_id: soalUts.id, siswa_id: state.siswaId, jawaban_teks: '4',
          skor_ai: 100, feedback_ai: 'Auto-Graded: Benar', status: 'pending_verifikasi',
        });
      }
    }
  }

  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}
