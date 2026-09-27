# Investigasi — Alur Data Membership (Submit & Hadiah) untuk Migrasi ke JSON Statis

> **Tanggal investigasi:** 2026-09-27
> **Scope:** `~/HomeLab/Work/Membership/` (murni read-only — tidak ada file source yang diubah; file ini satu-satunya file baru)
> **Metode:** Static analysis — pembacaan kode langsung (6 file dibaca utuh). Tidak ada endpoint GAS yang dipanggil (tidak ada `curl`/`read_url`/fetch live), tidak ada `clasp`, tidak ada command dengan side effect.
> **Tujuan:** Memetakan kondisi sekarang (bukan eksekusi migrasi) — alur fetch data halaman Submit & Hadiah, struktur response backend, pemakaian `MAO_CONFIG`/cache, serta daftar titik kode yang perlu diubah kalau sumber data diganti dari fetch-ke-GAS menjadi fetch-ke-file-JSON-lokal.

---

## 0. Ringkasan eksekutif

| Halaman | Endpoint saat ini | Method | Fungsi backend (`code.gs.js`) | Render logic | Cache |
|---|---|---|---|---|---|
| `Membership/Submit/` | `?action=getFormData` | GET | `doGetFormData_()` (L1025) | `Submit/script.js` (file terpisah) | sessionStorage `mao_cache_submit_formData` |
| `Membership/Hadiah/` | `?action=getHadiah` | GET | `doGetHadiah_()` (L1301) | **inline di `index.html`** (TIDAK punya script.js sendiri) | sessionStorage `mao_cache_hadiah_data` |

Kedua fungsi backend **ditemukan persis sesuai dugaan** (mengandung "FormData" dan "Hadiah"), jadi **tidak ada yang perlu dikonfirmasi lewat `ask_user`** — lihat bagian 7.

Kedua halaman memakai pola identik: **stale-while-revalidate** (render dari sessionStorage dulu tanpa spinner → fetch fresh di background → update cache & render). Keduanya mengharapkan **response ber-envelope `{success: true, ...}`**, bukan array polos.

---

## 1. HALAMAN SUBMIT (`Membership/Submit/`)

### 1.1 Ringkasan alur fetch data

**File yang terlibat:** `Submit/index.html` (markup + load script), `Submit/script.js` (logic, ~940 baris), `../config.js`, `../data-cache.js`.

Urutan load script (`Submit/index.html` L191–195):
`html2canvas` (CDN) → `../config.js` → `../data-cache.js` → `../nav.js` → `script.js`.

Alur saat page load:

1. `#loadingState` (spinner "Memuat data…") tampil; `#orderForm` `hidden` sampai data datang (`Submit/index.html` L24–30).
2. **IIFE `init()`** (`Submit/script.js:85`):
   - Baca cache dulu: `MAO_CACHE.get('submit_formData')` (L88) → kalau ada, langsung `applyFormData(cached)` (render instan, spinner hilang).
   - **Fetch:** `fetch(MAO_CONFIG.GAS_WEB_APP_URL + "?action=getFormData")` — **GET**, tanpa header khusus (L95).
   - `resp.json()` (L96) → cek **`if (!json.success) throw json.error || "Gagal memuat data"`** (L98–100).
   - Bentuk `{ memberList: json.memberList || [], menuList: json.menuList || [] }` (L102) — **`kodeList` dari response DIbuang di sini**, tidak dipakai Submit.
   - `MAO_CACHE.set('submit_formData', data)` (L103) → `applyFormData(data)` (L105).
   - `catch` (L107–113): kalau **tidak ada cache**, `#loadingState.innerHTML` diganti pesan merah `"Gagal memuat data: …"`; kalau ada cache, error dibisukan (data cache tetap tampil).
3. `applyFormData(data)` (L78–83): `renderKodeList(memberList)` + `renderMenuList(menuList)` → sembunyikan spinner → tampilkan form.

**Hard-refresh button** (IIFE "HARD REFRESH (TUGAS 10)", `Submit/script.js:116–141`): tombol `↻` di pojok form — `MAO_CACHE.clear` (L126) → fetch ulang `?action=getFormData` **GET** (L128) → cek `json.success` (L130) → set cache (L132) → `applyFormData` (L133). Error diam-diam (`catch` → state tetap).

