import { describe, it, expect } from 'vitest';
import { mapWithConcurrency } from '@/lib/concurrency';

describe('mapWithConcurrency', () => {
  it('mempertahankan urutan hasil sesuai input', async () => {
    const out = await mapWithConcurrency([3, 1, 2], 2, async (n: number) => n * 10);
    expect(out).toEqual([30, 10, 20]);
  });

  it('tidak melebihi batas konkurensi', async () => {
    let aktif = 0;
    let maks = 0;
    await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async () => {
      aktif++;
      maks = Math.max(maks, aktif);
      await new Promise((r) => setTimeout(r, 5));
      aktif--;
      return 0;
    });
    expect(maks).toBeLessThanOrEqual(2);
  });

  it('array kosong → hasil kosong', async () => {
    expect(await mapWithConcurrency([], 3, async (x: number) => x)).toEqual([]);
  });

  it('index yang diberikan sesuai posisi', async () => {
    const idx = await mapWithConcurrency(['a', 'b', 'c'], 2, async (_x: string, i: number) => i);
    expect(idx).toEqual([0, 1, 2]);
  });
});
