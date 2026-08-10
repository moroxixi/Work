# Investigasi Konsolidasi Notifikasi ntfy — `report.gs.js`

> **Sifat task**: read-only. Tidak ada kode existing yang diubah. Laporan ini adalah
> satu-satunya artefak yang dibuat (10 Agustus 2026).
> **Sumber yang dibaca**: `Work/Wonton/Apps-Script/report.gs.js` (penuh),
> `Work/Script/notif_total_harian.py` (penuh), `Work/Script/report-gs-doGet-addition.gs.txt`
> (penuh), `Work/Script/README.md` (penuh).

---

## 1. Daftar fungsi cek di `report.gs.js` + status pemanggilan `report_kirimNotif_()`

Verifikasi: `grep -n "^function "` → **27 fungsi top-level** (semua tercantum di bawah).
Cross-check: `grep -n "report_kirimNotif_("` → **9 baris = 8 call-site + 1 definisi**.
Semua 8 call-site sudah dibahas (7 fungsi pemanggil unik, 2 call-site di `checkMissingReports`).
Konsisten dengan klaim "god node 8 edges" di graph report.

| Fungsi | Ringkasan logic | Data sheet | Panggil `report_kirimNotif_()` | Catatan |
|---|---|---|---|---|
| `doPost(e)` (L43) | Entry point POST form Tempura/Wonton, dispatch ke simpan* | — | Tidak | Murni dispatcher |
| `doGet(e)` (L62) | Entry point GET; action `stok` & `totalHarian` | — | Tidak | Sudah expose data (lihat §4) |
| `simpanDataTempura(data)` (L82) | Submit Tempura: guard duplikat/anomali → appendRow → kirim ke Buku Kas | `Input_Tempura` | **Ya — langsung** (L98: duplikat diblokir) | Logic campur: tulis sheet + side-effect Buku Kas + notif |
| `buildHeaderTempura()` (L111) | Build header kolom Tempura | — | Tidak | Murni helper |
| `buildRowTempura(data)` (L128) | Build baris data Tempura | — | Tidak | Murni helper |
| `simpanDataWonton(data)` (L158) | Submit Wonton: guard duplikat/anomali → appendRow → kirim ke Buku Kas | `Input_Wonton` | **Ya — langsung** (L174: duplikat diblokir) | Logic campur (sama seperti Tempura) |
| `buildHeaderWonton()` (L187) | Build header kolom Wonton | — | Tidak | Murni helper |
| `buildRowWonton(data)` (L204) | Build baris data Wonton | — | Tidak | Murni helper |
| `kirimSetoranTempuraKeBukuKas(data)` (L238) | Susun baris setoran Tempura (omset, sterofoam, gaji, pengeluaran) → `kirimKeBukuKas` | — (baca dari payload) | Tidak langsung | Murni komputasi; ntfy hanya turunan lewat `kirimKeBukuKas` |
| `kirimSetoranWontonKeBukuKas(data)` (L266) | Susun baris setoran Wonton + kategori cabang; nilai setoran cabang R pakai selisih | — | **Ya — langsung** (L283: cabang tidak dikenali, setoran tidak masuk Buku Kas) | Logic campur komputasi + notif di cabang unknown |
| `kategoriSetoranWonton(cabang)` (L309) | Map huruf awal cabang → kategori Buku Kas | — | Tidak | Murni komputasi |
| `kirimKeBukuKas(rows)` (L317) | Tulis batch ke sheet `Input` buku kas gabungan (ID `15MZ...`) | `BUKU_KAS_SPREADSHEET_ID` / `Input` | **Ya — langsung** (L330: gagal kirim ke Buku Kas) | Side-effect tulis sheet + notif error |
| `formatTimestampWIB(date)` (L334) | Format WIB | — | Tidak | Murni helper |
| `findDuplicateOrAnomaly_(...)` (L351) | Logika tunggal deteksi duplikat/anomali (cabang+hari+dalam window 1 jam) | Baca array baris | Tidak | **Murni komputasi** — kandidat paling mudah dipindah |
| `checkSubmissionAgainstSheet_(sheet, newRow)` (L383) | Guard saat submit (selfIndex=-1) | Sheet aktif | Tidak | Murni komputasi (wrapper) |
| `flagAnomaliRow_(sheet, guard, ...)` (L397) | Tandai `Check_Status="Anomali"` di baris baru + pembanding, kirim alert | Sheet aktif | **Ya — langsung** (L412) | Campur: tulis sheet + notif |
| `buildRowLink(gid, rowNum)` (L415) | Build link sheet | — | Tidak | Murni helper |
| `checkDuplicatesAnomalies()` (L427) | Orchestrator checker berkala (2 sheet) | — | Tidak langsung (via ForSheet) | Panggil `checkDuplicatesAnomaliesForSheet` x2 |
| `checkDuplicatesAnomaliesForSheet(sheetName, gid)` (L432) | Scan baris 1 jam terakhir, mark `Check_Status` Anomali/OK, kirim alert | `Input_Tempura`/`Input_Wonton` | **Ya — langsung** (L473) | **Side-effect tulis sheet** (mark status) + notif — bukan murni baca |
| `checkMissingReports()` (L486) | Cek cabang P/L/B/R sudah lapor hari ini; alert cabang kosong nama | `Input_Tempura`/`Input_Wonton` | **Ya — langsung** (L504 cabang tanpa nama, L512 cabang belum lapor) | **Murni baca** (scan data range) + notif; tidak menulis sheet |
| `scanSheetForReports(sheet, ...)` (L516) | Scan baris hari ini per prefix cabang | Sheet | Tidak | Murni komputasi; hasil lewat array `reported`/`emptyCabangAlerts` |
| `handleStok_(tanggalStr, cabangKode)` (L550) | Expose Sisa/Laku per cabang per tanggal | Sheet | Tidak | Endpoint doGet, murni baca |
| `handleTotalHarian_(token)` (L623) | Expose kolom Z (Bbkn)/AB (Total) hari ini, token-protected | Sheet `Report 2026` (gid 794081767) | Tidak | Endpoint doGet, murni baca |
| `report_kirimNotif_(pesan, judul)` (L735) | **God node** — wrapper ntfy | — | — | Definisi (lihat §2) |
| `setupTriggers()` (L766) | Pasang trigger time-based (lihat §3) | — | Tidak | Wiring trigger DI KODE |
| `deleteTriggersByHandler(handlerName)` (L792) | Hapus trigger by handler | — | Tidak | Helper |
| `responseJSON(obj)` (L798) | Wrap JSON ContentService | — | Tidak | Helper |

