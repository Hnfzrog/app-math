import { test, expect, type Page } from '@playwright/test';
import { login, loginAsEmail, tutupAlert } from './helpers';
import { KELAS_UJI, SISWA_UJI_EMAIL, SISWA_UJI_PASSWORD, SISWA_UJI_NAMA } from './testdata';

// E2E fitur Rapor (7 Okt 2026). Hanya menyentuh KELAS-E2E (dibuat/dihapus global setup/teardown).
// Urutan serial: R3 (terbitkan) harus jalan sebelum R5 (siswa unduh).
test.describe.configure({ mode: 'serial' });

async function pilihKelasUji(page: Page) {
  await page.goto('/guru/rapor');
  await page.waitForLoadState('networkidle');
  await page.locator('select').first().selectOption({ label: KELAS_UJI });
  await page.waitForLoadState('networkidle');
  // Nama siswa muncul di 2 tabel (daftar siswa & perangkingan) → sempitkan ke baris
  // yang punya tombol "Isi Deskripsi" (hanya ada di tabel daftar siswa).
  return page
    .getByRole('row', { name: new RegExp(SISWA_UJI_NAMA) })
    .filter({ has: page.getByRole('button', { name: /Isi Deskripsi/i }) });
}

test.describe('Rapor — guru cetak, deskripsi, terbitkan, perangkingan', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'guru');
  });

  test('R1 — pilih kelas+semester → daftar siswa, tombol aksi, tabel perangkingan', async ({ page }) => {
    const baris = await pilihKelasUji(page);
    await expect(baris).toBeVisible();
    await expect(baris.getByRole('button', { name: /Isi Deskripsi/i })).toBeVisible();
    await expect(baris.getByRole('button', { name: /Unduh Rapor/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Perangkingan Kelas/i })).toBeVisible();
    // Ada tombol terbitkan atau badge sudah terbit.
    await expect(
      page.getByRole('button', { name: /Terbitkan Rapor|Sudah Terbit/i })
        .or(page.getByText(/Rapor sudah diterbitkan/i))
        .first()
    ).toBeVisible();
  });

  test('R2 — isi deskripsi (KPD/akhlak/catatan) → badge Terisi', async ({ page }) => {
    const baris = await pilihKelasUji(page);
    await baris.getByRole('button', { name: /Isi Deskripsi/i }).click();
    const modal = page.locator('.modal-dialog');
    await expect(modal).toBeVisible();

    const kpd = modal.locator('.form-group').filter({ hasText: 'Kegiatan Pengembangan Diri' });
    await kpd.getByRole('button', { name: /Tambah Kegiatan/i }).click();
    await kpd.getByPlaceholder('Kegiatan').fill('Pramuka');
    await kpd.getByPlaceholder('Deskripsi').fill('Aktif dan disiplin');

    const akhlak = modal.locator('.form-group').filter({ hasText: 'Akhlak Mulia' });
    await akhlak.getByRole('button', { name: /Tambah Deskripsi/i }).click();
    await akhlak.getByPlaceholder('Deskripsi').fill('Sopan dan bertanggung jawab');

    await modal.getByPlaceholder('Catatan wali kelas...').fill('Pertahankan prestasimu.');

    await modal.getByRole('button', { name: /Simpan Deskripsi/i }).click();
    await tutupAlert(page);
    await expect(modal).toBeHidden({ timeout: 10_000 });

    await expect(page.getByRole('row', { name: new RegExp(SISWA_UJI_NAMA) })
      .filter({ has: page.getByRole('button', { name: /Isi Deskripsi/i }) })).toContainText(/Terisi/i);
  });

  test('R3 — terbitkan rapor → badge "sudah diterbitkan"', async ({ page }) => {
    await pilihKelasUji(page);
    // Tunggu area aksi render dulu (auto-wait) sebelum cek tombol — menghindari
    // balapan dengan fetchData async yang memuat baris draf rapor.
    await expect(page.getByText(/Rapor (belum|sudah) diterbitkan/i)).toBeVisible({ timeout: 10_000 });
    const terbit = page.getByRole('button', { name: /^Terbitkan Rapor$/i });
    if ((await terbit.count()) > 0) {
      await terbit.click();
      await tutupAlert(page);
    }
    await expect(page.getByText(/Rapor sudah diterbitkan/i)).toBeVisible({ timeout: 10_000 });
  });

  test('R4 — unduh rapor per siswa (PDF)', async ({ page }) => {
    const baris = await pilihKelasUji(page);
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 20_000 }),
      baris.getByRole('button', { name: /Unduh Rapor/i }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('rapor.pdf');
  });
});

test.describe('Rapor — siswa unduh setelah terbit', () => {
  test('R5 — tombol Unduh Rapor aktif & menghasilkan PDF', async ({ page }) => {
    await loginAsEmail(page, SISWA_UJI_EMAIL, SISWA_UJI_PASSWORD, '/siswa/dashboard');
    await page.goto('/siswa/nilai');
    await page.waitForLoadState('networkidle');

    const btn = page.getByRole('button', { name: /Unduh Rapor/i });
    await expect(btn).toBeEnabled({ timeout: 10_000 });

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 20_000 }),
      btn.click(),
    ]);
    expect(download.suggestedFilename()).toBe('rapor.pdf');
  });
});
