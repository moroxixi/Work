# Graph Report - Work  (2026-09-20)

## Corpus Check
- 43 files · ~82,121 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 758 nodes · 1104 edges · 49 communities (40 shown, 9 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2c550fdd`
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
- Report-Harian/script.js
- Investigasi Mekanisme Ntfy — Pencatatan-Buku-Kas/Apps-Script/buku-kas.gs.js
- Detail Logic Pola Transaksi (follow-up)
- Investigasi — Sumber Data "Rekap Pengeluaran Harian" & Struktur Quicknav (Pencatatan-Buku-Kas)
- Pendaftaran/script.js
- code.gs.js
- Submit/script.js
- processFotoFile
- showReport
- admin-nav.js
- applyFormData
- renderLaporanCanvas
- Membership/nav.js
- hideKodeDropdown
- Member/script.js
- admin-auth.js
- Check-Pesanan/script.js

## God Nodes (most connected - your core abstractions)
1. `json_()` - 21 edges
2. `trim_()` - 16 edges
3. `doPost()` - 14 edges
4. `getMemberSheet_()` - 12 edges
5. `doPostPendaftaran_()` - 11 edges
6. `buildReceiptCard()` - 10 edges
7. `checkAdminPin_()` - 10 edges
8. `Investigasi Mekanisme Ntfy — Pencatatan-Buku-Kas/Apps-Script/buku-kas.gs.js` - 10 edges
9. `2. Daftar Lengkap Pemanggil `report_kirimNotif_()`` - 10 edges
10. `doPostSubmitOrder_()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `setCardPhoto()` --references--> `MAO_CONFIG`  [EXTRACTED]
  Membership/Admin/Member/script.js → Membership/config.js
- `processFotoFile()` --references--> `MAO_CONFIG`  [EXTRACTED]
  Membership/Pendaftaran/script.js → Membership/config.js
- `processFotoFile()` --references--> `MAO_CONFIG`  [EXTRACTED]
  Membership/Submit/script.js → Membership/config.js
- `driveImageUrl()` --references--> `MAO_CONFIG`  [EXTRACTED]
  Membership/Admin/Check-Pesanan/script.js → Membership/config.js
- `setFotoDrive()` --references--> `MAO_CONFIG`  [EXTRACTED]
  Membership/Admin/Check-Pesanan/script.js → Membership/config.js

## Import Cycles
- None detected.

## Communities (49 total, 9 thin omitted)

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
Cohesion: 0.04
Nodes (46): 1. Alur Lengkap `report_kirimNotif_(pesan, judul)`, 1. Fungsi yang Membaca "Kolom Z": `handleTotalHarian_()` (line 615), 2.1 `simpanDataTempura()` — Duplikat Tempura, 2.2 `simpanDataWonton()` — Duplikat Wonton, 2.3 `flagAnomaliRow_()` — Anomali, 2.4 `kirimKeBukuKas()` — Gagal Kirim ke Buku Kas, 2.5 `kirimSetoranWontonKeBukuKas()` — Cabang Tidak Dikenali, 2.6 `checkDuplicatesAnomaliesForSheet()` — Duplikat/Anomali (Checker Berkala) (+38 more)

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
Cohesion: 0.22
Nodes (17): BULAN_ID_, doGet(), doPost(), formatTimestampCell_(), handleDelete_(), handleEdit_(), handleList_(), handleRekapHarian_() (+9 more)

### Community 28 - "Investigasi Konsolidasi Notifikasi ntfy — `report.gs.js`"
Cohesion: 0.15
Nodes (12): 1. Daftar fungsi cek di `report.gs.js` + status pemanggilan `report_kirimNotif_()`, 2. Detail `report_kirimNotif_(pesan, judul)` (L735–763), 3. Status trigger per fungsi cek, 4. Status `doGet()` — data yang sudah/ belum di-expose, 5. Perbandingan dengan pola `notif_total_harian.py`, 6. Status `report-gs-doGet-addition.gs.txt`, 7. Rekomendasi, Estimasi effort Model A (hanya bagian time-based): (+4 more)

### Community 29 - "notif_checker_poller.py"
Cohesion: 0.17
Nodes (18): build_message(), cfg_get(), checker_key(), compute_fingerprint(), fetch_checker_status(), is_dry_run(), main(), _normalize_problem_detail() (+10 more)

### Community 31 - "Report-Harian/script.js"
Cohesion: 0.11
Nodes (22): btnHariIni, btnKemarin, btnRefresh, cacheTimestamps, currentDate, datePicker, emptyMsg, errorMsg (+14 more)

### Community 32 - "Investigasi Mekanisme Ntfy — Pencatatan-Buku-Kas/Apps-Script/buku-kas.gs.js"
Cohesion: 0.05
Nodes (39): 1. Fungsi Pengirim Ntfy: `pola_kirimNotif_(pesan)`, 2.1 `checkPolaTransaksi(tanggalTarget, DRY_RUN)` — GOD NODE #1 (12 edges), 2.2 `checkPolaPagi()` — Trigger 07:00, 2.3 `checkPolaMalam()` — Trigger 21:00, 2.4 Status keterhubungan ketiga fungsi, 2. Detail Lengkap `checkPolaTransaksi()`, `checkPolaPagi()`, `checkPolaMalam()`, 3.1 Direct Callers (2 situs), 3.2 Internal Dependencies (memanggil checkPolaTransaksi / dipanggil oleh checkPolaTransaksi) (+31 more)

### Community 33 - "Detail Logic Pola Transaksi (follow-up)"
Cohesion: 0.13
Nodes (15): 1. Definisi "Pola" yang Dicek, 2. Perbedaan `checkPolaPagi()` vs `checkPolaMalam()`, 3. Sheet dan Kolom yang Dibaca, 4. Peran Masing-Masing Helper Function, 5. Contoh Skenario Hipotetis, Detail Logic Pola Transaksi (follow-up), Eksekusi Fungsi Selama Investigasi (Section Ini), Keputusan Akhir: Kirim atau Tidak (+7 more)

### Community 34 - "Investigasi — Sumber Data "Rekap Pengeluaran Harian" & Struktur Quicknav (Pencatatan-Buku-Kas)"
Cohesion: 0.11
Nodes (17): 1.1.1 `buku-kas.gs.js` (Kas Harian + Riwayat) — endpoint `ENDPOINT_URL`, 1.1.2 `scan-struk.gs` (Scan Struk) — endpoint `SCRIPT_URL`, 1.1.3 `report.gs.js` (Report/Stok) — endpoint `STOK_SCRIPT_URL`, 1.1 Inventaris backend & handler yang return data sheet, 1.2 Apakah ada fungsi yang sudah return tabel "Rekap Pengeluaran Harian"?, 1.3 `config.js` & `shared-utils.js` — fungsi fetch generik yang bisa dipakai ulang?, 1. Sumber Data "Rekap Pengeluaran Harian", 2.1 `nav.js` = 1 komponen shared, dirender DYNAMIC di semua 5 halaman (+9 more)

### Community 35 - "Pendaftaran/script.js"
Cohesion: 0.05
Nodes (40): backBtn, btnLoading, btnText, cardDomisili, cardFotoProfil, cardKode, cardNama, cardSection (+32 more)

### Community 36 - "code.gs.js"
Cohesion: 0.18
Nodes (37): checkAdminPin_(), createAdminSessionToken_(), deleteOrderById_(), doGet(), doGetFormData_(), doGetHadiah_(), doGetLeaderboard_(), doGetMemberByUsername_() (+29 more)

### Community 37 - "Submit/script.js"
Cohesion: 0.04
Nodes (35): btnLoading, btnText, downloadLaporanBtn, errorMsg, formSection, fotoInput, fotoInputCamera, fotoPreview (+27 more)

### Community 38 - "processFotoFile"
Cohesion: 0.40
Nodes (5): clearFotoState(), hideError(), processFotoFile(), resetForm(), showError()

### Community 39 - "showReport"
Cohesion: 0.22
Nodes (9): base64ToBlob(), buildLaporanFileName(), formatStampFile(), formatWaktu(), hideReportError(), hideReportInfo(), pad2(), sanitizeFilePart() (+1 more)

### Community 41 - "applyFormData"
Cohesion: 0.40
Nodes (5): applyFormData(), escapeHtml(), renderKodeList(), renderKodeOptions(), renderMenuList()

### Community 46 - "Member/script.js"
Cohesion: 0.18
Nodes (12): closeDropdown(), fillForm(), hideFormMsg(), loadMemberList(), resetFotoUpload(), selectMember(), setCardPhoto(), setSelectValue() (+4 more)

### Community 47 - "admin-auth.js"
Cohesion: 0.27
Nodes (13): authMode(), clearAuth(), consumeTarget(), currentPageKey(), getCredential(), goToLogin(), isAuthed(), markAuthed() (+5 more)

### Community 48 - "Check-Pesanan/script.js"
Cohesion: 0.15
Nodes (22): addEditItemRow(), buildCardActions(), buildFotoPlaceholder(), buildFotoWrap(), buildItemsList(), buildLegacyCard(), buildReceiptCard(), closeLightbox() (+14 more)

## Knowledge Gaps
- **314 isolated node(s):** `all`, `menuBtn`, `drawer`, `overlay`, `drawerClose` (+309 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `MAO_CONFIG` connect `Check-Pesanan/script.js` to `processFotoFile`, `Pendaftaran/script.js`, `Member/script.js`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Why does `processFotoFile()` connect `processFotoFile` to `Check-Pesanan/script.js`, `Submit/script.js`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `processFotoFile()` connect `Pendaftaran/script.js` to `Check-Pesanan/script.js`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `all`, `menuBtn`, `drawer` to the rest of the system?**
  _314 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Riwayat/script.js` be split into smaller, more focused modules?**
  _Cohesion score 0.044444444444444446 - nodes in this community are weakly interconnected._
- **Should `Pencatatan-Buku-Kas/script.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08817204301075268 - nodes in this community are weakly interconnected._
- **Should `Stok/script.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._