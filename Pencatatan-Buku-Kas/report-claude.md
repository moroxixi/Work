# Laporan Diagnosis — Baris Kosong Berulang di Sheet "INPUT"

> Status: **READ-ONLY investigation**. Tidak ada file yang diedit/dihapus/dibuat
> selain laporan ini. Tidak ada fungsi submit/fetch yang dijalankan, tidak ada
> trigger yang dieksekusi, tidak ada deploy/clasp. Semua analisis berbasis
> pembacaan kode statis (file:line sebagai bukti).

---

## 1. Ringkasan Masalah

Sheet **"Input"** menerima baris kosong berulang dengan pola:

- **Keterangan** = `-` (dash)
- **Kategori** = kosong
- **Jumlah** = 0
- **Timestamp** berjarak ~4–8 detik antar baris (mis. 19:21:49, 19:21:54, 19:22:00, 19:22:04, …) dan **muncul terus-menerus**.

User memastikan baris-baris ini **bukan input manual**.

**Fakta penting dari kode:** timestamp baris dibuat **di server** (Apps Script),
bukan di client:

```js
// Work/Apps-Script/buku-kas.gs:56-58
const timestamp = Utilities.formatDate(new Date(), "Asia/Jakarta", "dd/MM/yyyy HH:mm:ss");
const keteranganRaw = (data.keterangan || "").toString().trim();
const keterangan = keteranganRaw === "" ? "-" : keteranganRaw;
```

Artinya selisih 4–8 detik di sheet = selisih **kedatangan request POST** di server
Google. Ini pola khas **pengirim otomatis yang menembak endpoint berulang kali**,
bukan hasil satu-dua klik manusia.

---

## 2. Lokasi Folder Apps Script "buku-kas"

Hasil pencarian read-only (`find` + `rg` di `~/HomeLab`):

| File | Status |
|---|---|
| `Work/Apps-Script/buku-kas.gs` | ✅ **Backend buku-kas** (doPost untuk sheet `"Input"`) |
| `Work/Apps-Script/report.gs` | Satu project sama (komentar di buku-kas.gs: *"satu project Apps Script berbagi global scope"*) |
| `MoroalMora/Catatan-Haid/gas/Code.gs` (+ `.clasp.json`, `appsscript.json`) | **Bukan** buku-kas — app period tracker terpisah. Match di `rg` hanya karena komentar menyebut "Pencatatan-Buku-Kas". Code.gs-nya eksplisit: *"TIDAK memakai time-based trigger / ScriptApp.newTrigger apa pun"* dan tidak menulis ke spreadsheet buku-kas. |

**Konfirmasi user (via ask_user):** path yang benar = **`Work/Apps-Script/`**,
dan kode yang ter-deploy di script.google.com **sesuai dengan repo** (buku-kas.gs
adalah versi terbaru).

Catatan: `Work/Apps-Script/` **tidak** berisi `.clasp.json`/`appsscript.json` —
project dikelola dengan paste manual ke editor Apps Script (konsisten dengan
instruksi di header buku-kas.gs).

---

## 3. Temuan Kode Client-Side (Work/Pencatatan-Buku-Kas/)

### 3.1 Form Kas Harian (`script.js`) — validasi ada, tidak bisa submit kosong

- `script.js:390` — listener submit di-bind **sekali saja** (`form.addEventListener("submit", …)`), tidak ada double-binding.
- Validasi sebelum submit:
  - `script.js:393` — `resolveKategori()`; jika error (kategori/toko belum dipilih) → `setStatus(resolved.error, "err"); return;` (script.js:394-396).
  - `script.js:399-401` — `const jumlahAngka = Number(jumlahEl.value.replace(/\D/g, "")); if (!jumlahAngka) { … return; }`.
  - Payload lengkap dibangun di `script.js:413-421` (timestamp, keterangan, kategori, belanjaDi, jumlah, arah).
- **Kesimpulan:** lewat UI form ini, tidak mungkin lahir baris dengan Kategori kosong + Jumlah 0. `resolveKategori()` (script.js:191) selalu mengembalikan error kalau kategori/toko belum valid.

### 3.2 Antrean pengiriman (queue) — TIDAK ada auto-retry, tidak bisa spam

