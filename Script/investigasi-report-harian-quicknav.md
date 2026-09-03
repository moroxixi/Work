# Investigasi — Sumber Data "Rekap Pengeluaran Harian" & Struktur Quicknav (Pencatatan-Buku-Kas)

> **Tanggal investigasi:** 2026-09-03
> **Scope:** `~/HomeLab/Work/Pencatatan-Buku-Kas/` (murni read-only, tidak ada PENUTUP/push)
> **Metode:** Static analysis — pembacaan kode langsung; tidak ada fungsi backend yang dieksekusi, tidak ada file kode yang diubah/dibuat/dihapus (file ini satu-satunya file baru, dokumentasi investigasi).
> **Tujuan:** Memetakan (1) sumber data untuk tabel "Rekap Pengeluaran Harian", (2) struktur quicknav/navigasi saat ini, (3) konvensi folder subfolder — sebagai input prompt implementasi "Report-Harian quicknav".

---

## 1. Sumber Data "Rekap Pengeluaran Harian"

### 1.1 Inventaris backend & handler yang return data sheet

Ada **3 backend Apps Script** yang terlibat di scope ini (dari `glob Work/**/*.gs*` + pembacaan isi). Tiga-tiganya endpoint Google Apps Script Web App (GET/POST), di-referensikan lewat konstanta di `Pencatatan-Buku-Kas/config.js`:

| Backend file | Konstanta config.js | Sheet yang dibaca | Handler & aksi |
|---|---|---|---|
| `Pencatatan-Buku-Kas/Apps-Script/buku-kas.gs.js` | `ENDPOINT_URL` | `"Input"` (Buku Kas Gabungan, `BUKU_KAS_SPREADSHEET_ID` di report.gs.js) | `doGet` / `doPost` (lihat 1.1.1) |
| `Pencatatan-Buku-Kas/Scan-Struk/Apps-Script/scan-struk.gs` | `SCRIPT_URL` | `"Input Harga Belanja"` (riwayat harga, terpisah dari kas) | `doPost` (lihat 1.1.2) |
| `Work/Wonton/Apps-Script/report.gs.js` | `STOK_SCRIPT_URL` | `Input_Tempura`, `Input_Wonton`, `"Report 2026"` (lihat 1.1.3) | `doGet` / `doPost` (lihat 1.1.3) |

#### 1.1.1 `buku-kas.gs.js` (Kas Harian + Riwayat) — endpoint `ENDPOINT_URL`

- **`doGet(e)`** (line 84):
  - `action=list` → **`handleList_(params.tanggal)`** (line 99) — baca **sheet `"Input"`**, range **`A2:E{lastRow}`** (5 kolom: Timestamp, Keterangan, Kategori, Belanja Di, Jumlah), filter baris yang tanggalnya (`dd/MM/yyyy` dari kolom A) sama dengan `tanggal`, urut baris sheet terbaru di atas. Response:
    ```json
    { "status": "ok", "rows": [ { "row": 12, "timestamp": "02/09/2026 18:30:00",
      "keterangan": "-", "kategori": "Setoran Cabang Tempura", "belanjaDi": "",
      "jumlah": 500000, "sumber": "otomatis", "arah": "Masuk" } ] }
    ```
    (`sumber` = manual/otomatis/cek-dulu; `arah` = Masuk/Keluar dari `isKategoriMasuk_`).
  - `action=ping` → `{ lastChange: <marker> }` dari Script Properties (`CHANGE_MARKER_KEY`), dipasang trigger `onSheetChangeInstallable`.
  - default → teks "Form endpoint aktif…".
- **`doPost(e)`** (line 46): `action=create` (default) → `sheet.appendRow([timestamp, keterangan, kategori, belanjaDi, jumlah])`; `action=edit` → `handleEdit_` (update kolom 2–5 per `data.row`, guard `timestampCheck`); `action=delete` → `handleDelete_` (deleteRow, guard `timestampCheck`).
- **Struktur sheet `"Input"`:** 5 kolom — `Timestamp` (dd/MM/yyyy HH:mm:ss), `Keterangan`, `Kategori`, `Belanja Di`, `Jumlah (Rp)`. **Tidak ada kolom Tanggal terpisah** (diturunkan dari Timestamp).