**Fetch lain di halaman ini yang BUKAN sumber data katalog** (tetap butuh GAS, di luar lingkup migrasi data):
- **Submit pesanan:** POST `action=submitOrder` (`Submit/script.js:516`, di handler `orderForm` L459) — write ke sheet.
- **Recovery:** GET `?action=getOrderByOrderId&orderId=…` (`tryRecoverByOrderId`, L840; fetch L844–845) — cek read-only apakah order masuk setelah POST gagal.

### 1.2 Struktur response backend (persis)

Backend: **`doGetFormData_(e)`** di `Membership/Apps-Script/code.gs.js:1025–1080`, diruting oleh `doGet(e)` L937–939 (`if (action === "getFormData") return doGetFormData_(e);`). Dibungkus `json_()` (L2048–2052) = `ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(JSON)`.

```json
{
  "success": true,
  "kodeList":  ["MAO-ABC123", "MAO-DEF456"],
  "memberList": [
    { "kode": "MAO-ABC123", "username": "rofi" },
    { "kode": "MAO-DEF456", "username": "" }
  ],
  "menuList": ["Wonton Mie Jebew", "Kipas Charco"]
}
```

| Field | Tipe | Asal di sheet | Catatan |
|---|---|---|---|
| `success` | boolean `true` | selalu `true` kalau tidak ada exception | **dicek client** (throw kalau falsy) |
| `kodeList` | `string[]` | tab **Member**, kolom `Kode Membership` (B), baris 2..akhir | Derivasi dari kode saja — **dipakai `Admin/Check-Pesanan`? tidak; yang dipakai Check-Pesanan adalah `menuList`. `kodeList` tampaknya tidak dipakai halaman mana pun** (Submit membuangnya di L102). |
| `memberList` | `[{kode: string, username: string}]` | tab **Member**, kolom B (`Kode Membership`) + kolom K (`Username`), baris 2..akhir | `String().trim()` keduanya; username kosong → `""`; **baris dengan kode kosong di-skip**; **TANPA sort/dedup** (urutan = urutan baris sheet) |
| `menuList` | `string[]` | tab **"Daftar Menu"**, kolom A, baris 2..akhir | `String().trim()`, kosong → difilter |

**Transformasi/logic backend yang harus direplikasi saat generate JSON** (bukan data mentah):
- Mulai baca dari **baris 2** (header tidak ikut) — L1038, L1065.
- `trim()` semua string.
- Skip baris `kode === ""` (member) dan `v === ""` (menu).
- `username || ""` (null/undefined → string kosong).
- Tidak ada sorting, tidak ada filter lain — client-lah yang menyaring ulang: `renderKodeList` (`Submit/script.js:149`, skip `""` & header-like `"Kode Membership"`) dan `renderMenuList` (L254, skip `""` & header-like `"Nama Menu"`) — itu defensif, aman dipertahankan.
- Catatan kecil: L1027 `var ss = SpreadsheetApp.openById(SHEET_ID)` dipakai untuk `getSheetByName("Daftar Menu")`; tab Member diakses via `getMemberSheet_()` (god node — tidak disentuh task ini).

### 1.3 Pemakaian `MAO_CONFIG` & cache

- **`MAO_CONFIG.GAS_WEB_APP_URL`** (`config.js:13–15`) — satu-satunya sumber endpoint: dipakai di L95 (init), L128 (hard refresh), L516 (POST submitOrder), L845 (recovery GET).
- **`MAO_CONFIG.prepareFotoForUpload`** (`config.js:266`, dipakai `Submit/script.js:435`) — jalur **upload foto**, TIDAK terkait fetch data katalog; tetap dibutuhkan.
- **Cache `data-cache.js`** (stale-while-revalidate, sessionStorage, prefix `mao_cache_`):
  - Key: **`mao_cache_submit_formData`** (`CACHE_KEY = 'submit_formData'`, `Submit/script.js:76`).
  - **Tidak ada TTL/expiry** — berlaku selama sesi browser (tab) saja (komentar `data-cache.js` L12–13). "Durasi cache" = lifetime sesi tab.
  - API: `MAO_CACHE.get/set/clear` (`data-cache.js` L23–56).
  - Tersimpan bentuk: `{ memberList: [...], menuList: [...] }` (tanpa `kodeList`, tanpa envelope `success`).
