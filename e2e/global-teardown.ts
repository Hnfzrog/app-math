import './ws-polyfill';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import { loadEnv } from './env';
import { STATE_FILE } from './testdata';

/**
 * Hapus SEMUA data uji yang dibuat globalSetup (kelas/bab/nilai + siswa uji).
 * Tidak menyentuh data asli — hanya baris yang kita buat.
 */
export default async function globalTeardown() {
  loadEnv();
  if (!fs.existsSync(STATE_FILE)) return;
  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  if (state.babId) await admin.from('nilai').delete().eq('bab_id', state.babId);

  // Bersihkan pengumuman uji yang mungkin tersisa dari run yang gagal (berdasarkan marker judul).
  await admin.from('pengumuman').delete().like('judul', 'E2E Pengumuman%');

  if (state.kelasId) {
    await admin.from('guru_kelas').delete().eq('kelas_id', state.kelasId);
    await admin.from('siswa_kelas').delete().eq('kelas_id', state.kelasId);
    // cascade: bab → konten → soal; remedial_target/pengumuman_target kelas ini ikut terhapus
    await admin.from('kelas').delete().eq('id', state.kelasId);
  }

  if (state.siswaId) {
    await admin.from('notifikasi').delete().eq('user_id', state.siswaId);
    await admin.from('users').delete().eq('id', state.siswaId);
    await admin.auth.admin.deleteUser(state.siswaId);
  }

  fs.rmSync(STATE_FILE, { force: true });
}
