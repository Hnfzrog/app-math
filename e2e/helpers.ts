import { Page, expect } from '@playwright/test';

export type Role = 'admin' | 'guru' | 'siswa';

/**
 * Login lewat UI. Kredensial diambil dari env `E2E_<ROLE>_EMAIL` / `E2E_<ROLE>_PASSWORD`
 * (diisi lewat file `.env.test.local` yang gitignored).
 */
export async function login(page: Page, role: Role) {
  const email = process.env[`E2E_${role.toUpperCase()}_EMAIL`];
  const password = process.env[`E2E_${role.toUpperCase()}_PASSWORD`];
  if (!email || !password) {
    throw new Error(
      `Kredensial E2E untuk "${role}" belum diset. Isi E2E_${role.toUpperCase()}_EMAIL & E2E_${role.toUpperCase()}_PASSWORD di .env.test.local`
    );
  }

  await page.goto('/login');
  await page.getByPlaceholder('Contoh: andi@siswa.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: /login|masuk/i }).click();

  await expect(page).toHaveURL(new RegExp(`/${role}/dashboard`), { timeout: 20_000 });
}

/** Login dengan kredensial eksplisit (mis. akun siswa uji), lalu tunggu halaman `home`. */
export async function loginAsEmail(page: Page, email: string, password: string, home: string) {
  await page.goto('/login');
  await page.getByPlaceholder('Contoh: andi@siswa.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: /login|masuk/i }).click();
  await expect(page).toHaveURL(new RegExp(home), { timeout: 20_000 });
}

/** Tunggu lalu tutup modal customAlert (#custom-alert-overlay) bila muncul. */
export async function tutupAlert(page: Page) {
  const overlay = page.locator('#custom-alert-overlay');
  try {
    await overlay.waitFor({ state: 'visible', timeout: 4000 });
  } catch {
    return; // tidak ada alert
  }
  await overlay.getByRole('button', { name: 'OK' }).click();
  await expect(overlay).toBeHidden();
}
