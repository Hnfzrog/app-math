import { describe, it, expect } from 'vitest';
import { pembahasanTerbit } from '@/lib/pembahasan';

const now = new Date('2026-10-10T12:00:00Z').getTime();
const past = '2026-10-10T11:00:00Z';
const future = '2026-10-10T13:00:00Z';

describe('pembahasanTerbit', () => {
  it('false bila tidak ada file', () => {
    expect(pembahasanTerbit({ pembahasan_file_url: null, pembahasan_is_terbit: true }, now)).toBe(false);
    expect(pembahasanTerbit(null, now)).toBe(false);
    expect(pembahasanTerbit(undefined, now)).toBe(false);
  });

  it('true bila diterbitkan manual (is_terbit)', () => {
    expect(pembahasanTerbit({ pembahasan_file_url: 'x.pdf', pembahasan_is_terbit: true }, now)).toBe(true);
  });

  it('true bila waktu terbit (otomatis/jadwal) sudah lewat', () => {
    expect(pembahasanTerbit({ pembahasan_file_url: 'x.pdf', pembahasan_terbit_at: past }, now)).toBe(true);
  });

  it('false bila waktu terbit belum tiba', () => {
    expect(pembahasanTerbit({ pembahasan_file_url: 'x.pdf', pembahasan_terbit_at: future }, now)).toBe(false);
  });

  it('false bila ada file tapi belum terbit & tanpa jadwal', () => {
    expect(pembahasanTerbit({ pembahasan_file_url: 'x.pdf' }, now)).toBe(false);
  });
});