- `script.js:348-383` — `processQueue()`; status item: pending → sending → (sukses) dihapus / (gagal) `"failed"`.
- `script.js:375-379` — item gagal **menunggu tombol "Kirim Ulang" manual**; komentar eksplisit di `script.js:230-233`: *"failed (gagal, nunggu user pencet Kirim Ulang manual -- TIDAK auto-retry)"*.
- `script.js:364-369` — fetch pakai `mode: "no-cors"` → request **selalu resolve** (respons tak terbaca browser), item langsung dihapus. Tidak ada loop ulang.
- `script.js:388` — `processQueue()` dipanggil sekali saat halaman dimuat untuk mengirim sisa antrean `localStorage` (`kasHarianQueue`). Payload sisa ini adalah payload asli dari submit sebelumnya (bukan kosong).
- **Tidak ada** `setInterval`/`setTimeout` untuk submit di script.js. Satu-satunya setTimeout di index.html:181 hanya animasi visual `page-loader` (200ms).

### 3.3 Halaman Riwayat (`Riwayat/script.js`) — polling hanya GET, interval 10 detik

- `Riwayat/script.js:569` — `setInterval(pollMarker, PING_INTERVAL_MS)` dengan `PING_INTERVAL_MS = 10000` (baris 4).
- `Riwayat/script.js:543` — `pollMarker()` fetch **GET** `?action=ping` (read-only, tidak menulis baris).
- `Riwayat/script.js:656, 727` — POST `action:"edit"` / `action:"delete"` hanya lewat modal yang diklik user, payload valid.
- **Kesimpulan:** interval 10 detik ≠ pola 4–8 detik, dan semuanya GET/aksi manual. Bukan sumber.

### 3.4 Halaman Scan Struk (`Scan-Struk/script.js`) — ⚠️ TEMUAN PENTING

- `Scan-Struk/index.html:101` — Scan-Struk me-load **config.js yang sama** dengan form Kas Harian: `https://moroxixi.github.io/Work/Pencatatan-Buku-Kas/config.js`.
- `config.js:2` — `const SCRIPT_URL = ENDPOINT_URL;` → **Script URL Scan-Struk = endpoint buku-kas yang sama**.
- `Scan-Struk/script.js:93-102` — POST `{ action: "scan", imageBase64, mimeType }`.
- `Scan-Struk/script.js:208-212` — POST `{ action: "save", toko, items }`.

**Bug:** `buku-kas.gs` `doPost` **tidak mengenali action `"scan"`/`"save"`** →
request jatuh ke jalur default "create" (lihat §4.1) → **setiap klik tombol
"Scan Struk" menulis SATU baris kosong persis dengan pola teramati**
(`"-"`, kategori `""`, jumlah `0`). Client tetap menampilkan error `"Gagal scan."`
karena `data.ok` tidak ada di respons `{status:"ok"}` (Scan-Struk/script.js:102-103).

Ini jalur in-repo satu-satunya yang **terbukti** menghasilkan bentuk baris kosong
yang sama persis — meski dari sisi frekuensi (per klik, bukan stream 4–8 detik)
tidak serta-merta menjelaskan rentetan terus-menerus.

### 3.5 `shared-utils.js` — netral

Hanya helper format tanggal/escape (`formatTanggalApi`, `formatTanggalLabel`,
`toDateInputValue`, `escapeHtml`). Tidak ada fetch.

---

## 4. Temuan Kode Apps Script (`Work/Apps-Script/`)

### 4.1 `buku-kas.gs` — `doPost` TANPA validasi (jalur utama penyebab bentuk baris kosong)

```js
// buku-kas.gs:47-66
function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const action = data.action || "create";
  if (action === "edit") return handleEdit_(data);
  if (action === "delete") return handleDelete_(data);
  // ==== Perilaku LAMA, tidak diubah sama sekali ====
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const timestamp = Utilities.formatDate(new Date(), "Asia/Jakarta", "dd/MM/yyyy HH:mm:ss");
  const keteranganRaw = (data.keterangan || "").toString().trim();
  const keterangan = keteranganRaw === "" ? "-" : keteranganRaw;
  sheet.appendRow([
    timestamp,
    keterangan,
    data.kategori || "",      // buku-kas.gs:63
    data.belanjaDi || "",     // buku-kas.gs:64
    Number(data.jumlah) || 0  // buku-kas.gs:65
  ]);
```

- **Tidak ada validasi field apa pun.** Request POST dengan body JSON apa pun yang
  bisa di-parse tetapi tanpa `kategori`/`jumlah` (mis. `{}`, `{"action":"ping"}`,
  `{"action":"scan",...}`, `{"action":"save",...}`) → `appendRow` baris kosong:
  `[timestamp, "-", "", "", 0]`. **Persis pola teramati.**
