# Progres Sistem Pencatatan Keuangan — Wonton, Mie Jebew & Tempura

Dokumen ini merangkum apa yang sudah dikerjakan sejauh ini sebagai referensi progres proyek.

## 1. Konteks Bisnis

- 4 cabang street food: 2x Wonton & Mie Jebew, 1x Wonton, 1x Tempura.
- Satu cabang Wonton & Mie Jebew dikelola pihak eksternal — pemilik hanya menerima total setoran hasil penjualan, tanpa visibilitas operasional.
- Semua belanja bahan baku dilakukan terpusat oleh pemilik dalam transaksi gabungan (tidak dipisah per cabang saat belanja).
- Pemilik punya waktu terbatas untuk pencatatan detail, sehingga sistem harus low-maintenance.

## 2. Pendekatan Akuntansi yang Dipilih

Dari beberapa opsi yang dibahas, disepakati mulai dari **Opsi 1: Buku Kas Gabungan**:

- Semua cabang (termasuk cabang eksternal) diperlakukan sementara sebagai **satu kesatuan kas**.
- Uang masuk = semua penjualan cabang yang dikelola sendiri + setoran dari cabang eksternal.
- Uang keluar = semua belanja & biaya operasional, tanpa dipilah per cabang.
- Kelemahan: belum bisa lihat performa per cabang. Ini disadari dan diterima untuk tahap awal.
- Opsi lanjutan (alokasi belanja per cabang via piutang/talangan) didokumentasikan untuk dipakai nanti setelah pencatatan harian jadi kebiasaan (~2-4 minggu).

### Catatan penting: Modal Kembalian (Floating Cash)
- Modal kembalian ±Rp200.000 yang disiapkan tiap pagi untuk karyawan **bukan pendapatan** dan tidak dicatat sebagai Uang Masuk.
- Karena modal ini ditarik balik tiap hari (diberi pagi, ditarik sore), pergerakannya **tidak perlu dicatat sama sekali** di buku kas — dampaknya netral (keluar-masuk sama besar).
- Yang dicatat sebagai kategori "Penjualan" adalah **omset bersih** = uang tunai dibawa pulang dikurangi modal kembalian.

## 3. Struktur Spreadsheet (Google Sheets)

File: `Buku_Kas_Harian_Gabungan.xlsx` (dipakai sebagai Google Sheet setelah di-upload & dibuka dengan Google Sheets).

| Sheet | Fungsi |
|---|---|
| **Petunjuk** | Panduan pemakaian & penjelasan kategori |
| **Input** | Log mentah, terisi otomatis dari form HTML lewat Apps Script. Kolom: Timestamp, Keterangan, Kategori, Belanja Di, Jumlah (Rp) |
| **Buku Kas Harian** | Otomatis membaca dari sheet Input via formula. Tanggal diambil dari `INT(Timestamp)` — tidak ada kolom Tanggal terpisah. Kolom Saldo terhitung otomatis (running balance) |
| **Rekap Bulanan** | Otomatis merangkum total Uang Masuk, Uang Keluar, dan Laba/Rugi Kotor per bulan dari sheet Buku Kas Harian (pakai `SUMIFS` dengan rentang tanggal, bukan `SUMPRODUCT`+`MONTH`/`YEAR` supaya tidak error kalau ada baris kosong) |

### Kategori Transaksi
**Uang Masuk:**
- Penjualan
- Setoran Cabang Tempura
- Setoran Cabang Babakan
- Setoran Cabang Leweung Gajah
- Setoran Cabang Depan RS

**Uang Keluar:**
- Belanja
- Gaji/Upah
- Sewa Tempat
- Tunjangan
- Bonus

## 4. Form Input (HTML/CSS/JS)

Tiga file terpisah: `index.html`, `style.css`, `script.js`.

