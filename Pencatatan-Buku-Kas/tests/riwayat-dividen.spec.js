// @ts-check
// Playwright regression test — Riwayat Kas Harian (bug Dividen render + total)
//
// ⚠️ SAFETY (sama dengan kas-harian.spec.js, jangan dihapus):
// Riwayat/index.html memuat config.js & shared-utils.js dari GitHub Pages LIVE
// dan mengirim GET/POST ke Apps Script PRODUKSI. Tanpa intercept, test ini
// akan menanyai endpoint asli. Karena itu SEMUA request di-intercept:
//   1. **/config.js        -> diganti mock lokal (endpoint palsu)
//   2. **/shared-utils.js  -> diganti implementasi lokal (fungsi murni)
//   3. **/script.google.com/** -> di-fulfill oleh test sendiri (list + ping),
//                                 TIDAK PERNAH diteruskan ke server produksi.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const MOCK_ENDPOINT = 'https://script.google.com/macros/s/MOCK-FOR-PLAYWRIGHT/exec';
const MOCK_CONFIG_JS = `
  const ENDPOINT_URL = "${MOCK_ENDPOINT}";
  const SCRIPT_URL = "${MOCK_ENDPOINT}";
  const STOK_SCRIPT_URL = "${MOCK_ENDPOINT}";
`;

// Riwayat/script.js memuat shared-utils.js dari GitHub Pages live. Alih-alih
// menyalin fungsinya (yang bisa drift), test menyajikan file lokal asli dari
// repo ini — fungsi murni, aman di-serve apa adanya.
const MOCK_SHARED_UTILS_JS = fs.readFileSync(path.join(__dirname, '..', 'shared-utils.js'), 'utf8');

// Timestamp "hari ini" (Asia/Jakarta) supaya baris mock masuk periode aktif.
function todayTimestamp() {
  const d = new Date();
  const tgl = d.toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric"
  });
  return tgl + " 12:00:00";
}

// Data mock: 1 Masuk, 1 Keluar, 1 Dividen (arah dari backend = "Keluar" — ini
// persis skenario bug: Dividen punya arah "Keluar" tapi harus tampil sendiri).
function mockRows() {
  const today = todayTimestamp();
  return [
    { row: 5, timestamp: today, keterangan: "-", kategori: "MAO Instan", belanjaDi: "", jumlah: 25000, sumber: "manual", arah: "Masuk" },
    { row: 4, timestamp: today, keterangan: "Dividen bulanan", kategori: "Dividen", belanjaDi: "", jumlah: 100000, sumber: "manual", arah: "Keluar" },
    { row: 3, timestamp: today, keterangan: "-", kategori: "Belanja", belanjaDi: "Surya", jumlah: 50000, sumber: "manual", arah: "Keluar" }
  ];
}

/**
 * Pasang intercept: config.js & shared-utils.js -> mock lokal; endpoint Apps
 * Script -> di-fulfill langsung (list & ping), URL tertangkap dicatat di `seen`
 * supaya test bisa memverifikasi guardrail MOCK-FOR-PLAYWRIGHT.
 */
async function interceptNetwork(page) {
  const seen = [];
  await page.route('**/config.js', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: MOCK_CONFIG_JS })
  );
  await page.route('**/shared-utils.js', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: MOCK_SHARED_UTILS_JS })
  );
  await page.route('**/script.google.com/**', async (route) => {
    const url = route.request().url();
    seen.push(url);
    const body = url.includes('action=ping')
      ? JSON.stringify({ lastChange: '' })
      : JSON.stringify({ status: 'ok', rows: mockRows() });
    await route.fulfill({ status: 200, contentType: 'application/json', body });
  });
  return seen;
}

test('Riwayat: item Dividen tampil violet tanpa minus & TIDAK ikut total Keluar', async ({ page }) => {
  const seen = await interceptNetwork(page);
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));

  await page.goto('/Riwayat/index.html');

  // Ringkasan: Keluar HANYA dari Belanja (50.000), Dividen (100.000) terpisah,
  // Masuk 25.000 — bukti kalkulasi total sudah benar sejak sebelum fix.
  await expect(page.locator('#summaryBar')).toBeVisible();
  await expect(page.locator('#summaryMasuk')).toHaveText('Rp 25.000');
  await expect(page.locator('#summaryKeluar')).toHaveText('Rp 50.000');
  await expect(page.locator('#summaryDividen')).toHaveText('Rp 100.000');

  // Kartu Dividen: class arah-dividen, nominal TANPA tanda minus.
  const dividenCard = page.locator('.tx-card').filter({ has: page.locator('.tx-kategori', { hasText: /^Dividen$/ }) });
  await expect(dividenCard).toHaveClass(/arah-dividen/);
  await expect(dividenCard).not.toHaveClass(/arah-keluar/);
  await expect(dividenCard).not.toHaveClass(/arah-masuk/);
  await expect(dividenCard.locator('.tx-jumlah')).toHaveText('Rp 100.000');

  // Kartu biasa tetap konsisten: Belanja = keluar merah dengan minus,
  // MAO Instan = masuk hijau dengan plus.
  const belanjaCard = page.locator('.tx-card').filter({ has: page.locator('.tx-kategori', { hasText: /^Belanja$/ }) });
  await expect(belanjaCard).toHaveClass(/arah-keluar/);
  await expect(belanjaCard.locator('.tx-jumlah')).toHaveText('- Rp 50.000');

  const masukCard = page.locator('.tx-card').filter({ has: page.locator('.tx-kategori', { hasText: /^MAO Instan$/ }) });
  await expect(masukCard).toHaveClass(/arah-masuk/);
  await expect(masukCard.locator('.tx-jumlah')).toHaveText('+ Rp 25.000');

  // Guardrail network: request list benar-benar tertangkap (summaryBar sudah
  // visible = fetch list sudah resolve & render), dan SEMUA request ke
  // script.google.com mengarah ke endpoint mock — bukan produksi.
  expect(seen.some((u) => u.includes('action=list'))).toBe(true);
  for (const url of seen) {
    expect(url, 'request ke script.google.com wajib endpoint mock').toContain('MOCK-FOR-PLAYWRIGHT');
  }

  // Tidak boleh ada error JS di console
  expect(consoleErrors, 'Tidak boleh ada console.error/pageerror').toEqual([]);
});