**Peta pemanggil → god node** (8 call-site):

```
simpanDataTempura (L98) ──────────────► report_kirimNotif_ (duplikat Tempura diblokir)
simpanDataWonton (L174) ──────────────► report_kirimNotif_ (duplikat Wonton diblokir)
kirimSetoranWontonKeBukuKas (L283) ───► report_kirimNotif_ (cabang tidak dikenali)
kirimKeBukuKas (L330) ────────────────► report_kirimNotif_ (gagal kirim Buku Kas)
flagAnomaliRow_ (L412) ───────────────► report_kirimNotif_ (anomali saat submit)
checkDuplicatesAnomaliesForSheet (L473)► report_kirimNotif_ (anomali/duplikat checker 30m)
checkMissingReports (L504) ───────────► report_kirimNotif_ (cabang tanpa nama)
checkMissingReports (L512) ───────────► report_kirimNotif_ (cabang belum lapor)
```

**Tidak ada pemanggilan tersembunyi** — semua call-site muncul di pembacaan linear +
grep konsisten (tidak ada panggilan via `eval`/callback async yang tersembunyi).

---

## 2. Detail `report_kirimNotif_(pesan, judul)` (L735–763)

- **Signature**: `function report_kirimNotif_(pesan, judul)` — 2 parameter posisional.
- **Bukan pure wrapper 1-shot**: punya **retry 2x dengan delay 2000ms** (`MAX_ATTEMPT = 2`,
  `RETRY_DELAY_MS = 2000`), `muteHttpExceptions: true`, log per percobaan.
