# Playwright Test Suite — Pencatatan-Buku-Kas

Test suite pilot untuk mini-app **Kas Harian** (client-side HTML+JS, backend
Google Apps Script). Pola ini siap di-replikasi ke mini-app Work lain
(Dashboard, Tempura, Wonton, Reminder).

## Setup (sekali per mesin)

```bash
cd ~/HomeLab/Work/Pencatatan-Buku-Kas
npm install            # devDependency: @playwright/test (lokal, bukan global)
npx playwright install chromium   # browser binary (chromium saja cukup)
```

> Catatan Arch Linux: Playwright memakai "fallback build" ubuntu24.04-x64
> karena Arch belum didukung resmi — sudah terverifikasi jalan di mesin ini.
> Di mesin Debian/Ubuntu bisa `npx playwright install --with-deps chromium`
> (butuh sudo) untuk library sistem.

## Menjalankan

```bash
npm test                          # atau: npx playwright test
npx playwright test --list        # cek config & koleksi test dulu
npx playwright test --reporter=list --workers=1
```

`workers: 1` di-pin di `playwright.config.js` (default paralel pernah hang).

## ⚠️ Safety: data produksi tidak boleh tersentuh

`index.html` memuat `config.js` dari GitHub Pages LIVE, dan `script.js`
mengirim POST ke endpoint Apps Script **produksi** (spreadsheet asli) dengan
`mode: "no-cors"`. Tanpa pencegahan, submit form di test = transaksi nyata
masuk ke buku kas asli.

Semua test di `tests/kas-harian.spec.js` wajib meng-intercept via
`interceptNetwork(page)`:

1. `**/config.js` → di-fulfill dengan **mock config** (endpoint palsu
   `MOCK-FOR-PLAYWRIGHT`).
2. `**/script.google.com/**` → request **ditahan** (`held`) & di-fulfill oleh
   test sendiri; TIDAK PERNAH diteruskan ke server.

Plus guardrail URL: test memastikan URL request yang tertangkap mengandung
`MOCK-FOR-PLAYWRIGHT` — kalau suatu saat config berubah host sehingga route
tidak match, test langsung gagal (daripada mengirim data asli).

**Aturan untuk test baru:** jangan pernah biarkan fetch nyata ke endpoint
produksi; selalu pakai `interceptNetwork` + verifikasi URL mock.

## Skenario saat ini

1. **Test 1** — halaman utama load tanpa error (console/pageerror/requestfailed)
2. **Test 2** — isi form (kategori MAO Instan, keterangan, jumlah) + submit;
   verifikasi status sukses, form reset, dan payload POST yang tertangkap
3. **Test 3** — render antrean: item muncul dgn label kategori + nominal
   terformat id-ID, lalu hilang setelah request di-fulfill

## Struktur

```
Pencatatan-Buku-Kas/
├── playwright.config.js   # webServer: python3 -m http.server (port 4173)
├── package.json           # scoped ke folder ini saja
├── .gitignore             # node_modules/, test-results/, dll
└── tests/
    └── kas-harian.spec.js
```

## Kendala yang ditemukan saat pilot

- Radio chip di-sembunyikan via CSS (`.chip input { position:absolute;
  opacity:0; width:0; height:0 }`) → test harus klik **label** chip, bukan
  input-nya (`label.chip:has(input[value="..."])`).
- Halaman Riwayat/Stok pakai `shared-utils.js` + polling GET 10 detik —
  kalau mau di-test juga, mock `shared-utils.js` & endpoint report dengan pola
  yang sama.
