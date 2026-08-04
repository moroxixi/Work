# Graph Report - Work  (2026-08-02)

## Corpus Check
- 12 files · ~15,259 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 193 nodes · 247 edges · 21 communities (15 shown, 6 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a4436fcd`
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
- fetchMonthList
- openEditModal
- goToMonth
- kantong.py
- Deployment Scripts
- Setoran Tempura Form
- Main Dashboard View
- User Onboarding Form
- Reminder/script.js
- downloadFileName
- Setoran Wonton Form

## God Nodes (most connected - your core abstractions)
1. `fetchMonthList()` - 7 edges
2. `fetchStok()` - 7 edges
3. `applyFilterAndRenderCards()` - 6 edges
4. `fetchList()` - 6 edges
5. `validateAndGetSeconds()` - 6 edges
6. `renderList()` - 5 edges
7. `refreshCurrent()` - 5 edges
8. `goToMonth()` - 5 edges
9. `renderQueue()` - 5 edges
10. `submitReminder()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `Riwayat Kas Harian` --references--> `Input Kas Harian Form`  [EXTRACTED]
  Pencatatan-Buku-Kas/Riwayat/index.html → Pencatatan-Buku-Kas/index.html
- `Scan Struk Belanja` --references--> `Input Kas Harian Form`  [EXTRACTED]
  Pencatatan-Buku-Kas/Scan-Struk/index.html → Pencatatan-Buku-Kas/index.html
- `Sisa Stok Dashboard` --references--> `Input Kas Harian Form`  [EXTRACTED]
  Pencatatan-Buku-Kas/Stok/index.html → Pencatatan-Buku-Kas/index.html

## Import Cycles
- None detected.

## Communities (21 total, 6 thin omitted)

### Community 0 - "Riwayat/script.js"
Cohesion: 0.05
Nodes (40): RFC-4180, allRowsToday, btnBatalEdit, btnBatalHapus, btnBulanIni, btnDownload, btnHariIni, btnKemarin (+32 more)

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

### Community 7 - "fetchMonthList"
Cohesion: 0.31
Nodes (10): applyFilterAndRenderCards(), fetchDayRows(), fetchList(), fetchMonthList(), formatRupiah(), isCacheValid(), openDeleteModal(), renderKategoriFilterBar() (+2 more)

### Community 8 - "openEditModal"
Cohesion: 0.67
Nodes (3): KATEGORI_MASUK, openEditModal(), populateKategoriSelect()

### Community 10 - "goToMonth"
Cohesion: 0.29
Nodes (8): currentViewKey(), goToDate(), goToMonth(), invalidateCache(), monthKeyOf(), pollMarker(), refreshCurrent(), updateDownloadVisibility()

### Community 17 - "Reminder/script.js"
Cohesion: 0.40
Nodes (8): el, fmtDuration(), getCustomSeconds(), getTimePickerSeconds(), hideStatus(), showStatus(), submitReminder(), validateAndGetSeconds()

### Community 18 - "downloadFileName"
Cohesion: 0.33
Nodes (6): csvEscape(), downloadCsv(), downloadFileName(), formatBulanLabel(), formatBulanNama(), sanitizeFilenamePart()

## Knowledge Gaps
- **95 isolated node(s):** `all`, `menuBtn`, `drawer`, `overlay`, `drawerClose` (+90 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fetchMonthList()` connect `fetchMonthList` to `Riwayat/script.js`, `goToMonth`?**
  _High betweenness centrality (0.000) - this node is a cross-community bridge._
- **Why does `applyFilterAndRenderCards()` connect `fetchMonthList` to `Riwayat/script.js`, `openEditModal`?**
  _High betweenness centrality (0.000) - this node is a cross-community bridge._
- **What connects `all`, `menuBtn`, `drawer` to the rest of the system?**
  _95 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Riwayat/script.js` be split into smaller, more focused modules?**
  _Cohesion score 0.045454545454545456 - nodes in this community are weakly interconnected._
- **Should `Cash Book Recording` be split into smaller, more focused modules?**
  _Cohesion score 0.08817204301075268 - nodes in this community are weakly interconnected._
- **Should `Stok/script.js` be split into smaller, more focused modules?**
  _Cohesion score 0.09538461538461539 - nodes in this community are weakly interconnected._