- Request: `POST https://ntfy.sh/report-checker` (const `REPORT_NTFY_URL`), body = `pesan`,
  header `Title: judul || "Report Checker"`. Sukses = HTTP 2xx. Gagal setelah 2x → log,
  return tanpa error (fire-and-forget).
- **Tidak ada logic format pesan tambahan** — format pesan disusun di caller masing-masing.
- Catatan penting: pola retry ini **identik** dengan `send_ntfy()` di `notif_total_harian.py`
  (MAX_ATTEMPT=2, RETRY_DELAY_MS=2000) — ntfy-sending sudah "terduplikasi" secara konseptual
  antara GAS dan Python, jadi sisi pengiriman Python sudah proven.

---

## 3. Status trigger per fungsi cek

**Temuan: wiring trigger DITEMUKAN DI KODE** di `setupTriggers()` (L766–790) —
bukan manual-only. Tapi status terpasang-aktual tetap **tidak bisa dipastikan secara statis**:

| Fungsi | Wiring di kode | Jadwal di kode | Status aktual |
|---|---|---|---|
| `checkDuplicatesAnomalies` | ✅ `ScriptApp.newTrigger(...).timeBased().everyMinutes(30)` (L770–773) | tiap 30 menit | Tidak bisa dipastikan — `setupTriggers()` harus dijalankan manual 1x via editor dulu |
| `checkMissingReports` | ✅ 2 trigger: `atHour(22).nearMinute(30)` (L775–779) + `atHour(23).nearMinute(59)` (L781–785) | 22:30 & 23:59 harian | Tidak bisa dipastikan — sama seperti di atas |
| `checkDuplicatesAnomaliesForSheet` | Tidak dipasang langsung — dipanggil oleh `checkDuplicatesAnomalies` | — | Ikut status `checkDuplicatesAnomalies` |
| `simpanDataTempura`/`simpanDataWonton` | Tidak — event-driven via `doPost` (form) | — | Aktif otomatis selama Web App ter-deploy |

**Implikasi**: trigger time-based untuk kedua checker sudah dikodekan, tinggal apakah
`setupTriggers()` pernah dijalankan (cek manual: Apps Script editor → Triggers, atau
`ScriptApp.getProjectTriggers()` read-only). Tidak perlu wiring baru untuk Model A — jadwal
GAS sudah jadi referensi jadwal timer systemd Python.

---

## 4. Status `doGet()` — data yang sudah/ belum di-expose

`doGet(e)` (L62–80) sudah punya 2 action:

| Action | Handler | Data yang di-expose |
|---|---|---|
| `action=stok` | `handleStok_` (L550) | Sisa/Laku per item per cabang per tanggal |
| `action=totalHarian` | `handleTotalHarian_` (L623) | Tanggal, kolom Z (Bbkn), total AB, rowNumber, link — **token-protected** (`TOTAL_HARIAN_TOKEN`) |

**BELUM di-expose**: hasil `checkMissingReports()` (siapa yang belum lapor hari ini) dan
hasil `checkDuplicatesAnomaliesForSheet()` (anomali/duplikat baru). Artinya untuk Model A,
perlu 1–2 action doGet baru (mis. `action=missingReports`, `action=checkDuplicates`) yang
menjalankan logika scan dan return JSON — pola sudah ada (ikuti `handleTotalHarian_` +
token guard + `responseJSON`).

Catatan kehati-hatian: `checkDuplicatesAnomaliesForSheet` punya **side-effect tulis**
(mark `Check_Status` = "Anomali"/"OK"). Kalau doGet baru mengekspos fungsinya, ekspos
**hasil scan** (daftar anomali baru) tanpa memindahkan penandaan; atau pertahankan checker
GAS 30-menit untuk penandaan dan Python hanya membaca hasilnya.

---

## 5. Perbandingan dengan pola `notif_total_harian.py`

