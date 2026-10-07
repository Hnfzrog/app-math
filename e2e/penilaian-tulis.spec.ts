import { test, expect } from '@playwright/test';
import { login, tutupAlert } from './helpers';
import { KELAS_UJI, SISWA_UJI_NAMA } from './testdata';

// Alur TULIS Batch 2 — hanya menyentuh KELAS-E2E (dibuat/dihapus oleh global setup/teardown).
test.describe('Guru — alur tulis penilaian (Batch 2)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'guru');
  });

  test('E2 — simpan nilai LKPD → kolom & rata-rata terisi', async ({ page }) => {
    await page.goto('/guru/penilaian');
    await page.waitForLoadState('networkidle');

    // Pilih kelas uji (0) → tampilan per bab default → pilih bab (select ke-3)
    await page.locator('select').first().selectOption({ label: KELAS_UJI });
    await page.waitForLoadState('networkidle');
    await page.locator('select').nth(2).selectOption({ index: 1 });
    await page.waitForLoadState('networkidle');

    // Baris siswa uji + kolom LKPD tersedia
    const baris = page.getByRole('row', { name: new RegExp(SISWA_UJI_NAMA) });
    await expect(baris).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /^LKPD$/i })).toBeVisible();

    // Buka modal penilaian LKPD (per item)
    await baris.getByRole('button', { name: /Penilaian LKPD/i }).click();
    const modal = page.locator('.modal-dialog');
    await expect(modal).toBeVisible();

    // Skor item (item pertama otomatis terpilih) → simpan item
    await modal.locator('input[type="number"]').first().fill('80');
    await modal.getByRole('button', { name: /Simpan Item Ini/i }).click();
    await tutupAlert(page);

    // Kolom LKPD terisi 80.00 (nilai komponen = rata-rata item)
    const barisSetelah = page.getByRole('row', { name: new RegExp(SISWA_UJI_NAMA) });
    await expect(barisSetelah).toContainText('80.00');
  });

  test('C2 — buat pengumuman untuk kelas uji lalu hapus', async ({ page }) => {
    const judul = `E2E Pengumuman ${Date.now()}`;
    await page.goto('/guru/pengumuman');
    await page.waitForLoadState('networkidle');

    await page.getByLabel(/Judul/i).fill(judul);
    await page.getByLabel(/Deskripsi/i).fill('Dibuat otomatis oleh E2E — akan dihapus.');
    await page.getByLabel(/Audiens/i).selectOption({ label: 'Beberapa kelas' });

    // centang kelas uji (label berisi nama kelas)
    await page.locator('label').filter({ hasText: KELAS_UJI }).getByRole('checkbox').check();

    // batas waktu tayang (wajib) — 1 jam ke depan
    const nanti = new Date(Date.now() + 3_600_000).toISOString().slice(0, 16);
    await page.getByLabel(/Batas Waktu/i).fill(nanti);

    await page.getByRole('button', { name: /Kirim Pengumuman/i }).click();

    // Muncul di daftar "Pengumuman Saya" (menandakan simpan selesai)
    const baris = page.getByRole('row', { name: new RegExp(judul) });
    await expect(baris).toBeVisible({ timeout: 10_000 });
    await tutupAlert(page); // "Pengumuman terkirim."

    // Hapus
    await baris.getByRole('button', { name: /Hapus/i }).click();
    await expect(page.getByRole('row', { name: new RegExp(judul) })).toHaveCount(0);
  });
});
