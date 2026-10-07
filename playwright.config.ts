import { defineConfig, devices } from '@playwright/test';
import { loadEnv } from './e2e/env';

// Muat kredensial E2E (.env.test.local) + service key (.env.local) tanpa menaruh di chat.
loadEnv();

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    // GpsGate memblokir seluruh app bila lokasi ditolak → beri izin + posisi dummy.
    // 'notifications' → banner minta izin tak muncul & jalur notifikasi OS ikut diuji.
    permissions: ['geolocation', 'notifications'],
    geolocation: { latitude: -6.2, longitude: 106.816666 },
  },
  // Pakai Chrome yang terpasang di sistem (channel 'chrome') → tidak perlu unduh browser.
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