| Aspek | GAS (`report_kirimNotif_` + checker) | Python (`notif_total_harian.py`) |
|---|---|---|
| Trigger | Apps Script time-based (30m / 22:30 / 23:59) | systemd user timer (`notif-cek-kolom-z.timer` tiap 15m, `notif-fallback-2300.timer` 23:00) |
| Window gating | Tidak ada (trigger dijadwalkan) | Di dalam script (`WINDOW_START 21:30`, `WINDOW_END 23:00`, gating WIB) |
| Fetch data | Baca spreadsheet langsung | Poll `doGet?action=totalHarian&token=...` (token dari `config.local.env`) |
| Kirim ntfy | `POST ntfy.sh/report-checker`, retry 2x/2s, Title header | **Identik**: `send_ntfy()` retry 2x/2s, Title + Click header |
| Anti-dobel | Tidak ada state — tiap trigger kirim apa adanya | State file `state/last-sent-date.txt` (YYYY-MM-DD) |
| Konfigurasi | Konstanta di file GAS | `config.local.env` + env override, `DRY_RUN` mode testing |
| Auth endpoint | — | Token query param sederhana (bukan OAuth) |

**Relevansi untuk konsolidasi**: pola "Python poll doGet + kirim ntfy + state anti-dobel"
sudah production-proven untuk kasus totalHarian. Mekanisme retry ntfy identik dengan GAS.
Yang BELUM dimiliki Python: akses ke hasil checker (butuh doGet baru, §4) dan penjadwalan
ulang yang meniru trigger GAS (timer systemd baru: 22:30 / 23:59 / tiap 30m).

---

## 6. Status `report-gs-doGet-addition.gs.txt`

**Kesimpulan: sudah terintegrasi penuh, dan draft kini USANG (terlampaui oleh implementasi aktual).**

Bukti:
- **BAGIAN A** (konstanta `TOTAL_HARIAN_TOKEN`): ✅ terintegrasi — tapi di aktual token-nya
  sudah diisi (`"zpfadasXcgUdqMxz_rmMGNg5NVri61gN"`), bukan placeholder `<TOKEN_DI_SINI>`.
- **BAGIAN B** (cabang `action === "totalHarian"` di `doGet`): ✅ terintegrasi persis di L67–69.
- **BAGIAN C** (`handleTotalHarian_`): ✅ terintegrasi (L623), **TAPI versi aktual sudah berkembang
  melampaui draft**:
  - Draft: kolom Z pakai index tetap `row[25]`.
  - Aktual: **lookup header dinamis** untuk kolom bernama "Bbkn" (case-insensitive), dengan
    deteksi ambigu (`columnLookupError`) — perubahan yang jelas-jelas dimaksudkan untuk
    robustness terhadap kolom yang disisipkan.
  - Aktual: header di row 2, data mulai row 3 (`rowNumber = i + 2`), sementara draft
    mengasumsikan header row 1. Komentar + `TODO(Rofi)` di aktual menandakan sudah ada
    verifikasi lapangan yang tidak tercermin di draft.

Header draft juga menyatakan "Jangan di-edit/di-push oleh freebuff" — statusnya file
referensi. **Karena sudah terintegrasi penuh + ada versi yang lebih baik di aktual,
draft ini tidak perlu dipertahankan sebagai sumber kebenaran.** Kalau Model A nanti
menambah doGet action, sebaiknya jadikan `handleTotalHarian_` aktual sebagai template,
bukan draft ini.

---

## 7. Rekomendasi

### Kesimpulan: **Model A — feasible untuk notifikasi berbasis WAKTU; TIDAK bisa penuh untuk notifikasi event-driven.**

**Alasan konkret (dari temuan, bukan asumsi):**

1. **8 call-site `report_kirimNotif_` terbagi 2 kelompok berbeda sifatnya:**
   - **Time-based (4 call-site)**: `checkDuplicatesAnomaliesForSheet` (L473),
     `checkMissingReports` (L504, L512). Dijalankan trigger terjadwal → **sangat cocok**
     dipindah ke pola poller Python (sudah proven oleh `notif_total_harian.py`).
   - **Event-driven (4 call-site)**: `simpanDataTempura` (L98), `simpanDataWonton` (L174),
     `kirimSetoranWontonKeBukuKas` (L283), `kirimKeBukuKas` (L330), `flagAnomaliRow_` (L412).
     Terpicu submit form real-time. **Poller Python tidak bisa mereplikasi notif real-time** —
     menunggu poll berikutnya (15m/30m) mengubah semantik notif (mis. "duplikat diblokir"
     yang tadinya langsung, jadi telat). Ini alasan konkret kenapa "cabut SEMUA ntfy dari GAS"
     tidak disarankan.

