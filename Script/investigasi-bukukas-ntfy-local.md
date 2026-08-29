# Investigasi Mekanisme Ntfy — Pencatatan-Buku-Kas/Apps-Script/buku-kas.gs.js

> **Tanggal investigasi:** 2026-08-29
> **Scope:** `~/HomeLab/Work/Pencatatan-Buku-Kas/Apps-Script/buku-kas.gs.js`
> **Metode:** Static analysis (read-only) — tidak ada fungsi ntfy/trigger yang dieksekusi selama investigasi.
> **Graph reference:** GRAPH_REPORT.md built from commit `7c1a47dd`; HEAD saat ini `e757d9fc` — graph **stale** (tidak di-update, task ini read-only).
> **Community graph:** Community 27, cohesion 0.13, 28 nodes — file ini.

---

## 1. Fungsi Pengirim Ntfy: `pola_kirimNotif_(pesan)`

### Status: ✅ DITEMUKAN — ada fungsi pengirim ntfy di file ini

### Endpoint & URL
- **Topic:** `buku-kas-checker` (didefinisikan sebagai `POLA_NTFY_TOPIC`)
- **Full URL:** `https://ntfy.sh/buku-kas-checker` (dibentuk dari `POLA_NTFY_URL = "https://ntfy.sh/" + POLA_NTFY_TOPIC`)
- **Service:** [ntfy.sh](https://ntfy.sh) — layanan notifikasi push publik berbasis HTTP
- **⚠️ Berbeda dengan report.gs.js:** report.gs.js pakai topic `report-checker`, buku-kas.gs.js pakai topic terpisah `buku-kas-checker`

### Method
- **POST** — payload dikirim sebagai request body (plain text, bukan JSON)

### Auth / Token
- **Tidak ada autentikasi.** Ntfy.sh publik tidak memerlukan token atau kredensial. Siapa saja yang mengetahui topic dapat mengirim/menerima.

### Payload & Headers
| Komponen | Nilai |
|----------|-------|
| **Body** | Isi `pesan` (plain text, bisa multi-baris dengan `\n`) |
| **Header `Title`** | `"Buku Kas — Pola Transaksi"` (hardcoded) |
| **Header `Content-Type`** | Tidak di-set secara eksplisit — `UrlFetchApp.fetch()` default ke plain text |

### Retry Logic
- **MAX_ATTEMPT = 2** percobaan
- **RETRY_DELAY_MS = 2000ms** (2 detik antar percobaan)
- Jika HTTP response code 2xx → sukses, return (tidak kirim lagi)
- Jika gagal atau exception → retry sekali, lalu log error dan return (tidak throw)
- Error **tidak menghentikan eksekusi** fungsi pemanggil — notifikasi dianggap "fire and forget"
- **Pola retry identik** dengan `report_kirimNotif_()` di report.gs.js dan `send_ntfy()` di notif_total_harian.py

### Token Sensitive
- **Tidak ada token/credential sensitif** yang dipakai di fungsi ini atau konstanta terkaitnya. Topic `buku-kas-checker` adalah publik.

---

## 2. Detail Lengkap `checkPolaTransaksi()`, `checkPolaPagi()`, `checkPolaMalam()`

### 2.1 `checkPolaTransaksi(tanggalTarget, DRY_RUN)` — GOD NODE #1 (12 edges)

**Fungsi inti.** Deteksi pola transaksi harian untuk tanggalTarget.

#### Apa yang dicek
1. **Pola rutin (statistical):** Scan seluruh baris sheet "Input" selama 14 hari terakhir (window kalender, TIDAK termasuk tanggalTarget). Untuk setiap kombinasi unik `kategori|belanjaDi`:
   - Hitung jumlah hari unik dimana kombinasi itu muncul
   - Jika `hari_unik / 14 >= 0.5` (50% threshold) → dianggap "pola rutin"
   - Jika pola rutin TIDAK muncul di tanggalTarget → masuk daftar reminder
2. **Aturan tetap (`POLA_KATEGORI_WAJIB`):** Kategori wajib yang **selalu** dicek di tanggalTarget, TERLEPAS dari histori 14 hari:
   - `"Tunjangan"`
   - `"Setoran Cabang Babakan"`
   - `"Setoran Cabang Depan RS"`
3. **Kombinasi wajib (`POLA_KOMBINASI_WAJIB`):** Kombinasi kategori+toko wajib dicek tiap hari:
   - `{ kategori: "Belanja", belanjaDi: "Surya" }`
4. Jika ada reminder → build SATU pesan gabungan → kirim via `pola_kirimNotif_()` (atau log saja jika `DRY_RUN=true`)

#### Input/Output
- **Input:** `tanggalTarget` (Date object atau string yang bisa di-parse), `DRY_RUN` (boolean, default `POLA_DRY_RUN = false`)
- **Return:** `{ status: "ok", target: "yyyy-MM-dd", reminders: [...], dryRun: boolean }` atau `{ status: "error", message: "..." }`

#### Konstanta pendukung
| Konstanta | Nilai | Kegunaan |
|-----------|-------|----------|
| `POLA_WINDOW_HARI` | `14` | Window 14 hari kalender ke belakang |
| `POLA_THRESHOLD` | `0.5` | Muncul >= 50% hari window → pola rutin |
| `POLA_DRY_RUN` | `false` | Notif dikirim langsung ke ntfy (bukan cuma log) |

### 2.2 `checkPolaPagi()` — Trigger 07:00

- **Kapan dipanggil:** Time-based trigger, setiap hari jam 07:00 WIB
- **Apa yang dilakukan:** Hitung tanggal **kemarin (H-1)**, panggil `checkPolaTransaksi()` dengan tanggal kemarin
- **Logika waktu:**
  ```js
  const d = pola_dateFromDayKey_(pola_dayKey_(new Date()));
  checkPolaTransaksi(new Date(d.getTime() - 86400000));
  ```
  Hitung midnight hari ini (via `dayKey_`), lalu kurangi 1 hari (86400000 ms)
- **Tujuan:** Cek apakah transaksi rutin yang seharusnya ada kemarin sudah tercatat — notifikasi "kemarin belum tercatat"
- **Saling terhubung:** `checkPolaPagi()` → memanggil `checkPolaTransaksi()`. Independen dari `checkPolaMalam()` (tidak ada shared state).

### 2.3 `checkPolaMalam()` — Trigger 21:00

- **Kapan dipanggil:** Time-based trigger, setiap hari jam 21:00 WIB
- **Apa yang dilakukan:** Panggil `checkPolaTransaksi()` dengan tanggal **hari ini (H)**
- **Logika waktu:**
  ```js
  checkPolaTransaksi(pola_dateFromDayKey_(pola_dayKey_(new Date())));
  ```
- **Tujuan:** Cek apakah transaksi rutin yang seharusnya ada hari ini sudah tercatat — notifikasi "hari ini belum tercatat"
- **Saling terhubung:** `checkPolaMalam()` → memanggil `checkPolaTransaksi()`. Independen dari `checkPolaPagi()`.

### 2.4 Status keterhubungan ketiga fungsi

| Fungsi | Dipanggil oleh | Memanggil | Tipe trigger |
|--------|---------------|-----------|-------------|
| `checkPolaTransaksi()` | `checkPolaPagi()`, `checkPolaMalam()` | `pola_kirimNotif_()`, `pola_parseTanggal_()`, `pola_normalize_()`, `pola_dayKey_()`, `pola_dateFromDayKey_()`, `pola_buildPesan_()` | — (dipanggil oleh fungsi lain) |
| `checkPolaPagi()` | Apps Script time-based trigger (07:00) | `checkPolaTransaksi()`, `pola_dateFromDayKey_()`, `pola_dayKey_()` | Time-based: 07:00 daily |
| `checkPolaMalam()` | Apps Script time-based trigger (21:00) | `checkPolaTransaksi()` | Time-based: 21:00 daily |

**Kesimpulan:** Ketiga fungsi **saling terhubung secara hierarkis** — `checkPolaPagi` dan `checkPolaMalam` adalah dua wrapper yang memanggil `checkPolaTransaksi`. Mereka **independen satu sama lain** (tidak ada shared state atau panggilan silang). `checkPolaTransaksi` adalah pusat dari semua operasi.

---

## 3. Daftar Lengkap Pemanggil `checkPolaTransaksi()`

Ditemukan **2 situs pemanggilan** langsung (direct callers). Sisanya edges di GRAPH_REPORT.md berasal dari **internal dependency** (helper functions yang dipanggil oleh `checkPolaTransaksi`).

### 3.1 Direct Callers (2 situs)

| # | Fungsi Pemanggil | Baris Kode | Kapan Dipanggil | Argumen |
|---|-------------------|-----------|-----------------|---------|
| 1 | `checkPolaPagi()` | `checkPolaTransaksi(new Date(d.getTime() - 86400000));` | Time-based trigger 07:00 daily | `tanggalTarget = kemarin (H-1)`, `DRY_RUN = default (false)` |
| 2 | `checkPolaMalam()` | `checkPolaTransaksi(pola_dateFromDayKey_(pola_dayKey_(new Date())));` | Time-based trigger 21:00 daily | `tanggalTarget = hari ini (H)`, `DRY_RUN = default (false)` |

### 3.2 Internal Dependencies (memanggil checkPolaTransaksi / dipanggil oleh checkPolaTransaksi)

Edges ke-3 sampai ke-12 di GRAPH_REPORT.md berasal dari hubungan internal berikut:

| # | Relasi | Fungsi | Keterangan |
|---|--------|--------|-----------|
| 3 | `checkPolaTransaksi` → panggil | `pola_kirimNotif_()` | Kirim notif ntfy |
| 4 | `checkPolaTransaksi` → panggil | `pola_parseTanggal_()` | Parse timestamp sheet |
| 5 | `checkPolaTransaksi` → panggil | `pola_normalize_()` | Normalisasi string (trim+lower) |
| 6 | `checkPolaTransaksi` → panggil | `pola_dayKey_()` | Konversi Date → "yyyy-MM-dd" |
| 7 | `checkPolaTransaksi` → panggil | `pola_dateFromDayKey_()` | Konversi "yyyy-MM-dd" → Date |
| 8 | `checkPolaTransaksi` → panggil | `pola_buildPesan_()` | Bangun pesan gabungan reminder |
| 9 | Konstanta terkait | `POLA_KATEGORI_WAJIB` | Daftar kategori wajib |
| 10 | Konstanta terkait | `POLA_KOMBINASI_WAJIB` | Daftar kombinasi kategori+toko wajib |
| 11 | Konstanta terkait | `POLA_WINDOW_HARI` | Window 14 hari |
| 12 | Konstanta terkait | `POLA_THRESHOLD` | Threshold 50% |

### 3.3 Cross-check dengan GRAPH_REPORT.md

**Angka 12 edges dari GRAPH_REPORT.md konsisten** dengan temuan di atas: 2 direct callers + 10 internal dependencies (helper functions + constants). Tidak ada caller tersembunyi dari file lain atau dari `doGet()`/`doPost()`. Fungsi `checkPolaTransaksi` hanya bisa dipanggil oleh `checkPolaPagi` dan `checkPolaMalam`.

**⚠️ Catatan penting:** Tidak ada pemanggil dari luar kedua fungsi trigger. Artinya, migrasi ntfy dari fungsi ini **tidak perlu khawatir ada caller tak terduga** — cukup fokus pada 2 trigger yang memanggil `checkPolaPagi`/`checkPolaMalam`, atau pada `pola_kirimNotif_()` itu sendiri.

---

## 4. Trigger Apps Script

### 4.1 Trigger terkait checkPola*

Semua trigger didefinisikan di fungsi `setupTriggersPolaTransaksi()` (harus dijalankan **MANUAL 1 kali** lewat editor Apps Script).

| Handler Function | Tipe | Jadwal | Keterangan |
|------------------|------|--------|------------|
| `checkPolaPagi` | `timeBased()` | `atHour(7).nearMinute(0).everyDays(1)` | 07:00 WIB daily |
| `checkPolaMalam` | `timeBased()` | `atHour(21).nearMinute(0).everyDays(1)` | 21:00 WIB daily |

Fungsi `setupTriggersPolaTransaksi()` juga menghapus trigger duplikat via `pola_deleteTriggersByHandler_()` sebelum memasang yang baru (idempotent).

### 4.2 Trigger LAIN di file ini (terpisah, tidak terkait ntfy/pola)

| Handler Function | Tipe | Keterangan |
|------------------|------|------------|
| `onSheetChangeInstallable` | `onChange()` (installable) | Dipasang via `setupOnChangeTrigger()`. Menulis timestamp ke `PropertiesService` saat sheet berubah — untuk fitur "Riwayat" |

### 4.3 Status Trigger

**Tidak bisa dipastikan secara statis** apakah trigger di atas sudah terpasang di runtime Apps Script saat ini. Fungsi `setupTriggersPolaTransaksi()` dan `setupOnChangeTrigger()` harus dipanggil manual oleh deployer (Rofi) lewat editor. Untuk memverifikasi:
- Cek melalui Apps Script editor → menu Triggers (ikon jam)
- Atau jalankan `ScriptApp.getProjectTriggers()` di editor

### 4.4 ⚠️ JANGAN jalankan trigger apapun selama investigasi ini

Fungsi `checkPolaPagi()`, `checkPolaMalam()`, dan `pola_kirimNotif_()` **tidak dieksekusi** selama investigasi ini — hanya dibaca secara statis. Menjalankan mereka dapat mengirim notifikasi ntfy asli ke topic `buku-kas-checker`.

---

## 5. Fungsi yang TIDAK Berhubungan dengan Ntfy/Pola Transaksi (Irrelevant)

Berikut fungsi-fungsi di `buku-kas.gs.js` yang **aman tidak disentuh** dalam task migrasi ntfy:

| Fungsi | Kegunaan | Alasan Irrelevant |
|--------|----------|-------------------|
| `doPost(e)` | Endpoint web app — terima POST dari form HTML, route ke `handleEdit_`/`handleDelete_`/create row | Tidak ada hubungan dengan ntfy atau pola |
| `doGet(e)` | Endpoint web app — handle `action=list` dan `action=ping` | Tidak ada hubungan dengan ntfy atau pola |
| `handleList_(tanggalStr)` | Return JSON baris sheet untuk tanggal tertentu | Fungsi data read-only, tidak ada ntfy |
| `handleEdit_(data)` | Edit baris sheet berdasarkan nomor baris | CRUD murni, tidak ada ntfy |
| `handleDelete_(data)` | Hapus baris sheet berdasarkan nomor baris | CRUD murni, tidak ada ntfy |
| `jsonOut_(obj)` | Helper — buat JSON response via `ContentService` | Utility, tidak ada ntfy |
| `formatTimestampCell_(value)` | Format Date object atau string ke `"dd/MM/yyyy HH:mm:ss"` | Utility, tidak ada ntfy |
| `isKategoriMasuk_(kategori)` | Cek apakah kategori termasuk "Masuk" atau "Keluar" | Business logic murni, tidak ada ntfy |
| `onSheetChangeInstallable(e)` | Trigger handler — tulis timestamp ke Properties saat sheet berubah | Tracking perubahan, tidak ada ntfy |
| `setupOnChangeTrigger()` | Pasang installable onChange trigger (sekali manual) | Trigger setup, tidak ada ntfy |

**Total: 10 fungsi irrelevant.** Ini memperkuat bahwa seluruh mekanisme ntfy di file ini terisolasi di blok pola (separator `==== CHECK POLA TRANSAKSI HARIAN...====` di kode).

---

## 6. Pembanding dengan `notif_total_harian.py`

### 6.1 Perbandingan Endpoint & Mekanisme Ntfy

| Aspek | buku-kas.gs.js (GAS) | notif_total_harian.py (Local) |
|-------|----------------------|-------------------------------|
| **Runtime** | Google Apps Script (triggered 2x/hari) | Local (systemd timer) |
| **Topic ntfy** | `buku-kas-checker` (TERPISAH) | `report-checker` |
| **Auth ke ntfy** | Tidak ada | Tidak ada |
| **Method** | POST, plain text body | POST, plain text body |
| **Header Title** | `"Buku Kas — Pola Transaksi"` (hardcoded) | Dynamic (`f"Total Qris hari ini : {total}"`) |
| **Header Click** | Tidak ada | Ada (link ke sheet) |
| **Retry** | 2x, delay 2s | 2x, delay 2s |
| **Config source** | Hardcoded inline (tidak import config) | `config.local.env` (env vars override) |
| **Dedup** | Tidak ada file state (langsung kirim) | File `state/last-sent-date.txt` (satu notif/hari) |

### 6.2 Perbandingan Logic Business

| Aspek | buku-kas.gs.js (GAS) | notif_total_harian.py (Local) |
|-------|----------------------|-------------------------------|
| **Yang dicek** | Pola transaksi rutin (14 hari window, 50% threshold) + aturan tetap | Nilai kolom AB (Total) terisi atau tidak |
| **Data source** | Sheet "Input" (Buku Kas, dibaca langsung dari GAS) | Sheet "Report 2026" via webapp endpoint GAS |
| **Pemicu** | Time-based trigger GAS (07:00 & 21:00) | Systemd timer (every 15min gated 21:30-23:00) |
| **State management** | Tidak ada (dikirim tiap trigger fire) | File teks (satu kirim/hari, anti-dobel) |
| **Error handling** | Logger.log, tidak throw | Print + exit 0 |

### 6.3 Catatan Relevan untuk Migrasi
- Topik ntfy **berbeda** — `buku-kas-checker` (buku-kas) vs `report-checker` (report/notif_total_harian). Migrasi nanti perlu pertimbangkan apakah mau konsolidasi atau tetap terpisah.
- Retry pattern **identik** — pola MAX_ATTEMPT=2/RETRY_DELAY_MS=2000 sudah menjadi standar konsisten.
- `buku-kas.gs.js` **tidak punya dedup/state management** — notif dikirim setiap trigger fire tanpa cek apakah sudah kirim sebelumnya. Ini potensial issue jika trigger fire lebih dari sekali per hari.
- `notif_total_harian.py` sudah punya **config external** (`config.local.env`), sedangkan `buku-kas.gs.js` **hardcoded semua** — termasuk topic URL.

---

## 7. Ringkasan Temuan

### Status Ntfy
✅ **Ada fungsi pengirim ntfy di file ini:** `pola_kirimNotif_(pesan)` — mengirim ke topic `buku-kas-checker` via `https://ntfy.sh/buku-kas-checker`. POST, plain text, tanpa auth, retry 2x/2s.

### God Node `checkPolaTransaksi()`
- **2 direct callers** (`checkPolaPagi` via trigger 07:00, `checkPolaMalam` via trigger 21:00)
- **10 internal edges** (helper functions + constants) → total 12 edges konsisten dengan GRAPH_REPORT.md
- **Tidak ada caller dari luar** — tidak dipanggil dari `doGet()`, `doPost()`, atau fungsi lain di file ini

### Trigger
- `setupTriggersPolaTransaksi()` — dipasang manual 1x, menghasilkan 2 time-based trigger (07:00 & 21:00)
- Status terpasang: **tidak bisa dipastikan secara statis**

### Fungsi Irrelevant (aman tidak disentuh)
`doPost()`, `doGet()`, `handleList_()`, `handleEdit_()`, `handleDelete_()`, `jsonOut_()`, `formatTimestampCell_()`, `isKategoriMasuk_()`, `onSheetChangeInstallable()`, `setupOnChangeTrigger()`

### Graph Freshness
GRAPH_REPORT.md dibangun dari commit `7c1a47dd`, HEAD saat ini `e757d9fc` — **graph stale**, tidak di-update dalam task ini.

### Eksekusi Fungsi Selama Investigasi
❌ **TIDAK ada fungsi yang dieksekusi** — investigasi murni static analysis (read-only). `checkPolaPagi()`, `checkPolaMalam()`, `checkPolaTransaksi()`, dan `pola_kirimNotif_()` tidak dipanggil/dijalankan.

---

## Validasi Git Diff

Setelah penulisan laporan ini, hanya `Script/investigasi-bukukas-ntfy-local.md` yang akan muncul di git status. File-file berikut **TIDAK diubah:**
- `Pencatatan-Buku-Kas/Apps-Script/buku-kas.gs.js` ✓
- `Script/notif_total_harian.py` ✓
- `Script/investigasi-wonton-ntfy-local.md` ✓

---

## Detail Logic Pola Transaksi (follow-up)

> **Tanggal:** 2026-08-29
> **Metode:** Static analysis — tidak ada fungsi ntfy/trigger yang dieksekusi.
> **Latar:** Melengkapi laporan di atas dengan penjelasan logic detail di dalam `checkPolaTransaksi()` dan 10 helper functions.

---

### 1. Definisi "Pola" yang Dicek

`checkPolaTransaksi()` menjawab satu pertanyaan: **"Apakah ada transaksi yang biasanya rutin tapi belum tercatat di tanggal tertentu?"**

Ada **3 mekanisme** yang menentukan kapan notifikasi dikirim vs tidak:

#### Mekanisme A — Pola Rutin (Statistical)

```
IF kombinasi (kategori + belanjaDi) muncul di ≥ 50% hari dalam 14 hari terakhir
   DAN kombinasi itu TIDAK muncul di tanggalTarget
→ MASUK daftar reminder (dengan label "muncul X/14 hari terakhir, belum tercatat")
```

Contoh konkret: "Setoran Cabang Babakan" muncul 8 dari 14 hari terakhir (= 57% ≥ 50%) tapi hari ini belum ada → masuk reminder.

**Penting:** Yang dihitung adalah **hari unik**, bukan jumlah transaksi. Kalau "Belanja|Surya" muncul 3 kali dalam 1 hari tapi tidak muncul di 6 hari lain, tetap hanya dihitung 1 hari unik (= 1/14 = 7% — tidak memenuhi threshold).

#### Mekanisme B — Kategori Wajib (Hardcoded Rule)

```
UNTUK setiap kategori di POLA_KATEGORI_WAJIB:
  IF kategori itu TIDAK muncul di tanggalTarget
     DAN belum masuk reminder dari Mekanisme A
  → MASUK daftar reminder (dengan label "wajib (aturan tetap)")
```

Kategori wajib saat ini:
- `"Tunjangan"`
- `"Setoran Cabang Babakan"`
- `"Setoran Cabang Depan RS"`

**Kondisi ini BERBEDA dari Mekanisme A:** tidak peduli histori 14 hari — kategori ini **selalu** dicek, bahkan kalau belum pernah muncul sekalipun di window 14 hari.

#### Mekanisme C — Kombinasi Kategori+Toko Wajib

```
UNTUK setiap kombinasi di POLA_KOMBINASI_WAJIB:
  IF kombinasi (kategori + belanjaDi) TIDAK muncul di tanggalTarget
     DAN belum masuk reminder dari Mekanisme A atau B
  → MASUK daftar reminder (dengan label "wajib (aturan tetap)")
```

Kombinasi wajib saat ini:
- `{ kategori: "Belanja", belanjaDi: "Surya" }` — hanya "Belanja di Surya" yang wajib, kategori "Belanja" di toko lain TIDAK diwajibkan.

#### Keputusan Akhir: Kirim atau Tidak

```
IF reminders.length === 0:
  → TIDAK kirim notif (return ok, reminders kosong)
ELSE:
  → Build SATU pesan gabungan berisi SEMUA reminder
  → KIRIM via pola_kirimNotif_(pesan)
  → Return ok dengan daftar reminders
```

**Tidak ada filter duplikat lintas mekanisme.** Mekanisme B dan C secara eksplisit cek `sudahDiReminder` sebelum push — jadi satu kategori tidak akan muncul 2x dalam satu notif. Tapi Mekanisme A dan B bisa menghasilkan reminder yang isinya sama secara semantik jika kategori wajib juga memenuhi threshold pola rutin (dalam praktik: ini jarang terjadi karena kategori wajib biasanya memang rutin).

---

### 2. Perbedaan `checkPolaPagi()` vs `checkPolaMalam()`

**Satu-satunya perbedaan: tanggalTarget yang dikirim.**

| Aspek | checkPolaPagi() | checkPolaMalam() |
|-------|----------------|------------------|
| **Trigger time** | 07:00 WIB | 21:00 WIB |
| **tanggalTarget** | **Kemarin (H-1)** | **Hari ini (H)** |
| **Cara hitung** | `new Date(base.getTime() - 86400000)` — ambil midnight hari ini, kurangi 1 hari | `pola_dateFromDayKey_(pola_dayKey_(new Date()))` — ambil midnight hari ini |
| **Artinya** | "Apakah transaksi rutin kemarin sudah tercatat?" | "Apakah transaksi rutin hari ini sudah tercatat?" |

**Tidak ada parameter/mode lain yang berbeda.** Keduanya memanggil `checkPolaTransaksi()` dengan `DRY_RUN = default (false)`, `POLA_WINDOW_HARI = 14`, dan `POLA_THRESHOLD = 0.5` yang sama. Logic di dalam `checkPolaTransaksi()` **identik** — hanya input tanggal yang berbeda.

**Mengapa ada 2 trigger?** Karena pagi (07:00) adalah waktu yang tepat untuk mengingatkan transaksi kemarin yang belum tercatat (operator baru mulai kerja), sedangkan malam (21:00) adalah waktu terakhir untuk memastikan transaksi hari ini sudah lengkap sebelum tutup hari.

---

### 3. Sheet dan Kolom yang Dibaca

**Sheet:** `"Input"` (didefinisikan sebagai `const SHEET_NAME = "Input"`)

**Range dibaca:** `sheet.getRange(2, 1, lastRow - 1, 5)` — artinya:
- Mulai dari **baris 2** (baris 1 = header, dilewati)
- **5 kolom** pertama (A sampai E)

| Kolom | Index (0-based) | Isi | Dipakai untuk |
|-------|-----------------|-----|---------------|
| **A** | 0 | Timestamp (format tidak konsisten) | Parse tanggal → tentukan hari transaksi |
| **B** | 1 | Keterangan | Tidak dipakai dalam pola |
| **C** | 2 | Kategori | Digunakan sebagai key pola (kategori + belanjaDi) |
| **D** | 3 | BelanjaDi (toko/mitra) | Digunakan sebagai key pola |
| **E** | 4 | Jumlah | Tidak dipakai dalam pola |

**Format timestamp kolom A (3 format didukung oleh `pola_parseTanggal_()`):**
1. `Date object` — langsung dari cell berformat tanggal di Google Sheets
2. `"29/07/2026 12:57:11"` — format dd/MM/yyyy HH:mm:ss (jam/menit opsional)
3. `"Kamis, 16 Juli 2026"` — nama hari opsional + tanggal bulan Indonesia + tahun

Timestamp yang gagal di-parse → baris di-skip (dihitung sebagai `gagalParse` di log, tidak mempengaruhi logic pola).

---

### 4. Peran Masing-Masing Helper Function

| # | Fungsi | Peran dalam Logic Pola |
|---|--------|----------------------|
| 1 | `pola_parseTanggal_(value)` | Mengonversi timestamp mentah dari kolom A (3 format berbeda) menjadi Date object — **kunci** untuk menentukan tanggal transaksi. Jika gagal parse → baris di-skip. |
| 2 | `pola_normalize_(s)` | Menormalisasi string (trim + lowercase) supaya perbandingan kategori/toko case-insensitive — misal "Setoran cabang BABAKAN" == "Setoran Cabang Babakan". |
| 3 | `pola_dayKey_(date)` | Mengonversi Date → string `"yyyy-MM-dd"` di timezone Asia/Jakarta — jadi **hari kunci** untuk mencocokkan baris ke tanggalTarget atau window 14 hari. |
| 4 | `pola_dateFromDayKey_(dayKey)` | Kebalikan dari `pola_dayKey_()` — mengonversi `"yyyy-MM-dd"` → Date object (UTC noon) untuk perhitungan window 14 hari. |
| 5 | `pola_buildPesan_(targetKey, reminders)` | Membangun SATU pesan gabungan multi-baris dari semua reminder — format `"📋 Pola transaksi belum tercatat — YYYY-MM-DD\n1. ..."`. |
| 6 | `pola_kirimNotif_(pesan)` | Mengirim pesan ke ntfy.sh via POST (topic `buku-kas-checker`). Retry 2x, delay 2s. Error tidak throw. — **satu-satunya titik eksekusi notifikasi** di seluruh file ini. |

**Catatan:** 4 fungsi sisanya dari 10 yang disebut di bagian 3.2 laporan sebelumnya adalah **konstanta** (`POLA_KATEGORI_WAJIB`, `POLA_KOMBINASI_WAJIB`, `POLA_WINDOW_HARI`, `POLA_THRESHOLD`) — bukan fungsi, tapi parameter yang mengontrol threshold dan aturan wajib.

---

### 5. Contoh Skenario Hipotetis

#### Skenario 1: Pola rutin terdeteksi → NOTIFIKASI DIKIRIM

**Setup hari Kamis, 28 Agustus 2026 (`targetKey = "2026-08-28"`):**

| Tanggal | Kategori | BelanjaDi | Catatan |
|---------|----------|-----------|--------|
| 2026-08-27 | Setoran Cabang Babakan | | Muncul |
| 2026-08-26 | Setoran Cabang Babakan | | Muncul |
| 2026-08-25 | Setoran Cabang Babakan | | Muncul |
| 2026-08-24 | Setoran Cabang Babakan | | Muncul |
| 2026-08-23 | Setoran Cabang Babakan | | Muncul |
| 2026-08-22 | Setoran Cabang Babakan | | Muncul |
| 2026-08-21 | Setoran Cabang Babakan | | Muncul |
| 2026-08-20 | Setoran Cabang Babakan | | Muncul |
| **2026-08-28** | *(tidak ada Setoran Babakan)* | | **TIDAK tercatat di target** |

**Logic:**
- `Setoran Cabang Babakan` muncul 8 hari unik dari 14 → `8/14 = 57% ≥ 50%` → **pola rutin**
- `munculTarget["setoran cabang babakan|"] = false` → belum tercatat
- → **MASUK reminder** (Mekanisme A)
- Selain itu, `Setoran Cabang Babakan` juga ada di `POLA_KATEGORI_WAJIB` — tapi sudah masuk via Mekanisme A, jadi Mekanisme B skip (sudahDiReminder = true)

**Hasil:** Notifikasi terkirim dengan isi:
```
📋 Pola transaksi belum tercatat — 2026-08-28
1. Setoran Cabang Babakan — muncul 8/14 hari terakhir, belum tercatat
```

---

#### Skenario 2: Semua pola sudah tercatat → TIDAK ADA NOTIFIKASI

**Setup hari Jumat, 29 Agustus 2026 (`targetKey = "2026-08-29"`):**

| Tanggal | Kategori | BelanjaDi |
|---------|----------|----------|
| 2026-08-28 | Tunjangan | | Muncul |
| 2026-08-27 | Setoran Cabang Babakan | | Muncul |
| 2026-08-26 | Setoran Cabang Depan RS | | Muncul |
| ... (window 14 hari) | ... | | Total 8 hari unik per kategori |
| **2026-08-29** | Tunjangan | | **TERCATAT** |
| **2026-08-29** | Setoran Cabang Babakan | | **TERCATAT** |
| **2026-08-29** | Setoran Cabang Depan RS | | **TERCATAT** |
| **2026-08-29** | Belanja | Surya | **TERCATAT** |

**Logic:**
- `Tunjangan`: 8/14 ≥ 50% → pola rutin, tapi `munculTarget` = true → **TIDAK masuk reminder**
- `Setoran Cabang Babakan`: 8/14 ≥ 50% → pola rutin, tapi `munculTarget` = true → **TIDAK masuk reminder**
- `Setoran Cabang Depan RS`: 8/14 ≥ 50% → pola rutin, tapi `munculTarget` = true → **TIDAK masuk reminder**
- Mekanisme B (kategori wajib): semua sudah `wajibMunculTarget` = true → **skip semua**
- Mekanisme C (Belanja|Surya): sudah `munculTarget` = true → **skip**

**Hasil:** `reminders.length === 0` → **TIDAK kirim notif**, return `{ status: "ok", reminders: [] }`.

---

#### Skenario 3: Kombinasi wajib hilang → NOTIFIKASI DIKIRIM (walaupun kategori "Belanja" lain ada)

**Setup hari Sabtu, 30 Agustus 2026 (`targetKey = "2026-08-30"`):**

| Tanggal | Kategori | BelanjaDi |
|---------|----------|----------|
| **2026-08-30** | Belanja | Indomaret | **TERCATAT** |
| **2026-08-30** | Belanja | Alfamart | **TERCATAT** |
| **2026-08-30** | *(tidak ada Belanja di Surya)* | | |

**Logic:**
- `POLA_KOMBINASI_WAJIB` cek: `munculTarget["belanja|surya"]` → false (tidak tercatat)
- `munculTarget` punya `belanja|indomaret` dan `belanja|alfamart` — tapi ini key BERBEDA, tidak cocok dengan `belanja|surya`
- → **MASUK reminder** (Mekanisme C)

**Hasil:** Notifikasi terkirim:
```
📋 Pola transaksi belum tercatat — 2026-08-30
1. Belanja (Surya) — wajib (aturan tetap)
```

**Catatan:** Kategori "Belanja" di Indomaret/Alfamart TIDAK memicu reminder — hanya kombinasi spesifik "Belanja" + "Surya" yang diwajibkan.

---

### Ringkasan Cepat: Kapan Notif Dikirim vs Tidak

| Kondisi | Notif? |
|---------|--------|
| Semua pola rutin (≥50% dari 14 hari) sudah tercatat di tanggalTarget | ❌ Tidak |
| Kategori wajib (`POLA_KATEGORI_WAJIB`) sudah tercatat di tanggalTarget | ❌ Tidak |
| Kombinasi wajib (`POLA_KOMBINASI_WAJIB`) sudah tercatat di tanggalTarget | ❌ Tidak |
| Ada pola rutin yang belum tercatat | ✅ Ya (satu notif gabungan) |
| Ada kategori wajib yang belum tercatat | ✅ Ya (satu notif gabungan) |
| Ada kombinasi wajib yang belum tercatat | ✅ Ya (satu notif gabungan) |
| Sheet "Input" kosong atau tidak ada | ❌ Tidak (return error/ok kosong) |
| tanggalTarget tidak valid / gagal parse | ❌ Tidak (return error) |

### Eksekusi Fungsi Selama Investigasi (Section Ini)
❌ **TIDAK ada fungsi yang dieksekusi** — analisis murni static (baca kode). Skenario hipotetis di atas **tidak dijalankan**, hanya ilustrasi tertulis.