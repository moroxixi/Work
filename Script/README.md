# Script — Notif Total Harian Sheet "Report 2026"

Poller Python + systemd user timer yang memantau **Total (kolom AB)** di sheet
**"Report 2026"** (gid `794081767`, spreadsheet yang sama dengan
Input_Tempura/Input_Wonton) lewat endpoint `doGet` action `totalHarian` di
`Work/Wonton/Apps-Script/report.gs`.

Alur notif:
- **Sekali sehari jam 22:00 WIB**: fetch webapp, ambil baris tanggal hari ini,
  kirim nilai Total (kolom AB) via ntfy dengan judul "Total Qris hari ini : <angka>".
- Anti-dobel: state file `state/last-sent-date.txt` berisi tanggal terakhir kirim.
- Kalau baris tanggal hari ini belum ada di sheet → log info, tidak kirim notif.

---

## Deploy Manual (WAJIB oleh Rofi — freebuff tidak menjalankan ini)

### 1. Tempel kode ke `report.gs`

Buka `Work/Wonton/Apps-Script/report.gs` di editor Apps Script, lalu tempel isi
`Script/report-gs-doGet-addition.gs.txt` sesuai 3 bagian yang ditandai di file itu:

1. **BAGIAN A** (konstanta) → taruh di area CONFIG (mis. setelah `REPORT_NTFY_URL`).
2. **BAGIAN B** (cabang `action === "totalHarian"`) → di dalam `doGet(e)`, SETELAH
   cabang `"stok"`, SEBELUM `return ContentService...` fallback.
3. **BAGIAN C** (`handleTotalHarian_`) → taruh di bawah (mis. setelah `handleStok_`).

**Ganti `<TOKEN_DI_SINI>`** di BAGIAN A dengan nilai `WEBAPP_TOKEN` dari
`Script/config.local.env` (token-nya tidak ditulis di file ini — cek file
config lokal yang tidak ter-commit). Kalau digenerate ulang, wajib sinkron di
dua tempat: `TOTAL_HARIAN_TOKEN` (report.gs) dan `WEBAPP_TOKEN` (config.local.env).

### 2. Deploy ulang sebagai Web App

Apps Script → **Deploy** → **Manage deployments** → Edit deployment → **New version** → Deploy.
Catat **URL Web App** (format `https://script.google.com/macros/s/.../exec`).

### 3. Isi `config.local.env`

```
cp Script/config.local.env.example Script/config.local.env   # sudah ada, cukup edit
```

Isi `WEBAPP_URL=` dengan URL hasil deploy (tanpa trailing slash, tanpa query).
`WEBAPP_TOKEN` sudah terisi. `NTFY_TOPIC` / `NTFY_BASE_URL` default sudah benar.

### 4. Aktifkan linger (sekali saja, kalau belum aktif)

User timer cuma jalan kalau user-nya "lingered". Cek:

```bash
loginctl show-user moroxixi | grep Linger
```

Kalau hasilnya `Linger=no`:

```bash
loginctl enable-linger moroxixi
```

> ⚠️ Perintah ini TIDAK dijalankan otomatis oleh freebuff — langkah manual Rofi.

### 5. Pasang & aktifkan timer

```bash
cp Script/systemd/notif-total-harian.service Script/systemd/notif-total-harian.timer ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now notif-total-harian.timer
systemctl --user list-timers | grep notif-
```

Cek log kalau perlu:

```bash
systemctl --user status notif-total-harian.service
journalctl --user -u notif-total-harian.service -n 50
```

---

## Testing Tanpa Kirim Notif Sungguhan

Semua network call bisa di-dry-run (tidak ada request keluar):

```bash
cd ~/HomeLab/Work/Script

# Normal — Total terisi, state kosong → kirim
DRY_RUN=1 MOCK_WEBAPP_JSON='{"ok":true,"tanggal":"09/08/2026","total":456,"link":"https://docs.google.com/spreadsheets/d/x/edit?gid=794081767&range=A5"}' \
  python3 notif_total_harian.py

# Skenario skip (state sudah berisi tanggal hari ini)
DRY_RUN=1 MOCK_WEBAPP_JSON='{"ok":true,"total":456}' \
  python3 notif_total_harian.py

# Baris hari ini belum ada di sheet → log saja, tidak kirim
DRY_RUN=1 MOCK_WEBAPP_JSON='{"ok":false,"error":"baris tanggal hari ini belum ada di sheet"}' \
  python3 notif_total_harian.py
```

Hapus state test setelah selesai: `rm -f state/last-sent-date.txt`.

---

## Struktur

```
Script/
├── notif_total_harian.py            # poller (stdlib only, DRY_RUN)
├── config.local.env.example         # template (tracked, value dikosongkan)
├── config.local.env                 # config rahasia (TIDAK di-track)
├── report-gs-doGet-addition.gs.txt  # kode tambahan utk report.gs (referensi)
├── systemd/
│   ├── notif-total-harian.service   # sekali sehari, jam 22:00
│   └── notif-total-harian.timer     # OnCalendar=*-*-* 22:00:00
├── state/                           # runtime state (di-gitignore, .gitkeep saja)
└── README.md
```