**Desain:**
- Dua kartu terpisah: **Uang Masuk** (aksen hijau) dan **Uang Keluar** (aksen terracotta), masing-masing berisi kategori dalam bentuk **chip/checklist** (bukan dropdown) — minim klik.
- Field **"Belanja di"** muncul otomatis hanya saat kategori "Belanja" dipilih, berupa daftar chip toko (Ayam Ma'mun, Ayam Depan Pasar, Ayam Bi Warsih, Kulit Pangsit, Plastik Pasar, Plastik DA, Sayur, Mini Frozen, Ngena-Q Frozen, Mega Frozen) + opsi "Toko lain…" untuk input manual.
- Field **Keterangan** bersifat **opsional** (kategori sudah cukup jelas sebagai identitas transaksi).
- Field **Jumlah (Rp)** dengan format ribuan otomatis saat mengetik.
- Timestamp tercatat otomatis saat submit — tidak perlu diisi manual.
- Dioptimalkan untuk iPhone: `viewport-fit=cover`, `env(safe-area-inset)`, font input 16px (mencegah auto-zoom iOS), touch target ≥40px.
- Tetap nyaman dipakai di laptop (max-width 460px, center-aligned).

## 5. Integrasi Google Apps Script (`Code.gs`)

- Berfungsi sebagai backend penerima data dari form, di-deploy sebagai **Web App** dari dalam Google Sheet (Extensions → Apps Script).
- `doPost(e)` menerima JSON dari form, lalu `appendRow()` ke sheet **Input**.
- Deployment: Execute as **Me**, Who has access **Anyone**.
- Endpoint sudah aktif: `https://script.google.com/macros/s/AKfycbxQV9SiURK5bKibxzoUOr0pm1OdFFdUsoW1kQdiA4TVcJ6baGqgc6lhJIB9XYZ7cRjj/exec`
- **Penting:** setiap edit `Code.gs`, harus **Deploy ulang** (Manage deployments → Edit → New version → Deploy) supaya perubahan aktif di URL yang sama.

### Catatan Teknis: `mode: "no-cors"`
- Fetch dari form ke Apps Script pakai `mode: "no-cors"` karena Apps Script tidak mengirim header CORS di responsnya.
- Konsekuensi: browser **selalu** menampilkan pesan sukses di form, walau sebenarnya request bisa saja gagal di sisi server.
- Cara verifikasi data benar-benar masuk: cek langsung sheet **Input**, atau cek log **Executions** di Apps Script editor.

## 6. Troubleshooting Data Tidak Masuk ke Sheet

Checklist yang sudah disusun kalau form bilang "Tersimpan ✓" tapi data tidak muncul di sheet:
1. Buka URL Web App langsung di browser — harus muncul "Form endpoint aktif...", bukan halaman login Google.
2. Cek menu **Executions** di Apps Script editor untuk lihat log error (atau ketiadaan log = request tidak sampai).
3. Pastikan sudah **Deploy ulang** (New version) setelah edit kode — URL lama tidak otomatis ambil kode baru.
4. Pastikan `SHEET_NAME` di `Code.gs` sama persis dengan nama tab di spreadsheet (case-sensitive).
5. Pastikan Apps Script dibuka dari **dalam** spreadsheet (Extensions → Apps Script), bukan project standalone terpisah — karena kode pakai `SpreadsheetApp.getActiveSpreadsheet()`.

## 7. Perubahan Struktur: Menghapus Kolom Tanggal Terpisah

- Awalnya sheet Input punya kolom Tanggal terpisah dari Timestamp — dianggap mubazir.
- **Fix:** kolom Tanggal dihapus dari sheet Input. Sheet Buku Kas Harian sekarang mengambil tanggal dengan formula `INT(Timestamp)` untuk membuang bagian jam.
- `Code.gs` dan `script.js` disesuaikan — payload form tidak lagi mengirim field `tanggal` terpisah, cukup `timestamp`.

## 8. Version Control (GitHub)

- Folder kerja: `/home/moroxixi/HomeLab/Work`.
- Dibuatkan script `work-push.sh` (adaptasi dari `homelab-push.sh` yang sudah ada sebelumnya) untuk auto commit & push:
  - Cek SSH agent aktif.
  - Cek syntax semua file `.py` sebelum commit (push dibatalkan kalau ada `SyntaxError`).
  - Skip kalau tidak ada perubahan.
  - `git add -A` → commit → `git push origin main`.
  - Log ke `push.log` + notifikasi desktop via `notify-send`.
- Panduan setup SSH key (`ssh-keygen`, `ssh-agent`, daftar public key ke GitHub, ganti remote ke URL SSH) sudah diberikan supaya push tidak perlu password manual tiap kali.

## 9. Yang Masih Perlu Dikerjakan / Dipantau

- [x] Pastikan hasil rebuild sheet (kolom Tanggal dihapus dari Input) sudah di-upload ulang ke Google Sheets, dan data lama (kalau ada) dipindahkan/dibackup dulu.
- [x] Pastikan `Code.gs` versi terbaru sudah di-deploy ulang di Apps Script.
- [x] Pastikan `script.js` versi terbaru (tanpa field `tanggal`, Keterangan tidak wajib) sudah dipakai di form yang aktif.
- [x] Verifikasi end-to-end: submit dari form → cek data masuk ke sheet Input → cek Buku Kas Harian & Rekap Bulanan terhitung benar.
- [ ] Setelah pencatatan harian jadi kebiasaan (~2-4 minggu), evaluasi apakah sudah siap naik ke Opsi 2/3 (pemisahan biaya per cabang, sistem piutang untuk cabang eksternal).

## 10. Update — Redesign Form & Simplifikasi Sheet

- **Form input dirombak total**: dari dropdown jadi checklist chip, dipisah 2 kartu terpisah
  (Uang Masuk aksen hijau, Uang Keluar aksen terracotta) — minim klik, lebih nyaman dipakai
  satu tangan di iPhone.
- **Kolom Tanggal dihapus** dari sheet Input — dianggap redundan karena Timestamp sudah
  mengandung tanggal. Sheet Buku Kas Harian sekarang pakai formula `INT(Timestamp)` untuk
  ambil tanggal saja.
- **Field Keterangan jadi opsional** — kategori transaksi sudah cukup jelas sebagai identitas,
  jadi tidak wajib diisi lagi.
- **Endpoint Apps Script sudah aktif dan terpasang** di `script.js`, form siap dites langsung
  ke sheet.
- **Version control**: dibuat `work-push.sh` untuk auto commit & push folder kerja ke GitHub,
  plus setup SSH key supaya push tidak perlu password manual.