- **`localStorage["mao_submit_result"]`** (`Submit/script.js` di handler submit) — data hasil submit untuk halaman Hasil (expiry 24 jam di sana); **bukan** cache katalog, tidak terpengaruh migrasi.

### 1.4 Titik kode yang perlu diubah untuk migrasi ke JSON lokal (Submit)

| # | File:baris | Fungsi/konteks | Yang harus berubah |
|---|---|---|---|
| 1 | `Submit/script.js:95` | `init()` | Ganti URL fetch → file JSON lokal (mis. `"./data.json"` atau `new URL('./data.json', location)`). Method GET tetap. |
| 2 | `Submit/script.js:96–100` | `init()` | **Unwrapping envelope** — `resp.json()` + `if (!json.success) throw` hanya valid kalau JSON lokal juga memakai envelope `{success:true, memberList, menuList}`. Kalau JSON polos (objek tanpa `success`), blok ini harus diubah. |
| 3 | `Submit/script.js:102–103` | `init()` | Bentuk data yang di-cache — ikuti struktur JSON baru. |
| 4 | `Submit/script.js:107–113` | `init()` `catch` | Error loading state didesain untuk API error (`err.message` dari server). Fetch file lokal masih bisa gagal (404/offline) — logic boleh dipertahankan apa adanya, tapi pesan "Gagal memuat data" jadi lebih jarang muncul. |
| 5 | `Submit/script.js:128–133` | IIFE hard refresh | Fetch kedua → file JSON lokal juga. **Perhatikan cache-busting:** fetch ke file statis bisa kena cache HTTP browser (GitHub Pages `max-age=600`); kalau perlu, tambah query `?t=Date.now()` saat refresh. |
| 6 | `Submit/script.js:126` | hard refresh `MAO_CACHE.clear` | Tetap relevan (sessionStorage) — tidak wajib diubah. |
| 7 | — | `#loadingState` spinner (`index.html` L24–27) + `applyFormData` L80–81 | **Tidak wajib diubah**: spinner + hide-form-sampai-loaded tetap berjalan (fetch lokal juga async). Bisa disederhanakan kalau data di-`<script>` inline / import statis. |
| 8 | `Submit/index.html:192–195` | load script | **Tidak wajib diubah** — `config.js` tetap dibutuhkan (POST submitOrder + foto). Kalau pakai JSON lokal, cukup tambah `<script>`/fetch baru. |

**Yang TIDAK berubah:** handler submit POST L459–560-an, `tryRecoverByOrderId` L840, render combobox/menu L149 & L254 (asalkan struktur `{kode, username}` / `string[]` sama).

### 1.5 Potensi kejutan/risiko (Submit)

1. **Envelope `{success: true}`** — kalau file JSON lokal ditulis polos (`[...]` / `{memberList: ...}`), `json.success` = `undefined` → `throw "Gagal memuat data"` → **halaman gagal load total**. Risiko #1 paling mudah salah.
2. **`getFormData` punya konsumen kedua:** `Admin/Check-Pesanan/script.js:142` (`loadMenuList()`, L140–153) juga fetch `?action=getFormData` dan memakai `json.menuList` (dengan filter header `"Nama Menu"` sendiri). Kalau nanti endpoint GAS-nya dihapus/diganti total, halaman Admin ikut putus. Kalau hanya halaman Submit yang dialihkan ke JSON, Admin tetap aman (masih baca GAS) tapi **data Admin bisa beda versi** dengan JSON statis kalau sheet berubah dan JSON tidak digenerate ulang.
3. **Cache sessionStorage tanpa TTL + fetch fresh tiap load** — perilaku saat ini: user SELALU dapat update terbaru di akhir load. Dengan file JSON statis, "update" = kapan file itu di-deploy; hard-refresh button jadi satu-satunya pemicu kalau browser meng-cache file JSON-nya. Pertimbangkan query-buster.
4. **Error path dirancang untuk API** (`json.error`, pesan server) — file lokal umumnya hanya bisa 404/parse-error; pesan server tidak akan ada lagi.
5. **Header-like filtering di client** (`"Kode Membership"`, `"Nama Menu"`) tetap harus diperhatikan saat *generate* JSON: kalau generator salah mulai dari baris 1, filter client akan menyelamatkan tampilan, tapi baris pertama data valid bisa terbuang salah sasaran — lebih baik generator benar mulai baris 2.
6. **Sheet jadi mirror/manual** — risiko data stale antar deploy (mission brief sudah menyebut ini): `memberList` bertambah saat ada pendaftaran baru, `menuList` saat admin edit menu — tanpa regen JSON, combobox Submit tidak dapat kode baru.

