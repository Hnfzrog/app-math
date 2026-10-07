// Logika penilaian per bab (revisi 6 Okt 2026).
// Dipakai bersama halaman Penilaian (guru) & Nilai Saya (siswa), dan diuji unit-test
// supaya aturan rata-rata/ambang remedial tidak menyimpang dari spec.

export type KomponenNilai = {
  nilai_lkpd?: number | null;
  nilai_tugas?: number | null;
  nilai_uh?: number | null;
  nilai_keaktifan?: number | null;
};

/** Ambang kelulusan bab: rata-rata >= 75 → lanjut; < 75 → remedial. */
export const AMBANG_LULUS = 75;

/**
 * Rata-rata sederhana komponen yang TERISI (keaktifan ikut sebagai satu komponen).
 * Komponen kosong (null/undefined/NaN) diabaikan — sesuai "rata-rata bergantung
 * banyaknya kolom yang ada". Mengembalikan null bila belum ada komponen terisi.
 */
export function hitungRataRata(row: KomponenNilai | null | undefined): number | null {
  if (!row) return null;
  const vals = [row.nilai_lkpd, row.nilai_tugas, row.nilai_uh, row.nilai_keaktifan]
    .filter((v): v is number => v !== null && v !== undefined && !Number.isNaN(v));
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** Siswa perlu remedial bila rata-rata ada dan di bawah ambang (< 75). */
export function perluRemedial(rata: number | null | undefined): boolean {
  return rata !== null && rata !== undefined && rata < AMBANG_LULUS;
}
