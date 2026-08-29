# Graph Report - Work  (2026-08-29)

## Corpus Check
- 31 files · ~39,328 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 483 nodes · 652 edges · 34 communities (29 shown, 5 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `dfe2fd4d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Riwayat/script.js
- Pencatatan-Buku-Kas/script.js
- Stok/script.js
- 2. Daftar Lengkap Pemanggil `report_kirimNotif_()`
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
- Detail Mekanisme Kolom Z (follow-up)
- Investigasi Mekanisme Ntfy — Pencatatan-Buku-Kas/Apps-Script/buku-kas.gs.js
- Detail Logic Pola Transaksi (follow-up)

## God Nodes (most connected - your core abstractions)
1. `Investigasi Mekanisme Ntfy — Pencatatan-Buku-Kas/Apps-Script/buku-kas.gs.js` - 10 edges
2. `2. Daftar Lengkap Pemanggil `report_kirimNotif_()`` - 10 edges
3. `hitungRekomendasiProduk()` - 9 edges
4. `Investigasi Konsolidasi Notifikasi ntfy — `report.gs.js`` - 9 edges
5. `Detail Mekanisme Kolom Z (follow-up)` - 9 edges
6. `cek_dan_kirim_total_harian()` - 8 edges
7. `simpanDataTempura()` - 8 edges
8. `simpanDataWonton()` - 8 edges
9. `report_kirimNotif_()` - 8 edges
10. `1. Fungsi Pengirim Ntfy: `pola_kirimNotif_(pesan)`` - 8 edges

## Surprising Connections (you probably didn't know these)
- `fetchList()` --calls--> `renderList()`  [EXTRACTED]
  Pencatatan-Buku-Kas/Riwayat/script.js → Pencatatan-Buku-Kas/Riwayat/script.js  _Bridges community 10 → community 14_
- `fetchMonthList()` --calls--> `monthKeyOf()`  [EXTRACTED]
  Pencatatan-Buku-Kas/Riwayat/script.js → Pencatatan-Buku-Kas/Riwayat/script.js  _Bridges community 11 → community 14_
- `goToMonth()` --calls--> `formatBulanLabel()`  [EXTRACTED]
  Pencatatan-Buku-Kas/Riwayat/script.js → Pencatatan-Buku-Kas/Riwayat/script.js  _Bridges community 13 → community 11_

## Import Cycles
- None detected.

## Communities (34 total, 5 thin omitted)

### Community 0 - "Riwayat/script.js"
Cohesion: 0.04
Nodes (41): RFC-4180, allRowsToday, btnBatalEdit, btnBatalHapus, btnBulanIni, btnDownload, btnHariIni, btnKemarin (+33 more)

### Community 1 - "Pencatatan-Buku-Kas/script.js"
Cohesion: 0.09
Nodes (27): addToQueue(), belanjaDiLainnyaInput, belanjaDiWrap, form, getSelectedBelanjaDi(), getSelectedKategoriLain(), getSelectedOutlet(), jumlahEl (+19 more)

### Community 2 - "Stok/script.js"
Cohesion: 0.08
Nodes (38): applyRekomendasiToDom(), btnHariIni, btnKemarin, btnRefresh, buatCatatan(), currentDate, datePicker, emptyMsg (+30 more)

### Community 3 - "2. Daftar Lengkap Pemanggil `report_kirimNotif_()`"
Cohesion: 0.05
Nodes (36): 1. Alur Lengkap `report_kirimNotif_(pesan, judul)`, 2.1 `simpanDataTempura()` — Duplikat Tempura, 2.2 `simpanDataWonton()` — Duplikat Wonton, 2.3 `flagAnomaliRow_()` — Anomali, 2.4 `kirimKeBukuKas()` — Gagal Kirim ke Buku Kas, 2.5 `kirimSetoranWontonKeBukuKas()` — Cabang Tidak Dikenali, 2.6 `checkDuplicatesAnomaliesForSheet()` — Duplikat/Anomali (Checker Berkala), 2.7 `checkMissingReports()` — Cabang Tanpa Nama (dalam loop) (+28 more)

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
Cohesion: 0.13
Nodes (21): applySavedFilters(), buildSavedTokoColors(), escapeAttr(), fetchSavedItems(), formatRp(), items, manualItems, openDeleteSavedModal() (+13 more)

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
Cohesion: 0.27
Nodes (12): cek_dan_kirim_total_harian(), cfg_get(), fetch_webapp(), is_dry_run(), main(), now_wib(), Ambil baris hari ini dari webapp, kirim Total (kolom AB) via ntfy., Env var override duluan, baru config file. (+4 more)

### Community 25 - "Deploy Manual (WAJIB oleh Rofi — freebuff tidak menjalankan ini)"
Cohesion: 0.20
Nodes (9): 1. Tempel kode ke `report.gs`, 2. Deploy ulang sebagai Web App, 3. Isi `config.local.env`, 4. Aktifkan linger (sekali saja, kalau belum aktif), 5. Pasang & aktifkan timer, Deploy Manual (WAJIB oleh Rofi — freebuff tidak menjalankan ini), Script — Notif Total Harian Sheet "Report 2026", Struktur (+1 more)

### Community 26 - "report.gs.js"
Cohesion: 0.16
Nodes (29): buildHeaderTempura(), buildHeaderWonton(), buildRowLink(), buildRowTempura(), buildRowWonton(), checkDuplicatesAnomalies(), checkDuplicatesAnomaliesForSheet(), checkMissingReports() (+21 more)

### Community 27 - "buku-kas.gs.js"
Cohesion: 0.29
Nodes (12): doGet(), doPost(), formatTimestampCell_(), handleDelete_(), handleEdit_(), handleList_(), isKategoriMasuk_(), jsonOut_() (+4 more)

### Community 28 - "Investigasi Konsolidasi Notifikasi ntfy — `report.gs.js`"
Cohesion: 0.15
Nodes (12): 1. Daftar fungsi cek di `report.gs.js` + status pemanggilan `report_kirimNotif_()`, 2. Detail `report_kirimNotif_(pesan, judul)` (L735–763), 3. Status trigger per fungsi cek, 4. Status `doGet()` — data yang sudah/ belum di-expose, 5. Perbandingan dengan pola `notif_total_harian.py`, 6. Status `report-gs-doGet-addition.gs.txt`, 7. Rekomendasi, Estimasi effort Model A (hanya bagian time-based): (+4 more)

### Community 29 - "notif_checker_poller.py"
Cohesion: 0.17
Nodes (18): build_message(), cfg_get(), checker_key(), compute_fingerprint(), fetch_checker_status(), is_dry_run(), main(), _normalize_problem_detail() (+10 more)

### Community 31 - "Detail Mekanisme Kolom Z (follow-up)"
Cohesion: 0.20
Nodes (10): 1. Fungsi yang Membaca "Kolom Z": `handleTotalHarian_()` (line 615), 2. Arti/Isi Kolom Z (Y) dan Logic Pengecekan, 3. Trigger yang Memanggil Fungsi Checker Kolom Z, 4. Struktur Kolom Terkait (Sheet "Report 2026"), 5. Pesan yang Dikirim ke Ntfy, Detail Mekanisme Kolom Z (follow-up), ⚠️ DISCREPANCY: Kolom Y, bukan Kolom Z, Ringkasan Cepat (+2 more)

### Community 32 - "Investigasi Mekanisme Ntfy — Pencatatan-Buku-Kas/Apps-Script/buku-kas.gs.js"
Cohesion: 0.05
Nodes (39): 1. Fungsi Pengirim Ntfy: `pola_kirimNotif_(pesan)`, 2.1 `checkPolaTransaksi(tanggalTarget, DRY_RUN)` — GOD NODE #1 (12 edges), 2.2 `checkPolaPagi()` — Trigger 07:00, 2.3 `checkPolaMalam()` — Trigger 21:00, 2.4 Status keterhubungan ketiga fungsi, 2. Detail Lengkap `checkPolaTransaksi()`, `checkPolaPagi()`, `checkPolaMalam()`, 3.1 Direct Callers (2 situs), 3.2 Internal Dependencies (memanggil checkPolaTransaksi / dipanggil oleh checkPolaTransaksi) (+31 more)

### Community 33 - "Detail Logic Pola Transaksi (follow-up)"
Cohesion: 0.13
Nodes (15): 1. Definisi "Pola" yang Dicek, 2. Perbedaan `checkPolaPagi()` vs `checkPolaMalam()`, 3. Sheet dan Kolom yang Dibaca, 4. Peran Masing-Masing Helper Function, 5. Contoh Skenario Hipotetis, Detail Logic Pola Transaksi (follow-up), Eksekusi Fungsi Selama Investigasi (Section Ini), Keputusan Akhir: Kirim atau Tidak (+7 more)

## Knowledge Gaps
- **219 isolated node(s):** `all`, `menuBtn`, `drawer`, `overlay`, `drawerClose` (+214 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Investigasi Mekanisme Ntfy — Pencatatan-Buku-Kas/Apps-Script/buku-kas.gs.js` connect `Investigasi Mekanisme Ntfy — Pencatatan-Buku-Kas/Apps-Script/buku-kas.gs.js` to `Detail Logic Pola Transaksi (follow-up)`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `Investigasi Mekanisme Ntfy — Wonton/Apps-Script/report.gs.js` connect `2. Daftar Lengkap Pemanggil `report_kirimNotif_()`` to `Detail Mekanisme Kolom Z (follow-up)`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Why does `Detail Logic Pola Transaksi (follow-up)` connect `Detail Logic Pola Transaksi (follow-up)` to `Investigasi Mekanisme Ntfy — Pencatatan-Buku-Kas/Apps-Script/buku-kas.gs.js`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **What connects `all`, `menuBtn`, `drawer` to the rest of the system?**
  _219 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Riwayat/script.js` be split into smaller, more focused modules?**
  _Cohesion score 0.044444444444444446 - nodes in this community are weakly interconnected._
- **Should `Pencatatan-Buku-Kas/script.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08817204301075268 - nodes in this community are weakly interconnected._
- **Should `Stok/script.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._