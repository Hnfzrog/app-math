// Logika rapor (cetak & perangkingan) — 7 Okt 2026.
// Aturan nilai huruf, deskripsi capaian, rata-rata, dan ketidakhadiran diletakkan di sini
// (bukan di halaman) supaya konsisten antara sisi guru & siswa dan bisa diuji unit-test.

/** Ambang ketuntasan default (dipakai bila `pengaturan.kkm` tidak tersedia). */
export const KKM_DEFAULT = 75;

export const SEMESTER_GANJIL = 'ganjil';
export const SEMESTER_GENAP = 'genap';

/** Nilai angka → huruf (Kurikulum Merdeka): 90–100 A, 80–89 B, 70–79 C, <70 D. */
export function nilaiHuruf(angka: number | null | undefined): string | null {
  if (angka === null || angka === undefined || Number.isNaN(angka)) return null;
  if (angka >= 90) return 'A';
  if (angka >= 80) return 'B';
  if (angka >= 70) return 'C';
  return 'D';
}

/**
 * Deskripsi kemajuan belajar per bab dari band `nilai_akhir`.
 * NULL/belum dinilai → "Belum dinilai". Ambang "mencapai ketuntasan" memakai `kkm`.
 */
export function deskripsiCapaian(
  judul: string | null | undefined,
  nilaiAkhir: number | null | undefined,
  kkm: number = KKM_DEFAULT
): string {
  const nama = (judul ?? '').trim();
  if (nilaiAkhir === null || nilaiAkhir === undefined || Number.isNaN(nilaiAkhir)) {
    return nama ? `Belum dinilai untuk ${nama}.` : 'Belum dinilai.';
  }
  if (nilaiAkhir >= 90) return `Mencapai kompetensi ${nama} dengan sangat baik dan melebihi ekspektasi.`;
  if (nilaiAkhir >= 80) return `Mencapai kompetensi ${nama} dengan baik.`;
  if (nilaiAkhir >= kkm) return `Mencapai ketuntasan minimum ${nama} (KKTP ${kkm}).`;
  return `Belum mencapai ketuntasan minimum ${nama}; perlu remedial.`;
}

/** Rata-rata nilai_akhir (untuk perangkingan & nilai akhir rapor). */
export function rataRapor(nilaiAkhirList: (number | null | undefined)[]): number | null {
  const vals = nilaiAkhirList.filter(
    (v): v is number => v !== null && v !== undefined && !Number.isNaN(v)
  );
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** Label semester untuk tampilan. */
export function labelSemester(semester: string | null | undefined): string {
  return semester === SEMESTER_GENAP ? 'Genap' : 'Ganjil';
}

/**
 * Apakah tanggal presensi termasuk semester tsb. Konvensi tahun ajaran Indonesia:
 * Ganjil = Juli–Desember (bulan 7–12), Genap = Januari–Juni (bulan 1–6).
 * Baris tanpa tanggal valid dianggap termasuk (jangan hilangkan data lama).
 */
export function termasukSemester(
  tanggal: string | null | undefined,
  semester: string | null | undefined
): boolean {
  const m = typeof tanggal === 'string' ? parseInt(tanggal.slice(5, 7), 10) : NaN;
  if (!Number.isFinite(m) || m < 1 || m > 12) return true;
  return semester === SEMESTER_GENAP ? m <= 6 : m >= 7;
}

/** Hitung ketidakhadiran dari baris presensi (sakit / izin / tanpa keterangan = alpha). */
export function hitungKetidakhadiran(
  rows: { status: string; tanggal?: string | null }[],
  semester?: string | null
): {
  sakit: number;
  izin: number;
  tanpaKeterangan: number;
} {
  let sakit = 0;
  let izin = 0;
  let tanpaKeterangan = 0;
  for (const r of rows) {
    if (semester && !termasukSemester(r.tanggal, semester)) continue;
    if (r.status === 'sakit') sakit += 1;
    else if (r.status === 'izin') izin += 1;
    else if (r.status === 'alpha') tanpaKeterangan += 1;
  }
  return { sakit, izin, tanpaKeterangan };
}
