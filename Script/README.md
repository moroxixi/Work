# Script — Notif Kolom Z (Bbkn) / Total Harian Sheet "Report 2026"

Poller Python + systemd user timer yang memantau kolom **Z (Bbkn)** dan **AB (Total)**
di sheet **"Report 2026"** (gid `794081767`, spreadsheet yang sama dengan
Input_Tempura/Input_Wonton) lewat endpoint `doGet` action `totalHarian` di
`Work/Wonton/Apps-Script/report.gs`.

Alur notif:
- **cek-z** (tiap 15 menit, gating window di dalam script): kalau sekarang
  21:30–23:00 WIB **dan** kolom Z sudah terisi → kirim notif ntfy "Kolom Bbkn Terisi"
  (sekali per hari).
- **fallback-2300** (jam 23:00): kalau sampai jam 23:00 kolom Z belum terisi →
  kirim notif "Rekap Jam 23:00 (Kolom Z belum terisi)" + total apa adanya.
- Anti-dobel: state file `state/last-sent-date.txt` berisi tanggal terakhir kirim.

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
cp Script/systemd/*.service Script/systemd/*.timer ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now notif-cek-kolom-z.timer notif-fallback-2300.timer
systemctl --user list-timers | grep notif-
```

Cek log kalau perlu:

```bash
systemctl --user status notif-cek-kolom-z.service
journalctl --user -u notif-cek-kolom-z.service -n 50
```

---

## Testing Tanpa Kirim Notif Sungguhan

Semua network call bisa di-dry-run (tidak ada request keluar):

```bash
cd ~/HomeLab/Work/Script

# Cek-z di dalam window (mock waktu 22:00 WIB) + mock response kolom Z terisi
DRY_RUN=1 MOCK_NOW="2026-08-09T22:00:00+07:00" \
  MOCK_WEBAPP_JSON='{"ok":true,"tanggal":"09/08/2026","kolomZ":123,"total":456,"link":"https://docs.google.com/spreadsheets/d/x/edit?gid=794081767&range=A5"}' \
  python3 notif_total_harian.py --mode cek-z

# Skenario skip (state sudah berisi tanggal hari ini)
DRY_RUN=1 MOCK_NOW="2026-08-09T22:30:00+07:00" MOCK_WEBAPP_JSON='{"ok":true,"kolomZ":1,"total":2}' \
  python3 notif_total_harian.py --mode cek-z

# Fallback 23:00 (state kosong -> kirim; state terisi -> skip)
DRY_RUN=1 MOCK_NOW="2026-08-09T23:00:00+07:00" MOCK_WEBAPP_JSON='{"ok":true,"total":999,"link":"x"}' \
  python3 notif_total_harian.py --mode fallback-2300

# Di luar window (harus exit 0 tanpa efek)
DRY_RUN=1 MOCK_NOW="2026-08-09T10:00:00+07:00" MOCK_WEBAPP_JSON='{"ok":true,"kolomZ":1}' \
  python3 notif_total_harian.py --mode cek-z
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
│   ├── notif-cek-kolom-z.service    # --mode cek-z
│   ├── notif-cek-kolom-z.timer      # tiap 15 menit
│   ├── notif-fallback-2300.service  # --mode fallback-2300
│   └── notif-fallback-2300.timer    # jam 23:00
├── state/                           # runtime state (di-gitignore, .gitkeep saja)
└── README.md
```
