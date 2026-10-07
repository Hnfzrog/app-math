import { describe, it, expect } from 'vitest';
import { hitungRataRata, perluRemedial, AMBANG_LULUS } from '@/lib/nilai';

describe('hitungRataRata — rata-rata sederhana komponen terisi', () => {
  it('menghitung rata-rata semua komponen yang ada', () => {
    expect(hitungRataRata({ nilai_lkpd: 80, nilai_tugas: 90, nilai_uh: 70, nilai_keaktifan: 100 })).toBe(85);
  });

  it('mengabaikan komponen kosong dan membagi sejumlah kolom yang terisi', () => {
    expect(hitungRataRata({ nilai_lkpd: 80, nilai_uh: 60 })).toBe(70);
  });

  it('keaktifan ikut dihitung sebagai satu komponen', () => {
    expect(hitungRataRata({ nilai_uh: 50, nilai_keaktifan: 100 })).toBe(75);
  });

  it('null bila tidak ada komponen terisi', () => {
    expect(hitungRataRata({})).toBeNull();
    expect(hitungRataRata({ nilai_lkpd: null, nilai_tugas: null })).toBeNull();
  });

  it('null bila baris null/undefined', () => {
    expect(hitungRataRata(null)).toBeNull();
    expect(hitungRataRata(undefined)).toBeNull();
  });

  it('nilai 0 tetap dihitung (bukan dianggap kosong)', () => {
    expect(hitungRataRata({ nilai_lkpd: 0, nilai_tugas: 100 })).toBe(50);
  });
});

describe('perluRemedial — ambang 75', () => {
  it('true bila rata-rata di bawah ambang', () => {
    expect(perluRemedial(74.9)).toBe(true);
  });

  it('false bila TEPAT ambang (75 = lanjut, sesuai asumsi spec)', () => {
    expect(perluRemedial(AMBANG_LULUS)).toBe(false);
  });

  it('false bila di atas ambang', () => {
    expect(perluRemedial(80)).toBe(false);
  });

  it('false bila rata-rata belum ada', () => {
    expect(perluRemedial(null)).toBe(false);
    expect(perluRemedial(undefined)).toBe(false);
  });
});
