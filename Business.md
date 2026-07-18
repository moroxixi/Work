# Business.md — Sistem Pencatatan Keuangan (Wonton & Mie Jebew, Tempura)

## 1. Konteks Bisnis
- 4 cabang: Wonton (Babakan), Wonton & Mie Jebew (Leweung Gajah), Wonton & Mie Jebew (Depan RS — dikelola eksternal, hanya kirim setoran), Tempura.
- Belanja bahan baku terpusat, tidak dipisah per cabang.
- Tahap akuntansi: **Opsi 1 (Buku Kas Gabungan)** — belum pisah performa per cabang, sengaja ditunda sampai pencatatan harian jadi kebiasaan.

## 2. Aturan Akuntansi Tetap
- Modal kembalian (±Rp200rb/hari) → netral, **tidak dicatat sama sekali**.
- "Penjualan" di Buku Kas Gabungan = omset bersih (uang dibawa pulang − modal kembalian).
- Skema kirim data setoran → Buku Kas Gabungan = **Gross** (Omset penuh sbg Masuk, Gaji/Pengeluaran/dll sbg Keluar terpisah), bukan Net — supaya QRIS/Gofood tetap tercatat sebagai omset, bukan hilang.

## 3. Formula Wajib Setor (jangan disamakan antar cabang)
**Tempura:**
`Wajib Setor = Omset Kotor − (QRIS+Gaji+Pengeluaran) + (Uang Modal+Sterofoam)`
- Sterofoam = penambah. "Omset" Tempura = kotor mentah.

**Wonton:**
`Wajib Setor = Omset Kotor − (QRIS+Gofood+Gaji+Pengeluaran+Uang Jajan+Dimakan) + Uang Modal`
- Tidak ada Sterofoam. "Omset" Wonton sudah dikurangi Dimakan (beda definisi dari Tempura, jangan dibandingkan langsung).

**Semua cabang:** `Selisih = Uang Tunai fisik − Wajib Setor` → status PAS/KURANG/LEBIH.

## 4. Struktur Spreadsheet & Sheet

**Buku Kas Gabungan** (ID `15MZYZOhqY2dTGBeZoAe1yqwJWTh43e9qPdgotM4DuCM`)
- `Input` — log mentah: Timestamp, Keterangan, Kategori, Belanja Di, Jumlah (Rp). Tanggal = `INT(Timestamp)`, tidak ada kolom Tanggal terpisah.
- `Buku Kas Harian` — baca dari Input via formula, saldo running balance otomatis.
- `Rekap Bulanan` — pakai `SUMIFS` by tanggal (jangan ganti ke `SUMPRODUCT+MONTH/YEAR`, pernah error kalau ada baris kosong).

**Setoran Harian** (spreadsheet terpisah)
- `Input_Tempura`, `Input_Wonton` — satu Web App/`SCRIPT_URL` sama, dibedakan field `tipe` di payload.

**Data Harga Belanja** (spreadsheet terpisah, dari Scan Struk)
- `Input Harga Belanja` — raw hasil scan.
- `Riwayat Harga` — log + kolom Harga Sebelumnya/Status/Selisih (formula; locale spreadsheet pakai `;` bukan `,` sebagai pemisah argumen — kecuali koma di dalam string `QUERY`).
- `Katalog Toko` — rekap 1 baris per Toko+Barang.

**Data_Karyawan** — dari form onboarding karyawan.

## 5. Kategori Transaksi (sheet `Input`)
- **Masuk:** Setoran Cabang Tempura/Babakan/Leweung Gajah (otomatis), Sterofoam Tempura (otomatis), MAO Frozen, MAO Instan, Outlet, Lainnya.
- **Keluar:** Belanja, Gaji/Upah (otomatis+manual), Sewa Tempat, Tunjangan, Bonus, Parkir, Dividen, Pengeluaran Operasional (otomatis), Uang Jajan Karyawan (otomatis).

**Kategori "Outlet" — 2 kegunaan, jangan tertukar:**
- **A. Fallback darurat** kalau `kirimKeBukuKas()` gagal — wajib cek dulu `Input_Tempura`/`Input_Wonton` + histori alert Telegram sebelum input manual (hindari dobel hitung).
- **B. Jalur reguler Setoran Cabang Depan RS** (tidak punya form otomatis) — langsung manual, tanpa perlu prosedur cek di atas.

**Kenapa "Sterofoam Tempura" bukan "Sterofoam":** formula whitelist `REGEXMATCH` kolom Masuk cari kata `Tempura|Babakan|Leweung Gajah|RS` dst — nama kategori sengaja mengandung `Tempura` biar otomatis kehitung Masuk tanpa ubah formula.

**Dua jalur entri ke `Input`:**
1. Otomatis via `kirimKeBukuKas()` saat submit form setoran.
2. Manual via `index.html` — untuk kategori tanpa jalur otomatis. Hati-hati `Gaji/Upah` bisa lewat 2 jalur — cek dulu sebelum input manual supaya tidak dobel.

