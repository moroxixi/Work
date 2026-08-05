# Graph Report - Work  (2026-08-05)

## Corpus Check
- 14 files · ~18,346 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 235 nodes · 294 edges · 23 communities (17 shown, 6 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0e4423de`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Riwayat/script.js
- Cash Book Recording
- Stok/script.js
- Dashboard UI Components
- Employee Registration Form
- Input Kas Harian Form
- Receipt Scanning Module
- applyFilterAndRenderCards
- Laporan Diagnosis — Baris Kosong Berulang di Sheet "INPUT"
- goToMonth
- kantong.py
- Deployment Scripts
- Setoran Tempura Form
- Main Dashboard View
- User Onboarding Form
- Reminder/script.js
- downloadFileName
- Setoran Wonton Form
- fetchMonthList
- Rekap/script.js

## God Nodes (most connected - your core abstractions)
1. `Laporan Diagnosis — Baris Kosong Berulang di Sheet "INPUT"` - 9 edges
2. `applyFilterAndRenderCards()` - 7 edges
3. `fetchMonthList()` - 7 edges
4. `fetchStok()` - 7 edges
5. `fetchList()` - 6 edges
6. `validateAndGetSeconds()` - 6 edges
7. `3. Temuan Kode Client-Side (Work/Pencatatan-Buku-Kas/)` - 6 edges
8. `renderList()` - 5 edges
9. `refreshCurrent()` - 5 edges
10. `goToMonth()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `Riwayat Kas Harian` --references--> `Input Kas Harian Form`  [EXTRACTED]
  Pencatatan-Buku-Kas/Riwayat/index.html → Pencatatan-Buku-Kas/index.html
- `Scan Struk Belanja` --references--> `Input Kas Harian Form`  [EXTRACTED]
  Pencatatan-Buku-Kas/Scan-Struk/index.html → Pencatatan-Buku-Kas/index.html
- `Sisa Stok Dashboard` --references--> `Input Kas Harian Form`  [EXTRACTED]
  Pencatatan-Buku-Kas/Stok/index.html → Pencatatan-Buku-Kas/index.html

## Import Cycles
- None detected.

## Communities (23 total, 6 thin omitted)

### Community 0 - "Riwayat/script.js"
Cohesion: 0.04
Nodes (41): RFC-4180, allRowsToday, btnBatalEdit, btnBatalHapus, btnBulanIni, btnDownload, btnHariIni, btnKemarin (+33 more)

### Community 1 - "Cash Book Recording"
Cohesion: 0.09
Nodes (27): addToQueue(), belanjaDiLainnyaInput, belanjaDiWrap, form, getSelectedBelanjaDi(), getSelectedKategoriLain(), getSelectedOutlet(), jumlahEl (+19 more)

### Community 2 - "Stok/script.js"
Cohesion: 0.10
Nodes (24): btnHariIni, btnKemarin, btnRefresh, currentDate, datePicker, emptyMsg, errorMsg, fetchStok() (+16 more)

### Community 3 - "Dashboard UI Components"
Cohesion: 0.19
Nodes (13): all, bmGroupHTML(), bmHTML(), cardHTML(), catColor(), catIcon(), drawer, drawerClose (+5 more)

### Community 4 - "Employee Registration Form"
Cohesion: 0.20
Nodes (8): form, hubunganChips, hubunganInput, hubunganLainnya, submitBtn, submitLabel, successMsg, uploadedImages

### Community 5 - "Input Kas Harian Form"
Cohesion: 0.50
Nodes (4): Input Kas Harian Form, Riwayat Kas Harian, Scan Struk Belanja, Sisa Stok Dashboard

### Community 6 - "Receipt Scanning Module"
Cohesion: 0.39
Nodes (5): escapeAttr(), formatRp(), items, renderItems(), updateTotals()

### Community 7 - "applyFilterAndRenderCards"
Cohesion: 0.28
Nodes (9): applyFilterAndRenderCards(), arahTampilan(), formatRupiah(), KATEGORI_MASUK, openDeleteModal(), openEditModal(), populateKategoriSelect(), renderKategoriFilterBar() (+1 more)

### Community 8 - "Laporan Diagnosis — Baris Kosong Berulang di Sheet "INPUT""
Cohesion: 0.09
Nodes (22): 1. Ringkasan Masalah, 2. Lokasi Folder Apps Script "buku-kas", 3.1 Form Kas Harian (`script.js`) — validasi ada, tidak bisa submit kosong, 3.2 Antrean pengiriman (queue) — TIDAK ada auto-retry, tidak bisa spam, 3.3 Halaman Riwayat (`Riwayat/script.js`) — polling hanya GET, interval 10 detik, 3.4 Halaman Scan Struk (`Scan-Struk/script.js`) — ⚠️ TEMUAN PENTING, 3.5 `shared-utils.js` — netral, 3. Temuan Kode Client-Side (Work/Pencatatan-Buku-Kas/) (+14 more)

### Community 10 - "goToMonth"
Cohesion: 0.29
Nodes (8): currentViewKey(), goToDate(), goToMonth(), invalidateCache(), monthKeyOf(), pollMarker(), refreshCurrent(), updateDownloadVisibility()

### Community 17 - "Reminder/script.js"
Cohesion: 0.40
Nodes (8): el, fmtDuration(), getCustomSeconds(), getTimePickerSeconds(), hideStatus(), showStatus(), submitReminder(), validateAndGetSeconds()

### Community 18 - "downloadFileName"
Cohesion: 0.33
Nodes (6): csvEscape(), downloadCsv(), downloadFileName(), formatBulanLabel(), formatBulanNama(), sanitizeFilenamePart()

### Community 21 - "fetchMonthList"
Cohesion: 0.60
Nodes (5): fetchDayRows(), fetchList(), fetchMonthList(), isCacheValid(), setLoading()

### Community 22 - "Rekap/script.js"
Cohesion: 0.16
Nodes (16): allItems, applyFilters(), emptyMsg, errorMsg, fetchItems(), formatRp(), listEl, loadingMsg (+8 more)

## Knowledge Gaps
- **123 isolated node(s):** `all`, `menuBtn`, `drawer`, `overlay`, `drawerClose` (+118 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `all`, `menuBtn`, `drawer` to the rest of the system?**
  _123 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Riwayat/script.js` be split into smaller, more focused modules?**
  _Cohesion score 0.044444444444444446 - nodes in this community are weakly interconnected._
- **Should `Cash Book Recording` be split into smaller, more focused modules?**
  _Cohesion score 0.08817204301075268 - nodes in this community are weakly interconnected._
- **Should `Stok/script.js` be split into smaller, more focused modules?**
  _Cohesion score 0.09538461538461539 - nodes in this community are weakly interconnected._
- **Should `Laporan Diagnosis — Baris Kosong Berulang di Sheet "INPUT"` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._