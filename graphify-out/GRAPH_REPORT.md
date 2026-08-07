# Graph Report - Work  (2026-08-07)

## Corpus Check
- 20 files · ~21,660 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 280 nodes · 357 edges · 24 communities (20 shown, 4 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cb5c6584`
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

## God Nodes (most connected - your core abstractions)
1. `hitungRekomendasiProduk()` - 9 edges
2. `Laporan Diagnosis — Baris Kosong Berulang di Sheet "INPUT"` - 9 edges
3. `fetchMonthList()` - 7 edges
4. `fetchStok()` - 7 edges
5. `Playwright Test Suite — Pencatatan-Buku-Kas` - 7 edges
6. `applyFilterAndRenderCards()` - 6 edges
7. `fetchList()` - 6 edges
8. `fetchItems()` - 6 edges
9. `loadRekomendasi()` - 6 edges
10. `validateAndGetSeconds()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `fetchList()` --calls--> `renderList()`  [EXTRACTED]
  Pencatatan-Buku-Kas/Riwayat/script.js → Pencatatan-Buku-Kas/Riwayat/script.js  _Bridges community 10 → community 14_
- `fetchMonthList()` --calls--> `monthKeyOf()`  [EXTRACTED]
  Pencatatan-Buku-Kas/Riwayat/script.js → Pencatatan-Buku-Kas/Riwayat/script.js  _Bridges community 11 → community 14_
- `goToMonth()` --calls--> `formatBulanLabel()`  [EXTRACTED]
  Pencatatan-Buku-Kas/Riwayat/script.js → Pencatatan-Buku-Kas/Riwayat/script.js  _Bridges community 13 → community 11_

## Import Cycles
- None detected.

## Communities (24 total, 4 thin omitted)

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
Cohesion: 0.39
Nodes (5): escapeAttr(), formatRp(), items, renderItems(), updateTotals()

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

## Knowledge Gaps
- **137 isolated node(s):** `all`, `menuBtn`, `drawer`, `overlay`, `drawerClose` (+132 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `all`, `menuBtn`, `drawer` to the rest of the system?**
  _137 weakly-connected nodes found - possible documentation gaps or missing edges._
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