## 6. Apa yang Dikirim dari Form Setoran → Buku Kas (skema Gross)

| Data | Dikirim? | Kategori Buku Kas |
|---|---|---|
| Omset Tempura | ✅ Masuk | Setoran Cabang Tempura |
| Sterofoam | ✅ Masuk | Sterofoam Tempura |
| Omset Wonton (net Dimakan) | ✅ Masuk | Setoran Cabang Babakan/Leweung Gajah (deteksi huruf pertama field `cabang`) |
| Gaji | ✅ Keluar | Gaji/Upah |
| Pengeluaran | ✅ Keluar | Pengeluaran Operasional |
| Uang Jajan | ✅ Keluar | Uang Jajan Karyawan |
| Uang Modal, Dimakan | ❌ | netral / bukan transaksi kas |
| QRIS, Gofood | ❌ | sudah termasuk dalam Omset, jangan dikirim lagi (dobel) |
| Uang Tunai, Wajib Setor, Selisih, Status | ❌ | hanya tersimpan di `Input_Tempura`/`Input_Wonton` untuk audit |

Nominal 0 tidak dikirim (skip). Cabang Wonton yang tidak terdeteksi (bukan huruf B/L) → tidak ditebak, alert Telegram, input manual.

## 7. Fitur-Fitur Aktif

- **Form Kas Harian** (`index.html`) — input manual kategori di atas, chip UI, satu radio group `kategoriUtama` dibedakan `data-arah="masuk"/"keluar"`.
- **Setoran Tempura/Wonton** (`setoran-tempura.html`, `setoran-wonton.html`) — hitung per item, tombol "CEK HASIL" sebelum submit, kirim otomatis ke Buku Kas via `kirimKeBukuKas()`.
- **Formulir Onboarding Karyawan** (`formulir-karyawan.html`) — data pribadi + motivasi kerja + kontak darurat. Foto disimpan ke Google Drive (bukan embed sel — limit 1MP/2MB), link via `HYPERLINK`.
- **Scan Struk Belanja** (`Scan-Struk/index.html`) — foto struk → OCR Gemini → preview editable → simpan ke `Input Harga Belanja`.
  - Model aktif: `gemini-3.5-flash`.
  - Multi-API-key fallback: 6 key (`GEMINI_API_KEY_1..6`), fallback berurutan kalau error retryable (429/503/quota/overload).
  - Deteksi duplikat otomatis: skip kalau kombinasi Toko+Barang+Harga sudah pernah tersimpan.
- **Riwayat Harga & Katalog Toko** — rekap formula dari `Input Harga Belanja`, sudah jalan normal.
- **Riwayat Kas Harian** (`Riwayat/index.html`) — lihat/edit/hapus transaksi `Input` per tanggal dari HP. Live update via `onChange` trigger (polling 10 detik). Badge proteksi: merah = otomatis dari setoran (blokir/peringatan tegas), kuning = "cek dulu" (khusus Gaji/Upah).

## 8. Kebiasaan Teknis (Wajib Diingat)
- Edit `Code.gs` → **selalu** ingatkan Deploy ulang (New version) — URL lama tidak auto-update.
- Form kas awal pakai `mode:"no-cors"` → selalu tampil "Tersimpan ✓" walau gagal di server. Debug "data tidak masuk" → cek Executions log, bukan pesan sukses di form.
- Form yang perlu baca response (Scan Struk, Riwayat) pakai `Content-Type: text/plain;charset=utf-8` (hindari CORS preflight yang tidak didukung Apps Script).
- Semua form dioptimalkan iPhone: font input 16px (cegah auto-zoom), touch target ≥40px, `env(safe-area-inset)` — pertahankan di semua perubahan UI.
- Hosting semua form: GitHub Pages repo `Work`, folder `Pencatatan-Buku-Kas/` (`index.html`, `Scan-Struk/`, `Riwayat/`). Push via `work-push.sh`.

## 9. Yang Masih Perlu Ditest/Dikerjakan
- [x] Scan Struk: test fallback 6 API key end-to-end dengan key asli.
- [x] Scan Struk: cek fetch `text/plain` tidak kena CORS error di HP.
- [x] Scan Struk: cek model `gemini-3.5-flash` masih valid (kalau 404, cek nama model terbaru di aistudio.google.com).
- [x] Deteksi duplikat harga: belum ditest dengan data riil.
- [ ] Riwayat Kas Harian: belum ditest end-to-end — perlu deploy ulang `Code.gs`, jalankan `setupOnChangeTrigger()` sekali, upload ke GitHub Pages, lalu coba edit/hapus data asli.
- [ ] Kas Harian form: bug Outlet sub-pilihan & Lainnya belum ke-fix, redesign Uang Keluar (Belanja fokus utama) belum jalan — masih nunggu jawaban 3 pertanyaan (lokasi nama custom Lainnya di sheet, Belanja auto-select atau tidak, apakah 6 sub-kategori Lainnya final).