2. **Side-effect tulis sheet**: `checkDuplicatesAnomaliesForSheet` dan `flagAnomaliRow_`
   tidak murni komputasi — mereka **menulis `Check_Status`** ke sheet. Kalau logic-nya
   dipindah penuh ke Python (Model B), Python harus punya akses tulis ke spreadsheet
   (Sheets API + kredensial) — infrastruktur baru yang jauh lebih besar daripada nambah
   action doGet read-only. `checkMissingReports` + `scanSheetForReports` justru **murni
   baca** — kandidat terbersih untuk Model A.

3. **Pola ntfy sudah terduplikasi identik** (§5) — sisi pengiriman bukan hambatan.

### Estimasi effort Model A (hanya bagian time-based):

| Fungsi di `report.gs.js` | Perubahan |
|---|---|
| `doGet(e)` | + cabang `action=missingReports` (dan opsional `action=checkDuplicates`) |
| `handleMissingReports_` (baru) | Bungkus logika `checkMissingReports`/`scanSheetForReports`, return JSON daftar cabang belum lapor — token-guard pola `handleTotalHarian_` |
| `checkMissingReports()` | Hapus 2 call-site `report_kirimNotif_` (L504, L512) — atau sisakan untuk masa transisi |
| `checkDuplicatesAnomaliesForSheet()` | Pertahankan penandaan `Check_Status`, hapus call-site ntfy (L473); hasil anomali baru bisa diekspos action `checkDuplicates` kalau mau |
| Event-driven (L98, L174, L283, L330, L412) | **TIDAK disentuh** — tetap kirim ntfy dari GAS |

| File Python | Perubahan |
|---|---|
| `notif_total_harian.py` | + mode baru `--mode missing-reports` (window mis. 22:00–23:30, pakai state file anti-dobel yang sama) memanggil action baru |
| `systemd/` | + 1–2 timer baru meniru jadwal GAS (22:30 & 23:59; atau cukup 1 jendela cek) |
| `config.local.env` | `WEBAPP_TOKEN` sama (action baru pakai token yang sama) |

**Estimasi kasar**: ~1 session kerja focused (kecil-sedang). Titik paling rawan bukan
pengiriman ntfy (sudah proven di Python), tapi memastikan jadwal timer systemd meniru
semantik trigger GAS yang lama (30m / 22:30 / 23:59) dan tidak ada celah (mis. GAS
di-retire sebelum timer baru aktif → notif hilang).

**Model B** (pindah total ke Python) hanya layak kalau event-driven notif juga mau
dideregulasi (mis. ganti jadi "cek berkala saja") ATAU Python dapat akses tulis Sheets API —
keduanya keputusan produk, bukan kebutuhan teknis dari temuan ini.

### Status yang tidak bisa dipastikan secara statis
- Apakah `setupTriggers()` sudah pernah dijalankan (trigger aktual terpasang?) → cek
  manual `ScriptApp.getProjectTriggers()` atau UI Triggers.
- Nama tab/gid sheet "Report 2026" (ada TODO(Rofi) di `handleTotalHarian_`).

---

## Lampiran: verifikasi yang dilakukan

- `grep -n "^function "` → 27 fungsi, semua dipetakan di §1.
- `grep -n "report_kirimNotif_("` → 9 kemunculan (8 call-site + 1 definisi), semua dibahas.
- `grep -n "ScriptApp"` → hanya di `setupTriggers`/`deleteTriggersByHandler`.
- `git status` sebelum PENUTUP: 6 file modified pre-existing (WIP user, TIDAK disentuh task ini)
  + 1 file baru untracked: `Work/Script/investigasi-konsolidasi-ntfy.md`.
