import { describe, it, expect } from 'vitest';
import { judulBab } from '@/lib/judulBab';

describe('judulBab — normalisasi judul bab', () => {
  it('membuang prefix "Bab N:" yang membuat dobel', () => {
    expect(judulBab(1, 'BAB 1: ALGORITMA')).toBe('1. ALGORITMA');
  });

  it('mendukung pemisah titik dan strip (case-insensitive)', () => {
    expect(judulBab(2, 'Bab 2. Aljabar')).toBe('2. Aljabar');
    expect(judulBab(2, 'bab 2 - Aljabar')).toBe('2. Aljabar');
  });

  it('tanpa nomor → hanya membersihkan prefix', () => {
    expect(judulBab(null, 'Bab 3: Trigonometri')).toBe('Trigonometri');
  });

  it('judul tanpa prefix dibiarkan apa adanya', () => {
    expect(judulBab(1, 'Aljabar')).toBe('1. Aljabar');
  });

  it('judul kosong → hanya nomor', () => {
    expect(judulBab(1, null)).toBe('1');
    expect(judulBab(1, '')).toBe('1');
  });
});