- `JSON.parse` (baris 48) melempar error untuk body non-JSON → row tidak ditulis
  (Apps Script mengembalikan error). Jadi pengirimnya mengirim **JSON valid**.
- **Tidak ada** retry loop / polling / penulisan otomatis di `doPost`.

### 4.2 Trigger yang terpasang / didefinisikan di buku-kas.gs (status: read-only)

| Trigger | Definis | Apa yang dilakukan | Menulis ke sheet "Input"? |
|---|---|---|---|
| `onSheetChangeInstallable` | buku-kas.gs:175, dipasang `setupOnChangeTrigger()` (buku-kas.gs:179) via `.onChange()` | Hanya set `PropertiesService` marker `LAST_CHANGE_INPUT` (untuk polling Riwayat) | ❌ Tidak |
| `checkPolaPagi` (07:00) | buku-kas.gs:467, dipasang `setupTriggersPolaTransaksi()` (buku-kas.gs:482) | Baca sheet + kirim **notif ntfy** saja | ❌ Tidak (read-only terhadap sheet) |
| `checkPolaMalam` (21:00) | buku-kas.gs:473 | Sama, baca + notif | ❌ Tidak |

- `pola_kirimNotif_` (buku-kas.gs:438-461) punya retry `MAX_ATTEMPT = 2` + sleep 2s —
  tapi itu **retry notifikasi ntfy**, bukan penulisan baris. Tidak relevan ke baris kosong.
- ⚠️ Catatan: kehadiran trigger terpasang **di project live** tidak bisa diverifikasi
  dari repo (hanya definisi kode). Yang penting: definisi trigger di repo **tidak ada
  yang menulis** ke sheet "Input".

### 4.3 `report.gs` — penulis otomatis ke Buku Kas, tapi tidak pernah baris kosong

- `kirimKeBukuKas(rows)` (report.gs:306-318) menulis ke `BUKU_KAS_SPREADSHEET_ID` / sheet `"Input"` (report.gs:8, 310).
- **Semua baris di-guard nilai > 0** sebelum masuk daftar `rows`:
  - `if (omset > 0)` report.gs:233, `if (gaji > 0)` report.gs:243/281, dst.
- Trigger report.gs: `checkDuplicatesAnomalies` (30 menit, report.gs:645),
  `checkMissingReports` (22:30 & 23:59, report.gs:650/657) — keduanya hanya menulis
  kolom `Check_Status` di sheet Tempura/Wonton dan kirim notif. **Tidak menulis ke "Input".**
- **Kesimpulan:** report.gs tidak bisa menghasilkan baris kosong di "Input".

### 4.4 Status verifikasi trigger (read-only, tidak dieksekusi)

Dari kode saja **tidak dapat dipastikan** trigger mana yang benar-benar terpasang
di project live (perlu cek menu **Triggers** / **Executions** di editor Apps Script
oleh user). Yang bisa dipastikan secara statis: tidak ada definisi trigger di repo
yang menulis baris ke sheet "Input".

---

## 5. Hipotesis Root Cause (diurutkan dari paling meyakinkan)

### H1 — Pengirim otomatis eksternal menembak endpoint publik dengan JSON kosong/parsial *(paling meyakinkan untuk rentetan 4–8 detik)*
- Endpoint `ENDPOINT_URL` (config.js:1) **publik tanpa autentikasi** (web app Apps
  Script default), dan URL-nya terekspos di `config.js` yang di-host GitHub Pages.
- `doPost` menerima **body JSON apa pun tanpa validasi** (buku-kas.gs:47-66) →
  satu POST `{}`/`{"action":"create"}` = satu baris kosong.
- Rentetan 4–8 detik terus-menerus = khas script/scanner/monitoring/retry-loop
  eksternal (bot probing, health-checker yang salah method POST, atau skrip
  otomatis di perangkat lain milik user). **Tidak ada kode di repo ini yang bisa
  menghasilkan cadence seperti itu** (lihat H2-H4 untuk satu-satunya jalur in-repo).

### H2 — Halaman Scan Struk menulis baris kosong lewat action yang tidak ditangani *(jalur in-repo yang terbukti, frekuensi rendah)*
- Scan-Struk POST ke endpoint buku-kas (config.js:2; Scan-Struk/script.js:93, 208)
  dengan `action:"scan"`/`"save"` yang **tidak ada handler-nya** di buku-kas.gs:49-50
  → fallback ke jalur create → baris kosong persis pola teramati.