#### 1.1.2 `scan-struk.gs` (Scan Struk) — endpoint `SCRIPT_URL`

- `doGet` → hanya teks statis.
- `doPost` (line 34): `scan` (Gemini OCR → items), `save` → `saveItems_`, `list` → **`listItems_()`** (line 279, baca semua baris sheet `"Input Harga Belanja"` → `{ ok:true, items:[...] }`), `edit`, `editManual`, `delete`. Murni riwayat harga barang — **tidak terhubung ke Buku Kas**.

#### 1.1.3 `report.gs.js` (Report/Stok) — endpoint `STOK_SCRIPT_URL`

- `doGet` (line 55):
  - `action=stok` → **`handleStok_(tanggal, cabang)`** (line 550) — baca `Input_Tempura` (cabang `P`) atau `Input_Wonton` (cabang `B/L/R`), ambil baris pertama yang tanggalnya cocok, return `{ status:"ok", found, timestamp, cabang, items:[{nama, sisa, laku}] }` (kolom per item `"<Item> (Sisa)"` / `"<Item> (Laku)"`).
  - `action=totalHarian` → **`handleTotalHarian_(token)`** (line 615) — baca **sheet `"Report 2026"`** (gid `794081767`, spreadsheet Wonton/Tempura `SPREADSHEET_ID`), range **`A3:AB{lastRow}` (28 kolom, data mulai baris 3)**, cari baris **TANGGAL HARI INI**, return:
    ```json
    { "ok": true, "tanggal": "02/09/2026", "kolomZ": <nilai kolom Y / Bbkn>,
      "total": <nilai kolom AB>, "rowNumber": 42, "link": ".../edit#gid=794081767&range=A42" }
    ```
    ⚠️ Hanya **2 dari 28 kolom** yang di-expose (index 24 = kolom **Y**, property tetap bernama `kolomZ` — legacy; index 27 = kolom **AB** = Total), dan **hanya baris hari ini**, diproteksi token `TOTAL_HARIAN_TOKEN`. Dipakai poller Python `Script/notif_total_harian.py`.

### 1.2 Apakah ada fungsi yang sudah return tabel "Rekap Pengeluaran Harian"?

