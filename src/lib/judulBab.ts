/**
 * Judul bab yang dinormalisasi agar tidak dobel.
 *
 * Banyak `bab.judul` sudah memuat prefix "Bab N:" (guru mengetiknya di form
 * "Contoh: Bab 2: Aljabar"), sementara UI juga menambahkan nomor bab →
 * menghasilkan "Bab 1: Bab 1: Aljabar". Helper ini membuang prefix tsb lalu
 * menambahkan "{nomor}. " bila nomor diberikan.
 *
 * `judulBab(1, 'BAB 1: ALGORITMA')` → "1. ALGORITMA" · `judulBab(null, 'Aljabar')` → "Aljabar"
 */
export function judulBab(
  nomor: number | string | null | undefined,
  judul: string | null | undefined
): string {
  const bersih = String(judul ?? '')
    .replace(/^\s*bab\s*\d+\s*[:.\-]\s*/i, '')
    .trim();
  if (nomor === null || nomor === undefined || nomor === '') return bersih;
  return bersih ? `${nomor}. ${bersih}` : String(nomor);
}
