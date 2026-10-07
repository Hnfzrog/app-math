/**
 * Menjalankan `fn` untuk setiap item dengan batas konkurensi.
 *
 * Dipakai untuk memanggil penilaian AI (Gemini) secara paralel tanpa membanjiri
 * API — pangkal masalah "menunggu lama setelah klik kirim" pada ujian & tugas,
 * yang sebelumnya menilai soal uraian satu per satu secara berurutan.
 *
 * Urutan hasil mengikuti urutan `items`.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  const worker = async () => {
    while (next < items.length) {
      const current = next++;
      results[current] = await fn(items[current], current);
    }
  };

  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, () =>
    worker()
  );
  await Promise.all(workers);
  return results;
}
