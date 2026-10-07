import { describe, it, expect } from 'vitest';
import { statusUjian, labelStatusUjian, badgeStatusUjian } from '@/lib/jadwalUjian';

const past = new Date(Date.now() - 3_600_000).toISOString();
const future = new Date(Date.now() + 3_600_000).toISOString();

describe('statusUjian', () => {
  it('draf bila belum diterbitkan', () => {
    expect(statusUjian({ is_terbit: false, mulai_at: past, selesai_at: future })).toBe('draf');
  });

  it('belum bila jadwal buka belum tiba', () => {
    expect(statusUjian({ is_terbit: true, mulai_at: future, selesai_at: future })).toBe('belum');
  });

  it('buka bila di dalam jendela jadwal', () => {
    expect(statusUjian({ is_terbit: true, mulai_at: past, selesai_at: future })).toBe('buka');
  });

  it('tutup bila sudah lewat jadwal tutup', () => {
    expect(statusUjian({ is_terbit: true, mulai_at: past, selesai_at: past })).toBe('tutup');
  });
});

describe('label & badge status', () => {
  it('label sesuai status', () => {
    expect(labelStatusUjian('draf')).toBe('DRAF');
    expect(labelStatusUjian('buka')).toBe('BERLANGSUNG');
    expect(labelStatusUjian('tutup')).toBe('DITUTUP');
  });

  it('badge success hanya untuk status buka', () => {
    expect(badgeStatusUjian('buka')).toBe('badge-success');
    expect(badgeStatusUjian('draf')).toBe('badge-secondary');
  });
});
