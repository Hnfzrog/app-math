import { describe, it, expect } from 'vitest';
import {
  nilaiHuruf,
  deskripsiCapaian,
  rataRapor,
  labelSemester,
  hitungKetidakhadiran,
  termasukSemester,
  KKM_DEFAULT,
} from '@/lib/rapor';

describe('nilaiHuruf — angka → huruf', () => {
  it('90–100 → A', () => {
    expect(nilaiHuruf(100)).toBe('A');
    expect(nilaiHuruf(90)).toBe('A');
  });
  it('80–89 → B', () => {
    expect(nilaiHuruf(89)).toBe('B');
    expect(nilaiHuruf(80)).toBe('B');
  });
  it('70–79 → C', () => {
    expect(nilaiHuruf(79)).toBe('C');
    expect(nilaiHuruf(70)).toBe('C');
  });
  it('<70 → D', () => {
    expect(nilaiHuruf(69)).toBe('D');
    expect(nilaiHuruf(0)).toBe('D');
  });
  it('null/undefined/NaN → null', () => {
    expect(nilaiHuruf(null)).toBeNull();
    expect(nilaiHuruf(undefined)).toBeNull();
    expect(nilaiHuruf(Number.NaN)).toBeNull();
  });
});

describe('deskripsiCapaian — template dari band nilai_akhir', () => {
  it('belum dinilai → teks belum dinilai', () => {
    expect(deskripsiCapaian('Aljabar', null)).toContain('Belum dinilai');
  });
  it('≥90 → sangat baik', () => {
    expect(deskripsiCapaian('Aljabar', 95)).toContain('sangat baik');
  });
  it('80–89 → baik', () => {
    expect(deskripsiCapaian('Aljabar', 85)).toContain('dengan baik');
  });
  it('≥KKM dan <80 → mencapai ketuntasan minimum', () => {
    expect(deskripsiCapaian('Aljabar', 76)).toContain('ketuntasan minimum');
  });
  it('<KKM → perlu remedial', () => {
    expect(deskripsiCapaian('Aljabar', 60)).toContain('remedial');
  });
  it('kkm custom ikut dipakai', () => {
    expect(deskripsiCapaian('Aljabar', 70, 70)).toContain('ketuntasan minimum');
    expect(deskripsiCapaian('Aljabar', 69, 70)).toContain('remedial');
  });
  it('judul kosong tidak menghasilkan teks menggantung', () => {
    expect(deskripsiCapaian('', 85)).toContain('dengan baik');
  });
});

describe('rataRapor — rata-rata nilai_akhir', () => {
  it('rata-rata semua nilai', () => {
    expect(rataRapor([80, 90, 70])).toBe(80);
  });
  it('mengabaikan null/undefined/NaN', () => {
    expect(rataRapor([80, null, 90, undefined, Number.NaN])).toBe(85);
  });
  it('null bila tidak ada nilai', () => {
    expect(rataRapor([])).toBeNull();
    expect(rataRapor([null, undefined])).toBeNull();
  });
});

describe('labelSemester', () => {
  it('ganjil/genap', () => {
    expect(labelSemester('ganjil')).toBe('Ganjil');
    expect(labelSemester('genap')).toBe('Genap');
  });
  it('nilai tak dikenal/ kosong → Ganjil', () => {
    expect(labelSemester(null)).toBe('Ganjil');
    expect(labelSemester(undefined)).toBe('Ganjil');
    expect(labelSemester('')).toBe('Ganjil');
  });
});

describe('hitungKetidakhadiran', () => {
  it('menghitung sakit/izin/alpha', () => {
    expect(
      hitungKetidakhadiran([
        { status: 'sakit' },
        { status: 'sakit' },
        { status: 'izin' },
        { status: 'alpha' },
        { status: 'alpha' },
        { status: 'masuk' },
        { status: 'masuk' },
      ])
    ).toEqual({ sakit: 2, izin: 1, tanpaKeterangan: 2 });
  });
  it('kosong → nol semua', () => {
    expect(hitungKetidakhadiran([])).toEqual({ sakit: 0, izin: 0, tanpaKeterangan: 0 });
  });
  it('filter semester: ganjil = Jul–Des', () => {
    expect(
      hitungKetidakhadiran(
        [
          { status: 'sakit', tanggal: '2025-08-01' }, // ganjil
          { status: 'izin', tanggal: '2025-02-01' }, // genap
          { status: 'alpha', tanggal: '2025-12-15' }, // ganjil
        ],
        'ganjil'
      )
    ).toEqual({ sakit: 1, izin: 0, tanpaKeterangan: 1 });
  });
  it('filter semester: genap = Jan–Jun', () => {
    expect(
      hitungKetidakhadiran(
        [
          { status: 'sakit', tanggal: '2025-06-30' }, // genap
          { status: 'izin', tanggal: '2025-07-01' }, // ganjil
          { status: 'alpha', tanggal: '2025-01-10' }, // genap
        ],
        'genap'
      )
    ).toEqual({ sakit: 1, izin: 0, tanpaKeterangan: 1 });
  });
  it('tanpa semester → semua dihitung (backward compatible)', () => {
    expect(
      hitungKetidakhadiran([
        { status: 'sakit', tanggal: '2025-08-01' },
        { status: 'sakit', tanggal: '2025-02-01' },
      ])
    ).toEqual({ sakit: 2, izin: 0, tanpaKeterangan: 0 });
  });
  it('tanggal invalid/kosong → tetap dihitung', () => {
    expect(
      hitungKetidakhadiran([{ status: 'sakit', tanggal: null }], 'ganjil')
    ).toEqual({ sakit: 1, izin: 0, tanpaKeterangan: 0 });
  });
});

describe('termasukSemester', () => {
  it('ganjil = bulan 7–12', () => {
    expect(termasukSemester('2025-07-01', 'ganjil')).toBe(true);
    expect(termasukSemester('2025-12-31', 'ganjil')).toBe(true);
    expect(termasukSemester('2025-06-30', 'ganjil')).toBe(false);
  });
  it('genap = bulan 1–6', () => {
    expect(termasukSemester('2025-01-01', 'genap')).toBe(true);
    expect(termasukSemester('2025-06-30', 'genap')).toBe(true);
    expect(termasukSemester('2025-07-01', 'genap')).toBe(false);
  });
  it('tanggal invalid → true (fallback)', () => {
    expect(termasukSemester(null, 'ganjil')).toBe(true);
    expect(termasukSemester(undefined, 'genap')).toBe(true);
    expect(termasukSemester('bukan-tanggal', 'ganjil')).toBe(true);
  });
});

describe('konstanta', () => {
  it('KKM default 75', () => {
    expect(KKM_DEFAULT).toBe(75);
  });
});