---

## 2. HALAMAN HADIAH (`Membership/Hadiah/`)

### 2.1 Ringkasan alur fetch data

**Halaman ini TIDAK punya `script.js` sendiri** — seluruh logic inline di `<script>` IIFE di `Hadiah/index.html` L327–533. Load script: `../config.js` (L324) → `../data-cache.js` (L325) → `../nav.js` (L326) → inline (L327). CSS juga inline (halaman standalone, tidak load `style.css`).

Alur:
1. `#loadingState` spinner "Memuat daftar hadiah…" tampil default (state via `showState()`, L335–341: `loading|list|empty|error`).
2. **`loadHadiah(forceFresh)`** (L404–437), dipanggil pertama kali tanpa argumen di L439:
   - Cache-first: `MAO_CACHE.get('hadiah_data')` (L407) → kalau ada & `length > 0` → `renderHadiah(cached)` + `showState('list')` (L408–411).
   - `if (forceFresh) showState('loading')` (L413).
   - **Fetch:** `fetch(MAO_CONFIG.GAS_WEB_APP_URL + '?action=getHadiah')` — **GET** (L417).
   - `resp.json()` (L418) → **`if (!json.success) throw json.error || 'Gagal memuat data'`** (L419).
   - `var hadiah = json.hadiah || []` (L421) → `MAO_CACHE.set('hadiah_data', hadiah)` (L422).
   - State: array kosong & bukan forceFresh → `empty` (L424–425); selain itu `renderHadiah(hadiah)` → `list` (L426–428).
   - `catch` (L430–436): **hanya** menampilkan `#errorState` kalau **tidak ada cache**; dengan cache, error dibisukan (data lama tetap tampil).
3. **Hard refresh** (L441–455): `MAO_CACHE.clear('hadiah_data')` (L450) → `await loadHadiah(true)` (L451) → tampil spinner selama refresh.
4. **`renderHadiah(hadiah)`** (L352–396) per item:
   - `item.urlFoto` kosong → placeholder 🎁; ada → `<img>` dengan **`MAO_CONFIG.driveImageUrl(item.urlFoto, 'small')`** (L382) + fallback berlapis **`MAO_CONFIG.attachDriveImageFallback`** (L373).
   - `item.judul` (escapeHtml) + **`item.poinDibutuhkan.toLocaleString('id-ID')`** — **`poinDibutuhkan` HARUS number**; kalau string, `.toLocaleString` melempar TypeError → render terhenti.

**Fetch lain (write, tetap GAS):** modal "Request List Hadiah" — POST `action=requestHadiah` (`Hadiah/index.html:510`, handler L500–523; komentar L459–461). Tidak terkait migrasi data katalog.

### 2.2 Struktur response backend (persis)

Backend: **`doGetHadiah_(e)`** di `code.gs.js:1301–1334`, diruting `doGet` L947–949.

```json
{
  "success": true,
  "hadiah": [
    { "judul": "Kipas Karakter", "poinDibutuhkan": 500,
      "urlFoto": "https://drive.google.com/file/d/1AbCdEf.../view?usp=drivesdk" },
    { "judul": "Cermin Bunga", "poinDibutuhkan": 1200, "urlFoto": "" }
  ]
}
```

