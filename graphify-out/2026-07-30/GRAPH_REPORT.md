# Graph Report - Work  (2026-07-29)

## Corpus Check
- 13 files · ~17,322 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 178 nodes · 217 edges · 18 communities (14 shown, 4 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c36f86d7`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Riwayat/script.js
- Cash Book Recording
- Stok/script.js
- Dashboard UI Components
- Employee Registration Form
- Accounting Backend System
- Receipt Scanning Module
- applyFilterAndRenderCards
- fetchList
- Category Modal Management
- Deployment Scripts
- Business Context Overview
- Main Dashboard View
- User Onboarding Form
- Reminder/script.js

## God Nodes (most connected - your core abstractions)
1. `fetchStok()` - 7 edges
2. `applyFilterAndRenderCards()` - 6 edges
3. `validateAndGetSeconds()` - 6 edges
4. `fetchList()` - 5 edges
5. `renderQueue()` - 5 edges
6. `submitReminder()` - 5 edges
7. `cardHTML()` - 4 edges
8. `render()` - 4 edges
9. `bmHTML()` - 4 edges
10. `renderList()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `Input Kas Harian Form` --calls--> `Apps Script Backend`  [EXTRACTED]
  Pencatatan-Buku-Kas/index.html → Aturan-Business.md
- `Setoran Tempura Form` --calls--> `Apps Script Backend`  [EXTRACTED]
  Tempura/index.html → Aturan-Business.md
- `Setoran Wonton Form` --calls--> `Apps Script Backend`  [EXTRACTED]
  Wonton/index.html → Aturan-Business.md
- `Apps Script Backend` --references--> `Buku Kas Spreadsheet`  [EXTRACTED]
  Aturan-Business.md → Business.md
- `Riwayat Kas Harian` --references--> `Input Kas Harian Form`  [EXTRACTED]
  Pencatatan-Buku-Kas/Riwayat/index.html → Pencatatan-Buku-Kas/index.html

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **MAO Group Digital Ecosystem** — pencatatan_buku_kas_index, tempura_index, wonton_index, pencatatan_buku_kas_scan_struk, pencatatan_buku_kas_riwayat, pencatatan_buku_kas_stok [EXTRACTED 0.90]
- **Daily Financial Reporting Flow** — tempura_index, wonton_index, google_apps_script_code, google_sheets_buku_kas [EXTRACTED 0.95]

## Communities (18 total, 4 thin omitted)

### Community 0 - "Riwayat/script.js"
Cohesion: 0.05
Nodes (36): allRowsToday, btnBatalEdit, btnBatalHapus, btnHariIni, btnKemarin, btnKonfirmHapus, btnRefresh, btnSimpanEdit (+28 more)

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

### Community 5 - "Accounting Backend System"
Cohesion: 0.22
Nodes (9): Accounting Rules, Apps Script Backend, Buku Kas Spreadsheet, Input Kas Harian Form, Riwayat Kas Harian, Scan Struk Belanja, Sisa Stok Dashboard, Setoran Tempura Form (+1 more)

### Community 6 - "Receipt Scanning Module"
Cohesion: 0.39
Nodes (5): escapeAttr(), formatRp(), items, renderItems(), updateTotals()

### Community 7 - "applyFilterAndRenderCards"
Cohesion: 0.60
Nodes (5): applyFilterAndRenderCards(), formatRupiah(), openDeleteModal(), renderKategoriFilterBar(), renderList()

### Community 8 - "fetchList"
Cohesion: 0.29
Nodes (7): fetchList(), goToDate(), invalidateCache(), isCacheValid(), pollMarker(), refreshCurrent(), setLoading()

### Community 10 - "Category Modal Management"
Cohesion: 0.67
Nodes (3): KATEGORI_MASUK, openEditModal(), populateKategoriSelect()

### Community 17 - "Reminder/script.js"
Cohesion: 0.40
Nodes (8): el, fmtDuration(), getCustomSeconds(), getTimePickerSeconds(), hideStatus(), showStatus(), submitReminder(), validateAndGetSeconds()

## Knowledge Gaps
- **93 isolated node(s):** `all`, `menuBtn`, `drawer`, `overlay`, `drawerClose` (+88 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `all`, `menuBtn`, `drawer` to the rest of the system?**
  _93 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Riwayat/script.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Cash Book Recording` be split into smaller, more focused modules?**
  _Cohesion score 0.08817204301075268 - nodes in this community are weakly interconnected._
- **Should `Stok/script.js` be split into smaller, more focused modules?**
  _Cohesion score 0.09538461538461539 - nodes in this community are weakly interconnected._