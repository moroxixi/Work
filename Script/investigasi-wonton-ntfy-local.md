# Investigasi Mekanisme Ntfy — Wonton/Apps-Script/report.gs.js

> **Tanggal investigasi:** 2026-08-29
> **Scope:** `~/HomeLab/Work/Wonton/Apps-Script/report.gs.js`
> **Metode:** Static analysis (read-only) — tidak ada fungsi ntfy yang dieksekusi selama investigasi.
> **Graph reference:** GRAPH_REPORT.md tidak ditemukan di repo saat ini (kemungkinan belum di-generate dari commit 7717ef97). Analisis berbasis pembacaan kode langsung.

---

## 1. Alur Lengkap `report_kirimNotif_(pesan, judul)`

### Endpoint & URL
- **Topic:** `report-checker` (didefinisikan sebagai `REPORT_NTFY_TOPIC`)
- **Full URL:** `https://ntfy.sh/report-checker` (dibentuk dari `REPORT_NTFY_URL = "https://ntfy.sh/" + REPORT_NTFY_TOPIC`)
- **Service:** [ntfy.sh](https://ntfy.sh) — layanan notifikasi push publik berbasis HTTP

### Method
- **POST** — payload dikirim sebagai request body (plain text, bukan JSON)

### Auth / Token
- **Tidak ada autentikasi.** Ntfy.sh publik tidak memerlukan token atau kredensial. Siapa saja yang mengetahui topic dapat mengirim/menerima.

### Payload & Headers
| Komponen | Nilai |
|----------|-------|
| **Body** | Isi `pesan` (plain text, bisa multi-baris dengan `\n`) |
| **Header `Title`** | Isi `judul` (default: `"Report Checker"` jika tidak diisi) |
| **Header `Content-Type`** | Tidak di-set secara eksplisit — `UrlFetchApp.fetch()` default ke plain text |

### Retry Logic
- **MAX_ATTEMPT = 2** percobaan
- **RETRY_DELAY_MS = 2000ms** (2 detik antar percobaan)
- Jika HTTP response code 2xx → sukses, return (tidak kirim lagi)
- Jika gagal atau exception → retry sekali, lalu log error dan return (tidak throw)
- Error **tidak menghentikan eksekusi** fungsi pemanggil — notifikasi dianggap "fire and forget"

### Catatan Kode
- Fungsi ini meniru pola `pola_kirimNotif_()` di `buku-kas.gs` (disebutkan di komentar kode)
- Tidak ada logging ke sheet/spreadsheet — hanya `Logger.log()` ke Apps Script log

---

## 2. Daftar Lengkap Pemanggil `report_kirimNotif_()`

Ditemukan **8 situs pemanggilan** (call sites) dari **6 fungsi berbeda** di `report.gs.js`. Semua pemanggil berada di file yang sama — tidak ada file lain yang memanggil fungsi ini.

### 2.1 `simpanDataTempura()` — Duplikat Tempura
- **Kondisi:** Guard `checkSubmissionAgainstSheet_()` mendeteksi `type === "Duplikat"` saat data Tempura di-submit
- **Pesan:** `"🚫 Submission duplikat Tempura diblokir (cabang: <cabang>). Data TIDAK disimpan. Baris pembanding: <rowNum>."`
- **Judul:** `"Buku Kas — Duplikat Tempura"`
- **Aksi:** Return segera — data tidak disimpan ke sheet maupun Buku Kas

### 2.2 `simpanDataWonton()` — Duplikat Wonton
- **Kondisi:** Guard `checkSubmissionAgainstSheet_()` mendeteksi `type === "Duplikat"` saat data Wonton di-submit
- **Pesan:** `"🚫 Submission duplikat Wonton diblokir (cabang: <cabang>). Data TIDAK disimpan. Baris pembanding: <rowNum>."`
- **Judul:** `"Buku Kas — Duplikat Wonton"`
- **Aksi:** Return segera — data tidak disimpan

### 2.3 `flagAnomaliRow_()` — Anomali
- **Kondisi:** Guard `checkSubmissionAgainstSheet_()` mendeteksi `type === "Anomali"` (data beda tapi waktu + cabang sama dalam 1 jam) — dipanggil dari `simpanDataTempura()` DAN `simpanDataWonton()`
- **Pesan:** Multi-baris dengan info sheet, baris baru, baris pembanding, dan link ke baris di spreadsheet
- **Judul:** `"Buku Kas — Anomali"`
- **Aksi:** Set `Check_Status = "Anomali"` di kedua baris yang terlibat

### 2.4 `kirimKeBukuKas()` — Gagal Kirim ke Buku Kas
- **Kondisi:** Exception/error saat `SpreadsheetApp.openById()` atau operasi sheet gagal di `kirimKeBukuKas()`
- **Pesan:** `"⚠️ Gagal kirim data setoran ke Buku Kas Gabungan: <error>"`
- **Judul:** `"Buku Kas — Gagal Kirim"`
- **Aksi:** Log error, tidak throw — data form tetap tersimpan di sheet Tempura/Wonton

### 2.5 `kirimSetoranWontonKeBukuKas()` — Cabang Tidak Dikenali
- **Kondisi:** Huruf pertama `cabang` bukan `B` (Babakan), `L` (Leweung Gajah), atau `R` (Depan RS) — `kategoriSetoranWonton()` return `null`, DAN `nilaiSetoran > 0`
- **Pesan:** Multi-baris dengan nama cabang, nilai setoran, dan instruksi input manual kategori
- **Judul:** `"Buku Kas — Cabang Tidak Dikenali"`
- **Aksi:** Data form tetap tersimpan, tapi tidak otomatis masuk Buku Kas Gabungan

### 2.6 `checkDuplicatesAnomaliesForSheet()` — Duplikat/Anomali (Checker Berkala)
- **Kondisi:** Checker berkala (bukan submission-time) menemukan `findDuplicateOrAnomaly_()` match pada baris yang belum diproses (`Check_Status` kosong) DAN timestamp dalam 1 jam terakhir
- **Pesan:** Multi-baris dengan tipe match, sheet, baris, baris pembanding, dan link
- **Judul:** `"Buku Kas — Duplikat"` atau `"Buku Kas — Anomali"` (bergantung `match.type`)
- **Aksi:** Set `Check_Status` ke `"Duplikat"`, `"Anomali"`, atau `"OK"`

### 2.7 `checkMissingReports()` — Cabang Tanpa Nama (dalam loop)
- **Kondisi:** Baris di sheet punya timestamp hari ini tapi kolom `Cabang` kosong/null
- **Pesan:** `"⚠️ Cabang belum dicantumkan namanya (baris <n>, sheet <sheetName>)"`
- **Judul:** `"Buku Kas — Cabang Tanpa Nama"`
- **Aksi:** Notifikasi dikumpulkan di array `emptyCabangAlerts`, dikirim semua setelah loop selesai

### 2.8 `checkMissingReports()` — Cabang Belum Lapor
- **Kondisi:** Setelah scan kedua sheet, ada huruf cabang (`P`, `L`, `B`, `R`) yang belum ditemukan datanya hari ini
- **Pesan:** Multi-baris dengan daftar cabang yang belum lapor + jam pengecekan
- **Judul:** `"Buku Kas — Cabang Belum Lapor"`
- **Aksi:** Kirim notifikasi daftar cabang yang belum lapor

### Ringkasan Callers

| # | Fungsi Pemanggil | Trigger/Kondisi | Judul Notif |
|---|-------------------|-----------------|-------------|
| 1 | `simpanDataTempura()` | Duplikat saat submit | Buku Kas — Duplikat Tempura |
| 2 | `simpanDataWonton()` | Duplikat saat submit | Buku Kas — Duplikat Wonton |
| 3 | `flagAnomaliRow_()` | Anomali saat submit | Buku Kas — Anomali |
| 4 | `kirimKeBukuKas()` | Error kirim ke Buku Kas | Buku Kas — Gagal Kirim |
| 5 | `kirimSetoranWontonKeBukuKas()` | Cabang tidak dikenali | Buku Kas — Cabang Tidak Dikenali |
| 6 | `checkDuplicatesAnomaliesForSheet()` | Checker berkala: duplikat/anomali | Buku Kas — Duplikat/Anomali |
| 7 | `checkMissingReports()` (loop) | Cabang tanpa nama | Buku Kas — Cabang Tanpa Nama |
| 8 | `checkMissingReports()` | Cabang belum lapor | Buku Kas — Cabang Belum Lapor |

**Catatan terhadap GRAPH_REPORT.md:** GRAPH_REPORT.md tidak ditemukan di repo saat ini (commit 7717ef97 mungkin belum di-generate). Dari kode ditemukan 8 call sites — angka ini konsisten dengan "8 edges" yang disebutkan di GRAPH_REPORT.md untuk god node `report_kirimNotif_()`.

---

## 3. Trigger Apps Script

Semua trigger didefinisikan di fungsi `setupTriggers()` (line ~414 report.gs.js). Fungsi ini dirancang untuk dijalankan **MANUAL 1 kali lewat editor Apps Script** (tidak ada trigger otomatis yang memanggil `setupTriggers()`).

### Trigger yang dibuat oleh `setupTriggers()`:

| Handler Function | Tipe | Jadwal | Catatan |
|------------------|------|--------|---------|
| `checkDuplicatesAnomalies` | time-based | Setiap 30 menit (`everyMinutes(30)`) | Checker berkala |
| `checkMissingReports` | time-based | Setiap hari jam 22:30 (`atHour(22).nearMinute(30)`) | Cek cabang belum lapor — jadwal pertama |
| `checkMissingReports` | time-based | Setiap hari jam 23:59 (`atHour(23).nearMinute(59)`) | Cek cabang belum lapor — jadwal kedua |

### Fungsi terkait trigger:

- **`checkDuplicatesAnomalies()`** → memanggil `checkDuplicatesAnomaliesForSheet()` untuk kedua sheet (Tempura & Wonton). Triggered tiap 30 menit.
- **`checkMissingReports()`** → scan kedua sheet, kirim notif untuk cabang kosong + cabang belum lapor. Triggered 2x sehari (22:30 & 23:59).

### Status Trigger

**Tidak bisa dipastikan secara statis** apakah trigger ini sudah terpasang di runtime Apps Script saat ini. Fungsi `setupTriggers()` harus dipanggil manual oleh deployer (Rofi) lewat editor. Untuk memverifikasi:
- Cek melalui Apps Script editor → menu Triggers (ikon jam)
- Atau: jalankan `ScriptApp.getProjectTriggers()` di editor untuk melihat daftar trigger aktif

### Fungsi LAIN yang kemungkinan dipanggil trigger

- `doPost(e)` dan `doGet(e)` adalah endpoint web app — dipanggil oleh HTTP request dari form HTML dan `notif_total_harian.py` (bukan trigger time-based, tapi installable via web app deploy).
- `report_kirimNotif_()` sendiri **TIDAK dipanggil trigger** — hanya dipanggil oleh fungsi-fungsi lain.

### Catatan: `checkDuplicatesAnomalies()` vs Submission-Time Check

Fungsi `checkDuplicatesAnomalies()` (triggered tiap 30 menit) melakukan hal **serupa tapi terpisah** dari `checkSubmissionAgainstSheet_()` (dijalankan saat submit). Keduanya menggunakan `findDuplicateOrAnomaly_()` yang sama, tapi checker berkala menggunakan `selfIndex = idx` (baris sudah ada di sheet), sedangkan submission-time menggunakan `selfIndex = -1` (baris belum di-append). Checker berkala adalah "jaring pengaman" untuk menangkap anomali yang terlewat saat submit.

---

## 4. Config Relevan

### Di `report.gs.js` (inline constants, TIDAK import dari config.js):

| Konstanta | Nilai | Kegunaan |
|-----------|-------|----------|
| `REPORT_NTFY_TOPIC` | `"report-checker"` | Nama channel ntfy |
| `REPORT_NTFY_URL` | `"https://ntfy.sh/report-checker"` | Endpoint lengkap ntfy |
| `SPREADSHEET_ID` | `"1eGJG0wxFsSMCFdTz87qHzaikrS8uT3PEpi9ECdJEPaI"` | ID spreadsheet utama |
| `BUKU_KAS_SPREADSHEET_ID` | `"15MZYZOhqY2dTGBeZoAe1yqwJWTh43e9qPdgotM4DuCM"` | ID spreadsheet Buku Kas Gabungan |
| `TOTAL_HARIAN_TOKEN` | `zpfadasXcgUdqMxz_rmMGNg5NVri61gN` | Token proteksi endpoint `totalHarian` |
| `DUPLICATE_WINDOW_MS` | `3600000` (1 jam) | Jendela waktu deteksi duplikat |

### Di `Config/config.js` (file terpisah):

| Variable | Nilai | Kegunaan |
|----------|-------|----------|
| `SCRIPT_URL` | `https://script.google.com/macros/s/AKfycbz.../exec` | URL web app GAS — dipakai oleh HTML form (Tempura/Wonton) untuk POST data |

**Keterkaitan:** `config.js` dan `report.gs.js` **TIDAK saling import**. `config.js` dipakai oleh frontend HTML (form submission), sedangkan `report.gs.js` punya constants inline sendiri. Satu-satunya "koneksi" tidak langsung: `SCRIPT_URL` di config.js adalah URL web app yang menerima POST dari form → memanggil `doPost()` di report.gs.js.

### Token Sensitive
- `TOTAL_HARIAN_TOKEN` di report.gs.js **harus cocok** dengan `WEBAPP_TOKEN` di `Work/Script/config.local.env` (disebutkan di komentar kode). Nilai kredensial tidak ditampilkan di laporan ini — hanya disebutkan namanya.
- Token di report.gs.js ditulis secara hardcoded di kode (bukan dari environment variable).

---

## 5. Pembanding: Pola Ntfy di Script Lokal

### 5.1 `Script/notif_total_harian.py`

**Tujuan:** Poller kolom Z (Bbkn) & AB (Total) dari sheet "Report 2026" via web app GAS.

**Endpoint ntfy:**
- URL: `https://ntfy.sh/report-checker` (sama dengan report.gs.js)
- Configurable via `NTFY_BASE_URL` + `NTFY_TOPIC` di `config.local.env` (default ke yang di atas)
- Method: POST, body = pesan plain text, header `Title` = judul, header `Click` = link (opsional)

**Config yang dibaca dari `config.local.env`:**
- `WEBAPP_URL` — URL web app GAS (untuk fetch `?action=totalHarian&token=...`)
- `WEBAPP_TOKEN` — Token autentikasi web app
- `NTFY_TOPIC` — Topic ntfy (default: `report-checker`)
- `NTFY_BASE_URL` — Base URL ntfy (default: `https://ntfy.sh`)

**Mode operasi:**
- `cek-z`: Dipanggil tiap 15 menit oleh systemd timer. Gating waktu di dalam script (21:30–23:00 WIB). Fetch webapp, cek kolom Z terisi, kirim ntfy jika belum pernah kirim hari ini (dedup via `state/last-sent-date.txt`).
- `fallback-2300`: Dipanggil tepat jam 23:00. Jika state belum ada, kirim notif fallback "kolom Z belum terisi".

**Retry:** MAX_ATTEMPT=2, RETRY_DELAY_MS=2000 — **sama persis** dengan `report_kirimNotif_()`.

**State management:** File teks `state/last-sent-date.txt` (isi: `YYYY-MM-DD`). Folder `state/` di-gitignore.

---

### 5.2 `Script/notif_checker_poller.py`

**Tujuan:** Poller hasil checker Apps Script (action=checkerStatus) — mengambil alih pengiriman ntfy dari GAS (rencana Fase 2 konsolidasi).

**Endpoint ntfy:**
- URL: `https://ntfy.sh/report-checker` (sama)
- Method: POST, body = pesan plain text, header `Title` = judul
- Tidak ada header `Click` (berbeda dengan notif_total_harian.py)

**Config yang dibaca dari `config.local.env`:**
- `WEBAPP_URL` — URL web app GAS (untuk fetch `?action=checkerStatus&token=...`)
- `WEBAPP_TOKEN` — Token autentikasi web app
- `NTFY_TOPIC` — Topic ntfy (default: `report-checker`)
- `NTFY_BASE_URL` — Base URL ntfy (default: `https://ntfy.sh`)

**Mode operasi:**
- Default: Fetch webapp nyata + kirim ntfy nyata + update state
- `--dry-run`: Fetch boleh jalan, tapi tidak kirim ntfy & tidak update state
- `--mock PATH`: Baca response dari fixture file lokal, tanpa network

**Dedup/Fingerprint:**
- State file: `state/checker-poller-state.json` (JSON: `{"checker-key": "fingerprint-sha256"}`)
- Fingerprint = SHA-256 dari checker + sheet + isi problems (dengan normalisasi timestamp → `<time>`)
- Jika fingerprint sama → skip (tidak re-notify)
- Jika `ok=true` → hapus entry dari state (issue baru = re-notify)

**Retry:** MAX_ATTEMPT=2, RETRY_DELAY_MS=2000 — **sama persis** dengan `report_kirimNotif_()`.

**Catatan status:** Endpoint `action=checkerStatus` **belum live** (Fase 1 belum di-deploy). Testing WAJIB pakai `--mock`.

---

### 5.3 Perbandingan Singkat

| Aspek | report.gs.js (GAS) | notif_total_harian.py | notif_checker_poller.py |
|-------|---------------------|----------------------|------------------------|
| **Runtime** | Google Apps Script | Local (systemd timer) | Local (systemd/manual) |
| **Topic ntfy** | `report-checker` | `report-checker` | `report-checker` |
| **Auth ke ntfy** | Tidak ada | Tidak ada | Tidak ada |
| **Retry** | 2x, delay 2s | 2x, delay 2s | 2x, delay 2s |
| **State/Dedup** | Tidak ada (langsung kirim) | File teks tanggal terakhir | JSON fingerprint SHA-256 |
| **Error handling** | Logger.log, tidak throw | Print + exit 0 | Print + exit 0 |
| **Config source** | Hardcoded di kode | `config.local.env` | `config.local.env` |

---

## 6. Catatan Tambahan

### GRAPH_REPORT.md
File `GRAPH_REPORT.md` tidak ditemukan di repo saat ini. Referensi "community 26", "cohesion 0.16", "29 nodes", dan "god node #7 (8 edges)" tidak dapat diverifikasi dari kode. Analisis call sites di atas dilakukan murni dari pembacaan kode, dan menghasilkan 8 situs pemanggilan — konsisten dengan angka 8 edges yang disebutkan.

### Kredensial Sensitif
- `TOTAL_HARIAN_TOKEN` (report.gs.js): Token hardcoded. Nilai tidak ditampilkan.
- `SCRIPT_URL` (config.js): URL web app GAS. Bukan secret (public endpoint), tapi tetap sensitif karena mengarah ke deployment spesifik.
- Config file `config.local.env` (untuk script Python): Di-gitignore, tidak ada di repo. Berisi `WEBAPP_TOKEN` yang harus cocok dengan `TOTAL_HARIAN_TOKEN`.

### Validasi Git Diff
Setelah penulisan laporan ini, hanya `Script/investigasi-wonton-ntfy-local.md` yang akan muncul di git status. File-file berikut **TIDAK diubah**:
- `Wonton/Apps-Script/report.gs.js` ✓
- `Wonton/Config/config.js` ✓
- `Script/notif_total_harian.py` ✓
- `Script/notif_checker_poller.py` ✓

---

## Detail Mekanisme Kolom Z (follow-up)

> **Tanggal:** 2026-08-29
> **Metode:** Static analysis — tidak ada fungsi ntfy/trigger yang dieksekusi.

### Temuan Utama: TIDAK ADA fungsi GAS trigger yang membaca "kolom Z"

**Tiga fungsi trigger di `setupTriggers()` (report.gs.js line 724) TIDAK membaca "kolom Z":**

| Fungsi | Trigger Jadwal | Sheet yang Dibaca | Kolom yang Dicek |
|--------|---------------|-------------------|------------------|
| `checkDuplicatesAnomalies()` (line 427) | Every 30 menit | Input_Tempura, Input_Wonton | Timestamp, Cabang, Check_Status |
| `checkMissingReports()` (line 486) | 22:30 & 23:59 daily | Input_Tempura, Input_Wonton | Timestamp, Cabang |

Kedua fungsi di atas hanya membaca sheet `Input_Tempura` / `Input_Wonton` (spreadsheet `1eGJG0wxFsSMCFdTz87qHzaikrS8uT3PEpi9ECdJEPaI`). **Tidak ada yang membuka sheet "Report 2026" atau membaca kolom Z.**

---

### 1. Fungsi yang Membaca "Kolom Z": `handleTotalHarian_()` (line 615)

- **Nama fungsi:** `handleTotalHarian_(token)`
- **Lokasi:** `report.gs.js` line 615–682
- **Sheet:** `"Report 2026"` (fallback by gid `794081767`) dari spreadsheet `SPREADSHEET_ID`
- **Bukan fungsi trigger** — dipanggil sebagai **HTTP GET endpoint** via `doGet()` (line 70):
  ```
  if (params.action === "totalHarian") {
    return handleTotalHarian_(params.token);
  }
  ```
- **Pemicu:** Script Python lokal `notif_total_harian.py` memanggil webapp endpoint `?action=totalHarian&token=...`

#### ⚠️ DISCREPANCY: Kolom Y, bukan Kolom Z

Kode aktual membaca **index 24 (kolom Y)**, bukan kolom Z:

```javascript
// Line 666-668:
// Ambil nilai langsung berdasarkan Index
// Index 24 = Kolom Y  (Babakan/Bbkn)
// Index 27 = Kolom AB (Total)
const valBbkn = (row[24] !== "" && row[24] !== null && row[24] !== undefined) ? row[24] : null;
const valTotal = (row[27] !== "" && row[27] !== null && row[27] !== undefined) ? row[27] : null;
```

**Index mapping (0-based):**
- Index 24 = **Kolom Y** (25th column) → isi: nilai Babakan/Bbkn
- Index 27 = **Kolom AB** (28th column) → isi: Total

Tapi property yang dikembalikan bernama `kolomZ` (line 676):
```javascript
kolomZ: valBbkn, // Nama properti tetap 'kolomZ' agar API penerima tidak crash
```

**Kesimpulan:** Nama "kolom Z" adalah **penamaan historis/legacy**. Di spreadsheet asli, data Bbkn berada di **kolom Y**, bukan kolom Z. Nama property `kolomZ` dipertahankan agar API consumer (notif_total_harian.py) tidak crash.

---

### 2. Arti/Isi Kolom Z (Y) dan Logic Pengecekan

**Isi kolom Y:** Nilai nominal setoran cabang Babakan (Bbkn) — bisa angka (Rp) atau kosong/null.

**Logic pengecekan "terisi atau tidak":**

Di GAS (`handleTotalHarian_`, line 666-667):
```javascript
const valBbkn = (row[24] !== "" && row[24] !== null && row[24] !== undefined)
  ? row[24]
  : null;
```
Jika cell kosong, null, atau undefined → dikembalikan sebagai `null`.

Di Python (`notif_total_harian.py`, mode `cek-z`):
```python
kolom_z = data.get("kolomZ")
if kolom_z is None or str(kolom_z).strip() == "":
    # Belum terisi — tunggu fallback 23:00
    return 0
```

Artinya: kolom dianggap **"terisi"** jika bukan null, bukan string kosong, dan bukan whitespace-only.

---

### 3. Trigger yang Memanggil Fungsi Checker Kolom Z

**TIDAK ADA GAS trigger yang memanggil `handleTotalHarian_()`.** Fungsi ini hanya dipanggil via HTTP GET dari script Python lokal.

Pemicu lokal berupa **systemd timers:**

| Timer | Interval | Service | Mode |
|-------|----------|---------|------|
| `notif-cek-kolom-z.timer` | Setiap 15 menit (`*:0/15`) | `notif-cek-kolom-z.service` | `--mode cek-z` (gating window 21:30–23:00 WIB) |
| `notif-fallback-2300.timer` | Setiap hari jam 23:00 | `notif-fallback-2300.service` | `--mode fallback-2300` |

**Alur:**
1. Timer 15 menit → `notif_total_harian.py --mode cek-z`
2. Script cek waktu: hanya jalan di window 21:30–23:00 WIB
3. Fetch webapp → `handleTotalHarian_()` di GAS → return JSON `{ok, kolomZ, total, link}`
4. Jika `kolomZ` terisi DAN belum pernah kirim hari ini → kirim ntfy
5. Jika jam 23:00 dan masih belum terisi → `notif_total_harian.py --mode fallback-2300` kirim notif "kolom Z belum terisi"

---

### 4. Struktur Kolom Terkait (Sheet "Report 2026")

| Kolom | Index (0-based) | Isi | Keterangan |
|-------|----------------|-----|------------|
| **A** | 0 | Tanggal | Format `dd/MM/yyyy`, data mulai dari baris 3 |
| **Y** | 24 | Babakan (Bbkn) | Nilai setoran — inilah yang disebut "kolom Z" secara historis |
| **AB** | 27 | Total | Total rekap harian |

- Data di sheet "Report 2026" dimulai dari **baris 3** (baris 1-2 = header)
- **Satu baris per hari** — fungsi `handleTotalHarian_()` scan baris untuk mencocokkan tanggal hari ini di kolom A

---

### 5. Pesan yang Dikirim ke Ntfy

**Tidak ada `report_kirimNotif_()` yang dipanggil dari fungsi checker kolom Z di GAS.**

Pengiriman notif dilakukan oleh script Python lokal via `send_ntfy()` (topic sama: `report-checker`):

| Mode | Judul | Isi Pesan | Kondisi |
|------|-------|-----------|--------|
| `cek-z` | `"Kolom Bbkn Terisi"` | `"Kolom Bbkn (Z) terisi untuk {tanggal}.\nTotal (AB): {total}"` | Kolom Y terisi + belum pernah kirim hari ini |
| `fallback-2300` | `"Rekap Jam 23:00 (Kolom Z belum terisi)"` | `"Rekap Jam 23:00 — kolom Z (Bbkn) belum terisi.\nTotal (AB): {total}"` | Kolom Y masih kosong di jam 23:00 |

Dedup via file `state/last-sent-date.txt` (isi: YYYY-MM-DD) — hanya kirim sekali per hari.

---

### Ringkasan Cepat

| Aspek | Nilai |
|-------|-------|
| **Fungsi GAS yang baca kolom Z** | `handleTotalHarian_()` (line 615) — HTTP endpoint, bukan trigger |
| **Sheet** | `"Report 2026"` (gid 794081767) |
| **Kolom aktual** | **Y** (index 24), bukan Z — nama "kolomZ" adalah legacy naming |
| **Kolom AB** | Index 27 = Total |
| **Kolom A** | Tanggal (dd/MM/yyyy), data dari baris 3 |
| **Struktur baris** | Satu baris per hari |
| **Trigger GAS yang memanggil** | **Tidak ada** — dipanggil via HTTP GET dari Python lokal |
| **Timer lokal** | `notif-cek-kolom-z.timer` (every 15min, gated 21:30-23:00) + `notif-fallback-2300.timer` (23:00) |
| **ntfy message** | Lihat tabel di atas — dikirim Python, bukan GAS |
| **Fungsi ntfy/trigger dieksekusi saat investigasi?** | ❌ TIDAK — static analysis saja |

---

### Validasi Git Diff (Section Ini)

Setelah penulisan section ini, hanya `Script/investigasi-wonton-ntfy-local.md` yang berubah. File-file berikut **TIDAK diubah:**
- `Wonton/Apps-Script/report.gs.js` ✓
- `Wonton/Config/config.js` ✓
- `Script/notif_total_harian.py` ✓
- `Script/notif_checker_poller.py` ✓