| Field | Tipe | Asal (kolom sheet `COLUMNS_HADIAH`, L76) | Catatan |
|---|---|---|---|
| `success` | boolean `true` | — | dicek client |
| `hadiah[].judul` | `string` | kolom A **"Judul"** | `String().trim()` |
| `hadiah[].poinDibutuhkan` | **`number` (int)** | kolom B **"Poin Dibutuhkan"** | `parseInt(r[1], 10)` — **wajib number saat di-JSON** |
| `hadiah[].urlFoto` | `string` | kolom C **"URL Foto Hadiah"** | `String(r[2] \|\| "").trim()` — link share Drive apa adanya (bisa `""`) |

Kolom D **"Kode Membership"** & E **"Request Cust"** (baris fitur Request Hadiah) **tidak pernah di-return**.

**Transformasi/logic backend yang harus direplikasi saat generate JSON:**
- Baca mulai **baris 2** (L1316); tab tidak ada / `lastRow < 2` → `{success:true, hadiah:[]}` (bukan error).
- **Filter baris (L1319–1331): hanya push kalau `judul !== ""` DAN `!isNaN(parseInt(poin,10))`.** ← ini **alasan baris "Request Cust" (A–C kosong) tidak muncul di katalog**. Kalau export JSON dilakukan mentah (semua baris), baris request admin akan **bocor ke halaman Hadiah**.
- `parseInt(poin, 10)` — nilai non-angka ("-", "1500 poin") → NaN → baris di-skip.
- Tidak ada sorting (urutan = urutan baris sheet), tidak ada dedup.

### 2.3 Pemakaian `MAO_CONFIG` & cache

- **`MAO_CONFIG.GAS_WEB_APP_URL`** — fetch katalog L417 (GET) + POST requestHadiah L510.
- **`MAO_CONFIG.driveImageUrl`** (`config.js:144`) & **`MAO_CONFIG.attachDriveImageFallback`** (`config.js:175`, internalnya `extractDriveFileId`) — dipakai di render (L373, L382) untuk mengubah link share Drive → `<img src>`. **Ini tetap dibutuhkan meski data pindah ke JSON** (field `urlFoto` tetap link Drive).
- **Cache:** `CACHE_KEY = 'hadiah_data'` (L350) → sessionStorage **`mao_cache_hadiah_data`**, tanpa TTL (lifetime sesi tab), API `MAO_CACHE.get/set/clear`. Yang di-cache: **array `hadiah` saja** (tanpa envelope `success`).

### 2.4 Titik kode yang perlu diubah untuk migrasi ke JSON lokal (Hadiah)

| # | File:baris | Fungsi/konteks | Yang harus berubah |
|---|---|---|---|
| 1 | `Hadiah/index.html:417` | `loadHadiah()` | Ganti URL fetch → JSON lokal (mis. `"./data.json"`). |
| 2 | `Hadiah/index.html:418–419` | `loadHadiah()` | Unwrapping: `resp.json()` + `if (!json.success) throw` — **hanya valid kalau JSON lokal juga ber-envelope** `{success:true, hadiah:[...]}`. |
| 3 | `Hadiah/index.html:421` | `loadHadiah()` | `json.hadiah \|\| []` — kalau JSON polos array, baris ini harus jadi `json` langsung. |
| 4 | `Hadiah/index.html:422` | `loadHadiah()` | `MAO_CACHE.set(CACHE_KEY, hadiah)` — ikuti bentuk baru. |
| 5 | `Hadiah/index.html:424–429` | `loadHadiah()` state empty/list | Logika `hadiah.length === 0` → `empty` — tetap berlaku asalkan datanya array. |
| 6 | `Hadiah/index.html:430–436` | `loadHadiah()` `catch` | Error state (`#errorState` + "Coba Lagi") didesain untuk API failure; fetch lokal masih bisa 404 — boleh dipertahankan. |
| 7 | `Hadiah/index.html:447–454` | handler hard refresh | Fetch ulang (dari `loadHadiah(true)`) otomatis ikut; **tambah cache-buster query** kalau perlu melawan HTTP-cache file statis. |
| 8 | `Hadiah/index.html:352–396` | `renderHadiah()` | **Tidak wajib diubah** — asalkan field identik (`judul` string, `poinDibutuhkan` **number**, `urlFoto` string). |
| 9 | `Hadiah/index.html:500–523` | request hadiah POST | **TIDAK diubah** — tetap GAS (write). |

