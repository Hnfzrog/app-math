import { test, expect } from '@playwright/test';
import { login, loginAsEmail, tutupAlert } from './helpers';
import { bacaState } from './state';
import { KELAS_UJI, SISWA_UJI_NAMA, SISWA_UJI_EMAIL, SISWA_UJI_PASSWORD } from './testdata';

// Alur TULIS lanjutan — semua hanya menyentuh KELAS-E2E (dibuat/dihapus otomatis).
test.describe('Guru — alur tulis lanjutan (Batch 2/3)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'guru');
  });

  test('E2 — kelola remedial: tandai item + siswa', async ({ page }) => {
    await page.goto('/guru/penilaian');
    await page.waitForLoadState('networkidle');
    await page.locator('select').first().selectOption({ label: KELAS_UJI });
    await page.waitForLoadState('networkidle');
    await page.locator('select').nth(2).selectOption({ index: 1 });
    await page.waitForLoadState('networkidle');

    // Keaktifan otomatis dari presensi (auto: NN%)
    await expect(page.getByText(/auto:\s*\d+%/).first()).toBeVisible();

    await page.getByRole('button', { name: /Kelola Remedial/i }).click();
    const modal = page.locator('.modal-dialog');
    await expect(modal).toBeVisible();
    await modal.locator('select').selectOption({ index: 1 }); // item (tugas/UH) pertama
    await modal.locator('label').filter({ hasText: SISWA_UJI_NAMA }).getByRole('checkbox').check();
    await modal.getByRole('button', { name: /Simpan Remedial/i }).click();
    await tutupAlert(page);
    await expect(modal).toBeHidden({ timeout: 10_000 });

    // Verifikasi tersimpan: buka lagi → siswa uji tercentang
    await page.getByRole('button', { name: /Kelola Remedial/i }).click();
    const modal2 = page.locator('.modal-dialog');
    await modal2.locator('select').selectOption({ index: 1 });
    await expect(modal2.locator('label').filter({ hasText: SISWA_UJI_NAMA }).getByRole('checkbox')).toBeChecked();
  });

  test('D3 — unggah & terbitkan pembahasan ujian', async ({ page }) => {
    const state = bacaState();
    test.skip(!state.ujianUhId, 'seed ujian tidak ada');
    await page.goto(`/guru/ujian/${state.ujianUhId}`);
    await page.waitForLoadState('networkidle');

    const card = page.locator('.card').filter({ hasText: /Pembahasan Ujian/i });
    await expect(card).toBeVisible();
    await card.locator('input[type="file"]').setInputFiles({
      name: 'pembahasan-e2e.txt', mimeType: 'text/plain', buffer: Buffer.from('Pembahasan E2E'),
    });
    await card.getByRole('checkbox').check(); // "Terbitkan sekarang"
    await card.getByRole('button', { name: /Simpan Pembahasan/i }).click();
    await tutupAlert(page);

    await expect(page.locator('.card').filter({ hasText: /Pembahasan Ujian/i })).toContainText(/Terbit/i, { timeout: 10_000 });
  });

  test('E3 — tandai benar/salah & simpan penilaian per siswa', async ({ page }) => {
    const state = bacaState();
    test.skip(!state.ujianUtsId, 'seed ujian tidak ada');
    await page.goto(`/guru/ujian/${state.ujianUtsId}/hasil`);
    await page.waitForLoadState('networkidle');

    const baris = page.getByRole('row', { name: new RegExp(SISWA_UJI_NAMA) });
    await expect(baris).toBeVisible();
    await baris.getByRole('button', { name: /Penilaian/i }).click();
    const modal = page.locator('.modal-dialog');
    await expect(modal).toBeVisible();

    await modal.getByRole('button', { name: /Salah/i }).click();
    await modal.getByRole('button', { name: /Benar/i }).click();
    // Hitungan benar/salah tampil di modal
    await expect(modal.getByText(/Benar\s*:\s*\d+/)).toBeVisible();
    await expect(modal.getByText(/Salah\s*:\s*\d+/)).toBeVisible();
    await modal.getByRole('button', { name: /Simpan Penilaian Siswa Ini/i }).click();
    await tutupAlert(page);
    await expect(modal).toBeHidden({ timeout: 10_000 });
  });
});

test.describe('Siswa — mode ujian (Batch 3)', () => {
  test('D4 — mulai ujian → pelanggaran tercatat', async ({ page }) => {
    const state = bacaState();
    test.skip(!state.ujianUhId, 'seed ujian tidak ada');

    await loginAsEmail(page, SISWA_UJI_EMAIL, SISWA_UJI_PASSWORD, '/siswa/dashboard');

    await page.goto(`/siswa/ujian/${state.ujianUhId}`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Saya Paham/i }).click();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /Setuju.*Mulai/i }).click();

    await expect(page.getByText(/Navigasi Soal/i)).toBeVisible({ timeout: 10_000 });

    // Simulasikan siswa pindah tab (visibilitychange hidden → visible).
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await expect(page.getByText(/Pelanggaran:\s*1/)).toBeVisible({ timeout: 8000 });
  });

  test('D4 — keluar mode ujian → sidebar tampil kembali (tanpa refresh)', async ({ page }) => {
    const state = bacaState();
    test.skip(!state.ujianUhId, 'seed ujian tidak ada');

    await loginAsEmail(page, SISWA_UJI_EMAIL, SISWA_UJI_PASSWORD, '/siswa/dashboard');
    await page.goto(`/siswa/ujian/${state.ujianUhId}`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Saya Paham/i }).click();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /Setuju.*Mulai/i }).click();

    await expect(page.getByText(/Navigasi Soal/i)).toBeVisible({ timeout: 10_000 });
    // Saat ujian: sidebar disembunyikan lewat kelas body.exam-mode
    await expect(page.locator('body')).toHaveClass(/exam-mode/);
    await expect(page.locator('.sidebar')).toBeHidden();

    // Jawab soal pilgan lalu kumpulkan
    await page.locator('input[type="radio"]').first().check();
    await page.getByRole('button', { name: /Selesai.*Kumpulkan/i }).click();
    await page.getByRole('button', { name: /Ya, Kumpulkan/i }).click();

    // Layar hasil: mode ujian berakhir → sidebar HARUS tampil lagi tanpa refresh
    await expect(page.getByRole('heading', { name: /Hasil Ujian/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('body')).not.toHaveClass(/exam-mode/);
    await expect(page.locator('.sidebar')).toBeVisible();
  });
});
