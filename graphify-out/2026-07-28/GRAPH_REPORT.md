# Graph Report - .  (2026-07-28)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 162 nodes · 199 edges · 17 communities (13 shown, 4 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.5)
- Token cost: 578 input · 163 output

## Graph Freshness
- Built from commit: `9f0b883e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Transaction History UI
- Cash Book Recording
- Stock Inventory Tracking
- Dashboard UI Components
- Employee Registration Form
- Accounting Backend System
- Receipt Scanning Module
- List Filtering Logic
- Date Navigation Helpers
- API Data Fetching
- Category Modal Management
- Deployment Scripts
- Business Context Overview
- Main Dashboard View
- User Onboarding Form

## God Nodes (most connected - your core abstractions)
1. `applyFilterAndRenderCards()` - 7 edges
2. `fetchStok()` - 6 edges
3. `fetchList()` - 5 edges
4. `renderQueue()` - 5 edges
5. `cardHTML()` - 4 edges
6. `render()` - 4 edges
7. `bmHTML()` - 4 edges
8. `renderList()` - 4 edges
9. `refreshCurrent()` - 4 edges
10. `goToDate()` - 4 edges

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

## Communities (17 total, 4 thin omitted)

### Community 0 - "Transaction History UI"
Cohesion: 0.05
Nodes (34): allRowsToday, btnBatalEdit, btnBatalHapus, btnHariIni, btnKemarin, btnKonfirmHapus, btnRefresh, btnSimpanEdit (+26 more)

### Community 1 - "Cash Book Recording"
Cohesion: 0.09
Nodes (27): addToQueue(), belanjaDiLainnyaInput, belanjaDiWrap, form, getSelectedBelanjaDi(), getSelectedKategoriLain(), getSelectedOutlet(), jumlahEl (+19 more)

### Community 2 - "Stock Inventory Tracking"
Cohesion: 0.11
Nodes (24): btnHariIni, btnKemarin, btnRefresh, currentDate, datePicker, emptyMsg, errorMsg, escapeHtml() (+16 more)

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

### Community 7 - "List Filtering Logic"
Cohesion: 0.47
Nodes (6): applyFilterAndRenderCards(), escapeHtml(), formatRupiah(), openDeleteModal(), renderKategoriFilterBar(), renderList()

### Community 8 - "Date Navigation Helpers"
Cohesion: 0.40
Nodes (5): formatTanggalLabel(), goToDate(), pollMarker(), refreshCurrent(), toDateInputValue()

### Community 9 - "API Data Fetching"
Cohesion: 0.50
Nodes (4): fetchList(), formatTanggalApi(), isSameDate(), setLoading()

### Community 10 - "Category Modal Management"
Cohesion: 0.67
Nodes (3): KATEGORI_MASUK, openEditModal(), populateKategoriSelect()

## Knowledge Gaps
- **88 isolated node(s):** `all`, `menuBtn`, `drawer`, `overlay`, `drawerClose` (+83 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `all`, `menuBtn`, `drawer` to the rest of the system?**
  _88 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Transaction History UI` be split into smaller, more focused modules?**
  _Cohesion score 0.05405405405405406 - nodes in this community are weakly interconnected._
- **Should `Cash Book Recording` be split into smaller, more focused modules?**
  _Cohesion score 0.08817204301075268 - nodes in this community are weakly interconnected._
- **Should `Stock Inventory Tracking` be split into smaller, more focused modules?**
  _Cohesion score 0.10666666666666667 - nodes in this community are weakly interconnected._