- Cocok untuk menjelaskan baris kosong sporadis (setiap klik "Scan Struk"),
  **kurang cocok** untuk rentetan 4–8 detik terus-menerus — kecuali ada
  skrip/perangkat yang mengulang scan otomatis.

### H3 — Versi halaman lama / otomasi lain di perangkat user *(tidak bisa dipastikan secara statis)*
- Tab lama dengan kode lama yang auto-submit, ekstensi browser, Tasker/Automate,
  atau alat lain yang memakai URL lama. Sisa antrean `localStorage` yang diproses
  ulang saat load (script.js:388) hanya berisi payload asli — bukan sumber baris kosong.

### H4 — Deploy drift (versi deployed ≠ repo) *(ditepis oleh jawaban user)*
- User mengonfirmasi kode deployed sudah sesuai repo → hipotesis versi lama yang
  punya retry-loop di server gugur. Catatan pencegahan: komentar di buku-kas.gs:6-10
  memperingatkan *"URL lama TIDAK otomatis ambil kode baru"* — risiko ini tetap
  berlaku untuk perubahan di masa depan.

> **Kesimpulan jujur:** penyebab **pasti** rentetan 4–8 detik **tidak bisa
> dipastikan secara statis** dari repo ini — tidak ada kode di repo (client maupun
> server) yang menghasilkan cadence itu. Yang **terbukti dari kode**:
> (a) `doPost` tanpa validasi menulis baris kosong untuk JSON parsial apa pun
> (buku-kas.gs:47-66), dan (b) Scan-Struk adalah jalur in-repo yang memicu (a).

---

## 6. Pertanyaan Terbuka (butuh konfirmasi user)

1. **Jendela waktu serangan:** rentetan baris kosong terjadi jam berapa saja / hari apa saja? Apakah ada pola harian tertentu (mis. hanya malam, hanya saat HP nyala)?
2. **Apakah halaman Scan Struk dipakai** di sekitar jam kemunculan baris kosong? (H2 bisa langsung dikonfirmasi dari timestamps.)
3. **Akses ke Apps Script editor** (read-only): cek menu **Executions** — source invocation tiap request (web app vs trigger) akan menunjukkan siapa pengirim. Cek juga menu **Triggers** apakah ada trigger di luar `onSheetChangeInstallable` / `checkPolaPagi` / `checkPolaMalam`.
4. **Perangkat lain / otomasi:** adakah HP kedua, tablet, atau skrip otomatis (Tasker, Automate, cron, uptime monitor) yang memanggil URL endpoint buku-kas?
5. **Apakah ada Google Form / integrasi lain** yang menulis langsung ke sheet "Input" di luar web app ini?

---

## Lampiran A — Hasil ask_user (selama investigasi)

| Pertanyaan | Jawaban diterima |
|---|---|
| Folder Apps Script yang benar untuk backend buku-kas | **`Work/Apps-Script/` (buku-kas.gs)** — Catatan-Haid dianggap false positive |
| Kode deployed vs repo | **Sudah sesuai repo** (buku-kas.gs terbaru) |

---

## Lampiran B — Bukti kunci (file:line)

| Klaim | Bukti |
|---|---|
| doPost tanpa validasi menulis baris kosong | buku-kas.gs:47-66 (khususnya 63-65) |
| Keterangan "-" untuk input kosong | buku-kas.gs:57-58 |
| Timestamp dibuat server-side | buku-kas.gs:56 |
| Form Kas Harian punya validasi jumlah & kategori | script.js:393-401 |
| Queue tanpa auto-retry | script.js:348-383, komentar 230-233 |
| Riwayat polling GET 10 detik | Riwayat/script.js:4, 543, 569 |
| Scan-Struk POST ke endpoint buku-kas | config.js:2; Scan-Struk/script.js:93, 208 |
| Action scan/save tidak ditangani server | buku-kas.gs:49-50 |
| report.gs hanya menulis baris > 0 ke "Input" | report.gs:233, 243, 281, 306-318 |
| Trigger buku-kas tidak menulis ke "Input" | buku-kas.gs:175, 467, 473 (semua read/notif) |

---

*File laporan ini dibuat oleh agen investigasi read-only. Tidak ada fix yang
diusulkan di sini — laporan ini untuk bahan diskusi dengan Claude.*
