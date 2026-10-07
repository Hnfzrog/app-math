import { test, expect } from '@playwright/test';
import { login } from './helpers';

// Smoke E2E (read-only) untuk fitur baru di role GURU.
test.describe('Guru — smoke fitur baru', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'guru');
  });

  test('A1 — kartu dashboard dapat diklik', async ({ page }) => {
    await page.goto('/guru/dashboard');
    await expect(page.locator('a.stat-card')).toHaveCount(2);
  });

  test('E2 — Penilaian per bab menampilkan komponen & tombol Kelola Remedial', async ({ page }) => {
    await page.goto('/guru/penilaian');
    await page.waitForLoadState('networkidle');
    const kelas = page.locator('select').first();
    if ((await kelas.locator('option').count()) <= 1) {
      test.skip(true, 'Guru ini belum punya kelas uji — loncat.');
    }
    await kelas.selectOption({ index: 1 });

    // select ke-3 = pilih Bab (0: kelas, 1: tampilan, 2: bab)
    const bab = page.locator('select').nth(2);
    if ((await bab.count()) > 0 && (await bab.locator('option').count()) > 1) {
      await bab.selectOption({ index: 1 });
      await expect(page.getByRole('columnheader', { name: /Keaktifan/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /Rata-rata/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Kelola Remedial/i })).toBeVisible();
    }
  });

  test('E3 — halaman hasil ujian memuat', async ({ page }) => {
    await page.goto('/guru/ujian');
    await expect(page.getByRole('heading', { name: /ujian/i }).first()).toBeVisible();
  });

  test('C2 — halaman Pengumuman guru punya form', async ({ page }) => {
    await page.goto('/guru/pengumuman');
    await expect(page.getByRole('heading', { name: /Pengumuman/i }).first()).toBeVisible();
    await expect(page.getByLabel(/Judul/i)).toBeVisible();
    await expect(page.getByLabel(/Deskripsi/i)).toBeVisible();
  });

  test('tanpa error runtime di halaman utama guru', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    for (const path of ['/guru/dashboard', '/guru/penilaian', '/guru/pengumuman']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
    }
    expect(errors, errors.join('\n')).toEqual([]);
  });
});