### 2.5 Potensi kejutan/risiko (Hadiah)

1. **Baris "Request Cust" bocor ke katalog** kalau export JSON tidak memfilter `judul != "" && poin numerik` (lihat 2.2). Ini risiko paling nyata: tab "Hadiah" di sheet sengaja campur katalog + request (kolom D–E).
2. **`poinDibutuhkan` harus number di JSON** — `toLocaleString('id-ID')` di L390 akan crash pada string → satu item gagal → seluruh render terhenti (loop `forEach` terlempar error di tengah, state bisa tersangkut).
3. **Envelope `{success: true}`** — sama dengan Submit: JSON polos membuat `throw 'Gagal memuat data'` → kalau tidak ada cache → error state.
4. **`urlFoto` tetap link Drive publik** — tetap butuh file di-share "Anyone with the link"; fallback lh3 (`attachDriveImageFallback`) tetap relevan. (Risiko ini independen dari migrasi, tapi jangan dipindahkan ke JSON dalam bentuk thumbnail — biarkan config.js yang mengolah.)
5. **Kosong vs error:** response GAS kosong (`hadiah: []`) = state `empty`; fetch gagal tanpa cache = state `error`. Dengan JSON lokal keduanya menyatu (404 = error, `[]` = empty) — jangan sampai file tidak ada dianggap "tidak ada hadiah".
6. **Cache session tanpa TTL** — sama dengan Submit: data segar = kapan JSON di-deploy.

---

## 3. Sisi backend `code.gs.js` — ringkasan untuk migrasi

| Aspek | `doGetFormData_` (L1025) | `doGetHadiah_` (L1301) |
|---|---|---|
| Routing | `doGet` L937–939 | `doGet` L947–949 |
| Sumber | tab `Member` (via `getMemberSheet_()`, god node — **tidak disentuh**) + tab `Daftar Menu` | tab `Hadiah` |
| Envelope | `json_({success:true, kodeList, memberList, menuList})` L1074–1079 | `json_({success:true, hadiah})` L1333 |
| Filter/format | trim; skip kode kosong & menu kosong; mulai baris 2; tanpa sort | trim; `parseInt(poin)`; **skip baris judul kosong / poin NaN** (menyaring baris request); mulai baris 2; tanpa sort |
| Perlu direplikasi di generator JSON? | **Ya** (poin-poin di atas) | **Ya**, terutama filter baris request |
| Ada 2 kandidat fungsi? | Tidak — satu-satunya sumber `getFormData` | Tidak — satu-satunya sumber `getHadiah` |

Catatan: **`Apps-Script/code.gs` (file lama, tanpa `.js`) juga punya `doGetFormData_` di L523** — duplikat/versi lama. Task ini menganalisis **`code.gs.js`** sesuai instruksi. **Keberadaan dua file ini tidak mempengaruhi pilihan fungsi** (keduanya sama), tapi saat eksekusi migrasi Rofi perlu memastikan **file mana yang benar-benar ter-deploy** sebelum mengubah kontrak response.

Endpoint GAS yang **tetap dipakai setelah migrasi** (di luar data katalog):
- POST `submitOrder` (`doPost` L572 → `doPostSubmitOrder_`), POST `requestHadiah` (L576 → `doPostRequestHadiah_` L1249), GET `getOrderByOrderId` (L955 → L1190), seluruh action admin, POST `daftar`.

---

## 4. Rekomendasi Struktur File JSON

> **Ini rekomendasi saja — BUKAN implementasi. File JSON TIDAK dibuat di task ini.**

Prinsip: **pertahankan envelope & nama field persis seperti response GAS**, supaya titik kode yang diubah minimal (hanya URL fetch di 2 tempat + hard-refresh), tanpa menyentuh unwrapping/error-handling/render.

### 4.1 `Membership/Submit/data.json`

```json
{
  "success": true,
  "memberList": [
    { "kode": "MAO-ABC123", "username": "rofi" },
    { "kode": "MAO-DEF456", "username": "" }
  ],
  "menuList": ["Wonton Mie Jebew", "Kipas Charco"]
}
```

