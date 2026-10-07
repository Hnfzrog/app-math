// Aturan visibilitas pembahasan (revisi 6 Okt 2026) — dipakai halaman siswa
// (hasil ujian & hasil tugas) dan diuji unit-test.

export type PembahasanInfo = {
  pembahasan_file_url?: string | null;
  pembahasan_is_terbit?: boolean | null;
  pembahasan_terbit_at?: string | null;
};

/**
 * Pembahasan tampil bila ADA FILE dan (terbit manual **atau** waktu terbit
 * otomatis/jadwal sudah lewat). `now` bisa diinjeksi untuk pengujian.
 */
export function pembahasanTerbit(
  p: PembahasanInfo | null | undefined,
  now: number = Date.now()
): boolean {
  if (!p || !p.pembahasan_file_url) return false;
  if (p.pembahasan_is_terbit) return true;
  if (p.pembahasan_terbit_at) return now >= new Date(p.pembahasan_terbit_at).getTime();
  return false;
}
