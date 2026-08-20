# Graph Report - Work  (2026-08-20)

## Corpus Check
- 30 files · ~34,375 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 406 nodes · 585 edges · 31 communities (26 shown, 5 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 10 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7d305322`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Riwayat/script.js
- Pencatatan-Buku-Kas/script.js
- Stok/script.js
- Laporan Diagnosis — Baris Kosong Berulang di Sheet "INPUT"
- Rekap/script.js
- Dashboard/script.js
- Karyawan-Baru/script.js
- package.json
- Reminder/script.js
- Playwright Test Suite — Pencatatan-Buku-Kas
- applyFilterAndRenderCards
- goToMonth
- Scan-Struk/script.js
- downloadFileName
- fetchMonthList
- kas-harian.spec.js
- kantong.py
- nav.js
- playwright.config.js
- work-push.sh
- riwayat-dividen.spec.js
- notif_total_harian.py
- Deploy Manual (WAJIB oleh Rofi — freebuff tidak menjalankan ini)
- report.gs.js
- buku-kas.gs.js
- Investigasi Konsolidasi Notifikasi ntfy — `report.gs.js`
- notif_checker_poller.py
- test_checker_poller.py

## God Nodes (most connected - your core abstractions)
1. `checkPolaTransaksi()` - 12 edges
2. `hitungRekomendasiProduk()` - 9 edges
3. `Laporan Diagnosis — Baris Kosong Berulang di Sheet "INPUT"` - 9 edges
4. `Investigasi Konsolidasi Notifikasi ntfy — `report.gs.js`` - 9 edges
5. `mode_cek_z()` - 8 edges
6. `simpanDataTempura()` - 8 edges
7. `simpanDataWonton()` - 8 edges
8. `report_kirimNotif_()` - 8 edges
9. `handleList_()` - 7 edges
10. `fetchMonthList()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `fetchList()` --calls--> `renderList()`  [EXTRACTED]
  Pencatatan-Buku-Kas/Riwayat/script.js → Pencatatan-Buku-Kas/Riwayat/script.js  _Bridges community 10 → community 14_
- `fetchMonthList()` --calls--> `monthKeyOf()`  [EXTRACTED]
  Pencatatan-Buku-Kas/Riwayat/script.js → Pencatatan-Buku-Kas/Riwayat/script.js  _Bridges community 11 → community 14_
- `goToMonth()` --calls--> `formatBulanLabel()`  [EXTRACTED]
  Pencatatan-Buku-Kas/Riwayat/script.js → Pencatatan-Buku-Kas/Riwayat/script.js  _Bridges community 13 → community 11_

## Import Cycles
- None detected.

## Communities (31 total, 5 thin omitted)

### Community 0 - "Riwayat/script.js"
Cohesion: 0.04
Nodes (41): RFC-4180, allRowsToday, btnBatalEdit, btnBatalHapus, btnBulanIni, btnDownload, btnHariIni, btnKemarin (+33 more)

### Community 1 - "Pencatatan-Buku-Kas/script.js"
Cohesion: 0.09
Nodes (27): addToQueue(), belanjaDiLainnyaInput, belanjaDiWrap, form, getSelectedBelanjaDi(), getSelectedKategoriLain(), getSelectedOutlet(), jumlahEl (+19 more)

### Community 2 - "Stok/script.js"
Cohesion: 0.08
Nodes (38): applyRekomendasiToDom(), btnHariIni, btnKemarin, btnRefresh, buatCatatan(), currentDate, datePicker, emptyMsg (+30 more)

### Community 3 - "Laporan Diagnosis — Baris Kosong Berulang di Sheet "INPUT""
Cohesion: 0.09
Nodes (22): 1. Ringkasan Masalah, 2. Lokasi Folder Apps Script "buku-kas", 3.1 Form Kas Harian (`script.js`) — validasi ada, tidak bisa submit kosong, 3.2 Antrean pengiriman (queue) — TIDAK ada auto-retry, tidak bisa spam, 3.3 Halaman Riwayat (`Riwayat/script.js`) — polling hanya GET, interval 10 detik, 3.4 Halaman Scan Struk (`Scan-Struk/script.js`) — ⚠️ TEMUAN PENTING, 3.5 `shared-utils.js` — netral, 3. Temuan Kode Client-Side (Work/Pencatatan-Buku-Kas/) (+14 more)

### Community 4 - "Rekap/script.js"
Cohesion: 0.14
Nodes (19): allItems, applyFilters(), buildTokoColors(), emptyMsg, errorMsg, fetchItems(), formatRp(), listEl (+11 more)

### Community 5 - "Dashboard/script.js"
Cohesion: 0.19
Nodes (13): all, bmGroupHTML(), bmHTML(), cardHTML(), catColor(), catIcon(), drawer, drawerClose (+5 more)

### Community 6 - "Karyawan-Baru/script.js"
Cohesion: 0.20
Nodes (8): form, hubunganChips, hubunganInput, hubunganLainnya, submitBtn, submitLabel, successMsg, uploadedImages

### Community 7 - "package.json"
Cohesion: 0.20
Nodes (9): description, devDependencies, @playwright/test, name, private, scripts, test, version (+1 more)

### Community 8 - "Reminder/script.js"
Cohesion: 0.40
Nodes (8): el, fmtDuration(), getCustomSeconds(), getTimePickerSeconds(), hideStatus(), showStatus(), submitReminder(), validateAndGetSeconds()

### Community 9 - "Playwright Test Suite — Pencatatan-Buku-Kas"
Cohesion: 0.25
Nodes (7): Kendala yang ditemukan saat pilot, Menjalankan, Playwright Test Suite — Pencatatan-Buku-Kas, ⚠️ Safety: data produksi tidak boleh tersentuh, Setup (sekali per mesin), Skenario saat ini, Struktur

### Community 10 - "applyFilterAndRenderCards"
Cohesion: 0.32
Nodes (8): applyFilterAndRenderCards(), formatRupiah(), KATEGORI_MASUK, openDeleteModal(), openEditModal(), populateKategoriSelect(), renderKategoriFilterBar(), renderList()

### Community 11 - "goToMonth"
Cohesion: 0.29
Nodes (8): currentViewKey(), goToDate(), goToMonth(), invalidateCache(), monthKeyOf(), pollMarker(), refreshCurrent(), updateDownloadVisibility()

### Community 12 - "Scan-Struk/script.js"
Cohesion: 0.23
Nodes (7): escapeAttr(), formatRp(), items, manualItems, renderItems(), renderManualItems(), updateTotals()

### Community 13 - "downloadFileName"
Cohesion: 0.33
Nodes (6): csvEscape(), downloadCsv(), downloadFileName(), formatBulanLabel(), formatBulanNama(), sanitizeFilenamePart()

### Community 14 - "fetchMonthList"
Cohesion: 0.60
Nodes (5): fetchDayRows(), fetchList(), fetchMonthList(), isCacheValid(), setLoading()

### Community 17 - "kantong.py"
Cohesion: 0.33
Nodes (4): _dalam_range_reminder(), _nama_hari_besok(), Cek apakah waktu sekarang masuk Range A (Kamis 20:00 - Jumat 05:00) atau Range…, Nama hari esok (H+1) dalam Bahasa Indonesia, mis. hari ini Kamis -> Jumat.

### Community 23 - "riwayat-dividen.spec.js"
Cohesion: 0.32
Nodes (7): fs, interceptNetwork(), MOCK_SHARED_UTILS_JS, mockRows(), path, { test, expect }, todayTimestamp()

### Community 24 - "notif_total_harian.py"
Cohesion: 0.35
Nodes (12): cfg_get(), fetch_webapp(), is_dry_run(), main(), mode_cek_z(), mode_fallback_2300(), now_wib(), Env var override duluan, baru config file. (+4 more)

### Community 25 - "Deploy Manual (WAJIB oleh Rofi — freebuff tidak menjalankan ini)"
Cohesion: 0.20
Nodes (9): 1. Tempel kode ke `report.gs`, 2. Deploy ulang sebagai Web App, 3. Isi `config.local.env`, 4. Aktifkan linger (sekali saja, kalau belum aktif), 5. Pasang & aktifkan timer, Deploy Manual (WAJIB oleh Rofi — freebuff tidak menjalankan ini), Script — Notif Kolom Z (Bbkn) / Total Harian Sheet "Report 2026", Struktur (+1 more)

### Community 26 - "report.gs.js"
Cohesion: 0.16
Nodes (29): buildHeaderTempura(), buildHeaderWonton(), buildRowLink(), buildRowTempura(), buildRowWonton(), checkDuplicatesAnomalies(), checkDuplicatesAnomaliesForSheet(), checkMissingReports() (+21 more)

### Community 27 - "buku-kas.gs.js"
Cohesion: 0.13
Nodes (28): checkPolaMalam(), checkPolaPagi(), checkPolaTransaksi(), doGet(), doPost(), formatTimestampCell_(), handleDelete_(), handleEdit_() (+20 more)

### Community 28 - "Investigasi Konsolidasi Notifikasi ntfy — `report.gs.js`"
Cohesion: 0.15
Nodes (12): 1. Daftar fungsi cek di `report.gs.js` + status pemanggilan `report_kirimNotif_()`, 2. Detail `report_kirimNotif_(pesan, judul)` (L735–763), 3. Status trigger per fungsi cek, 4. Status `doGet()` — data yang sudah/ belum di-expose, 5. Perbandingan dengan pola `notif_total_harian.py`, 6. Status `report-gs-doGet-addition.gs.txt`, 7. Rekomendasi, Estimasi effort Model A (hanya bagian time-based): (+4 more)

### Community 29 - "notif_checker_poller.py"
Cohesion: 0.17
Nodes (18): build_message(), cfg_get(), checker_key(), compute_fingerprint(), fetch_checker_status(), is_dry_run(), main(), _normalize_problem_detail() (+10 more)

## Knowledge Gaps
- **157 isolated node(s):** `all`, `menuBtn`, `drawer`, `overlay`, `drawerClose` (+152 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `all`, `menuBtn`, `drawer` to the rest of the system?**
  _157 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Riwayat/script.js` be split into smaller, more focused modules?**
  _Cohesion score 0.044444444444444446 - nodes in this community are weakly interconnected._
- **Should `Pencatatan-Buku-Kas/script.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08817204301075268 - nodes in this community are weakly interconnected._
- **Should `Stok/script.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._
- **Should `Laporan Diagnosis — Baris Kosong Berulang di Sheet "INPUT"` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `Rekap/script.js` be split into smaller, more focused modules?**
  _Cohesion score 0.14210526315789473 - nodes in this community are weakly interconnected._
- **Should `buku-kas.gs.js` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._