- Lokasi: **di folder yang sama** dengan `index.html` → fetch `"./data.json"` relatif, aman di GitHub Pages.
- `kodeList` boleh disertakan (kompatibilitas penuh dengan `getFormData`) atau di-skip (konsumennya nol terdeteksi) — rekomendasi: **sertakan** supaya JSON = salinan literal response, dan `Admin/Check-Pesanan` tetap bisa diajak pindah dengan pergantian URL minimal (ia cuma butuh `menuList`).
- Generate dari sheet dengan aturan §1.2 (mulai baris 2, trim, skip kosong).

### 4.2 `Membership/Hadiah/data.json`

```json
{
  "success": true,
  "hadiah": [
    { "judul": "Kipas Karakter", "poinDibutuhkan": 500, "urlFoto": "https://drive.google.com/file/d/.../view?usp=drivesdk" }
  ]
}
```

- Lokasi: **`Membership/Hadiah/data.json`** → fetch `"./data.json"`.
- **Wajib** melewati filter `judul != "" && parseInt(poin) valid` (baris request cust tidak ikut) dan `poinDibutuhkan` harus **number**.

### 4.3 Alternatif (lebih banyak ubahan kode)

JSON polos tanpa envelope (`memberList/menuList` sebagai root objek, atau array `hadiah` sebagai root): menghapus "kepalsuan" `success:true`, tapi **mengharuskan edit semua titik unwrapping** (§1.4 #2 dan §2.4 #2–3) plus penyesuaian blok error `json.success`/`json.error`. Tidak direkomendasikan kecuali Rofi memang ingin bersih-bersih kontrak response.

---

## 5. Daftar file yang dibaca (cross-check)

Dibaca **utuh** (sesuai KONTEKS):

1. `Work/Membership/config.js`
2. `Work/Membership/data-cache.js`
3. `Work/Membership/Submit/index.html`
4. `Work/Membership/Submit/script.js`
5. `Work/Membership/Hadiah/index.html`
6. `Work/Membership/Apps-Script/code.gs.js` (2052 baris, seluruh rentang L1–2052)

Pendukung (baca terarah, untuk memastikan klaim/risiko — tidak diedit):

7. `Work/Membership/Admin/Check-Pesanan/script.js` (L130–174 — konsumen kedua `getFormData`)
8. `Work/Script/investigasi-report-harian-quicknav.md` (L1–60 — acuan format laporan)

---

## 6. Verifikasi read-only

- Tidak ada `write_file`/`str_replace`/shell apa pun ke `Membership/**` — satu-satunya file yang dibuat adalah laporan ini.
- Tidak ada `curl`/`read_url`/fetch ke endpoint GAS live; analisis murni dari kode statis.
- Tidak ada `clasp`, tidak ada deploy, tidak ada command side-effect lain.
- Hasil `git status` & `git diff --stat` di scope `Work/` dicatat di sesi investigasi (lihat laporan konsol): hanya `Script/investigasi-membership-json-migration.md` yang baru/untracked; tidak ada file tracked yang berubah.

---

## 7. `ask_user` — TIDAK dipanggil

KONTEKS mensyaratkan `ask_user` hanya kalau: (a) fungsi backend tidak ada / namanya jauh berbeda dari dugaan, atau (b) ada dua kandidat fungsi yang ambigu.

Hasil investigasi:
- **Fungsi Submit ditemukan persis** seperti dugaan: `doGetFormData_` (`code.gs.js:1025`, diruting `doGet` L937–939 untuk `action=getFormData`).
- **Fungsi Hadiah ditemukan persis**: `doGetHadiah_` (`code.gs.js:1301`, diruting L947–949 untuk `action=getHadiah`).
- **Tidak ada dua kandidat** untuk masing-masing halaman; struktur response tidak mengandung nested object ambigu (field semua flat & jelas asal kolom sheet-nya).
- Satu catatan kecil yang **tidak memenuhi syarat ambiguity**: `code.gs` (versi lama tanpa `.js`) juga punya `doGetFormData_`, tapi tugas secara eksplisit menargetkan `code.gs.js` dan isinya konsisten.

**Keputusan: tidak ada pertanyaan yang diajukan ke Rofi, tidak ada jawaban yang diterima.**
