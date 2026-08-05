// @ts-check
// Playwright config — scoped ke mini-app Pencatatan-Buku-Kas saja.
// App ini static (HTML+JS, tanpa build), jadi pakai python3 http.server
// sebagai webServer lokal; config.js yang di-load dari GitHub Pages live
// akan di-intercept mock di dalam test (lihat tests/kas-harian.spec.js).
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  // workers: 1 di-pin eksplisit — run paralel default (cpus/2) pernah hang
  // di mesin ini; 1 worker deterministik dan cukup cepat (3 test < 3 detik).
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  webServer: {
    command: 'python3 -m http.server 4173 --bind 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 15000,
  },
});
