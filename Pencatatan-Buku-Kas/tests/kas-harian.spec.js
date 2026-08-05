// @ts-check
// Playwright test suite pilot — Pencatatan-Buku-Kas (halaman Kas Harian)
//
// ⚠️ SAFETY (penting, jangan dihapus):
// index.html memuat config.js dari GitHub Pages LIVE dan script.js mengirim
// POST ke ENDPOINT_URL (Apps Script PRODUKSI) dengan mode "no-cors". Tanpa
// pencegahan, submit form di test ini akan MENULIS transaksi nyata ke
// spreadsheet asli. Karena itu SEMUA test di file ini meng-intercept:
//   1. **/config.js            -> diganti mock lokal (endpoint palsu)
//   2. **/script.google.com/** -> ditahan & di-fulfill oleh test sendiri,
//                                 TIDAK PERNAH diteruskan ke server produksi.
const { test, expect } = require('@playwright/test');

const MOCK_ENDPOINT = 'https://script.google.com/macros/s/MOCK-FOR-PLAYWRIGHT/exec';
const MOCK_CONFIG_JS = `
  const ENDPOINT_URL = "${MOCK_ENDPOINT}";
  const SCRIPT_URL = "${MOCK_ENDPOINT}";
  const STOK_SCRIPT_URL = "${MOCK_ENDPOINT}";
`;

/**
 * Pasang intercept network: config.js -> mock; endpoint Apps Script -> request
 * ditahan dalam array `held` supaya test bisa melepasnya (fulfill) saat siap.
 * Tidak ada request yang benar-benar sampai ke server.
 */
async function interceptNetwork(page) {
  const held = [];
  await page.route('**/config.js', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: MOCK_CONFIG_JS })
  );
  await page.route('**/script.google.com/**', (route) => {
    held.push(route);
  });
  return held;
}

/**
 * Isi form Kas Harian dengan skenario dummy paling sederhana (MAO Instan).
 * Radio chip di-sembunyikan via CSS (.chip input { position:absolute; opacity:0;
 * width:0; height:0 }) jadi klik LABEL chip (elemen yang terlihat), bukan input.
 */
async function fillAndSubmit(page) {
  await page
    .locator('label.chip:has(input[name="kategoriUtama"][value="MAO Instan"])')
    .click();
  await page.fill('#keterangan', 'Test Playwright');
  await page.fill('#jumlah', '50000');
  await page.click('#submitBtn');
}

test('Test 1: halaman utama load tanpa error console', async ({ page }) => {
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('requestfailed', (req) => failedRequests.push(`${req.url()} (${req.failure()?.errorText})`));

  await interceptNetwork(page);
  await page.goto('/');

  // Elemen kunci halaman muncul
  await expect(page.locator('#cashForm')).toBeVisible();
  await expect(page.locator('h1')).toHaveText('Kas Harian');
  await expect(page.locator('#submitBtn')).toBeVisible();
  await expect(page.locator('#jumlah')).toBeVisible();

  expect(pageErrors, 'Tidak boleh ada uncaught page error').toEqual([]);
  expect(consoleErrors, 'Tidak boleh ada console.error').toEqual([]);
  expect(failedRequests, 'Tidak boleh ada request gagal (asset/script)').toEqual([]);
});

test('Test 2: isi form transaksi lalu submit', async ({ page }) => {
  const held = await interceptNetwork(page);
  await page.goto('/');

  await fillAndSubmit(page);

  // Status sukses tampil + form di-reset
  await expect(page.locator('#statusMsg')).toHaveText('Ditambahkan ke antrean ✓');
  await expect(page.locator('#statusMsg')).toHaveClass(/ok/);
  await expect(page.locator('#jumlah')).toHaveValue('');

  // Satu request POST ke endpoint tertangkap, payload sesuai data dummy
  // (verifikasi isi form tanpa menyentuh server asli sama sekali).
  await expect.poll(() => held.length).toBe(1);
  // Guardrail tambahan: URL yang tertangkap HARUS endpoint mock, bukan
  // endpoint produksi — kalau suatu saat config berubah host sehingga route
  // tidak match, test ini langsung gagal (tidak pernah kirim data asli).
  expect(held[0].request().url()).toContain('MOCK-FOR-PLAYWRIGHT');
  const postData = JSON.parse(held[0].request().postData());
  expect(postData.kategori).toBe('MAO Instan');
  expect(postData.jumlah).toBe(50000);
  expect(postData.arah).toBe('Masuk');
  expect(postData.keterangan).toBe('Test Playwright');
  expect(postData.belanjaDi).toBe('');

  // Lepas request supaya antrean selesai (fetch resolve -> item terkirim)
  await held[0].fulfill({ status: 200 });
});

test('Test 3: daftar antrean render/update sesuai data dummy', async ({ page }) => {
  const held = await interceptNetwork(page);
  await page.goto('/');

  await fillAndSubmit(page);

  // Item antrean muncul dengan label kategori + nominal terformat id-ID
  const queueSection = page.locator('#queueSection');
  await expect(queueSection).toBeVisible();
  await expect(page.locator('#queueList .queue-item')).toHaveCount(1);
  await expect(page.locator('#queueList .queue-item-title')).toHaveText('MAO Instan · Rp 50.000');
  await expect(page.locator('#queueList .queue-badge--sending')).toHaveText('Mengirim…');

  // Setelah request "terkirim" (di-fulfill), item hilang -> antrean kosong
  await held[0].fulfill({ status: 200 });
  await expect(queueSection).toBeHidden();
});
