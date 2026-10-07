import { test, expect } from '@playwright/test';
import { login } from './helpers';

// Smoke E2E (read-only) untuk fitur baru di role SISWA.
// Tidak ada penulisan data — hanya navigasi & pemeriksaan elemen.
test.describe('Siswa — smoke fitur baru', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'siswa');
  });

  test('A1 — kartu dashboard dapat diklik', async ({ page }) => {
    await page.goto('/siswa/dashboard');
    // Kartu statistik kini <Link> (a), bukan <div> statis.
    await expect(page.locator('a.stat-card').first()).toBeVisible();
    await page.locator('a.stat-card').first().click();
    await expect(page).toHaveURL(/\/siswa\/(materi|tugas|ujian)/);
  });

  test('D1 — daftar ujian menampilkan "Jumlah Soal"', async ({ page }) => {
    await page.goto('/siswa/ujian');
    await expect(page.getByRole('heading', { name: /Daftar Ujian/i })).toBeVisible();
    // Info jumlah soal muncul pada kartu yang ada (jika ada ujian terbit).
    const jumlah = page.getByText('Jumlah Soal');
    if (await jumlah.count() > 0) {
      await expect(jumlah.first()).toBeVisible();
    }
  });

  test('D1 — daftar tugas punya kolom "Jumlah Soal"', async ({ page }) => {
    await page.goto('/siswa/tugas');
    await expect(page.getByRole('columnheader', { name: /Jumlah Soal/i })).toBeVisible();
  });

  test('E2 — Nilai Saya memakai kolom komponen', async ({ page }) => {
    await page.goto('/siswa/nilai');
    // Kolom inti selalu ada; LKPD/Tugas/UH hanya muncul bila komponennya ada di bab.
    for (const k of ['Bab', 'Keaktifan', 'Rata-rata']) {
      await expect(page.getByRole('columnheader', { name: new RegExp(`^${k}$`, 'i') }).first()).toBeVisible();
    }
  });

  test('judul bab tidak dobel ("Bab N: Bab N:")', async ({ page }) => {
    for (const path of ['/siswa/materi', '/siswa/kelas', '/siswa/nilai']) {
      await page.goto(path);
      await expect(page.getByText(/Bab\s*\d+\s*:\s*Bab\s*\d+/i)).toHaveCount(0);
    }
  });

  test('C1/C2 — dashboard memuat tanpa error & feed pengumuman ok', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/siswa/dashboard');
    await expect(page.locator('a.stat-card')).toHaveCount(4);
    expect(errors, errors.join('\n')).toEqual([]);
  });
});