**TIDAK DITEMUKAN di backend manapun.** Tidak ada handler di ketiga backend yang return pivot tabel `Tanggal × toko/kategori` (kolom Tanggal + ~28 kolom toko/kategori seperti Ayam Ma'mun, Ayam Bi Warsih, …, Bensin, Parkir, Plastik Vaccum).

- Yang **paling dekat** hanya `handleTotalHarian_` (membaca sheet `"Report 2026"` yang punya 28 kolom A..AB, 1 baris per hari) — tapi ia **tidak return seluruh kolom**: hanya `Y` (Bbkn) dan `AB` (Total), dan hanya untuk baris tanggal hari ini. Itu pun di spreadsheet Wonton/Tempura (sheet rekap setoran), bukan pivot pengeluaran belanja Buku Kas.
- Nama kolom target (Ayam Ma'mun, Ayam Bi Warsih, …, Bensin, Parkir, Plastik Vaccum) persis = nilai opsi **`belanjaDi`** (kolom D) dan **`kategoriLain`** (kolom C) pada form Kas Harian (`Pencatatan-Buku-Kas/index.html` line 88–130) → tersimpan di sheet `"Input"` Buku Kas.
- Data mentahnya **sudah ada dan bisa diambil** via `action=list` (per tanggal, `handleList_`), tapi **agregasi/pivot belum ada** di endpoint manapun.

**Kesimpulan 1: perlu endpoint baru** — mis. `action=rekapHarian` (atau sejenisnya) di `buku-kas.gs.js` yang mengagregasi sheet `"Input"` per tanggal per `belanjaDi`/`kategori` (dan total), ATAU hitung pivot di frontend dari `action=list` per tanggal. Catatan: backend saat ini hanya bisa query per-tanggal (`list` butuh param `tanggal`), jadi endpoint agregasi multi-hari akan jauh lebih efisien daripada mem-fetch tiap hari di frontend (pola bulanan Riwayat terpaksa mem-fetch per hari karena keterbatasan ini).

### 1.3 `config.js` & `shared-utils.js` — fungsi fetch generik yang bisa dipakai ulang?

**Tidak ada fungsi fetch di keduanya.**

- `Pencatatan-Buku-Kas/config.js` — hanya 3 konstanta URL (tidak ada fungsi):
  ```js
  const ENDPOINT_URL = "https://script.google.com/macros/s/AKfycbxmII4hzsJdPyiM7_Ym2mwYzvva1qEa6jdg0LFwxOLIkapRbgHcwGl9WTWGPXSxaSbv/exec"; // Buku Kas
  const SCRIPT_URL    = "https://script.google.com/macros/s/AKfycby8fW1-pVmFbL95pk7WNtLr4RovMkHDC6h1mJ7jCEmyh_Yxh_cCkOVYEHW22wCaTYBh/exec"; // Scan Struk
  const STOK_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzbFc2R3o9GIwEZgPKpJFc4UJvDimRI0iskhydzMcWh_0TKFwt815Z8JTI55I4Mo9w/exec"; // Report
  ```
- `Pencatatan-Buku-Kas/shared-utils.js` — hanya utilitas format/tampilan: `formatTanggalApi`, `formatTanggalLabel`, `toDateInputValue`, `escapeHtml`. Tidak ada fetch.
- Pola fetch **diimplementasikan per halaman** di tiap `script.js` (bukan di-share), tapi konsisten antar halaman:
  - `Riwayat/script.js` → **`fetchList(date, {silent, force, mode})`** (line 269) + **`fetchDayRows(date, signal)`** (line 393) + `fetchMonthList` — `GET ENDPOINT_URL + "?action=list&tanggal=" + encodeURIComponent(tanggalStr)`.
  - `Stok/script.js` → `fetchStok()` / `fetchStokHistori()` — `GET STOK_SCRIPT_URL + "?action=stok&tanggal=...&cabang=..."`.
  - `Scan-Struk/Rekap/script.js` → `fetchItems()` — `POST SCRIPT_URL` body `{action:"list"}` (Content-Type `text/plain` untuk hindari CORS preflight).
  - Pola bersama: cache in-memory `Map` + `AbortController` + `CACHE_MAX_AGE` 30 mnt (Riwayat & Stok), guard respon basi (seq/requestId), `escapeHtml()` dari shared-utils untuk render.
- ⇒ Halaman `Report-Harian/` nanti harus menulis fetch-nya sendiri mengikuti pola di atas (bukan memanggil fungsi shared yang tidak ada).

---

## 2. Struktur Quicknav / Navigasi Saat Ini

### 2.1 `nav.js` = 1 komponen shared, dirender DYNAMIC di semua 5 halaman

- `nav.js` (di root `Pencatatan-Buku-Kas/`) adalah **single source of truth** navigasi. Dimuat via `<script src>` relatif oleh **SEMUA 5 halaman**.
- **Tidak ada satu pun halaman yang hardcode item quicknav** ("Kas Harian", "Scan Struk", "Riwayat", "Stok") di HTML-nya. Tiap halaman hanya punya placeholder kosong yang diisi oleh `nav.js` saat runtime:
  ```html
  <nav class="quicknav" aria-label="Navigasi cepat" data-page="..." data-depth="..."></nav>
  ```
- `MAIN_ITEMS` di nav.js = **4 item** (kas, scan, riwayat, stok); total "5 halaman" karena `SCAN_STRUK_PAGES = { scan, manual, rekap }` membuat item **Scan Struk** aktif di seluruh section Scan Struk (termasuk Rekap).

| Halaman (file) | `data-page` | `data-depth` | src nav.js | src config.js | src shared-utils.js |
|---|---|---|---|---|---|
| `index.html` (Kas Harian) | `kas` | `0` | `nav.js` | absolute | **tidak dimuat** |
| `Riwayat/index.html` | `riwayat` | `1` | `../nav.js` | absolute | absolute |
| `Stok/index.html` | `stok` | `1` | `../nav.js` | absolute | absolute |
| `Scan-Struk/index.html` | `scan` | `1` | `../nav.js` | absolute | absolute |
| `Scan-Struk/Rekap/index.html` | `rekap` | `2` | `../../nav.js` | absolute | absolute |

Keterangan:
- `data-depth` menentukan prefix `'../'` berulang (depth 1 → `../`, depth 2 → `../../`) yang ditambahkan ke `href` relatif root di `MAIN_ITEMS`. **Item baru cukup 1x di nav.js, otomatis benar di semua halaman.**
- Sub-nav alur Scan Struk (Scan Struk ↔ Rekap Harga) juga di-generate nav.js dari `SUB_NAV`, hanya di halaman tanpa `#tabSwitcher`.
- Item aktif dirender sebagai `<div>` non-link + `aria-current="page"` + class `.is-active`; item lain sebagai `<a>`.
- **Tidak ada variasi markup quicknav antar file** — 5 dari 5 halaman identik (hanya `data-page`/`data-depth` yang beda).

### 2.2 Icon / asset visual tiap item

- **Icon: inline SVG per item**, didefinisikan langsung di `MAIN_ITEMS` nav.js. Pola konsisten: `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="1.8"`, `stroke-linecap="round"`, `stroke-linejoin="round"` (gambar sederhana 1–3 path).
- Struktur markup per item (di-render nav.js): `<span class="quicknav-icon" aria-hidden="true">SVG</span><span class="quicknav-label">Label</span>`.
- **Warna ikon per key** didefinisikan di **tiap `style.css` halaman** (di-duplikasi per halaman, bukan di nav.js):
  - `.quicknav-kas .quicknav-icon` → `var(--ink)`
  - `.quicknav-scan .quicknav-icon` → `var(--keluar)` / `var(--terracotta)`
  - `.quicknav-riwayat .quicknav-icon` → `var(--muted)` / `var(--ink-soft)`
  - `.quicknav-stok .quicknav-icon` → `var(--masuk)` / `var(--green)`
  - `.quicknav-item.is-active` → `opacity: 0.5; pointer-events: none; cursor: default` (item halaman aktif tampil redup).
  - Di `Scan-Struk/Rekap/style.css` ada kelas `.quicknav-item.is-section` (opacity 0.5 + icon `--ink-soft`) — saat ini **tidak dipakai oleh nav.js** (sisa/persiapan).
- Layout: `.quicknav` = flex row, tiap `.quicknav-item` = flex column (ikon di atas, label di bawah), `.quicknav-icon` 22×22px.

### 2.3 Implikasi untuk item baru "Report Harian"

- Tambah 1 entry di `MAIN_ITEMS` nav.js: `{ key: 'report', label: 'Report Harian', href: 'Report-Harian/index.html', icon: '<svg ...>…</svg>' }` → otomatis muncul di **semua 5 halaman** tanpa edit HTML.
- Tambah rule warna `.quicknav-report .quicknav-icon { color: … }` di tiap `style.css` halaman kalau mau warna khusus (kalau tidak, ikut warna default `--ink`). **Ini satu-satunya bagian yang duplikat per halaman** di setup quicknav.
- Halaman baru `Report-Harian/index.html` cukup: placeholder `<nav class="quicknav" data-page="report" data-depth="1"></nav>` + `<script src="../nav.js">` + config/shared-utils absolute (pola Riwayat/Stok).

---

## 3. Konvensi Folder Subfolder Existing (Stok/ vs Riwayat/ vs Scan-Struk/)

### 3.1 Struktur folder — pola konsisten

- **Setiap subfolder = trio `index.html` + `script.js` + `style.css`.** Berlaku untuk `Riwayat/`, `Stok/`, `Scan-Struk/` (dan `Scan-Struk/Rekap/` yang punya trio sendiri). Root `Pencatatan-Buku-Kas/` juga pola sama (index.html + script.js + style.css), plus `nav.js`, `config.js`, `shared-utils.js`, `Apps-Script/buku-kas.gs.js`, `tests/`.
- `Scan-Struk/Apps-Script/scan-struk.gs` = satu-satunya backend yang hidup di dalam subfolder; backend Kas & Report ada di `Apps-Script/` root dan `Work/Wonton/Apps-Script/`.

### 3.2 Path & urutan loading script (pola yang harus ditiru `Report-Harian/`)

1. **`nav.js` → relatif** dari lokasi halaman: root `nav.js`, depth 1 `../nav.js`, depth 2 `../../nav.js`. **Satu-satunya script yang path-nya relatif.**
2. **`config.js` & `shared-utils.js` → absolute GitHub Pages**, dipakai di SEMUA halaman (bukan `../config.js` relatif!):
   ```html
   <script src="https://moroxixi.github.io/Work/Pencatatan-Buku-Kas/config.js"></script>
   <script src="https://moroxixi.github.io/Work/Pencatatan-Buku-Kas/shared-utils.js"></script>
   ```
3. **`shared-utils.js` tidak dimuat di halaman Kas root** (tidak dipakai di sana); dimuat di Riwayat, Stok, Scan-Struk, Rekap. Order script di Riwayat/Stok: `nav.js` → `config.js` → `shared-utils.js` → `script.js` (Scan-Struk membalik config/shared-utils — minor, tidak konsisten tapi tidak masalah).
4. Semua halaman menyertakan blok inline `#page-loader` (style + listener klik untuk link antar halaman) — identik di semua file.
5. Setiap halaman punya `<link rel="prefetch">` ke halaman-halaman lain (root prefetch ke Scan-Struk, Rekap, Riwayat, Stok, shared-utils; subfolder prefetch ke `../index.html` dst).

### 3.3 Template yang harus diikuti `Report-Harian/` (implikasi)

```
Report-Harian/
├── index.html      ← placeholder quicknav data-page="report" data-depth="1",
│                      <script src="../nav.js">, config+shared-utils absolute,
│                      <script src="script.js">, #page-loader
├── script.js       ← fetch sendiri mengikuti pola Riwayat/Stok (cache+abort), pakai escapeHtml
└── style.css       ← salin pola quicknav style dari Riwayat/Stok + rule .quicknav-report
```
+ 1 baris entry baru di `nav.js` `MAIN_ITEMS` (icon SVG pola sama) → quicknav ter-update otomatis di semua halaman.

---

## 4. Kesimpulan Eksplisit

- **Endpoint Rekap Pengeluaran Harian: belum ada, perlu ditambah** — tidak ada handler di `buku-kas.gs.js`, `scan-struk.gs`, maupun `report.gs.js` yang return pivot `Tanggal × toko/kategori`. Data mentah ada di sheet `"Input"` Buku Kas (diambil per tanggal via `action=list`), tapi agregasi multi-hari belum ada; kandidat penempatan: endpoint baru di `buku-kas.gs.js` (mis. `action=rekapHarian`), atau pivot client-side memakai `action=list` per tanggal. `handleTotalHarian_` hanya expose kolom Y/AB untuk hari ini — bukan tabel rekap lengkap.
- **Struktur quicknav: shared dynamic via nav.js, 5 dari 5 halaman memakai placeholder kosong yang dirender nav.js; 0 dari 5 halaman hardcode item quicknav** — markup placeholder identik di semua file (hanya `data-page`/`data-depth` yang berbeda), jadi tidak ada duplikasi markup. Satu-satunya duplikasi: rule warna `.quicknav-<key>` di tiap `style.css` halaman. Item baru cukup ditambahkan ke `MAIN_ITEMS` nav.js + rule warna CSS per halaman (opsional) + halaman barunya sendiri.